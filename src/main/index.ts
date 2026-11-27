import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  net,
  protocol,
  screen,
  shell
} from 'electron'
import { basename, join } from 'path'
import { pathToFileURL } from 'url'
import {
  archiveDoneCards,
  closeDatabase,
  countArchivedCards,
  createBoard,
  createCard,
  createCardLog,
  createLinkAttachment,
  createSource,
  createSubtask,
  deleteAttachment,
  deleteBoard,
  deleteCard,
  deleteCardLog,
  deleteSource,
  deleteSubtask,
  getAttachmentsDir,
  getCardDetail,
  getDbStatus,
  getImageAttachmentFilePath,
  getSettings,
  initDatabase,
  listArchivedCards,
  listBoards,
  listCards,
  listSources,
  reorderCards,
  reorderSubtasks,
  saveImageAttachment,
  saveImageAttachmentFromPath,
  searchCards,
  updateAttachmentOcrText,
  updateBoard,
  updateCard,
  updateSettings,
  updateSource,
  updateSubtask
} from './db'
import { recognizeImageText } from './ocr'
import { setupApplicationMenu } from './menu'
import { destroyTray, initTray, refreshTray } from './tray'
import type {
  CardOrderPatch,
  CreateBoardInput,
  CreateCardInput,
  CreateLinkAttachmentInput,
  CreateSourceInput,
  NavigateCommandPayload,
  SaveImageAttachmentInput,
  UpdateAppSettingsInput,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateSourceInput,
  UpdateSubtaskInput
} from '@shared/types'

let mainWindow: BrowserWindow | null = null
let quickWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'scrumnova-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

function broadcastDataChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('app:data-changed')
    }
  }
  refreshTray()
}

function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  const win = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'ScrumNova',
    backgroundColor: '#f1f5f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

function showMainWindow(): BrowserWindow {
  const win = createMainWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function navigateMainWindow(payload: NavigateCommandPayload): void {
  const isExisting = Boolean(mainWindow && !mainWindow.isDestroyed())
  const win = showMainWindow()
  if (isExisting && !win.webContents.isLoading()) {
    win.webContents.send('app:navigate', payload)
  } else {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('app:navigate', payload)
    })
  }
}

