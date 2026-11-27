import { useEffect, useState } from 'react'
import { Archive, Flame, Gauge, Keyboard, Plus, Search, Settings2 } from 'lucide-react'
import type { Board, Card, SourceConfig, UpdateBoardInput } from '@shared/types'
import { BOARD_PRESET_COLORS, type SourceFilter } from '../constants'

interface TopBarProps {
  board: Board | undefined
  cards: Card[]
  sources: SourceConfig[]
  archivedCount: number
  sourceFilter: SourceFilter
  onChangeFilter: (filter: SourceFilter) => void
  onUpdateBoard: (input: UpdateBoardInput) => Promise<void>
  onOpenSearch: () => void
  onOpenArchive: () => void
  onOpenSettings: () => void
  onOpenQuickNewCard: () => void
}

export function TopBar({
  board,
  cards,
  sources,
  archivedCount,
  sourceFilter,
  onChangeFilter,
  onUpdateBoard,
  onOpenSearch,
  onOpenArchive,
  onOpenSettings,
  onOpenQuickNewCard
}: TopBarProps) {
  const [editingBoard, setEditingBoard] = useState(false)
  const [editName, setEditName] = useState('')
  const [editLimit, setEditLimit] = useState('30')
  const [editColor, setEditColor] = useState(BOARD_PRESET_COLORS[0])

  useEffect(() => {
    if (board) {
      setEditName(board.name)
      setEditLimit(String(board.weeklyLimitHours))
      setEditColor(board.color)
    }
    setEditingBoard(false)
  }, [board?.id])

  const boardCards = cards.filter((c) => c.status !== 'inbox')
  const activeWorkloadCards = boardCards.filter((c) => c.status !== 'done')
  const scheduledHours = activeWorkloadCards.reduce((sum, c) => sum + (c.estimateHours ?? 0), 0)
  const doneHours = boardCards
    .filter((c) => c.status === 'done')
    .reduce((sum, c) => sum + (c.estimateHours ?? 0), 0)

  const limitHours = board?.weeklyLimitHours ?? 30
  const ratio = limitHours > 0 ? scheduledHours / limitHours : 0
  const percent = Math.min(100, Math.round(ratio * 100))

  const barColor =
    ratio > 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'

  const urgentCount = boardCards.filter((c) => c.isUrgentInsert).length

  const handleSaveBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!board || !editName.trim()) return
    const parsedLimit = Number(editLimit)
    await onUpdateBoard({
      id: board.id,
      name: editName.trim(),
      color: editColor,
      weeklyLimitHours: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 30
    })
    setEditingBoard(false)
  }

  return (
    <header className="relative flex h-13 shrink-0 items-center justify-between gap-2.5 border-b border-slate-200 bg-white px-4">
      {/* 左侧：当前空间标题 + 全局搜索入口 */}
      <div className="flex shrink-0 items-center gap-2">
        {board && (
          <>
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: board.color }}
            />
            <h2 className="max-w-32 truncate text-sm font-bold text-slate-900">{board.name}</h2>
            <button
              type="button"
              onClick={() => setEditingBoard((v) => !v)}
              title="空间名称与每周负载上限设置"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onOpenSearch}
          title="全局搜索所有空间与历史归档卡片 (Cmd+K)"
          className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
        >
          <Search className="h-3.5 w-3.5" />
          <span>搜索</span>
          <kbd className="rounded bg-white px-1 py-0.2 font-mono text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200">
            ⌘K
          </kbd>
        </button>

        {editingBoard && board && (
          <form
            onSubmit={(e) => void handleSaveBoard(e)}
            className="absolute top-12 left-4 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl"
          >
            <div className="mb-2 text-xs font-bold text-slate-800">空间与负载上限设置</div>
            <label className="block text-[11px] font-medium text-slate-500">空间名称</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 mb-2.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
            />

            <label className="block text-[11px] font-medium text-slate-500">
              看板建议负载上限（小时）
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={editLimit}
              onChange={(e) => setEditLimit(e.target.value)}
              className="mt-1 mb-2.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
            />

            <label className="block text-[11px] font-medium text-slate-500">主题色</label>
            <div className="mt-1.5 mb-3 flex items-center gap-2">
              {BOARD_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`h-5 w-5 rounded-full ${
                    editColor === c ? 'ring-2 ring-slate-900 ring-offset-1' : 'opacity-75'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingBoard(false)}
                className="rounded-md px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 中间：动态来源快捷筛选器 */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChangeFilter('all')}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            sourceFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          全部 ({boardCards.length})
        </button>

        {sources.map((s) => {
          const active = sourceFilter === s.id
          const count = boardCards.filter((c) => c.source === s.id).length
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangeFilter(active ? 'all' : s.id)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                active ? 'text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              style={active ? { backgroundColor: s.color } : undefined}
            >
              {s.name} ({count})
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onChangeFilter(sourceFilter === 'urgent' ? 'all' : 'urgent')}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            sourceFilter === 'urgent'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-orange-700 hover:bg-orange-100/70'
          }`}
        >
          <Flame className="h-3 w-3" />
          仅插单 ({urgentCount})
        </button>
      </div>

      {/* 右侧：当前负载条 + 归档箱 + 快捷键设置 + 新建卡片 */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          onClick={() => setEditingBoard(true)}
          title={`未完成负载 ${scheduledHours}h / 建议上限 ${limitHours}h（已完成 ${doneHours}h），点击可调整上限`}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100"
        >
          <Gauge
            className={`h-4 w-4 ${
              ratio > 1 ? 'text-red-600' : ratio >= 0.8 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          />
          <div className="w-26">
            <div className="mb-1 flex items-center justify-between text-[11px] leading-none font-semibold">
              <span className={ratio > 1 ? 'text-red-600' : 'text-slate-700'}>
                已排 {scheduledHours}h / {limitHours}h
              </span>
              {ratio > 1 && <span className="font-bold text-red-600">超载!</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenArchive}
          title="查看当前空间已归档卡片"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Archive className="h-3.5 w-3.5" />
          <span>归档箱</span>
          {archivedCount > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
              {archivedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="全局秒记快捷键与菜单栏助理设置"
          className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenQuickNewCard}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建卡片
        </button>
      </div>
    </header>
  )
}
