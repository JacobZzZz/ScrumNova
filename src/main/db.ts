import { app } from 'electron'
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { DatabaseSync } from 'node:sqlite'
import type {
  AppSettings,
  Attachment,
  AttachmentType,
  Board,
  Card,
  CardDetail,
  CardLog,
  CardOrderPatch,
  CardPriority,
  CardSource,
  CardStatus,
  CreateBoardInput,
  CreateCardInput,
  CreateLinkAttachmentInput,
  CreateSourceInput,
  DbStatusInfo,
  SaveImageAttachmentInput,
  SearchMatchField,
  SearchResultItem,
  SourceConfig,
  Subtask,
  UpdateAppSettingsInput,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateSourceInput,
  UpdateSubtaskInput
} from '@shared/types'

let db: DatabaseSync | null = null
let currentDbPath = ''
let attachmentsDir = ''

interface BoardRow {
  id: string
  name: string
  color: string
  weekly_limit_hours: number
  sort_order: number
  created_at: string
  updated_at: string
}

interface SourceRow {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: string
}

interface CardRow {
  id: string
  board_id: string
  title: string
  status: string
  source: string
  priority: string
  is_urgent_insert: number
  estimate_hours: number | null
  due_date: string | null
  next_step: string
  description: string
  sort_order: number
  is_archived: number
  subtask_total: number
  subtask_done: number
  attachment_count: number
  cover_image: string | null
  log_count: number
  created_at: string
  updated_at: string
}

interface SubtaskRow {
  id: string
  card_id: string
  title: string
  is_done: number
  sort_order: number
  created_at: string
}

interface CardLogRow {
  id: string
  card_id: string
  content: string
  created_at: string
}

interface AttachmentRow {
  id: string
  card_id: string
  type: string
  name: string
  value: string
  ocr_text: string
  created_at: string
}

const CARD_SELECT_BASE = `
  SELECT
    c.*,
    (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id) AS subtask_total,
    (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id AND s.is_done = 1) AS subtask_done,
    (SELECT COUNT(*) FROM attachments a WHERE a.card_id = c.id) AS attachment_count,
    (SELECT a.value FROM attachments a WHERE a.card_id = c.id AND a.type = 'image' ORDER BY a.created_at ASC LIMIT 1) AS cover_image,
    (SELECT COUNT(*) FROM card_logs l WHERE l.card_id = c.id) AS log_count
  FROM cards c
`

function nowIso(): string {
  return new Date().toISOString()
}

function mapBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    weeklyLimitHours: row.weekly_limit_hours,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSource(row: SourceRow): SourceConfig {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }
}

function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    status: row.status as CardStatus,
    source: row.source as CardSource,
    priority: row.priority as CardPriority,
    isUrgentInsert: Boolean(row.is_urgent_insert),
    estimateHours: row.estimate_hours,
    dueDate: row.due_date,
    nextStep: row.next_step,
    description: row.description,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    subtaskTotal: Number(row.subtask_total ?? 0),
    subtaskDone: Number(row.subtask_done ?? 0),
    attachmentCount: Number(row.attachment_count ?? 0),
    coverImage: row.cover_image ?? null,
    logCount: Number(row.log_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    cardId: row.card_id,
    title: row.title,
    isDone: Boolean(row.is_done),
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }
}

function mapCardLog(row: CardLogRow): CardLog {
  return {
    id: row.id,
    cardId: row.card_id,
    content: row.content,
    createdAt: row.created_at
  }
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    cardId: row.card_id,
    type: row.type as AttachmentType,
    name: row.name,
    value: row.value,
    ocrText: row.ocr_text ?? '',
    createdAt: row.created_at
  }
}

function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('Database has not been initialized')
  }
  return db
}

export function getAttachmentsDir(): string {
  return attachmentsDir
}

