import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertTriangle, Archive, Flame, Plus, X } from 'lucide-react'
import type {
  Card,
  CardPriority,
  CardSource,
  CardStatus,
  CreateCardInput,
  SourceConfig
} from '@shared/types'
import { DOING_WIP_SOFT_LIMIT, PRIORITIES } from '../constants'
import { SortableCardItem } from './CardItem'

interface KanbanColumnProps {
  status: Exclude<CardStatus, 'inbox'>
  title: string
  dotClass: string
  headerBgClass: string
  emptyHint: string
  cards: Card[]
  sources: SourceConfig[]
  boardId: string
  defaultSource: CardSource
  onCardClick: (card: Card) => void
  onQuickCreateCard: (input: CreateCardInput) => Promise<void>
  onArchiveDone?: () => Promise<void>
}

export function KanbanColumn({
  status,
  title,
  dotClass,
  headerBgClass,
  emptyHint,
  cards,
  sources,
  boardId,
  defaultSource,
  onCardClick,
  onQuickCreateCard,
  onArchiveDone
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`
  })

  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [source, setSource] = useState<CardSource>(defaultSource)
  const [priority, setPriority] = useState<CardPriority>('P1')
  const [isUrgentInsert, setIsUrgentInsert] = useState(false)
  const [estimateHours, setEstimateHours] = useState('')

  const totalHours = cards.reduce((sum, c) => sum + (c.estimateHours ?? 0), 0)
  const overWip = status === 'doing' && cards.length > DOING_WIP_SOFT_LIMIT

  const openComposer = () => {
    setSource(defaultSource || sources[0]?.id || 'planner')
    setAdding(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !boardId) return
    const parsedHours = estimateHours.trim() ? Number(estimateHours) : null
    await onQuickCreateCard({
      boardId,
      title: newTitle.trim(),
      status,
      source,
      priority,
      isUrgentInsert,
      estimateHours: parsedHours !== null && Number.isFinite(parsedHours) ? parsedHours : null
    })
    setNewTitle('')
    setEstimateHours('')
    setIsUrgentInsert(false)
    setAdding(false)
  }

  return (
    <div
      className={`flex h-full min-w-[278px] flex-1 flex-col rounded-xl border transition ${
        isOver
          ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-300/50'
          : 'border-slate-200/90 bg-slate-200/65'
      }`}
    >
      {/* 列头 */}
      <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${headerBgClass}`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
          <h3 className="truncate text-xs font-bold tracking-wide text-slate-800">{title}</h3>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            {cards.length}
          </span>
          {totalHours > 0 && (
            <span className="text-[11px] font-medium text-slate-500">{totalHours}h</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {overWip && (
            <span
              title="进行中任务较多，小心多线并行打乱节奏"
              className="inline-flex items-center gap-0.5 rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900"
            >
              <AlertTriangle className="h-3 w-3" />
              并行过多
            </span>
          )}
          {status === 'done' && cards.length > 0 && onArchiveDone && (
            <button
              type="button"
              onClick={() => void onArchiveDone()}
              title="一键归档所有已完成卡片，保持看板清爽"
              className="inline-flex items-center gap-1 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-2xs transition hover:bg-white"
            >
              <Archive className="h-3 w-3" />
              一键归档
            </button>
          )}
          <button
            type="button"
            onClick={openComposer}
            title="在此列新建卡片"
            className="rounded-md p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 卡片列表拖拽区 */}
      <div ref={setNodeRef} className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCardItem
              key={card.id}
              card={card}
              sources={sources}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && !adding && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300/90 px-3 text-center text-xs text-slate-400">
            {emptyHint}
          </div>
        )}

        {adding && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-xl border border-blue-300 bg-white p-2.5 shadow-sm"
          >
            <textarea
              autoFocus
              rows={2}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit(e)
                } else if (e.key === 'Escape') {
                  setAdding(false)
                }
              }}
              placeholder="输入卡片标题（回车保存，Esc 取消）..."
              className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="max-w-28 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CardPriority)}
                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.5"
                min="0"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                placeholder="耗时h"
                className="w-14 rounded border border-slate-200 px-1.5 py-1 text-[11px] outline-none focus:border-blue-500"
              />

              <button
                type="button"
                onClick={() => setIsUrgentInsert((v) => !v)}
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-semibold transition ${
                  isUrgentInsert
                    ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Flame className="h-3 w-3" />
                插单
              </button>
            </div>

            <div className="mt-2 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                添加
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 列底快捷添加 */}
      {!adding && (
        <button
          type="button"
          onClick={openComposer}
          className="m-2 mt-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900"
        >
          <Plus className="h-3.5 w-3.5" />
          添加卡片
        </button>
      )}
    </div>
  )
}
