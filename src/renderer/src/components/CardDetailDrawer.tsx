import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  FileInput,
  Flame,
  Footprints,
  History,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  ScanText,
  Send,
  Settings2,
  Trash2,
  X
} from 'lucide-react'
import type {
  Attachment,
  CardDetail,
  CardStatus,
  SourceConfig,
  Subtask
} from '@shared/types'
import {
  formatShortTime,
  getDueDateInfo,
  getMediaUrl,
  PRIORITIES,
  PRIORITY_META,
  QUICK_ESTIMATE_HOURS,
  resolveSourceConfig,
  SOURCE_PRESET_COLORS,
  STATUS_META
} from '../constants'

interface CardDetailDrawerProps {
  cardId: string | null
  sources: SourceConfig[]
  onClose: () => void
  onCardUpdated: () => Promise<void>
  onSourcesChanged: () => Promise<void>
  onCardDeleted: (cardId: string) => Promise<void>
}

export function CardDetailDrawer({
  cardId,
  sources,
  onClose,
  onCardUpdated,
  onSourcesChanged,
  onCardDeleted
}: CardDetailDrawerProps) {
  const [detail, setDetail] = useState<CardDetail | null>(null)
  const [title, setTitle] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [description, setDescription] = useState('')
  const [estimateInput, setEstimateInput] = useState('')

  const [addingSource, setAddingSource] = useState(false)
  const [managingSources, setManagingSources] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceColor, setNewSourceColor] = useState(SOURCE_PRESET_COLORS[3])

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newLogContent, setNewLogContent] = useState('')

  const [addingLink, setAddingLink] = useState(false)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const [pasteNotice, setPasteNotice] = useState<string | null>(null)
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadDetail = useCallback(async (id: string, resetInputs = false) => {
    const data = await window.scrumNova.getCardDetail(id)
    setDetail(data)
    if (resetInputs) {
      setTitle(data.card.title)
      setNextStep(data.card.nextStep)
      setDescription(data.card.description)
      setEstimateInput(data.card.estimateHours !== null ? String(data.card.estimateHours) : '')
      setConfirmDelete(false)
      setAddingLink(false)
      setAddingSource(false)
      setManagingSources(false)
    }
  }, [])

  useEffect(() => {
    if (!cardId) {
      setDetail(null)
      setPreviewImage(null)
      return
    }
    void loadDetail(cardId, true)
  }, [cardId, loadDetail])

  useEffect(() => {
    if (!cardId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cardId, previewImage, onClose])

  const flashNotice = (msg: string) => {
    setPasteNotice(msg)
    window.setTimeout(() => {
      setPasteNotice((curr) => (curr === msg ? null : curr))
    }, 2200)
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!detail) return
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return

    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    await window.scrumNova.saveImageAttachment({
      cardId: detail.card.id,
      dataUrl
    })
    await loadDetail(detail.card.id)
    await onCardUpdated()
    flashNotice('已粘贴并保存截图 ✓')
  }

  if (!cardId || !detail) return null

  const { card, subtasks, logs, attachments } = detail
  const activeSourceCfg = resolveSourceConfig(card.source, sources)
  const imageAttachments = attachments.filter((a) => a.type === 'image')
  const linkAttachments = attachments.filter((a) => a.type === 'link')
  const dueInfo = getDueDateInfo(card.dueDate, card.status === 'done')
  const doneSubtasks = subtasks.filter((s) => s.isDone).length
  const subtaskPercent =
    subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0

  const patchCard = async (patch: Parameters<typeof window.scrumNova.updateCard>[0]) => {
    await window.scrumNova.updateCard(patch)
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleTitleBlur = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(card.title)
      return
    }
    if (trimmed !== card.title) {
      await patchCard({ id: card.id, title: trimmed })
    }
  }

  const handleNextStepBlur = async () => {
    if (nextStep !== card.nextStep) {
      await patchCard({ id: card.id, nextStep })
    }
  }

  const handleDescriptionBlur = async () => {
    if (description !== card.description) {
      await patchCard({ id: card.id, description })
    }
  }

  const handleEstimateCommit = async (raw: string) => {
    setEstimateInput(raw)
    const trimmed = raw.trim()
    const nextVal = trimmed === '' ? null : Number(trimmed)
    if (nextVal !== null && (!Number.isFinite(nextVal) || nextVal < 0)) return
    if (nextVal !== card.estimateHours) {
      await patchCard({ id: card.id, estimateHours: nextVal })
    }
  }

  // 自定义来源增删改
  const handleCreateCustomSource = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newSourceName.trim()
    if (!trimmed) return
    const created = await window.scrumNova.createSource({
      name: trimmed,
      color: newSourceColor
    })
    setNewSourceName('')
    setAddingSource(false)
    await onSourcesChanged()
    await patchCard({ id: card.id, source: created.id })
    flashNotice(`已添加来源「${created.name}」`)
  }

  const handleUpdateSourceItem = async (
    src: SourceConfig,
    patch: { name?: string; color?: string }
  ) => {
    const nextName = patch.name !== undefined ? patch.name.trim() : src.name
    if (!nextName) return
    if (nextName === src.name && (patch.color === undefined || patch.color === src.color)) return
    await window.scrumNova.updateSource({
      id: src.id,
      name: nextName,
      color: patch.color ?? src.color
    })
    await onSourcesChanged()
  }

  const handleDeleteSourceItem = async (srcId: string) => {
    if (sources.length <= 1) return
    await window.scrumNova.deleteSource(srcId)
    await onSourcesChanged()
    await loadDetail(card.id)
  }

  // 子任务操作
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtaskTitle.trim()) return
    await window.scrumNova.createSubtask(card.id, newSubtaskTitle.trim())
    setNewSubtaskTitle('')
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleToggleSubtask = async (sub: Subtask) => {
    await window.scrumNova.updateSubtask({ id: sub.id, isDone: !sub.isDone })
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleSubtaskTitleBlur = async (sub: Subtask, nextTitle: string) => {
    const trimmed = nextTitle.trim()
    if (!trimmed || trimmed === sub.title) return
    await window.scrumNova.updateSubtask({ id: sub.id, title: trimmed })
    await loadDetail(card.id)
  }

  const handleMoveSubtask = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= subtasks.length) return
    const ids = subtasks.map((s) => s.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(targetIndex, 0, moved)
    await window.scrumNova.reorderSubtasks(card.id, ids)
    await loadDetail(card.id)
  }

  const handleDeleteSubtask = async (subId: string) => {
    await window.scrumNova.deleteSubtask(subId)
    await loadDetail(card.id)
    await onCardUpdated()
  }

  // 附件与 OCR 操作
  const handlePickLocalImage = async () => {
    const saved = await window.scrumNova.pickImageAttachment(card.id)
    if (saved) {
      await loadDetail(card.id)
      await onCardUpdated()
      flashNotice('图片已添加 ✓')
    }
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkUrl.trim()) return
    await window.scrumNova.createLinkAttachment({
      cardId: card.id,
      name: linkName.trim(),
      url: linkUrl.trim()
    })
    setLinkName('')
    setLinkUrl('')
    setAddingLink(false)
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleDeleteAttachment = async (attId: string) => {
    await window.scrumNova.deleteAttachment(attId)
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleExtractOcr = async (attId: string) => {
    setOcrLoadingId(attId)
    try {
      const updated = await window.scrumNova.extractAttachmentText(attId)
      await loadDetail(card.id)
      flashNotice(updated.ocrText ? '文字提取完成 ✓' : '未在图片中检测到文字')
    } catch (err) {
      flashNotice(err instanceof Error ? `提取失败：${err.message}` : '文字提取失败')
    } finally {
      setOcrLoadingId(null)
    }
  }

  const handleOcrTextBlur = async (img: Attachment, value: string) => {
    if (value === img.ocrText) return
    await window.scrumNova.updateAttachmentOcrText(img.id, value)
    await loadDetail(card.id)
  }

  const handleCopyOcrText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    flashNotice('已复制识别文字 ✓')
  }

  const handleInsertOcrToDescription = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const nextDesc = description.trim() ? `${description.trimEnd()}\n${trimmed}` : trimmed
    setDescription(nextDesc)
    await patchCard({ id: card.id, description: nextDesc })
    flashNotice('已填入上方需求详情 ✓')
  }

  // 需求变更小记
  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLogContent.trim()) return
    await window.scrumNova.createCardLog(card.id, newLogContent.trim())
    setNewLogContent('')
    await loadDetail(card.id)
    await onCardUpdated()
  }

  const handleDeleteLog = async (logId: string) => {
    await window.scrumNova.deleteCardLog(logId)
    await loadDetail(card.id)
    await onCardUpdated()
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[1px]"
      />

      <aside
        onPaste={(e) => void handlePaste(e)}
        className="fixed top-0 right-0 z-50 flex h-full w-[580px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl select-text"
      >
        {/* 顶部来源色带（动态跟随自定义颜色） */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: activeSourceCfg.color }} />

        {/* 抽屉顶栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <select
              value={card.status}
              onChange={(e) => void patchCard({ id: card.id, status: e.target.value as CardStatus })}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold outline-none ${STATUS_META[card.status].badgeClass}`}
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void patchCard({ id: card.id, isUrgentInsert: !card.isUrgentInsert })}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                card.isUrgentInsert
                  ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              {card.isUrgentInsert ? '已标插单' : '标为插单'}
            </button>

            {pasteNotice && (
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {pasteNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {card.isArchived ? (
              <button
                type="button"
                onClick={() => void patchCard({ id: card.id, isArchived: false })}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                恢复回看板
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await patchCard({ id: card.id, isArchived: true })
                  onClose()
                }}
                title="归档卡片（移出看板，仍可在归档箱与 Cmd+K 搜索中找到）"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Archive className="h-3.5 w-3.5" />
                归档
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (confirmDelete) {
                  void onCardDeleted(card.id)
                } else {
                  setConfirmDelete(true)
                }
              }}
              onMouseLeave={() => setConfirmDelete(false)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                confirmDelete
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? '确认删除卡片?' : '删除'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 主体滚动区 */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* 卡片标题 */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void handleTitleBlur()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              placeholder="卡片标题..."
              className="w-full rounded-lg border border-transparent px-1.5 py-1 text-lg font-extrabold text-slate-900 outline-none hover:border-slate-200 focus:border-blue-500"
            />
          </div>

          {/* 置顶高亮：当前进度 / 下一步 */}
          <section className="rounded-xl border border-amber-300/90 bg-amber-50/90 p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Footprints className="h-4 w-4 text-amber-600" />
                当前进度 / 下一步（防打断现场小记）
              </span>
              <span className="text-[11px] text-amber-700/80">会直接展示在看板卡片正面</span>
            </div>
            <textarea
              rows={2}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              onBlur={() => void handleNextStepBlur()}
              placeholder="被打断前随手记一句（例如：协议已调通，下一步接领奖弹窗回调）..."
              className="w-full resize-none rounded-lg border border-amber-200 bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-900 outline-none focus:border-amber-500"
            />
          </section>

          {/* 基础属性栏：自定义来源 + P0~P5 优先级 + 耗时 + 截止日 */}
          <section className="grid grid-cols-2 gap-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            {/* 需求来源（整行，支持新增自定义与管理） */}
            <div className="col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500">需求来源</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSource((v) => !v)
                      setManagingSources(false)
                    }}
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-3 w-3" />
                    自定义
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManagingSources((v) => !v)
                      setAddingSource(false)
                    }}
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      managingSources
                        ? 'bg-slate-200 text-slate-800'
                        : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-700'
                    }`}
                  >
                    <Settings2 className="h-3 w-3" />
                    {managingSources ? '完成' : '管理'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {sources.map((s) => {
                  const active = card.source === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void patchCard({ id: card.id, source: s.id })}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? 'text-white shadow-xs'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                      }`}
                      style={active ? { backgroundColor: s.color } : undefined}
                    >
                      {!active && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      {s.name}
                    </button>
                  )
                })}
              </div>

              {/* 新增自定义来源小面板 */}
              {addingSource && (
                <form
                  onSubmit={(e) => void handleCreateCustomSource(e)}
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-white p-2.5"
                >
                  <input
                    autoFocus
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="输入新来源（如：美术对接 / 运营需求）..."
                    className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    {SOURCE_PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSourceColor(c)}
                        className={`h-4 w-4 rounded-full transition ${
                          newSourceColor === c
                            ? 'scale-110 ring-2 ring-slate-900 ring-offset-1'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={newSourceColor}
                      onChange={(e) => setNewSourceColor(e.target.value)}
                      title="自定义选色"
                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    添加并选中
                  </button>
                </form>
              )}

              {/* 管理已有来源（改名 / 改色 / 删除） */}
              {managingSources && (
                <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
                  {sources.map((src) => (
                    <div key={src.id} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={src.color}
                        onChange={(e) =>
                          void handleUpdateSourceItem(src, { color: e.target.value })
                        }
                        title="修改颜色"
                        className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <input
                        defaultValue={src.name}
                        onBlur={(e) =>
                          void handleUpdateSourceItem(src, { name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                      />
                      {sources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteSourceItem(src.id)}
                          title="删除此来源（使用该来源的卡片会自动归入首个来源）"
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 优先级 P0 ~ P5（整行 6 等分） */}
            <div className="col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500">优先级 (P0 - P5)</label>
                <span className="text-[11px] text-slate-400">
                  当前：{card.priority} · {PRIORITY_META[card.priority]?.hint ?? ''}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PRIORITIES.map((p) => {
                  const active = card.priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      title={`${p} · ${PRIORITY_META[p].hint}`}
                      onClick={() => void patchCard({ id: card.id, priority: p })}
                      className={`rounded-lg py-1 text-xs font-bold transition ${
                        active
                          ? PRIORITY_META[p].activeButtonClass
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Clock className="h-3 w-3" />
                估算耗时（小时）
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimateInput}
                  onChange={(e) => setEstimateInput(e.target.value)}
                  onBlur={(e) => void handleEstimateCommit(e.target.value)}
                  placeholder="未设"
                  className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-1">
                  {QUICK_ESTIMATE_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => void handleEstimateCommit(String(h))}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        card.estimateHours === h
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  截止日期
                </span>
                {dueInfo && (
                  <span className={`rounded px-1.5 py-0.2 text-[10px] ${dueInfo.className}`}>
                    {dueInfo.text}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={card.dueDate ?? ''}
                  onChange={(e) =>
                    void patchCard({ id: card.id, dueDate: e.target.value || null })
                  }
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                />
                {card.dueDate && (
                  <button
                    type="button"
                    onClick={() => void patchCard({ id: card.id, dueDate: null })}
                    className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-200"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 子任务清单 Checklist */}
          <section className="rounded-xl border border-slate-200 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CheckSquare className="h-4 w-4 text-blue-600" />
                子任务拆解 ({doneSubtasks}/{subtasks.length})
              </span>
              {subtasks.length > 0 && (
                <span className="text-xs font-semibold text-slate-500">{subtaskPercent}%</span>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full transition-all ${
                    subtaskPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${subtaskPercent}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {subtasks.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sub.isDone}
                    onChange={() => void handleToggleSubtask(sub)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
                  />
                  <input
                    defaultValue={sub.title}
                    onBlur={(e) => void handleSubtaskTitleBlur(sub, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${
                      sub.isDone ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  />
                  <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void handleMoveSubtask(idx, -1)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === subtasks.length - 1}
                      onClick={() => void handleMoveSubtask(idx, 1)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSubtask(sub.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={(e) => void handleAddSubtask(e)} className="mt-2.5 flex gap-1.5">
              <input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="添加子步骤（如：搭 UI、写协议、接埋点、自测），回车继续添加..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </button>
            </form>
          </section>

          {/* 需求描述 & 截图 / 外链附件区 */}
          <section className="rounded-xl border border-slate-200 p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">需求详情 · 截图与文档链接</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handlePickLocalImage()}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
                  上传图片
                </button>
                <button
                  type="button"
                  onClick={() => setAddingLink((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Link2 className="h-3.5 w-3.5 text-violet-600" />
                  添加外链
                </button>
              </div>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void handleDescriptionBlur()}
              placeholder="补充需求原文、边界规则或备注...（在本窗口任意处按 Cmd+V 可直接粘贴截图保存）"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />

            {addingLink && (
              <form
                onSubmit={(e) => void handleAddLink(e)}
                className="mt-2.5 grid grid-cols-12 gap-1.5 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5"
              >
                <input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="链接名称（如：蓝湖设计稿 / 飞书需求文档）"
                  className="col-span-5 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-violet-500"
                />
                <input
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="col-span-5 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  className="col-span-2 rounded bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  保存
                </button>
              </form>
            )}

            {linkAttachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {linkAttachments.map((link) => (
                  <div
                    key={link.id}
                    className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => void window.scrumNova.openExternalLink(link.value)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium">{link.name}</span>
                      <span className="truncate text-[11px] text-slate-400">{link.value}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAttachment(link.id)}
                      className="ml-2 rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {imageAttachments.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {imageAttachments.map((img) => {
                  const isRecognizing = ocrLoadingId === img.id
                  return (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 p-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate font-medium text-slate-600">{img.name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={isRecognizing}
                            onClick={() => void handleExtractOcr(img.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                          >
                            {isRecognizing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ScanText className="h-3 w-3" />
                            )}
                            {isRecognizing
                              ? '识别中...'
                              : img.ocrText
                                ? '重新提取'
                                : '提取文字'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteAttachment(img.id)}
                            title="删除截图"
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                            删除
                          </button>
                        </div>
                      </div>

                      <div
                        onClick={() => setPreviewImage(img)}
                        title="点击放大查看原图"
                        className="flex cursor-zoom-in items-center justify-center rounded bg-white p-1.5 ring-1 ring-slate-100"
                      >
                        <img
                          src={getMediaUrl(img.value)}
                          alt={img.name}
                          className="max-h-44 w-auto max-w-full object-contain"
                        />
                      </div>

                      {img.ocrText && (
                        <div className="mt-2 rounded-lg border border-blue-200/80 bg-white p-2">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-blue-700">
                              识别文字（可直接修改）
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleCopyOcrText(img.ocrText)}
                                className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                              >
                                <Copy className="h-3 w-3" />
                                复制
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleInsertOcrToDescription(img.ocrText)}
                                className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                              >
                                <FileInput className="h-3 w-3" />
                                填入需求详情
                              </button>
                            </div>
                          </div>
                          <textarea
                            key={`${img.id}-${img.ocrText}`}
                            rows={Math.min(5, Math.max(2, img.ocrText.split('\n').length))}
                            defaultValue={img.ocrText}
                            onBlur={(e) => void handleOcrTextBlur(img, e.target.value)}
                            className="w-full rounded border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-xs leading-relaxed text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">
                提示：截图后直接按 <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono">Cmd+V</kbd>{' '}
                即可把图片贴进当前卡片，防策划改稿无据可查。
              </p>
            )}
          </section>

          {/* 需求变更小记 Changelog */}
          <section className="rounded-xl border border-slate-200 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <History className="h-4 w-4 text-slate-600" />
                需求变更小记 ({logs.length})
              </span>
              <span className="text-[11px] text-slate-400">自动记录时间戳，防遗忘防扯皮</span>
            </div>

            <form onSubmit={(e) => void handleAddLog(e)} className="mb-3 flex gap-1.5">
              <input
                value={newLogContent}
                onChange={(e) => setNewLogContent(e.target.value)}
                placeholder="例如：策划改口，每日重置时间从 0 点改为 5 点..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                <Send className="h-3 w-3" />
                记录
              </button>
            </form>

            {logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="group flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="mr-2 font-mono text-[11px] font-semibold text-slate-400">
                        [{formatShortTime(log.createdAt)}]
                      </span>
                      <span className="break-words text-slate-800">{log.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLog(log.id)}
                      className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-slate-400">暂无变更记录</div>
            )}
          </section>
        </div>
      </aside>

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-8"
        >
          <img
            src={getMediaUrl(previewImage.value)}
            alt={previewImage.name}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 rounded-full bg-white/15 p-2 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  )
}