export function initDatabase(): void {
  const userDataDir = app.getPath('userData')
  attachmentsDir = join(userDataDir, 'attachments')
  mkdirSync(userDataDir, { recursive: true })
  mkdirSync(attachmentsDir, { recursive: true })

  currentDbPath = join(userDataDir, 'scrumnova.db')
  db = new DatabaseSync(currentDbPath)

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#2563eb',
      weekly_limit_hours REAL NOT NULL DEFAULT 30,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#2563eb',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inbox',
      source TEXT NOT NULL DEFAULT 'planner',
      priority TEXT NOT NULL DEFAULT 'P1',
      is_urgent_insert INTEGER NOT NULL DEFAULT 0,
      estimate_hours REAL,
      due_date TEXT,
      next_step TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cards_board_status ON cards(board_id, is_archived, status, sort_order);

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subtasks_card ON subtasks(card_id, sort_order);

    CREATE TABLE IF NOT EXISTS card_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_card_logs_card ON card_logs(card_id, created_at);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      ocr_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_card ON attachments(card_id, created_at);
  `)

  const attCols = db.prepare('PRAGMA table_info(attachments)').all() as Array<{ name: string }>
  if (!attCols.some((c) => c.name === 'ocr_text')) {
    db.exec("ALTER TABLE attachments ADD COLUMN ocr_text TEXT NOT NULL DEFAULT ''")
  }

  seedSourcesIfEmpty()
  seedIfEmpty()
}

function seedSourcesIfEmpty(): void {
  const conn = getDb()
  const countRow = conn.prepare('SELECT COUNT(*) as count FROM card_sources').get() as { count: number }
  if (countRow.count > 0) return

  const now = nowIso()
  const defaults = [
    { id: 'planner', name: '策划需求', color: '#2563eb', sortOrder: 0 },
    { id: 'self', name: '自发任务', color: '#7c3aed', sortOrder: 1 },
    { id: 'bug', name: 'Bug', color: '#e11d48', sortOrder: 2 }
  ]
  const stmt = conn.prepare(
    'INSERT INTO card_sources (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
  )
  for (const item of defaults) {
    stmt.run(item.id, item.name, item.color, item.sortOrder, now)
  }
}

function seedIfEmpty(): void {
  const conn = getDb()
  const countRow = conn.prepare('SELECT COUNT(*) as count FROM boards').get() as { count: number }
  if (countRow.count > 0) return

  const workBoard = createBoard({ name: '工作项目', color: '#2563eb', weeklyLimitHours: 30 })
  createBoard({ name: '个人项目', color: '#7c3aed', weeklyLimitHours: 10 })

  const activeCard = createCard({
    boardId: workBoard.id,
    title: '【示例】新活动界面入口与领奖逻辑',
    status: 'doing',
    source: 'planner',
    priority: 'P0',
    estimateHours: 6,
    nextStep: '已对完配置表字段，下一步接入领奖回调和红点刷新',
    description: '策划需求：活动主界面支持倒计时、进度条和一键领取。'
  })

  const s1 = createSubtask(activeCard.id, '核对活动配置表字段与奖励结构')
  updateSubtask({ id: s1.id, isDone: true })
  createSubtask(activeCard.id, '接入领奖网络协议与状态刷新')
  createSubtask(activeCard.id, '补齐主界面红点与跨天倒计时自测')
  createCardLog(activeCard.id, '策划确认：倒计时结束后保留入口展示 24 小时用于补领奖励')

  createCard({
    boardId: workBoard.id,
    title: '【示例】修复背包红点偶发不消失的问题',
    status: 'todo',
    source: 'bug',
    priority: 'P0',
    isUrgentInsert: true,
    estimateHours: 2,
    nextStep: '先复现跨天刷新后缓存未清空的场景'
  })

  createCard({
    boardId: workBoard.id,
    title: '【示例】整理通用弹窗基类，减少重复代码',
    status: 'inbox',
    source: 'self',
    priority: 'P2',
    estimateHours: 4,
    nextStep: '等本周主线需求提测后推进'
  })
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function getCardById(cardId: string): Card {
  const conn = getDb()
  const row = conn.prepare(`${CARD_SELECT_BASE} WHERE c.id = ?`).get(cardId) as unknown as CardRow | undefined
  if (!row) {
    throw new Error(`Card not found: ${cardId}`)
  }
  return mapCard(row)
}

export function getDbStatus(): DbStatusInfo {
  const conn = getDb()
  const boardCount = (conn.prepare('SELECT COUNT(*) as count FROM boards').get() as { count: number }).count
  const cardCount = (conn.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number }).count
  const versionRow = conn.prepare('SELECT sqlite_version() as version').get() as { version: string }

  return {
    dbPath: currentDbPath,
    boardCount,
    cardCount,
    sqliteVersion: versionRow.version
  }
}

export function getSettings(): AppSettings {
  const conn = getDb()
  const rows = conn.prepare('SELECT key, value FROM app_settings').all() as Array<{
    key: string
    value: string
  }>
  const map = new Map(rows.map((r) => [r.key, r.value]))

  const boards = listBoards()
  const savedBoardId = map.get('activeBoardId') ?? ''
  const validBoardId = boards.some((b) => b.id === savedBoardId)
    ? savedBoardId
    : (boards[0]?.id ?? '')

  return {
    quickCaptureShortcut: map.get('quickCaptureShortcut') || 'CommandOrControl+Shift+N',
    activeBoardId: validBoardId
  }
}

export function updateSettings(input: UpdateAppSettingsInput): AppSettings {
  const conn = getDb()
  const now = nowIso()
  const upsert = conn.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )

  if (input.quickCaptureShortcut !== undefined && input.quickCaptureShortcut.trim()) {
    upsert.run('quickCaptureShortcut', input.quickCaptureShortcut.trim(), now)
  }
  if (input.activeBoardId !== undefined) {
    upsert.run('activeBoardId', input.activeBoardId, now)
  }

  return getSettings()
}

export function listBoards(): Board[] {
  const conn = getDb()
  const rows = conn.prepare('SELECT * FROM boards ORDER BY sort_order ASC, created_at ASC').all() as unknown as BoardRow[]
  return rows.map(mapBoard)
}

export function createBoard(input: CreateBoardInput): Board {
  const conn = getDb()
  const maxOrderRow = conn.prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM boards').get() as {
    maxOrder: number
  }
  const now = nowIso()
  const id = randomUUID()
  const color = input.color ?? '#2563eb'
  const weeklyLimitHours = input.weeklyLimitHours ?? 30
  const sortOrder = maxOrderRow.maxOrder + 1

  conn
    .prepare(
      `INSERT INTO boards (id, name, color, weekly_limit_hours, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.name.trim(), color, weeklyLimitHours, sortOrder, now, now)

  const row = conn.prepare('SELECT * FROM boards WHERE id = ?').get(id) as unknown as BoardRow
  return mapBoard(row)
}