function ensureQuickCaptureWindow(): BrowserWindow {
  if (quickWindow && !quickWindow.isDestroyed()) {
    return quickWindow
  }

  const win = new BrowserWindow({
    width: 580,
    height: 268,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setAlwaysOnTop(true, 'floating')
  }

  win.on('blur', () => {
    if (!win.isDestroyed() && win.isVisible()) {
      win.hide()
    }
  })

  win.on('closed', () => {
    if (quickWindow === win) {
      quickWindow = null
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#quick-capture`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick-capture' })
  }

  quickWindow = win
  return win
}

function openQuickCaptureWindow(): void {
  const win = ensureQuickCaptureWindow()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width, height } = display.workArea
  const winWidth = 580
  const posX = Math.round(x + (width - winWidth) / 2)
  const posY = Math.round(y + Math.max(72, height * 0.16))

  win.setPosition(posX, posY, false)
  win.webContents.send('app:data-changed')
  win.show()
  win.focus()
}

function toggleQuickCaptureWindow(): void {
  if (quickWindow && !quickWindow.isDestroyed() && quickWindow.isVisible()) {
    quickWindow.hide()
  } else {
    openQuickCaptureWindow()
  }
}

function registerGlobalCaptureShortcut(accelerator: string): boolean {
  globalShortcut.unregisterAll()
  try {
    return globalShortcut.register(accelerator, () => {
      toggleQuickCaptureWindow()
    })
  } catch {
    return false
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('db:status', () => getDbStatus())
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_event, input: UpdateAppSettingsInput) => {
    const prev = getSettings()
    const updated = updateSettings(input)
    if (
      input.quickCaptureShortcut &&
      input.quickCaptureShortcut !== prev.quickCaptureShortcut
    ) {
      const ok = registerGlobalCaptureShortcut(updated.quickCaptureShortcut)
      if (!ok) {
        // 恢复原快捷键并提示失败
        updateSettings({ quickCaptureShortcut: prev.quickCaptureShortcut })
        registerGlobalCaptureShortcut(prev.quickCaptureShortcut)
        throw new Error(`快捷键 ${input.quickCaptureShortcut} 注册失败或已被系统占用`)
      }
    }
    broadcastDataChanged()
    return updated
  })

  ipcMain.handle('boards:list', () => listBoards())
  ipcMain.handle('boards:create', (_event, input: CreateBoardInput) => {
    const res = createBoard(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('boards:update', (_event, input: UpdateBoardInput) => {
    const res = updateBoard(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('boards:delete', (_event, id: string) => {
    deleteBoard(id)
    broadcastDataChanged()
  })

  ipcMain.handle('sources:list', () => listSources())
  ipcMain.handle('sources:create', (_event, input: CreateSourceInput) => {
    const res = createSource(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('sources:update', (_event, input: UpdateSourceInput) => {
    const res = updateSource(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('sources:delete', (_event, id: string) => {
    deleteSource(id)
    broadcastDataChanged()
  })

  ipcMain.handle('cards:list', (_event, boardId: string, includeArchived?: boolean) =>
    listCards(boardId, includeArchived)
  )
  ipcMain.handle('cards:list-archived', (_event, boardId: string) => listArchivedCards(boardId))
  ipcMain.handle('cards:count-archived', (_event, boardId: string) => countArchivedCards(boardId))
  ipcMain.handle('cards:archive-done', (_event, boardId: string) => {
    const count = archiveDoneCards(boardId)
    broadcastDataChanged()
    return count
  })
  ipcMain.handle('cards:search', (_event, query: string) => searchCards(query))
  ipcMain.handle('cards:detail', (_event, cardId: string) => getCardDetail(cardId))
  ipcMain.handle('cards:create', (_event, input: CreateCardInput) => {
    const res = createCard(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('cards:update', (_event, input: UpdateCardInput) => {
    const res = updateCard(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('cards:reorder', (_event, patches: CardOrderPatch[]) => {
    reorderCards(patches)
    broadcastDataChanged()
  })
  ipcMain.handle('cards:delete', (_event, id: string) => {
    deleteCard(id)
    broadcastDataChanged()
  })

  ipcMain.handle('subtasks:create', (_event, cardId: string, title: string) => {
    const res = createSubtask(cardId, title)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('subtasks:update', (_event, input: UpdateSubtaskInput) => {
    const res = updateSubtask(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('subtasks:reorder', (_event, cardId: string, orderedIds: string[]) =>
    reorderSubtasks(cardId, orderedIds)
  )
  ipcMain.handle('subtasks:delete', (_event, id: string) => {
    deleteSubtask(id)
    broadcastDataChanged()
  })

  ipcMain.handle('logs:create', (_event, cardId: string, content: string) => {
    const res = createCardLog(cardId, content)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('logs:delete', (_event, id: string) => {
    deleteCardLog(id)
    broadcastDataChanged()
  })

  ipcMain.handle('attachments:save-image', (_event, input: SaveImageAttachmentInput) => {
    const res = saveImageAttachment(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('attachments:pick-image', async (event, cardId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
        })
      : await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
        })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const res = saveImageAttachmentFromPath(cardId, result.filePaths[0])
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('attachments:create-link', (_event, input: CreateLinkAttachmentInput) => {
    const res = createLinkAttachment(input)
    broadcastDataChanged()
    return res
  })
  ipcMain.handle('attachments:extract-text', async (_event, attachmentId: string) => {
    const filePath = getImageAttachmentFilePath(attachmentId)
    const recognized = await recognizeImageText(filePath)
    return updateAttachmentOcrText(attachmentId, recognized)
  })
  ipcMain.handle(
    'attachments:update-ocr',
    (_event, attachmentId: string, ocrText: string) => updateAttachmentOcrText(attachmentId, ocrText)
  )
  ipcMain.handle('attachments:delete', (_event, id: string) => {
    deleteAttachment(id)
    broadcastDataChanged()
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Only http/https URLs are supported')
    }
    await shell.openExternal(url)
  })

  ipcMain.handle('window:open-quick-capture', () => {
    openQuickCaptureWindow()
  })
  ipcMain.handle('window:hide-quick-capture', () => {
    if (quickWindow && !quickWindow.isDestroyed()) {
      quickWindow.hide()
    }
  })
}

app.setName('ScrumNova')

const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    initDatabase()

    protocol.handle('scrumnova-media', (request) => {
      const url = new URL(request.url)
      const fileName = basename(decodeURIComponent(url.pathname))
      const filePath = join(getAttachmentsDir(), fileName)
      return net.fetch(pathToFileURL(filePath).toString())
    })

    registerIpcHandlers()
    setupApplicationMenu({
      onOpenQuickCapture: () => openQuickCaptureWindow(),
      onNavigateMainWindow: (payload) => navigateMainWindow(payload)
    })
    createMainWindow()
    ensureQuickCaptureWindow()

    const settings = getSettings()
    registerGlobalCaptureShortcut(settings.quickCaptureShortcut)

    initTray({
      onShowMainWindow: () => showMainWindow(),
      onOpenQuickCapture: () => openQuickCaptureWindow(),
      onNavigateMainWindow: (payload) => navigateMainWindow(payload),
      onNotifyDataChanged: () => broadcastDataChanged()
    })

    app.on('activate', () => {
      showMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyTray()
  closeDatabase()
})
