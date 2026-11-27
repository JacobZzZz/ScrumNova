import { useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Inbox, Plus, X } from 'lucide-react'
import type { Card, CardSource, CreateCardInput, SourceConfig } from '@shared/types'
import { SortableCardItem } from './CardItem'

interface BacklogDrawerProps {
  open: boolean
  onClose: () => void
  boardId: string
  cards: Card[]
  sources: SourceConfig[]
  defaultSource: CardSource
  onCardClick: (card: Card) => void
  onQuickCreateInbox: (input: CreateCardInput) => Promise<void>
  onMoveToTodo: (card: Card) => Promise<void>
}

export function BacklogDrawer({
  open,
  onClose,
  boardId,
  cards,
  sources,
  defaultSource,
  onCardClick,
  onQuickCreateInbox,
  onMoveToTodo
}: BacklogDrawerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'column-inbox'
  })

  const [title, setTitle] = useState('')
  const [source, setSource] = useState<CardSource>(defaultSource)

  useEffect(() => {
    if (defaultSource) {
      setSource(defaultSource)
    }
  }, [defaultSource])

  if (!open) return null

  const activeSource = sources.some((s) => s.id === source)
    ? source
    : (sources[0]?.id ?? 'planner')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !boardId) return
    await onQuickCreateInbox({
      boardId,
      title: title.trim(),
      status: 'inbox',
      source: activeSource,
      priority: 'P2'
    })
    setTitle('')
  }

  return (
    <section
      className={`flex h-full w-76 shrink-0 flex-col border-r border-slate-200 bg-slate-100/90 transition ${
        isOver ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-300' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-800">需求池 · Backlog</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="收起需求池"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 零摩擦秒记入池 */}
      <form onSubmit={(e) => void handleSubmit(e)} className="border-b border-slate-200 bg-white/70 p-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="随手记一条需求/想法，回车进池..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
        />
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {sources.map((s) => {
              const selected = activeSource === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.id)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                    selected
                      ? 'text-white shadow-2xs'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={selected ? { backgroundColor: s.color } : undefined}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" />
            入池
          </button>
        </div>
      </form>

      {/* 可直接拖进右侧 4 列看板 */}
      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto p-2.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCardItem
              key={card.id}
              card={card}
              sources={sources}
              onClick={onCardClick}
              onQuickMoveToTodo={(c) => void onMoveToTodo(c)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-xs leading-relaxed text-slate-400">
            需求池空空如也 ✨
            <br />
            平时暂时不做的需求放这里，要用时直接拖到右边看板
          </div>
        )}
      </div>
    </section>
  )
}
