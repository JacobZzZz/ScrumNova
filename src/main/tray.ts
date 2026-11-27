import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import { getSettings, listBoards, listCards, updateCard, updateSettings } from './db'
import type { NavigateCommandPayload } from '@shared/types'

let tray: Tray | null = null

interface TrayCallbacks {
  onShowMainWindow: () => void
  onOpenQuickCapture: () => void
  onNavigateMainWindow: (payload: NavigateCommandPayload) => void
  onNotifyDataChanged: () => void
}

let callbacks: TrayCallbacks | null = null

// 绘制 36x36 (@2x = 18x18 pt) 极简双列看板图标，零外部图片路径依赖
function buildTrayIcon(): Electron.NativeImage {
  const size = 36
  const buf = Buffer.alloc(size * size * 4, 0)
  const isMac = process.platform === 'darwin'

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const idx = (y * size + x) * 4
    // Electron createFromBitmap 在 macOS/Windows 使用 BGRA 字节序
    buf[idx] = b
    buf[idx + 1] = g
    buf[idx + 2] = r
    buf[idx + 3] = a
  }

  const fillRect = (
    x0: number,
    y0: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a = 255
  ) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setPixel(x, y, r, g, b, a)
      }
    }
  }

  if (isMac) {
    // macOS Template Image：纯黑像素由系统自动适配深浅菜单栏
    // 外框上下左右（2px 线宽）
    fillRect(4, 4, 28, 3, 0, 0, 0)
    fillRect(4, 29, 28, 3, 0, 0, 0)
    fillRect(4, 4, 3, 28, 0, 0, 0)
    fillRect(29, 4, 3, 28, 0, 0, 0)
    // 左列长卡片 + 右列两张短卡片
    fillRect(10, 10, 6, 16, 0, 0, 0)
    fillRect(20, 10, 6, 7, 0, 0, 0)
    fillRect(20, 20, 6, 6, 0, 0, 0)
  } else {
    // Windows 托盘彩色圆角块 (#2563eb) + 白色看板条
    fillRect(2, 2, 32, 32, 37, 99, 235)
    fillRect(8, 8, 8, 20, 255, 255, 255)
    fillRect(20, 8, 8, 9, 255, 255, 255)
    fillRect(20, 20, 8, 8, 255, 255, 255)
  }

  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2.0 })
  if (isMac) {
    img.setTemplateImage(true)
  }
  return img
}

function truncateText(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str
}

export function formatShortcutLabel(accelerator: string): string {
  const isMac = process.platform === 'darwin'
  return accelerator
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+')
}

export function initTray(cb: TrayCallbacks): void {
  callbacks = cb
  if (tray) return

  tray = new Tray(buildTrayIcon())
  tray.setToolTip('ScrumNova · 个人敏捷工作台')
  refreshTray()
}

export function refreshTray(): void {
  if (!tray || !callbacks) return

  const settings = getSettings()
  const boards = listBoards()
  const activeBoard = boards.find((b) => b.id === settings.activeBoardId) ?? boards[0]
  const cards = activeBoard ? listCards(activeBoard.id, false) : []

  const doingCards = cards.filter((c) => c.status === 'doing')
  const todoCards = cards.filter((c) => c.status === 'todo')

  // 顶部菜单栏仅保留干净图标，不显示文字；鼠标悬停时可通过 Tooltip 查看进行中任务
  tray.setToolTip(
    doingCards.length > 0
      ? `ScrumNova · 进行中：${doingCards[0].title}${doingCards.length > 1 ? ` (+${doingCards.length - 1})` : ''}`
      : 'ScrumNova · 个人敏捷工作台'
  )

  const template: MenuItemConstructorOptions[] = []

  if (activeBoard) {
    template.push({
      label: `当前空间：${activeBoard.name}`,
      submenu: boards.map((b) => ({
        label: b.name,
        type: 'radio',
        checked: b.id === activeBoard.id,
        click: () => {
          updateSettings({ activeBoardId: b.id })
          callbacks?.onNotifyDataChanged()
          refreshTray()
        }
      }))
    })
    template.push({ type: 'separator' })
  }

  // 进行中任务区
  template.push({
    label: `🔥 进行中 (${doingCards.length})`,
    enabled: false
  })

  if (doingCards.length === 0) {
    template.push({
      label: '  当前没有正在进行的任务',
      enabled: false
    })
  } else {
    for (const card of doingCards.slice(0, 6)) {
      template.push({
        label: `  ● ${truncateText(card.title, 28)}`,
        submenu: [
          {
            label: '查看卡片详情',
            click: () => {
              callbacks?.onNavigateMainWindow({
                type: 'open-card',
                boardId: card.boardId,
                cardId: card.id
              })
            }
          },
          {
            label: '✓ 标记为已完成 (Done)',
            click: () => {
              updateCard({ id: card.id, status: 'done' })
              callbacks?.onNotifyDataChanged()
              refreshTray()
            }
          },
          {
            label: '⏸ 暂停放回待办 (Todo)',
            click: () => {
              updateCard({ id: card.id, status: 'todo' })
              callbacks?.onNotifyDataChanged()
              refreshTray()
            }
          }
        ]
      })
    }
  }

  template.push({ type: 'separator' })

  // 待办快捷开干区
  template.push({
    label: `📋 待办快捷开干 (${todoCards.length})`,
    enabled: false
  })

  if (todoCards.length === 0) {
    template.push({
      label: '  待办列暂无卡片',
      enabled: false
    })
  } else {
    for (const card of todoCards.slice(0, 5)) {
      template.push({
        label: `  ▶ 开始做：${truncateText(card.title, 26)}`,
        click: () => {
          updateCard({ id: card.id, status: 'doing' })
          callbacks?.onNotifyDataChanged()
          refreshTray()
        }
      })
    }
  }

  template.push({ type: 'separator' })

  template.push({
    label: `⚡ 快速秒记 (${formatShortcutLabel(settings.quickCaptureShortcut)})`,
    click: () => callbacks?.onOpenQuickCapture()
  })

  template.push({
    label: `🔍 全局历史搜索 (${process.platform === 'darwin' ? '⌘K' : 'Ctrl+K'})`,
    click: () => callbacks?.onNavigateMainWindow({ type: 'open-search' })
  })

  template.push({
    label: '打开 ScrumNova 主窗口',
    click: () => callbacks?.onShowMainWindow()
  })

  template.push({ type: 'separator' })
  template.push({
    label: '退出 ScrumNova',
    click: () => app.quit()
  })

  tray.setContextMenu(Menu.buildFromTemplate(template))
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
