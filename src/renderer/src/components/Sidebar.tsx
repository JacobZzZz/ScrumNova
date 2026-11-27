import { useState } from 'react'
import { FolderKanban, Inbox, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from 'lucide-react'
import type { Board, CreateBoardInput } from '@shared/types'
import { BOARD_PRESET_COLORS } from '../constants'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  boards: Board[]
  activeBoardId: string
  onSelectBoard: (boardId: string) => void
  onCreateBoard: (input: CreateBoardInput) => Promise<void>
  onDeleteBoard: (boardId: string) => Promise<void>
  backlogOpen: boolean
  onToggleBacklog: () => void
  inboxCount: number
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  backlogOpen,
  onToggleBacklog,
  inboxCount
}: SidebarProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(BOARD_PRESET_COLORS[0])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreateBoard({ name: name.trim(), color, weeklyLimitHours: 30 })
    setName('')
    setCreating(false)
  }

  if (collapsed) {
    return (
      <aside className="flex w-13 shrink-0 flex-col items-center border-r border-slate-200 bg-slate-50 py-3 text-slate-700">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="展开侧边栏"
          className="mb-4 rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleBacklog}
          title={`需求池 (${inboxCount})`}
          className={`relative mb-4 rounded-lg p-2 transition ${
            backlogOpen
              ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
        >
          <Inbox className="h-4 w-4" />
          {inboxCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {inboxCount}
            </span>
          )}
        </button>

        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
          {boards.map((board) => {
            const active = board.id === activeBoardId
            return (
              <button
                key={board.id}
                type="button"
                onClick={() => onSelectBoard(board.id)}
                title={board.name}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                  active
                    ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-slate-50'
                    : 'opacity-75 hover:opacity-100'
                }`}
                style={{ backgroundColor: board.color, color: '#fff' }}
              >
                {board.name.slice(0, 1)}
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-3 text-slate-800">
      {/* 品牌与收起 */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
            SN
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900">ScrumNova</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="收起侧边栏"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* 需求池抽屉开关 */}
      <button
        type="button"
        onClick={onToggleBacklog}
        className={`mb-4 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
          backlogOpen
            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
            : 'bg-white text-slate-700 ring-1 ring-slate-200/90 hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-2">
          <Inbox className={`h-4 w-4 ${backlogOpen ? 'text-blue-600' : 'text-slate-500'}`} />
          需求池 (Backlog)
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            backlogOpen ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {inboxCount}
        </span>
      </button>

      {/* 空间列表 */}
      <div className="mb-1.5 flex items-center justify-between px-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        <span className="flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" />
          空间 / 看板
        </span>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          title="新建空间"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {boards.map((board) => {
          const active = board.id === activeBoardId
          const isConfirming = confirmDeleteId === board.id
          return (
            <div
              key={board.id}
              onClick={() => {
                setConfirmDeleteId(null)
                onSelectBoard(board.id)
              }}
              className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    active ? 'ring-2 ring-white/80' : ''
                  }`}
                  style={{ backgroundColor: board.color }}
                />
                <span className="truncate">{board.name}</span>
              </div>

              {boards.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isConfirming) {
                      setConfirmDeleteId(null)
                      void onDeleteBoard(board.id)
                    } else {
                      setConfirmDeleteId(board.id)
                    }
                  }}
                  onMouseLeave={() => setConfirmDeleteId(null)}
                  title={isConfirming ? '再点一次确认删除空间' : '删除空间'}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition ${
                    isConfirming
                      ? 'bg-rose-600 font-bold text-white opacity-100'
                      : active
                        ? 'text-white/80 opacity-0 group-hover:opacity-100 hover:bg-blue-700 hover:text-white'
                        : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-300/70 hover:text-rose-600'
                  }`}
                >
                  {isConfirming ? '确认删?' : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 新建空间小面板 */}
      {creating ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新建空间名称..."
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
          />
          <div className="mt-2 flex items-center gap-1.5">
            {BOARD_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-4 w-4 rounded-full transition ${
                  color === c
                    ? 'scale-110 ring-2 ring-slate-800 ring-offset-1'
                    : 'opacity-75 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              创建
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
          新建空间
        </button>
      )}
    </aside>
  )
}
