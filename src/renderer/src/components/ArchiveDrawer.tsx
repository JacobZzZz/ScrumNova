import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArchiveRestore, Search, Trash2, X } from 'lucide-react'
import type { Card, SourceConfig } from '@shared/types'
import {
  formatShortTime,
  hexToSoftBg,
  PRIORITY_META,
  resolveSourceConfig
} from '../constants'

interface ArchiveDrawerProps {
  open: boolean
  boardId: string
  boardName: string
  sources: SourceConfig[]
  onClose: () => void
  onOpenCard: (cardId: string) => void
  onChanged: () => Promise<void>
}

export function ArchiveDrawer({
  open,
  boardId,
  boardName,
  sources,
  onClose,
  onOpenCard,
  onChanged
}: ArchiveDrawerProps) {
  const [archivedCards, setArchivedCards] = useState<Card[]>([])
  const [keyword, setKeyword] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const loadArchived = useCallback(async () => {
    if (!boardId) return
    const list = await window.scrumNova.listArchivedCards(boardId)
    setArchivedCards(list)
  }, [boardId])

  useEffect(() => {
    if (open) {
      setKeyword('')
      setConfirmDeleteId(null)
      void loadArchived()
    }
  }, [open, loadArchived])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return archivedCards
    return archivedCards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.nextStep.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    )
  }, [archivedCards, keyword])

  if (!open) return null

  const handleRestore = async (card: Card) => {
    await window.scrumNova.updateCard({
      id: card.id,
      isArchived: false,
      status: card.status === 'inbox' ? 'todo' : card.status
    })
    await loadArchived()
    await onChanged()
  }

  const handlePermanentDelete = async (cardId: string) => {
    await window.scrumNova.deleteCard(cardId)
    setConfirmDeleteId(null)
    await loadArchived()
    await onChanged()
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[1px]"
      />

      <aside className="fixed top-0 right-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              归档箱 · {boardName} ({archivedCards.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              已完成的卡片归档后保存在此，仍可通过 Cmd+K 全局搜索查到
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="在当前空间归档卡片中筛选..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {filtered.map((card) => {
            const srcCfg = resolveSourceConfig(card.source, sources)
            const prioMeta = PRIORITY_META[card.priority] ?? PRIORITY_META.P2
            const confirming = confirmDeleteId === card.id

            return (
              <div
                key={card.id}
                onClick={() => onOpenCard(card.id)}
                className="group cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: hexToSoftBg(srcCfg.color, 0.14),
                      color: srcCfg.color
                    }}
                  >
                    {srcCfg.name}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${prioMeta.badgeClass}`}>
                    {prioMeta.label}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    归档于 {formatShortTime(card.updatedAt)}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-800">{card.title}</div>

                <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-200/70 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleRestore(card)
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <ArchiveRestore className="h-3 w-3" />
                    恢复回看板
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirming) {
                        void handlePermanentDelete(card.id)
                      } else {
                        setConfirmDeleteId(card.id)
                      }
                    }}
                    onMouseLeave={() => setConfirmDeleteId(null)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      confirming
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                    {confirming ? '确认彻底删除?' : '彻底删除'}
                  </button>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-xs text-slate-400">
              {archivedCards.length === 0
                ? '还没有归档的卡片，点击「已完成」列头的归档按钮可一键清理看板'
                : '没有匹配的归档卡片'}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
