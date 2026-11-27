import { useCallback, useEffect, useRef, useState } from 'react'
import { Flame, Image as ImageIcon, Send, X, Zap } from 'lucide-react'
import type { Board, CardPriority, CardSource, CardStatus, SourceConfig } from '@shared/types'
import { FALLBACK_SOURCES, PRIORITIES } from '../constants'

export function QuickCaptureApp() {
  const [boards, setBoards] = useState<Board[]>([])
  const [sources, setSources] = useState<SourceConfig[]>(FALLBACK_SOURCES)
  const [boardId, setBoardId] = useState('')
  const [status, setStatus] = useState<CardStatus>('inbox')
  const [source, setSource] = useState<CardSource>('planner')
  const [priority, setPriority] = useState<CardPriority>('P2')
  const [isUrgentInsert, setIsUrgentInsert] = useState(false)

  const [title, setTitle] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [pastedImages, setPastedImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const titleInputRef = useRef<HTMLInputElement | null>(null)

  const syncContext = useCallback(async () => {
    const [settings, boardList, sourceList] = await Promise.all([
      window.scrumNova.getSettings(),
      window.scrumNova.listBoards(),
      window.scrumNova.listSources()
    ])
    setBoards(boardList)
    setSources(sourceList)

    const targetBoard =
      boardList.find((b) => b.id === settings.activeBoardId)?.id ?? boardList[0]?.id ?? ''
    setBoardId((curr) => (curr && boardList.some((b) => b.id === curr) ? curr : targetBoard))
    setSource((curr) =>
      sourceList.some((s) => s.id === curr) ? curr : (sourceList[0]?.id ?? 'planner')
    )
  }, [])

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'

    void syncContext()
    const unsub = window.scrumNova.onDataChanged(() => {
      void syncContext()
    })

    const onFocus = () => {
      void syncContext()
      window.setTimeout(() => titleInputRef.current?.focus(), 20)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void window.scrumNova.hideQuickCapture()
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => titleInputRef.current?.focus(), 30)

    return () => {
      unsub()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [syncContext])

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imgItem = items.find((it) => it.type.startsWith('image/'))
    if (!imgItem) return

    e.preventDefault()
    const file = imgItem.getAsFile()
    if (!file) return

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    setPastedImages((prev) => [...prev, dataUrl])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const trimmed = title.trim()
    if (!trimmed && pastedImages.length === 0) return
    if (!boardId) return

    setSubmitting(true)
    try {
      const cardTitle =
        trimmed || `截图速记 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
      const created = await window.scrumNova.createCard({
        boardId,
        title: cardTitle,
        status,
        source,
        priority,
        isUrgentInsert,
        nextStep: nextStep.trim()
      })

      for (const dataUrl of pastedImages) {
        await window.scrumNova.saveImageAttachment({
          cardId: created.id,
          dataUrl
        })
      }

      setTitle('')
      setNextStep('')
      setPastedImages([])
      setIsUrgentInsert(false)
      await window.scrumNova.hideQuickCapture()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onPaste={(e) => void handlePaste(e)} className="h-full w-full p-2.5">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/98 p-4 shadow-2xl ring-1 ring-slate-900/5"
      >
        {/* 顶栏提示 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
            <Zap className="h-3.5 w-3.5 fill-blue-600" />
            <span>ScrumNova 快速秒记</span>
            <span className="font-normal text-slate-400">· 回车直接保存，Esc 关闭，支持 Cmd+V 贴截图</span>
          </div>
          <button
            type="button"
            onClick={() => void window.scrumNova.hideQuickCapture()}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 主输入区 */}
        <div className="my-2 space-y-2">
          <input
            ref={titleInputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="随手记下策划刚提的需求或突然想到的任务..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />

          <div className="flex items-center gap-2">
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="补充下一步 / 现场备注（可选）..."
              className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
            />
            {pastedImages.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                <ImageIcon className="h-3.5 w-3.5" />
                已贴 {pastedImages.length} 张图
                <button
                  type="button"
                  onClick={() => setPastedImages([])}
                  className="ml-1 text-blue-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 底部快捷归属栏 */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="max-w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CardStatus)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
            >
              <option value="inbox">进需求池</option>
              <option value="todo">进待办</option>
              <option value="doing">立即开干</option>
            </select>

            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="max-w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
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
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsUrgentInsert((v) => !v)}
              className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                isUrgentInsert
                  ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Flame className="h-3 w-3" />
              插单
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || (!title.trim() && pastedImages.length === 0)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
