import { useEffect, useRef, useState } from 'react'
import { Archive, CornerDownLeft, Flame, Search, X } from 'lucide-react'
import type { SearchResultItem, SourceConfig } from '@shared/types'
import {
  hexToSoftBg,
  PRIORITY_META,
  resolveSourceConfig,
  STATUS_META
} from '../constants'

interface GlobalSearchModalProps {
  open: boolean
  sources: SourceConfig[]
  onClose: () => void
  onSelectResult: (item: SearchResultItem) => void
}

export function GlobalSearchModal({
  open,
  sources,
  onClose,
  onSelectResult
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    void window.scrumNova.searchCards('').then(setResults)
    window.setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void window.scrumNova.searchCards(query).then((list) => {
        setResults(list)
        setActiveIndex(0)
      })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [query, open])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (results.length > 0 ? (i + 1) % results.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (results.length > 0 ? (i - 1 + results.length) % results.length : 0))
      return
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      onSelectResult(results[activeIndex])
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/35 pt-[12vh] px-4 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="flex max-h-[72vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* 搜索输入栏 */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-blue-600" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索所有空间的标题、下一步、详情、子任务、变更记录、截图 OCR 文字..."
            className="min-w-0 flex-1 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
            ESC
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {!query.trim() && results.length > 0 && (
            <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              最近活跃与更新的卡片
            </div>
          )}

          {results.map((item, idx) => {
            const { card } = item
            const active = idx === activeIndex
            const srcCfg = resolveSourceConfig(card.source, sources)
            const prioMeta = PRIORITY_META[card.priority] ?? PRIORITY_META.P2

            return (
              <div
                key={card.id}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onSelectResult(item)
                  onClose()
                }}
                className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition ${
                  active ? 'bg-blue-50/90 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.boardColor }}
                      />
                      {item.boardName}
                    </span>

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

                    {card.isUrgentInsert && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                        <Flame className="h-2.5 w-2.5" />
                        插单
                      </span>
                    )}

                    {card.isArchived ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        <Archive className="h-2.5 w-2.5" />
                        已归档
                      </span>
                    ) : (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          STATUS_META[card.status].badgeClass
                        }`}
                      >
                        {STATUS_META[card.status].label}
                      </span>
                    )}

                    {query.trim() && (
                      <span className="rounded bg-blue-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        命中：{item.matchField}
                      </span>
                    )}
                  </div>

                  <div className="truncate text-sm font-bold text-slate-900">{card.title}</div>

                  {item.matchSnippet && (
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {item.matchSnippet}
                    </div>
                  )}
                </div>

                {active && (
                  <span className="mt-2 inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-blue-600">
                    打开
                    <CornerDownLeft className="h-3 w-3" />
                  </span>
                )}
              </div>
            )
          })}

          {results.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              没有找到包含「{query}」的卡片、变更小记或截图识别文字
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <span>支持跨空间与历史归档卡片检索</span>
          <span>↑↓ 选择 · Enter 打开详情 · Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
