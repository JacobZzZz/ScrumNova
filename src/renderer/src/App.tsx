import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type {
  Board,
  Card,
  CardOrderPatch,
  CardSource,
  CardStatus,
  CreateBoardInput,
  CreateCardInput,
  SearchResultItem,
  SourceConfig,
  UpdateBoardInput
} from '@shared/types'
import { BOARD_COLUMNS, FALLBACK_SOURCES, type SourceFilter } from './constants'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BacklogDrawer } from './components/BacklogDrawer'
import { KanbanColumn } from './components/KanbanColumn'
import { CardItem } from './components/CardItem'
import { CardDetailDrawer } from './components/CardDetailDrawer'
import { NewCardModal } from './components/NewCardModal'
import { GlobalSearchModal } from './components/GlobalSearchModal'
import { ArchiveDrawer } from './components/ArchiveDrawer'
import { SettingsModal } from './components/SettingsModal'

function findCardStatus(id: UniqueIdentifier, list: Card[]): CardStatus | null {
  const str = String(id)
  if (str.startsWith('column-')) {
    return str.slice('column-'.length) as CardStatus
  }
  return list.find((c) => c.id === str)?.status ?? null
}

export default function App() {
  const [boards, setBoards] = useState<Board[]>([])
  const [sources, setSources] = useState<SourceConfig[]>(FALLBACK_SOURCES)
  const [activeBoardId, setActiveBoardId] = useState<string>('')
  const [cards, setCards] = useState<Card[]>([])
  const [archivedCount, setArchivedCount] = useState(0)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [backlogOpen, setBacklogOpen] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [newCardModalOpen, setNewCardModalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [isBoardPanning, setIsBoardPanning] = useState(false)

  const activeBoardIdRef = useRef('')
  activeBoardIdRef.current = activeBoardId

  const boardMainRef = useRef<HTMLElement | null>(null)
  const inertiaRafRef = useRef<number | null>(null)
  const boardPanRef = useRef({
    active: false,
    panning: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    startScrollLeft: 0
  })

  const cardsRef = useRef<Card[]>([])
  cardsRef.current = cards
  const dragSnapshotRef = useRef<Card[]>([])
  const dragOriginStatusRef = useRef<CardStatus | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const loadCards = useCallback(async (boardId: string) => {
    if (!boardId) {
      setCards([])
      setArchivedCount(0)
      return
    }
    const [list, archCount] = await Promise.all([
      window.scrumNova.listCards(boardId),
      window.scrumNova.countArchivedCards(boardId)
    ])
    setCards(list)
    setArchivedCount(archCount)
  }, [])

  const reloadSources = useCallback(async () => {
    const sourceList = await window.scrumNova.listSources()
    setSources(sourceList)
    setSourceFilter((curr) =>
      curr === 'all' || curr === 'urgent' || sourceList.some((s) => s.id === curr) ? curr : 'all'
    )
    if (activeBoardIdRef.current) {
      await loadCards(activeBoardIdRef.current)
    }
  }, [loadCards])

  const refreshBoardsAndCards = useCallback(
    async (preferredBoardId?: string) => {
      const [settings, boardList, sourceList] = await Promise.all([
        window.scrumNova.getSettings(),
        window.scrumNova.listBoards(),
        window.scrumNova.listSources()
      ])
      setBoards(boardList)
      setSources(sourceList)

      const currId = activeBoardIdRef.current
      const nextBoardId =
        preferredBoardId && boardList.some((b) => b.id === preferredBoardId)
          ? preferredBoardId
          : settings.activeBoardId && boardList.some((b) => b.id === settings.activeBoardId)
            ? settings.activeBoardId
            : currId && boardList.some((b) => b.id === currId)
              ? currId
              : (boardList[0]?.id ?? '')

      setActiveBoardId(nextBoardId)
      await loadCards(nextBoardId)
    },
    [loadCards]
  )

  // 初始化 + 监听秒记悬浮窗/菜单栏触发的数据变化与导航指令 + Cmd+K 搜索快捷键
  useEffect(() => {
    void refreshBoardsAndCards()

    const unsubData = window.scrumNova.onDataChanged(() => {
      void refreshBoardsAndCards()
    })

    const unsubNav = window.scrumNova.onNavigateCommand((payload) => {
      if (payload.type === 'open-search') {
        setSearchOpen(true)
      } else if (payload.type === 'open-new-card') {
        setNewCardModalOpen(true)
      } else if (payload.type === 'toggle-backlog') {
        setBacklogOpen((v) => !v)
      } else if (payload.type === 'open-archive') {
        setArchiveOpen(true)
      } else if (payload.type === 'open-settings') {
        setSettingsOpen(true)
      } else if (payload.type === 'open-card' && payload.cardId) {
        const targetBoardId = payload.boardId
        if (targetBoardId && targetBoardId !== activeBoardIdRef.current) {
          void window.scrumNova.updateSettings({ activeBoardId: targetBoardId }).then(() => {
            setActiveBoardId(targetBoardId)
            void loadCards(targetBoardId)
          })
        }
        setSelectedCardId(payload.cardId)
      }
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      } else if (key === 'b' && !e.shiftKey) {
        e.preventDefault()
        setBacklogOpen((v) => !v)
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault()
        setNewCardModalOpen(true)
      } else if (key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      } else if (key === 'a' && e.shiftKey) {
        e.preventDefault()
        setArchiveOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      unsubData()
      unsubNav()
      window.removeEventListener('keydown', onKeyDown)
      if (inertiaRafRef.current !== null) {
        cancelAnimationFrame(inertiaRafRef.current)
      }
    }
  }, [loadCards, refreshBoardsAndCards])

  // 看板空白区域按住左右划动平移
  const stopBoardInertia = () => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = null
    }
  }

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !boardMainRef.current) return
    stopBoardInertia()

    const target = e.target as HTMLElement
    if (
      target.closest(
        '[data-kanban-card="true"], button, input, textarea, select, a, label, form'
      )
    ) {
      return
    }

    const now = performance.now()
    boardPanRef.current = {
      active: true,
      panning: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      lastTime: now,
      velocityX: 0,
      startScrollLeft: boardMainRef.current.scrollLeft
    }
  }

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const pan = boardPanRef.current
    const mainEl = boardMainRef.current
    if (!pan.active || e.pointerId !== pan.pointerId || !mainEl) return

    const dx = e.clientX - pan.startX
    if (!pan.panning) {
      if (Math.abs(dx) < 4) return
      pan.panning = true
      setIsBoardPanning(true)
      mainEl.setPointerCapture(e.pointerId)
    }

    const now = performance.now()
    const dt = now - pan.lastTime
    if (dt > 0) {
      const instantVx = (e.clientX - pan.lastX) / dt
      pan.velocityX = pan.velocityX * 0.6 + instantVx * 0.4
      pan.lastX = e.clientX
      pan.lastTime = now
    }

    mainEl.scrollLeft = pan.startScrollLeft - dx
  }

  const finishBoardPan = (e: React.PointerEvent<HTMLElement>) => {
    const pan = boardPanRef.current
    const mainEl = boardMainRef.current
    if (!pan.active || e.pointerId !== pan.pointerId) return

    if (pan.panning && mainEl) {
      if (mainEl.hasPointerCapture(e.pointerId)) {
        mainEl.releasePointerCapture(e.pointerId)
      }
      setIsBoardPanning(false)

      const idleMs = performance.now() - pan.lastTime
      if (idleMs < 65 && Math.abs(pan.velocityX) > 0.12) {
        let stepPx = pan.velocityX * 16
        const glide = () => {
          const el = boardMainRef.current
          if (!el || Math.abs(stepPx) < 0.5) {
            inertiaRafRef.current = null
            return
          }
          const before = el.scrollLeft
          el.scrollLeft -= stepPx
          if (el.scrollLeft === before) {
            inertiaRafRef.current = null
            return
          }
          stepPx *= 0.92
          inertiaRafRef.current = requestAnimationFrame(glide)
        }
        inertiaRafRef.current = requestAnimationFrame(glide)
      }
    }

    pan.active = false
    pan.panning = false
  }

  const handleSelectBoard = async (boardId: string) => {
    setSelectedCardId(null)
    setActiveBoardId(boardId)
    await window.scrumNova.updateSettings({ activeBoardId: boardId })
    await loadCards(boardId)
  }

  const handleCreateBoard = async (input: CreateBoardInput) => {
    const created = await window.scrumNova.createBoard(input)
    setSelectedCardId(null)
    await window.scrumNova.updateSettings({ activeBoardId: created.id })
    await refreshBoardsAndCards(created.id)
  }

  const handleUpdateBoard = async (input: UpdateBoardInput) => {
    await window.scrumNova.updateBoard(input)
    await refreshBoardsAndCards(input.id)
  }

  const handleDeleteBoard = async (boardId: string) => {
    if (boards.length <= 1) return
    await window.scrumNova.deleteBoard(boardId)
    if (selectedCardId) setSelectedCardId(null)
    await refreshBoardsAndCards()
  }

  const handleCreateCard = async (input: CreateCardInput, openAfterCreate = false) => {
    const created = await window.scrumNova.createCard(input)
    await loadCards(activeBoardId)
    if (openAfterCreate) {
      setSelectedCardId(created.id)
    }
  }

  const handleQuickMoveToTodo = async (card: Card) => {
    await window.scrumNova.updateCard({ id: card.id, status: 'todo' })
    await loadCards(activeBoardId)
  }

  const handleArchiveDoneCards = async () => {
    if (!activeBoardId) return
    await window.scrumNova.archiveDoneCards(activeBoardId)
    await loadCards(activeBoardId)
  }

  const handleSelectSearchResult = async (item: SearchResultItem) => {
    if (item.card.boardId !== activeBoardId) {
      setActiveBoardId(item.card.boardId)
      await window.scrumNova.updateSettings({ activeBoardId: item.card.boardId })
      await loadCards(item.card.boardId)
    }
    setSelectedCardId(item.card.id)
  }

  const handleCardDeleted = async (cardId: string) => {
    await window.scrumNova.deleteCard(cardId)
    setSelectedCardId(null)
    await loadCards(activeBoardId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveDragId(id)
    dragSnapshotRef.current = cardsRef.current
    dragOriginStatusRef.current = findCardStatus(id, cardsRef.current)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setCards((prev) => {
      const activeStatus = findCardStatus(activeId, prev)
      const overStatus = findCardStatus(overId, prev)
      if (!activeStatus || !overStatus || activeStatus === overStatus) {
        return prev
      }

      const activeIndex = prev.findIndex((c) => c.id === activeId)
      if (activeIndex === -1) return prev

      const movedCard: Card = { ...prev[activeIndex], status: overStatus }
      const withoutActive = prev.filter((c) => c.id !== activeId)

      if (overId.startsWith('column-')) {
        const next = [...withoutActive, movedCard]
        cardsRef.current = next
        return next
      }

      const overIndex = withoutActive.findIndex((c) => c.id === overId)
      if (overIndex === -1) {
        const next = [...withoutActive, movedCard]
        cardsRef.current = next
        return next
      }

      const next = [
        ...withoutActive.slice(0, overIndex),
        movedCard,
        ...withoutActive.slice(overIndex)
      ]
      cardsRef.current = next
      return next
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const originStatus = dragOriginStatusRef.current
    setActiveDragId(null)
    dragOriginStatusRef.current = null

    if (!over) {
      setCards(dragSnapshotRef.current)
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    let nextCards = [...cardsRef.current]

    const currentStatus = findCardStatus(activeId, nextCards)
    const overStatus = findCardStatus(overId, nextCards)
    if (!currentStatus || !overStatus) return

    if (currentStatus === overStatus && !overId.startsWith('column-') && activeId !== overId) {
      const oldIndex = nextCards.findIndex((c) => c.id === activeId)
      const newIndex = nextCards.findIndex((c) => c.id === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        nextCards = arrayMove(nextCards, oldIndex, newIndex)
      }
    }

    const affectedStatuses = new Set<CardStatus>([currentStatus])
    if (originStatus) affectedStatuses.add(originStatus)

    const patches: CardOrderPatch[] = []
    for (const st of affectedStatuses) {
      const colCards = nextCards.filter((c) => c.status === st)
      colCards.forEach((c, index) => {
        patches.push({ id: c.id, status: st, sortOrder: index })
      })
    }

    const patchMap = new Map(patches.map((p) => [p.id, p]))
    const normalized = nextCards.map((c) => {
      const p = patchMap.get(c.id)
      return p ? { ...c, status: p.status, sortOrder: p.sortOrder } : c
    })

    setCards(normalized)
    await window.scrumNova.reorderCards(patches)
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
    dragOriginStatusRef.current = null
    setCards(dragSnapshotRef.current)
  }

  const visibleCards = useMemo(() => {
    if (sourceFilter === 'all') return cards
    if (sourceFilter === 'urgent') return cards.filter((c) => c.isUrgentInsert)
    return cards.filter((c) => c.source === sourceFilter)
  }, [cards, sourceFilter])

  const inboxCards = useMemo(
    () => visibleCards.filter((c) => c.status === 'inbox'),
    [visibleCards]
  )
  const totalInboxCount = useMemo(
    () => cards.filter((c) => c.status === 'inbox').length,
    [cards]
  )

  const defaultSourceForCreate: CardSource =
    sourceFilter !== 'all' && sourceFilter !== 'urgent' && sources.some((s) => s.id === sourceFilter)
      ? sourceFilter
      : (sources[0]?.id ?? 'planner')

  const activeBoard = boards.find((b) => b.id === activeBoardId)
  const activeDragCard = activeDragId ? cards.find((c) => c.id === activeDragId) ?? null : null

  return (
    <div className="flex h-full overflow-hidden bg-slate-100 text-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={(id) => void handleSelectBoard(id)}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        backlogOpen={backlogOpen}
        onToggleBacklog={() => setBacklogOpen((v) => !v)}
        inboxCount={totalInboxCount}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          board={activeBoard}
          cards={cards}
          sources={sources}
          archivedCount={archivedCount}
          sourceFilter={sourceFilter}
          onChangeFilter={setSourceFilter}
          onUpdateBoard={handleUpdateBoard}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenArchive={() => setArchiveOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenQuickNewCard={() => setNewCardModalOpen(true)}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={handleDragCancel}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <BacklogDrawer
              open={backlogOpen}
              onClose={() => setBacklogOpen(false)}
              boardId={activeBoardId}
              cards={inboxCards}
              sources={sources}
              defaultSource={defaultSourceForCreate}
              onCardClick={(card) => setSelectedCardId(card.id)}
              onQuickCreateInbox={(input) => handleCreateCard(input, false)}
              onMoveToTodo={handleQuickMoveToTodo}
            />

            <main
              ref={boardMainRef}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={finishBoardPan}
              onPointerCancel={finishBoardPan}
              className={`flex min-w-0 flex-1 gap-3 overflow-x-auto p-3.5 ${
                isBoardPanning ? 'cursor-grabbing select-none' : 'cursor-grab'
              }`}
            >
              {BOARD_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.status}
                  status={col.status}
                  title={col.title}
                  dotClass={col.dotClass}
                  headerBgClass={col.headerBgClass}
                  emptyHint={col.emptyHint}
                  cards={visibleCards.filter((c) => c.status === col.status)}
                  sources={sources}
                  boardId={activeBoardId}
                  defaultSource={defaultSourceForCreate}
                  onCardClick={(card) => setSelectedCardId(card.id)}
                  onQuickCreateCard={(input) => handleCreateCard(input, false)}
                  onArchiveDone={col.status === 'done' ? handleArchiveDoneCards : undefined}
                />
              ))}
            </main>
          </div>

          <DragOverlay>
            {activeDragCard ? (
              <CardItem card={activeDragCard} sources={sources} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CardDetailDrawer
        cardId={selectedCardId}
        sources={sources}
        onClose={() => setSelectedCardId(null)}
        onCardUpdated={() => loadCards(activeBoardId)}
        onSourcesChanged={reloadSources}
        onCardDeleted={handleCardDeleted}
      />

      <ArchiveDrawer
        open={archiveOpen}
        boardId={activeBoardId}
        boardName={activeBoard?.name ?? ''}
        sources={sources}
        onClose={() => setArchiveOpen(false)}
        onOpenCard={(id) => {
          setArchiveOpen(false)
          setSelectedCardId(id)
        }}
        onChanged={() => loadCards(activeBoardId)}
      />

      <GlobalSearchModal
        open={searchOpen}
        sources={sources}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(item) => void handleSelectSearchResult(item)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsUpdated={() => void refreshBoardsAndCards()}
      />

      <NewCardModal
        open={newCardModalOpen}
        boardId={activeBoardId}
        sources={sources}
        defaultSource={defaultSourceForCreate}
        onClose={() => setNewCardModalOpen(false)}
        onCreate={handleCreateCard}
      />
    </div>
  )
}
