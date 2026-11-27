import { contextBridge, ipcRenderer } from 'electron'
import type { NavigateCommandPayload, ScrumNovaApi } from '@shared/types'

const api: ScrumNovaApi = {
  getDbStatus: () => ipcRenderer.invoke('db:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (input) => ipcRenderer.invoke('settings:update', input),

  listBoards: () => ipcRenderer.invoke('boards:list'),
  createBoard: (input) => ipcRenderer.invoke('boards:create', input),
  updateBoard: (input) => ipcRenderer.invoke('boards:update', input),
  deleteBoard: (id) => ipcRenderer.invoke('boards:delete', id),

  listSources: () => ipcRenderer.invoke('sources:list'),
  createSource: (input) => ipcRenderer.invoke('sources:create', input),
  updateSource: (input) => ipcRenderer.invoke('sources:update', input),
  deleteSource: (id) => ipcRenderer.invoke('sources:delete', id),

  listCards: (boardId, includeArchived) => ipcRenderer.invoke('cards:list', boardId, includeArchived),
  listArchivedCards: (boardId) => ipcRenderer.invoke('cards:list-archived', boardId),
  countArchivedCards: (boardId) => ipcRenderer.invoke('cards:count-archived', boardId),
  archiveDoneCards: (boardId) => ipcRenderer.invoke('cards:archive-done', boardId),
  searchCards: (query) => ipcRenderer.invoke('cards:search', query),
  getCardDetail: (cardId) => ipcRenderer.invoke('cards:detail', cardId),
  createCard: (input) => ipcRenderer.invoke('cards:create', input),
  updateCard: (input) => ipcRenderer.invoke('cards:update', input),
  reorderCards: (patches) => ipcRenderer.invoke('cards:reorder', patches),
  deleteCard: (id) => ipcRenderer.invoke('cards:delete', id),

  createSubtask: (cardId, title) => ipcRenderer.invoke('subtasks:create', cardId, title),
  updateSubtask: (input) => ipcRenderer.invoke('subtasks:update', input),
  reorderSubtasks: (cardId, orderedIds) => ipcRenderer.invoke('subtasks:reorder', cardId, orderedIds),
  deleteSubtask: (id) => ipcRenderer.invoke('subtasks:delete', id),

  createCardLog: (cardId, content) => ipcRenderer.invoke('logs:create', cardId, content),
  deleteCardLog: (id) => ipcRenderer.invoke('logs:delete', id),

  saveImageAttachment: (input) => ipcRenderer.invoke('attachments:save-image', input),
  pickImageAttachment: (cardId) => ipcRenderer.invoke('attachments:pick-image', cardId),
  createLinkAttachment: (input) => ipcRenderer.invoke('attachments:create-link', input),
  extractAttachmentText: (attachmentId) =>
    ipcRenderer.invoke('attachments:extract-text', attachmentId),
  updateAttachmentOcrText: (attachmentId, ocrText) =>
    ipcRenderer.invoke('attachments:update-ocr', attachmentId, ocrText),
  deleteAttachment: (id) => ipcRenderer.invoke('attachments:delete', id),
  openExternalLink: (url) => ipcRenderer.invoke('shell:open-external', url),

  openQuickCapture: () => ipcRenderer.invoke('window:open-quick-capture'),
  hideQuickCapture: () => ipcRenderer.invoke('window:hide-quick-capture'),

  onDataChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:data-changed', listener)
    return () => {
      ipcRenderer.removeListener('app:data-changed', listener)
    }
  },
  onNavigateCommand: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: NavigateCommandPayload) => {
      callback(payload)
    }
    ipcRenderer.on('app:navigate', listener)
    return () => {
      ipcRenderer.removeListener('app:navigate', listener)
    }
  }
}

contextBridge.exposeInMainWorld('scrumNova', api)
