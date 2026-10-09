import type { Database } from '../lib/database.types.js'

type PortableRow<T extends keyof Database['public']['Tables']> = Omit<
  Database['public']['Tables'][T]['Row'],
  'owner_id' | 'created_at' | 'updated_at' | 'version'
>
export type WorkspaceExport = {
  format: 'ergon'
  version: 1
  boards: PortableRow<'boards'>[]
  columns: PortableRow<'columns'>[]
  cards: PortableRow<'cards'>[]
  labels: PortableRow<'labels'>[]
  card_labels: PortableRow<'card_labels'>[]
  scheduled_sessions: PortableRow<'scheduled_sessions'>[]
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const date = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const instant = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
    value,
  ) &&
  date(value.slice(0, 10)) &&
  Number.isFinite(Date.parse(value))
const text = (max: number) => (value: unknown) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= max
const id = (value: unknown) => typeof value === 'string' && uuid.test(value)
const nullable = (check: (value: unknown) => boolean) => (value: unknown) =>
  value === null || check(value)
const position = (value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 2147483647
const oneOf =
  (...values: string[]) =>
  (value: unknown) =>
    typeof value === 'string' && values.includes(value)
const schemas = {
  boards: {
    id,
    title: text(200),
    archived_at: nullable(instant),
    background: oneOf('neutral', 'sand', 'rose', 'lavender', 'blue', 'sage'),
  },
  columns: { id, board_id: id, title: text(200), position },
  cards: {
    id,
    board_id: id,
    column_id: id,
    title: text(500),
    description: (v: unknown) => typeof v === 'string',
    position,
    due_date: nullable(date),
    due_time: (v: unknown) =>
      v === undefined ||
      v === null ||
      (typeof v === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)),
    archived_at: nullable(instant),
    completed_at: nullable(instant),
    priority: oneOf('none', 'low', 'medium', 'high', 'urgent'),
  },
  labels: {
    id,
    board_id: id,
    name: text(80),
    color: (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v),
  },
  card_labels: { board_id: id, card_id: id, label_id: id },
  scheduled_sessions: { id, card_id: id, starts_at: instant, ends_at: instant },
}

/** Validate untrusted files before sending any writes. Database constraints remain authoritative. */
export function validateWorkspaceExport(value: unknown): WorkspaceExport {
  const fail = (message: string): never => {
    throw new Error(`Invalid import: ${message}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('expected an Ergon JSON object')
  const data = value as Record<string, unknown>
  if (data.format !== 'ergon' || data.version !== 1)
    fail('unsupported format or version')
  const ids = new Set<string>()
  for (const [collection, schema] of Object.entries(schemas)) {
    const rows = data[collection]
    if (!Array.isArray(rows)) fail(`${collection} must be an array`)
    for (const row of rows as unknown[]) {
      if (!row || typeof row !== 'object' || Array.isArray(row))
        fail(`${collection} contains an invalid row`)
      const record = row as Record<string, unknown>
      for (const [field, check] of Object.entries(schema)) {
        if (!check(record[field])) fail(`${collection}.${field} is invalid`)
      }
      if ('id' in schema) {
        const key = record.id as string
        if (ids.has(key)) fail('duplicate IDs')
        ids.add(key)
      }
    }
  }
  const result = value as WorkspaceExport
  const boards = new Set(result.boards.map((b) => b.id))
  const columns = new Map(result.columns.map((c) => [c.id, c]))
  const cards = new Map(result.cards.map((c) => [c.id, c]))
  const labels = new Map(result.labels.map((l) => [l.id, l]))
  const unique = new Set<string>()
  function checkUnique(key: string) {
    if (unique.has(key))
      fail('duplicate positions, label names, or card-label links')
    unique.add(key)
  }
  for (const c of result.columns) {
    if (!boards.has(c.board_id)) fail('column references a missing board')
    checkUnique(`column:${c.board_id}:${c.position}`)
  }
  for (const c of result.cards) {
    if (c.due_time && !c.due_date) fail('due time requires a due date')
    if (
      !boards.has(c.board_id) ||
      columns.get(c.column_id)?.board_id !== c.board_id
    )
      fail('card references a missing column or a different board')
    checkUnique(`card:${c.column_id}:${c.position}`)
  }
  for (const l of result.labels) {
    if (!boards.has(l.board_id)) fail('label references a missing board')
    checkUnique(`label:${l.board_id}:${l.name}`)
  }
  for (const link of result.card_labels) {
    if (
      !boards.has(link.board_id) ||
      cards.get(link.card_id)?.board_id !== link.board_id ||
      labels.get(link.label_id)?.board_id !== link.board_id
    )
      fail('card-label link references missing entities or different boards')
    checkUnique(`link:${link.card_id}:${link.label_id}`)
  }
  for (const s of result.scheduled_sessions) {
    if (!cards.has(s.card_id)) fail('session references a missing card')
    if (Date.parse(s.ends_at) <= Date.parse(s.starts_at))
      fail('session must end after it starts')
  }
  return result
}

export function parseWorkspaceExport(json: string): WorkspaceExport {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('Invalid import: file is not valid JSON')
  }
  return validateWorkspaceExport(value)
}
