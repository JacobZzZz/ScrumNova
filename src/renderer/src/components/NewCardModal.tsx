import { useEffect, useState } from 'react'
import { Flame, X } from 'lucide-react'
import type {
  CardPriority,
  CardSource,
  CardStatus,
  CreateCardInput,
  SourceConfig
} from '@shared/types'
import { PRIORITIES, PRIORITY_META, QUICK_ESTIMATE_HOURS, STATUS_META } from '../constants'

interface NewCardModalProps {
  open: boolean
  boardId: string
  sources: SourceConfig[]
  defaultSource: CardSource
  onClose: () => void
  onCreate: (input: CreateCardInput, openAfterCreate: boolean) => Promise<void>
}

export function NewCardModal({
  open,
  boardId,
  sources,
  defaultSource,
  onClose,
  onCreate
}: NewCardModalProps) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<CardStatus>('todo')
  const [source, setSource] = useState<CardSource>(defaultSource)
  const [priority, setPriority] = useState<CardPriority>('P2')
  const [isUrgentInsert, setIsUrgentInsert] = useState(false)
  const [estimateHours, setEstimateHours] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [nextStep, setNextStep] = useState('')

  useEffect(() => {
    if (open) {
      setSource(defaultSource || sources[0]?.id || 'planner')
    }
  }, [open, defaultSource, sources])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const submit = async (openDetail: boolean) => {
    if (!title.trim() || !boardId) return
    const parsed = estimateHours.trim() ? Number(estimateHours) : null
    await onCreate(
      {
        boardId,
        title: title.trim(),
        status,
        source: sources.some((s) => s.id === source) ? source : (sources[0]?.id ?? 'planner'),
        priority,
        isUrgentInsert,
        estimateHours: parsed !== null && Number.isFinite(parsed) ? parsed : null,
        dueDate: dueDate || null,
        nextStep: nextStep.trim()
      },
      openDetail
    )
    setTitle('')
    setEstimateHours('')
    setDueDate('')
    setNextStep('')
    setIsUrgentInsert(false)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">新建任务卡片</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入需求或任务标题..."
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-blue-500"
        />

        <div className="mb-3 grid grid-cols-3 gap-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">放入位置</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CardStatus)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">需求来源</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">
              优先级 (P0-P5)
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CardPriority)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} · {PRIORITY_META[p].hint}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">
              估算耗时（小时）
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                placeholder="如 2"
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
              {QUICK_ESTIMATE_HOURS.slice(0, 4).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setEstimateHours(String(h))}
                  className="rounded bg-slate-100 px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">截止日期</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="第一步准备做什么？（可选，直接显示在卡片正面）"
          className="mb-3 w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs outline-none focus:border-amber-400"
        />

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setIsUrgentInsert((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              isUrgentInsert
                ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            标记为临时插单
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit(true)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              创建并贴图/拆子任务
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              创建卡片
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
