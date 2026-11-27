import type { CardPriority, CardSource, CardStatus, SourceConfig } from '@shared/types'

export const DOING_WIP_SOFT_LIMIT = 2

export const BOARD_COLUMNS: Array<{
  status: Exclude<CardStatus, 'inbox'>
  title: string
  dotClass: string
  headerBgClass: string
  emptyHint: string
}> = [
  {
    status: 'todo',
    title: '待办 · Todo',
    dotClass: 'bg-slate-500',
    headerBgClass: 'bg-slate-200/80',
    emptyHint: '从左侧需求池拖入，或点击下方新建'
  },
  {
    status: 'doing',
    title: '进行中 · Doing',
    dotClass: 'bg-blue-600',
    headerBgClass: 'bg-blue-100/80',
    emptyHint: '建议同时保持 1~2 件事，专注推进'
  },
  {
    status: 'blocked',
    title: '等待/阻塞 · Blocked',
    dotClass: 'bg-amber-500',
    headerBgClass: 'bg-amber-100/80',
    emptyHint: '等策划定稿/等美术资源的任务放这里'
  },
  {
    status: 'done',
    title: '已完成 · Done',
    dotClass: 'bg-emerald-600',
    headerBgClass: 'bg-emerald-100/80',
    emptyHint: '拖动完成的卡片到这里'
  }
]

export const STATUS_META: Record<CardStatus, { label: string; badgeClass: string }> = {
  inbox: { label: '需求池 (Inbox)', badgeClass: 'bg-slate-200 text-slate-700' },
  todo: { label: '待办 (Todo)', badgeClass: 'bg-slate-200 text-slate-800' },
  doing: { label: '进行中 (Doing)', badgeClass: 'bg-blue-100 text-blue-700' },
  blocked: { label: '等待/阻塞 (Blocked)', badgeClass: 'bg-amber-100 text-amber-800' },
  done: { label: '已完成 (Done)', badgeClass: 'bg-emerald-100 text-emerald-700' }
}

export const PRIORITIES: CardPriority[] = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']

export const PRIORITY_META: Record<
  CardPriority,
  { label: string; hint: string; badgeClass: string; activeButtonClass: string }
> = {
  P0: {
    label: 'P0',
    hint: '致命/最急',
    badgeClass: 'bg-red-600 text-white',
    activeButtonClass: 'bg-red-600 text-white shadow-xs'
  },
  P1: {
    label: 'P1',
    hint: '高优',
    badgeClass: 'bg-orange-500 text-white',
    activeButtonClass: 'bg-orange-500 text-white shadow-xs'
  },
  P2: {
    label: 'P2',
    hint: '中高',
    badgeClass: 'bg-amber-500 text-white',
    activeButtonClass: 'bg-amber-500 text-white shadow-xs'
  },
  P3: {
    label: 'P3',
    hint: '普通',
    badgeClass: 'bg-blue-500 text-white',
    activeButtonClass: 'bg-blue-500 text-white shadow-xs'
  },
  P4: {
    label: 'P4',
    hint: '较低',
    badgeClass: 'bg-slate-400 text-white',
    activeButtonClass: 'bg-slate-500 text-white shadow-xs'
  },
  P5: {
    label: 'P5',
    hint: '备选/最低',
    badgeClass: 'bg-slate-200 text-slate-600',
    activeButtonClass: 'bg-slate-700 text-white shadow-xs'
  }
}

export const BOARD_PRESET_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#e11d48',
  '#0891b2'
]

export const SOURCE_PRESET_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#e11d48',
  '#059669',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#4f46e5'
]

export const FALLBACK_SOURCES: SourceConfig[] = [
  { id: 'planner', name: '策划需求', color: '#2563eb', sortOrder: 0, createdAt: '' },
  { id: 'self', name: '自发任务', color: '#7c3aed', sortOrder: 1, createdAt: '' },
  { id: 'bug', name: 'Bug', color: '#e11d48', sortOrder: 2, createdAt: '' }
]

export function hexToSoftBg(hex: string, alpha = 0.13): string {
  const clean = hex.replace('#', '')
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }
  return 'rgba(37, 99, 235, 0.12)'
}

export function resolveSourceConfig(
  sourceId: CardSource,
  sources: SourceConfig[]
): { name: string; color: string } {
  const found = sources.find((s) => s.id === sourceId)
  if (found) return { name: found.name, color: found.color }
  const fallback = FALLBACK_SOURCES.find((s) => s.id === sourceId)
  if (fallback) return { name: fallback.name, color: fallback.color }
  return { name: sourceId || '未分类', color: '#64748b' }
}

export const QUICK_ESTIMATE_HOURS = [0.5, 1, 2, 4, 8, 16]

export type SourceFilter = 'all' | 'urgent' | CardSource

export type DueDateState = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'done'

export function getLocalDateString(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getDueDateInfo(
  dueDate: string | null,
  isDone: boolean
): { state: DueDateState; text: string; className: string } | null {
  if (!dueDate) return null
  const shortDate = dueDate.slice(5)
  if (isDone) {
    return {
      state: 'done',
      text: shortDate,
      className: 'bg-slate-100 text-slate-400 line-through'
    }
  }

  const today = getLocalDateString(0)
  const tomorrow = getLocalDateString(1)

  if (dueDate < today) {
    return {
      state: 'overdue',
      text: `逾期 ${shortDate}`,
      className: 'bg-red-100 text-red-700 font-semibold ring-1 ring-red-200'
    }
  }
  if (dueDate === today) {
    return {
      state: 'today',
      text: '今日截止',
      className: 'bg-orange-100 text-orange-700 font-semibold ring-1 ring-orange-200'
    }
  }
  if (dueDate === tomorrow) {
    return {
      state: 'tomorrow',
      text: '明日截止',
      className: 'bg-amber-100 text-amber-800 font-medium'
    }
  }
  return {
    state: 'upcoming',
    text: shortDate,
    className: 'bg-slate-100 text-slate-600'
  }
}

export function getMediaUrl(fileName: string): string {
  return `scrumnova-media://asset/${encodeURIComponent(fileName)}`
}

export function formatShortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${hh}:${mm}`
}
