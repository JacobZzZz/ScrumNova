import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowRight,
  Calendar,
  CheckSquare,
  Clock,
  Flame,
  Footprints,
  History,
  Image as ImageIcon,
  Paperclip
} from 'lucide-react'
import type { Card, SourceConfig } from '@shared/types'
import {
  getDueDateInfo,
  hexToSoftBg,
  PRIORITY_META,
  resolveSourceConfig
} from '../constants'

interface CardItemProps {
  card: Card
  sources: SourceConfig[]
  onClick?: (card: Card) => void
  onQuickMoveToTodo?: (card: Card) => void
  isOverlay?: boolean
}

export function CardItem({
  card,
  sources,
  onClick,
  onQuickMoveToTodo,
  isOverlay = false
}: CardItemProps) {
  const sourceCfg = resolveSourceConfig(card.source, sources)
  const priorityMeta = PRIORITY_META[card.priority] ?? PRIORITY_META.P2
  const isDone = card.status === 'done'
  const dueInfo = getDueDateInfo(card.dueDate, isDone)
  const hasFooterMeta =
    Boolean(dueInfo) || card.subtaskTotal > 0 || card.attachmentCount > 0 || card.logCount > 0
  const allSubtasksDone = card.subtaskTotal > 0 && card.subtaskDone === card.subtaskTotal

  return (
    <div
      data-kanban-card="true"
      onClick={() => onClick?.(card)}
      className={`group relative overflow-hidden rounded-xl border bg-white transition select-none ${
        card.isUrgentInsert && !isDone
          ? 'border-orange-300 ring-1 ring-orange-200/70'
          : 'border-slate-200/90'
      } ${
        isOverlay
          ? 'rotate-2 cursor-grabbing shadow-2xl ring-2 ring-blue-500/40'
          : 'cursor-pointer shadow-xs hover:border-slate-300 hover:shadow-md'
      } ${isDone ? 'opacity-80' : ''}`}
    >
      {/* 顶部来源彩色色条（支持任意自定义颜色） */}
      <div className="h-1.5 w-full" style={{ backgroundColor: sourceCfg.color }} />

      <div className="p-3">
        {/* 标签行：来源 + 优先级 + 插单 + 耗时 */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              backgroundColor: hexToSoftBg(sourceCfg.color, 0.14),
              color: sourceCfg.color
            }}
          >
            {sourceCfg.name}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${priorityMeta.badgeClass}`}>
            {priorityMeta.label}
          </span>
          {card.isUrgentInsert && (
            <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">
              <Flame className="h-3 w-3 fill-orange-500 text-orange-600" />
              插单
            </span>
          )}

          {card.estimateHours !== null && (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
              <Clock className="h-2.5 w-2.5" />
              {card.estimateHours}h
            </span>
          )}
        </div>

        {/* 卡片标题 */}
        <h4
          className={`text-[13px] leading-snug font-bold text-slate-900 ${
            isDone ? 'line-through text-slate-500' : ''
          }`}
        >
          {card.title}
        </h4>

        {/* 下一步 / 现场小记直接露在卡片正面 */}
        {card.nextStep.trim() !== '' && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-[11px] leading-relaxed text-amber-950">
            <Footprints className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
            <span className="line-clamp-2 break-words">{card.nextStep}</span>
          </div>
        )}

        {/* 底部高密度统计行 */}
        {(hasFooterMeta || onQuickMoveToTodo) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px]">
            {dueInfo && (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${dueInfo.className}`}>
                <Calendar className="h-3 w-3" />
                {dueInfo.text}
              </span>
            )}

            {card.subtaskTotal > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                  allSubtasksDone
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CheckSquare className="h-3 w-3" />
                {card.subtaskDone}/{card.subtaskTotal}
              </span>
            )}

            {card.attachmentCount > 0 && (
              <span
                title={card.coverImage ? '包含截图/附件' : '包含外链附件'}
                className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
              >
                {card.coverImage ? (
                  <ImageIcon className="h-3 w-3 text-blue-600" />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                {card.attachmentCount}
              </span>
            )}

            {card.logCount > 0 && (
              <span
                title="需求变更小记数"
                className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
              >
                <History className="h-3 w-3" />
                {card.logCount}
              </span>
            )}

            {onQuickMoveToTodo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickMoveToTodo(card)
                }}
                title="移入待办看板"
                className="ml-auto inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100 hover:bg-blue-100"
              >
                入看板
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface SortableCardItemProps {
  card: Card
  sources: SourceConfig[]
  onClick: (card: Card) => void
  onQuickMoveToTodo?: (card: Card) => void
}

export function SortableCardItem({
  card,
  sources,
  onClick,
  onQuickMoveToTodo
}: SortableCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-30' : ''}
    >
      <CardItem
        card={card}
        sources={sources}
        onClick={onClick}
        onQuickMoveToTodo={onQuickMoveToTodo}
      />
    </div>
  )
}