export function updateBoard(input: UpdateBoardInput): Board {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM boards WHERE id = ?').get(input.id) as unknown as BoardRow | undefined
  if (!existing) {
    throw new Error(`Board not found: ${input.id}`)
  }

  const now = nowIso()
  conn
    .prepare(
      `UPDATE boards
       SET name = ?, color = ?, weekly_limit_hours = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.name !== undefined ? input.name.trim() : existing.name,
      input.color ?? existing.color,
      input.weeklyLimitHours ?? existing.weekly_limit_hours,
      now,
      input.id
    )

  const updated = conn.prepare('SELECT * FROM boards WHERE id = ?').get(input.id) as unknown as BoardRow
  return mapBoard(updated)
}

export function deleteBoard(id: string): void {
  const conn = getDb()
  const imageRows = conn
    .prepare(
      `SELECT a.value FROM attachments a
       INNER JOIN cards c ON c.id = a.card_id
       WHERE c.board_id = ? AND a.type = 'image'`
    )
    .all(id) as Array<{ value: string }>

  conn.prepare('DELETE FROM boards WHERE id = ?').run(id)

  for (const img of imageRows) {
    removeLocalImageFile(img.value)
  }
}

export function listSources(): SourceConfig[] {
  const conn = getDb()
  const rows = conn
    .prepare('SELECT * FROM card_sources ORDER BY sort_order ASC, created_at ASC')
    .all() as unknown as SourceRow[]
  return rows.map(mapSource)
}

export function createSource(input: CreateSourceInput): SourceConfig {
  const conn = getDb()
  const maxOrderRow = conn
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM card_sources')
    .get() as { maxOrder: number }

  const id = randomUUID()
  const now = nowIso()
  const sortOrder = maxOrderRow.maxOrder + 1

  conn
    .prepare('INSERT INTO card_sources (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.name.trim(), input.color, sortOrder, now)

  const row = conn.prepare('SELECT * FROM card_sources WHERE id = ?').get(id) as unknown as SourceRow
  return mapSource(row)
}

export function updateSource(input: UpdateSourceInput): SourceConfig {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM card_sources WHERE id = ?').get(input.id) as unknown as
    | SourceRow
    | undefined
  if (!existing) {
    throw new Error(`Source not found: ${input.id}`)
  }

  conn
    .prepare('UPDATE card_sources SET name = ?, color = ? WHERE id = ?')
    .run(
      input.name !== undefined ? input.name.trim() : existing.name,
      input.color ?? existing.color,
      input.id
    )

  const updated = conn.prepare('SELECT * FROM card_sources WHERE id = ?').get(input.id) as unknown as SourceRow
  return mapSource(updated)
}

export function deleteSource(id: string): void {
  const conn = getDb()
  const fallback = conn
    .prepare('SELECT id FROM card_sources WHERE id != ? ORDER BY sort_order ASC, created_at ASC LIMIT 1')
    .get(id) as { id: string } | undefined

  if (!fallback) {
    throw new Error('至少保留一个需求来源')
  }

  conn.exec('BEGIN IMMEDIATE')
  try {
    conn.prepare('UPDATE cards SET source = ? WHERE source = ?').run(fallback.id, id)
    conn.prepare('DELETE FROM card_sources WHERE id = ?').run(id)
    conn.exec('COMMIT')
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }
}

export function listCards(boardId: string, includeArchived = false): Card[] {
  const conn = getDb()
  const sql = includeArchived
    ? `${CARD_SELECT_BASE} WHERE c.board_id = ? ORDER BY c.sort_order ASC, c.created_at DESC`
    : `${CARD_SELECT_BASE} WHERE c.board_id = ? AND c.is_archived = 0 ORDER BY c.sort_order ASC, c.created_at DESC`
  const rows = conn.prepare(sql).all(boardId) as unknown as CardRow[]
  return rows.map(mapCard)
}

export function listArchivedCards(boardId: string): Card[] {
  const conn = getDb()
  const rows = conn
    .prepare(`${CARD_SELECT_BASE} WHERE c.board_id = ? AND c.is_archived = 1 ORDER BY c.updated_at DESC`)
    .all(boardId) as unknown as CardRow[]
  return rows.map(mapCard)
}

export function countArchivedCards(boardId: string): number {
  const conn = getDb()
  const row = conn
    .prepare('SELECT COUNT(*) as count FROM cards WHERE board_id = ? AND is_archived = 1')
    .get(boardId) as { count: number }
  return row.count
}

export function archiveDoneCards(boardId: string): number {
  const conn = getDb()
  const res = conn
    .prepare(
      "UPDATE cards SET is_archived = 1, updated_at = ? WHERE board_id = ? AND status = 'done' AND is_archived = 0"
    )
    .run(nowIso(), boardId)
  return Number(res.changes ?? 0)
}

function makeSnippet(text: string, keyword: string, maxLen = 68): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (!keyword) return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean

  const lowerClean = clean.toLowerCase()
  const idx = lowerClean.indexOf(keyword.toLowerCase())
  if (idx === -1) {
    return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean
  }
  const start = Math.max(0, idx - 18)
  const end = Math.min(clean.length, idx + keyword.length + 42)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < clean.length ? '…' : ''
  return `${prefix}${clean.slice(start, end)}${suffix}`
}

interface SearchCardRow extends CardRow {
  board_name: string
  board_color: string
  matched_subtask: string | null
  matched_log: string | null
  matched_attachment: string | null
}

export function searchCards(query: string): SearchResultItem[] {
  const conn = getDb()
  const trimmed = query.trim()

  if (!trimmed) {
    const recentRows = conn
      .prepare(
        `SELECT
           c.*,
           b.name AS board_name,
           b.color AS board_color,
           (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id) AS subtask_total,
           (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id AND s.is_done = 1) AS subtask_done,
           (SELECT COUNT(*) FROM attachments a WHERE a.card_id = c.id) AS attachment_count,
           (SELECT a.value FROM attachments a WHERE a.card_id = c.id AND a.type = 'image' ORDER BY a.created_at ASC LIMIT 1) AS cover_image,
           (SELECT COUNT(*) FROM card_logs l WHERE l.card_id = c.id) AS log_count,
           NULL AS matched_subtask,
           NULL AS matched_log,
           NULL AS matched_attachment
         FROM cards c
         INNER JOIN boards b ON b.id = c.board_id
         ORDER BY c.is_archived ASC, c.updated_at DESC
         LIMIT 15`
      )
      .all() as unknown as SearchCardRow[]

    return recentRows.map((row) => ({
      card: mapCard(row),
      boardName: row.board_name,
      boardColor: row.board_color,
      matchField: '最近更新',
      matchSnippet: makeSnippet(row.next_step || row.description, '')
    }))
  }

  const kw = trimmed.toLowerCase()
  const rows = conn
    .prepare(
      `SELECT
         c.*,
         b.name AS board_name,
         b.color AS board_color,
         (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id) AS subtask_total,
         (SELECT COUNT(*) FROM subtasks s WHERE s.card_id = c.id AND s.is_done = 1) AS subtask_done,
         (SELECT COUNT(*) FROM attachments a WHERE a.card_id = c.id) AS attachment_count,
         (SELECT a.value FROM attachments a WHERE a.card_id = c.id AND a.type = 'image' ORDER BY a.created_at ASC LIMIT 1) AS cover_image,
         (SELECT COUNT(*) FROM card_logs l WHERE l.card_id = c.id) AS log_count,
         (SELECT s.title FROM subtasks s WHERE s.card_id = c.id AND instr(lower(s.title), ?) > 0 LIMIT 1) AS matched_subtask,
         (SELECT l.content FROM card_logs l WHERE l.card_id = c.id AND instr(lower(l.content), ?) > 0 ORDER BY l.created_at DESC LIMIT 1) AS matched_log,
         (SELECT COALESCE(NULLIF(a.ocr_text, ''), a.name) FROM attachments a WHERE a.card_id = c.id AND (instr(lower(a.ocr_text), ?) > 0 OR instr(lower(a.name), ?) > 0 OR instr(lower(a.value), ?) > 0) LIMIT 1) AS matched_attachment
       FROM cards c
       INNER JOIN boards b ON b.id = c.board_id
       WHERE
         instr(lower(c.title), ?) > 0
         OR instr(lower(c.next_step), ?) > 0
         OR instr(lower(c.description), ?) > 0
         OR EXISTS (SELECT 1 FROM subtasks s WHERE s.card_id = c.id AND instr(lower(s.title), ?) > 0)
         OR EXISTS (SELECT 1 FROM card_logs l WHERE l.card_id = c.id AND instr(lower(l.content), ?) > 0)
         OR EXISTS (SELECT 1 FROM attachments a WHERE a.card_id = c.id AND (instr(lower(a.ocr_text), ?) > 0 OR instr(lower(a.name), ?) > 0 OR instr(lower(a.value), ?) > 0))
       ORDER BY c.is_archived ASC, c.updated_at DESC
       LIMIT 40`
    )
    .all(kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw, kw) as unknown as SearchCardRow[]

  return rows.map((row) => {
    const card = mapCard(row)
    let matchField: SearchMatchField = '标题'
    let snippetSource = row.next_step || row.description

    if (row.title.toLowerCase().includes(kw)) {
      matchField = '标题'
      snippetSource = row.next_step || row.description
    } else if (row.next_step.toLowerCase().includes(kw)) {
      matchField = '下一步'
      snippetSource = row.next_step
    } else if (row.description.toLowerCase().includes(kw)) {
      matchField = '需求详情'
      snippetSource = row.description
    } else if (row.matched_subtask) {
      matchField = '子任务'
      snippetSource = row.matched_subtask
    } else if (row.matched_log) {
      matchField = '变更小记'
      snippetSource = row.matched_log
    } else if (row.matched_attachment) {
      matchField = '截图OCR/附件'
      snippetSource = row.matched_attachment
    }

    return {
      card,
      boardName: row.board_name,
      boardColor: row.board_color,
      matchField,
      matchSnippet: makeSnippet(snippetSource, trimmed)
    }
  })
}

export function getCardDetail(cardId: string): CardDetail {
  const conn = getDb()
  const card = getCardById(cardId)
  const subtaskRows = conn
    .prepare('SELECT * FROM subtasks WHERE card_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(cardId) as unknown as SubtaskRow[]
  const logRows = conn
    .prepare('SELECT * FROM card_logs WHERE card_id = ? ORDER BY created_at DESC')
    .all(cardId) as unknown as CardLogRow[]
  const attachmentRows = conn
    .prepare('SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at DESC')
    .all(cardId) as unknown as AttachmentRow[]

  return {
    card,
    subtasks: subtaskRows.map(mapSubtask),
    logs: logRows.map(mapCardLog),
    attachments: attachmentRows.map(mapAttachment)
  }
}

export function createCard(input: CreateCardInput): Card {
  const conn = getDb()
  const status = input.status ?? 'inbox'
  const maxOrderRow = conn
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM cards WHERE board_id = ? AND status = ?')
    .get(input.boardId, status) as { maxOrder: number }

  const now = nowIso()
  const id = randomUUID()
  const sortOrder = maxOrderRow.maxOrder + 1

  conn
    .prepare(
      `INSERT INTO cards (
        id, board_id, title, status, source, priority, is_urgent_insert,
        estimate_hours, due_date, next_step, description, sort_order, is_archived,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      input.boardId,
      input.title.trim(),
      status,
      input.source ?? 'planner',
      input.priority ?? 'P1',
      input.isUrgentInsert ? 1 : 0,
      input.estimateHours ?? null,
      input.dueDate ?? null,
      input.nextStep ?? '',
      input.description ?? '',
      sortOrder,
      now,
      now
    )

  return getCardById(id)
}

export function updateCard(input: UpdateCardInput): Card {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM cards WHERE id = ?').get(input.id) as unknown as CardRow | undefined
  if (!existing) {
    throw new Error(`Card not found: ${input.id}`)
  }

  let nextSortOrder = input.sortOrder ?? existing.sort_order
  if (input.status && input.status !== existing.status && input.sortOrder === undefined) {
    const maxOrderRow = conn
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM cards WHERE board_id = ? AND status = ?')
      .get(existing.board_id, input.status) as { maxOrder: number }
    nextSortOrder = maxOrderRow.maxOrder + 1
  }

  const now = nowIso()
  conn
    .prepare(
      `UPDATE cards
       SET title = ?, status = ?, source = ?, priority = ?, is_urgent_insert = ?,
           estimate_hours = ?, due_date = ?, next_step = ?, description = ?,
           sort_order = ?, is_archived = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.title !== undefined ? input.title.trim() : existing.title,
      input.status ?? existing.status,
      input.source ?? existing.source,
      input.priority ?? existing.priority,
      input.isUrgentInsert !== undefined ? (input.isUrgentInsert ? 1 : 0) : existing.is_urgent_insert,
      input.estimateHours !== undefined ? input.estimateHours : existing.estimate_hours,
      input.dueDate !== undefined ? input.dueDate : existing.due_date,
      input.nextStep !== undefined ? input.nextStep : existing.next_step,
      input.description !== undefined ? input.description : existing.description,
      nextSortOrder,
      input.isArchived !== undefined ? (input.isArchived ? 1 : 0) : existing.is_archived,
      now,
      input.id
    )

  return getCardById(input.id)
}

export function reorderCards(patches: CardOrderPatch[]): void {
  if (patches.length === 0) return
  const conn = getDb()
  const now = nowIso()
  const stmt = conn.prepare('UPDATE cards SET status = ?, sort_order = ?, updated_at = ? WHERE id = ?')

  conn.exec('BEGIN IMMEDIATE')
  try {
    for (const patch of patches) {
      stmt.run(patch.status, patch.sortOrder, now, patch.id)
    }
    conn.exec('COMMIT')
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }
}

export function deleteCard(id: string): void {
  const conn = getDb()
  const imageRows = conn
    .prepare("SELECT value FROM attachments WHERE card_id = ? AND type = 'image'")
    .all(id) as Array<{ value: string }>

  conn.prepare('DELETE FROM cards WHERE id = ?').run(id)

  for (const img of imageRows) {
    removeLocalImageFile(img.value)
  }
}

export function createSubtask(cardId: string, title: string): Subtask {
  const conn = getDb()
  const maxOrderRow = conn
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM subtasks WHERE card_id = ?')
    .get(cardId) as { maxOrder: number }

  const id = randomUUID()
  const now = nowIso()
  const sortOrder = maxOrderRow.maxOrder + 1

  conn
    .prepare('INSERT INTO subtasks (id, card_id, title, is_done, sort_order, created_at) VALUES (?, ?, ?, 0, ?, ?)')
    .run(id, cardId, title.trim(), sortOrder, now)

  const row = conn.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as unknown as SubtaskRow
  return mapSubtask(row)
}

export function updateSubtask(input: UpdateSubtaskInput): Subtask {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM subtasks WHERE id = ?').get(input.id) as unknown as SubtaskRow | undefined
  if (!existing) {
    throw new Error(`Subtask not found: ${input.id}`)
  }

  conn
    .prepare('UPDATE subtasks SET title = ?, is_done = ?, sort_order = ? WHERE id = ?')
    .run(
      input.title !== undefined ? input.title.trim() : existing.title,
      input.isDone !== undefined ? (input.isDone ? 1 : 0) : existing.is_done,
      input.sortOrder ?? existing.sort_order,
      input.id
    )

  const row = conn.prepare('SELECT * FROM subtasks WHERE id = ?').get(input.id) as unknown as SubtaskRow
  return mapSubtask(row)
}

export function reorderSubtasks(cardId: string, orderedIds: string[]): Subtask[] {
  const conn = getDb()
  const stmt = conn.prepare('UPDATE subtasks SET sort_order = ? WHERE id = ? AND card_id = ?')

  conn.exec('BEGIN IMMEDIATE')
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i], cardId)
    }
    conn.exec('COMMIT')
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }

  const rows = conn
    .prepare('SELECT * FROM subtasks WHERE card_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(cardId) as unknown as SubtaskRow[]
  return rows.map(mapSubtask)
}

export function deleteSubtask(id: string): void {
  const conn = getDb()
  conn.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
}

export function createCardLog(cardId: string, content: string): CardLog {
  const conn = getDb()
  const id = randomUUID()
  const now = nowIso()
  conn
    .prepare('INSERT INTO card_logs (id, card_id, content, created_at) VALUES (?, ?, ?, ?)')
    .run(id, cardId, content.trim(), now)

  const row = conn.prepare('SELECT * FROM card_logs WHERE id = ?').get(id) as unknown as CardLogRow
  return mapCardLog(row)
}

export function deleteCardLog(id: string): void {
  const conn = getDb()
  conn.prepare('DELETE FROM card_logs WHERE id = ?').run(id)
}

function removeLocalImageFile(fileName: string): void {
  if (!fileName || !attachmentsDir) return
  const safeName = basename(fileName)
  rmSync(join(attachmentsDir, safeName), { force: true })
}

function normalizeImageExt(subtype: string): string {
  const lower = subtype.toLowerCase()
  if (lower === 'jpeg' || lower === 'jpg') return 'jpg'
  if (lower === 'webp') return 'webp'
  if (lower === 'gif') return 'gif'
  return 'png'
}

export function saveImageAttachment(input: SaveImageAttachmentInput): Attachment {
  const conn = getDb()
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/.exec(input.dataUrl)
  if (!match) {
    throw new Error('Unsupported image data URL')
  }

  const ext = normalizeImageExt(match[1])
  const buffer = Buffer.from(match[2], 'base64')
  const fileName = `${randomUUID()}.${ext}`
  writeFileSync(join(attachmentsDir, fileName), buffer)

  const id = randomUUID()
  const now = nowIso()
  const displayName = input.name?.trim() || `截图 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`

  conn
    .prepare('INSERT INTO attachments (id, card_id, type, name, value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, input.cardId, 'image', displayName, fileName, now)

  const row = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as AttachmentRow
  return mapAttachment(row)
}

export function saveImageAttachmentFromPath(cardId: string, sourceFilePath: string): Attachment {
  const conn = getDb()
  const rawExt = extname(sourceFilePath).replace('.', '').toLowerCase()
  const ext = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt)
    ? rawExt === 'jpeg'
      ? 'jpg'
      : rawExt
    : 'png'
  const fileName = `${randomUUID()}.${ext}`
  copyFileSync(sourceFilePath, join(attachmentsDir, fileName))

  const id = randomUUID()
  const now = nowIso()
  const displayName = basename(sourceFilePath)

  conn
    .prepare('INSERT INTO attachments (id, card_id, type, name, value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, cardId, 'image', displayName, fileName, now)

  const row = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as AttachmentRow
  return mapAttachment(row)
}

export function createLinkAttachment(input: CreateLinkAttachmentInput): Attachment {
  const conn = getDb()
  const rawUrl = input.url.trim()
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  const displayName = input.name.trim() || normalizedUrl

  const id = randomUUID()
  const now = nowIso()

  conn
    .prepare('INSERT INTO attachments (id, card_id, type, name, value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, input.cardId, 'link', displayName, normalizedUrl, now)

  const row = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as AttachmentRow
  return mapAttachment(row)
}

export function getImageAttachmentFilePath(id: string): string {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as
    | AttachmentRow
    | undefined
  if (!existing || existing.type !== 'image') {
    throw new Error(`Image attachment not found: ${id}`)
  }
  return join(attachmentsDir, basename(existing.value))
}

export function updateAttachmentOcrText(id: string, ocrText: string): Attachment {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as
    | AttachmentRow
    | undefined
  if (!existing) {
    throw new Error(`Attachment not found: ${id}`)
  }
  conn.prepare('UPDATE attachments SET ocr_text = ? WHERE id = ?').run(ocrText, id)
  const updated = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as AttachmentRow
  return mapAttachment(updated)
}

export function deleteAttachment(id: string): void {
  const conn = getDb()
  const existing = conn.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as
    | AttachmentRow
    | undefined
  if (!existing) return

  conn.prepare('DELETE FROM attachments WHERE id = ?').run(id)
  if (existing.type === 'image') {
    removeLocalImageFile(existing.value)
  }
}
