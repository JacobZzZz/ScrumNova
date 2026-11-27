export type CardStatus = 'inbox' | 'todo' | 'doing' | 'blocked' | 'done'
export type CardSource = string
export type CardPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
export type AttachmentType = 'image' | 'link'

export interface Board {
  id: string
  name: string
  color: string
  weeklyLimitHours: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SourceConfig {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: string
}

export interface Card {
  id: string
  boardId: string
  title: string
  status: CardStatus
  source: CardSource
  priority: CardPriority
  isUrgentInsert: boolean
  estimateHours: number | null
  dueDate: string | null
  nextStep: string
  description: string
  sortOrder: number
  isArchived: boolean
  subtaskTotal: number
  subtaskDone: number
  attachmentCount: number
  coverImage: string | null
  logCount: number
  createdAt: string
  updatedAt: string
}

export interface Subtask {
  id: string
  cardId: string
  title: string
  isDone: boolean
  sortOrder: number
  createdAt: string
}

export interface CardLog {
  id: string
  cardId: string
  content: string
  createdAt: string
}

export interface Attachment {
  id: string
  cardId: string
  type: AttachmentType
  name: string
  value: string
  ocrText: string
  createdAt: string
}

export interface CardDetail {
  card: Card
  subtasks: Subtask[]
  logs: CardLog[]
  attachments: Attachment[]
}

export type SearchMatchField =
  | '最近更新'
  | '标题'
  | '下一步'
  | '需求详情'
  | '子任务'
  | '变更小记'
  | '截图OCR/附件'

export interface SearchResultItem {
  card: Card
  boardName: string
  boardColor: string
  matchField: SearchMatchField
  matchSnippet: string
}

export interface AppSettings {
  quickCaptureShortcut: string
  activeBoardId: string
}

export interface UpdateAppSettingsInput {
  quickCaptureShortcut?: string
  activeBoardId?: string
}

export interface NavigateCommandPayload {
  type: 'open-card' | 'open-search' | 'open-new-card' | 'toggle-backlog' | 'open-archive' | 'open-settings'
  boardId?: string
  cardId?: string
}

export interface CreateBoardInput {
  name: string
  color?: string
  weeklyLimitHours?: number
}

export interface UpdateBoardInput {
  id: string
  name?: string
  color?: string
  weeklyLimitHours?: number
}

export interface CreateSourceInput {
  name: string
  color: string
}

export interface UpdateSourceInput {
  id: string
  name?: string
  color?: string
}

export interface CreateCardInput {
  boardId: string
  title: string
  status?: CardStatus
  source?: CardSource
  priority?: CardPriority
  isUrgentInsert?: boolean
  estimateHours?: number | null
  dueDate?: string | null
  nextStep?: string
  description?: string
}

export interface UpdateCardInput {
  id: string
  title?: string
  status?: CardStatus
  source?: CardSource
  priority?: CardPriority
  isUrgentInsert?: boolean
  estimateHours?: number | null
  dueDate?: string | null
  nextStep?: string
  description?: string
  sortOrder?: number
  isArchived?: boolean
}

export interface CardOrderPatch {
  id: string
  status: CardStatus
  sortOrder: number
}

export interface UpdateSubtaskInput {
  id: string
  title?: string
  isDone?: boolean
  sortOrder?: number
}

export interface SaveImageAttachmentInput {
  cardId: string
  dataUrl: string
  name?: string
}

export interface CreateLinkAttachmentInput {
  cardId: string
  name: string
  url: string
}

export interface DbStatusInfo {
  dbPath: string
  boardCount: number
  cardCount: number
  sqliteVersion: string
}

export interface ScrumNovaApi {
  getDbStatus: () => Promise<DbStatusInfo>
  getSettings: () => Promise<AppSettings>
  updateSettings: (input: UpdateAppSettingsInput) => Promise<AppSettings>

  listBoards: () => Promise<Board[]>
  createBoard: (input: CreateBoardInput) => Promise<Board>
  updateBoard: (input: UpdateBoardInput) => Promise<Board>
  deleteBoard: (id: string) => Promise<void>

  listSources: () => Promise<SourceConfig[]>
  createSource: (input: CreateSourceInput) => Promise<SourceConfig>
  updateSource: (input: UpdateSourceInput) => Promise<SourceConfig>
  deleteSource: (id: string) => Promise<void>

  listCards: (boardId: string, includeArchived?: boolean) => Promise<Card[]>
  listArchivedCards: (boardId: string) => Promise<Card[]>
  countArchivedCards: (boardId: string) => Promise<number>
  archiveDoneCards: (boardId: string) => Promise<number>
  searchCards: (query: string) => Promise<SearchResultItem[]>
  getCardDetail: (cardId: string) => Promise<CardDetail>
  createCard: (input: CreateCardInput) => Promise<Card>
  updateCard: (input: UpdateCardInput) => Promise<Card>
  reorderCards: (patches: CardOrderPatch[]) => Promise<void>
  deleteCard: (id: string) => Promise<void>

  createSubtask: (cardId: string, title: string) => Promise<Subtask>
  updateSubtask: (input: UpdateSubtaskInput) => Promise<Subtask>
  reorderSubtasks: (cardId: string, orderedIds: string[]) => Promise<Subtask[]>
  deleteSubtask: (id: string) => Promise<void>

  createCardLog: (cardId: string, content: string) => Promise<CardLog>
  deleteCardLog: (id: string) => Promise<void>

  saveImageAttachment: (input: SaveImageAttachmentInput) => Promise<Attachment>
  pickImageAttachment: (cardId: string) => Promise<Attachment | null>
  createLinkAttachment: (input: CreateLinkAttachmentInput) => Promise<Attachment>
  extractAttachmentText: (attachmentId: string) => Promise<Attachment>
  updateAttachmentOcrText: (attachmentId: string, ocrText: string) => Promise<Attachment>
  deleteAttachment: (id: string) => Promise<void>
  openExternalLink: (url: string) => Promise<void>

  openQuickCapture: () => Promise<void>
  hideQuickCapture: () => Promise<void>
  onDataChanged: (callback: () => void) => () => void
  onNavigateCommand: (callback: (payload: NavigateCommandPayload) => void) => () => void
}
