import { useEffect, useState } from 'react'
import { Database, Keyboard, Sparkles, X } from 'lucide-react'
import type { AppSettings, DbStatusInfo } from '@shared/types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onSettingsUpdated: (settings: AppSettings) => void
}

function keyEventToAccelerator(e: React.KeyboardEvent): string | null {
  const ignore = new Set(['Meta', 'Control', 'Shift', 'Alt'])
  if (ignore.has(e.key)) return null

  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()

  return [...parts, key].join('+')
}

export function SettingsModal({ open, onClose, onSettingsUpdated }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dbStatus, setDbStatus] = useState<DbStatusInfo | null>(null)
  const [recording, setRecording] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErrorMsg(null)
    setSavedNotice(null)
    setRecording(false)
    void Promise.all([window.scrumNova.getSettings(), window.scrumNova.getDbStatus()]).then(
      ([s, db]) => {
        setSettings(s)
        setDbStatus(db)
      }
    )
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recording) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, recording, onClose])

  if (!open || !settings) return null

  const saveShortcut = async (shortcut: string) => {
    setErrorMsg(null)
    try {
      const updated = await window.scrumNova.updateSettings({ quickCaptureShortcut: shortcut })
      setSettings(updated)
      onSettingsUpdated(updated)
      setRecording(false)
      setSavedNotice('全局快捷键已更新 ✓')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '快捷键保存失败')
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">私人助理与系统设置</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 全局秒记快捷键 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Keyboard className="h-4 w-4 text-blue-600" />
              全局秒记快捷键（任意软件下直接唤起）
            </div>
            <p className="mb-2.5 text-[11px] text-slate-500">
              在写代码或看聊天软件时按下快捷键，即可弹出秒记条，回车存卡片
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRecording(true)
                  setErrorMsg(null)
                  setSavedNotice(null)
                }}
                onKeyDown={(e) => {
                  if (!recording) return
                  e.preventDefault()
                  if (e.key === 'Escape') {
                    setRecording(false)
                    return
                  }
                  const acc = keyEventToAccelerator(e)
                  if (acc) {
                    void saveShortcut(acc)
                  }
                }}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-left font-mono text-xs font-semibold transition ${
                  recording
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                }`}
              >
                {recording ? '请按下新的组合键（如 Cmd+Shift+Space）...' : settings.quickCaptureShortcut}
              </button>

              <button
                type="button"
                onClick={() => void saveShortcut('CommandOrControl+Shift+N')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                恢复默认
              </button>
            </div>

            {errorMsg && <p className="mt-1.5 text-[11px] font-medium text-rose-600">{errorMsg}</p>}
            {savedNotice && (
              <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">{savedNotice}</p>
            )}
          </div>

          {/* 常用快捷键速查 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="mb-2 text-xs font-bold text-slate-800">内置快捷键速查</div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>全局历史搜索</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘K
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>新建任务卡片</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘N
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>显示/收起需求池</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘B
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>打开归档箱</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘⇧A
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>详情页粘贴截图</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘V
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>偏好与快捷键</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
                  ⌘,
                </kbd>
              </div>
            </div>
          </div>

          {/* v0.2 AI 预留位 */}
          <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-800">
              <Sparkles className="h-4 w-4 text-violet-600" />
              AI 私人助理（v0.2 预留）
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-700/80">
              下一版本将在此接入 Google Gemini API 与 DeepSeek API，支持粘贴长文本自动拆卡片、拆子步骤与一键生成进度日报。
            </p>
          </div>

          {/* 本地数据路径 */}
          {dbStatus && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 select-text">
              <div className="mb-1 flex items-center gap-1 font-semibold text-slate-700">
                <Database className="h-3.5 w-3.5 text-emerald-600" />
                本地离线数据路径（拷贝此目录即可完整备份）
              </div>
              <div className="break-all font-mono text-[10px] text-slate-500">{dbStatus.dbPath}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
