import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, expect, it } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
let board: string, column: string, card: string
const session = '50000000-0000-0000-0000-000000000001'
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');`)
  for (const name of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((name) => name.endsWith('.sql'))
    .sort())
    await db.exec(
      await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'),
    )
  await asUser(alice)
  board = (
    await db.query<{ id: string }>(`select public.create_board('Work') as id`)
  ).rows[0]!.id
  column = (
    await db.query<{ id: string }>(
      `select id from public.columns where board_id = '${board}' order by position`,
    )
  ).rows[0]!.id
  await db.exec(
    `insert into public.cards (board_id, column_id, title, position, due_date) values ('${board}', '${column}', 'Proposal', 0, '2026-10-09')`,
  )
  card = (await db.query<{ id: string }>('select id from public.cards'))
    .rows[0]!.id
})
afterAll(() => db.close())
async function asUser(user: string) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub = '${user}';`,
  )
}
const create = () =>
  db.query(
    `select public.create_session('${session}', '${card}', '2026-10-09T09:00:00+01:00', '2026-10-09T10:00:00+01:00')`,
  )

it('creates multiple UTC sessions, safely retries creates, and never writes the task or board', async () => {
  await asUser(alice)
  const before = (await db.query('select * from public.cards')).rows
  const boardsBefore = (await db.query('select * from public.boards')).rows
  await create()
  await create()
  await db.query(
    `select public.create_session('50000000-0000-0000-0000-000000000002', '${card}', '2026-10-09T09:30Z', '2026-10-09T10:30Z')`,
  )
  expect(
    (await db.query('select * from public.scheduled_sessions')).rows,
  ).toHaveLength(2)
  expect((await db.query('select * from public.cards')).rows).toEqual(before)
  expect((await db.query('select * from public.boards')).rows).toEqual(
    boardsBefore,
  )
  expect(
    (
      await db.query(
        `select to_char(starts_at at time zone 'UTC', 'HH24:MI') as start from public.scheduled_sessions where id = '${session}'`,
      )
    ).rows,
  ).toEqual([{ start: '08:00' }])
})
it('revision-checks edits and removal; failed writes preserve saved data', async () => {
  await asUser(alice)
  const taskBefore = (await db.query('select * from public.cards')).rows
  await db.query(
    `select public.save_session('${session}', 1, '2026-10-09T12:00Z', '2026-10-09T13:00Z')`,
  )
  const saved = (await db.query('select * from public.scheduled_sessions')).rows
  await expect(
    db.query(
      `select public.save_session('${session}', 1, '2026-10-09T14:00Z', '2026-10-09T15:00Z')`,
    ),
  ).rejects.toThrow('Session changed')
  await expect(
    db.query(`select public.delete_session('${session}', 1)`),
  ).rejects.toThrow('Session changed')
  await expect(
    db.query(
      `select public.save_session('${session}', 2, '2026-10-09T14:00Z', '2026-10-09T13:00Z')`,
    ),
  ).rejects.toThrow('check constraint')
  expect(
    (await db.query('select * from public.scheduled_sessions')).rows,
  ).toEqual(saved)
  await db.query(`select public.delete_session('${session}', 2)`)
  expect((await db.query('select * from public.cards')).rows).toEqual(
    taskBefore,
  )
})
it('keeps session and preference RPCs isolated, including related tasks and impersonation', async () => {
  await asUser(bob)
  await expect(create()).rejects.toThrow('Active task unavailable')
  await expect(
    db.query(
      `select public.save_session('50000000-0000-0000-0000-000000000002', 1, now(), now() + interval '1 hour')`,
    ),
  ).rejects.toThrow('Session unavailable')
  await expect(
    db.query(
      `select public.delete_session('50000000-0000-0000-0000-000000000002', 1)`,
    ),
  ).rejects.toThrow('Session unavailable')
  expect(
    (
      await db.query<{
        data: {
          sessions: unknown[]
          cards: unknown[]
          boards: unknown[]
          preferences: null
        }
      }>('select public.get_scheduling_snapshot() as data')
    ).rows[0]!.data,
  ).toEqual({
    sessions: [],
    cards: [],
    boards: [],
    labels: [],
    card_labels: [],
    preferences: null,
  })
  await expect(
    db.query(
      `insert into public.user_preferences (id, owner_id) values ('${alice}', '${alice}')`,
    ),
  ).rejects.toThrow('row-level security')
  await db.exec('reset role; set role anon;')
  for (const sql of [
    'select public.get_scheduling_snapshot()',
    `select public.delete_session('${session}', 1)`,
    `select public.save_calendar_preferences(0, 'UTC', 1, 'week')`,
  ])
    await expect(db.query(sql)).rejects.toThrow('permission denied')
})
it('persists and validates preferences with revision checks, including the first-save race', async () => {
  await asUser(alice)
  await db.query(
    `select public.save_calendar_preferences(0, 'Europe/Dublin', 0, 'agenda')`,
  )
  await expect(
    db.query(`select public.save_calendar_preferences(0, 'UTC', 1, 'week')`),
  ).rejects.toThrow('Preferences changed')
  await expect(
    db.query(
      `select public.save_calendar_preferences(1, 'Mars/Olympus', 1, 'week')`,
    ),
  ).rejects.toThrow('Unknown timezone')
  await expect(
    db.query(`select public.save_calendar_preferences(1, 'UTC', 7, 'week')`),
  ).rejects.toThrow('check constraint')
  await expect(
    db.query(`select public.save_calendar_preferences(1, 'UTC', 1, 'month')`),
  ).rejects.toThrow('check constraint')
  await db.query(`select public.save_calendar_preferences(1, 'UTC', 1, 'day')`)
  await expect(
    db.query(
      `select public.save_calendar_preferences(1, 'Europe/Dublin', 0, 'agenda')`,
    ),
  ).rejects.toThrow('Preferences changed')
  await asUser(bob)
  await expect(
    db.query(`select public.save_calendar_preferences(2, 'UTC', 1, 'week')`),
  ).rejects.toThrow('Preferences changed')
  await asUser(alice)
  expect(
    (
      await db.query(
        'select timezone, week_starts_on, calendar_view, version from public.user_preferences',
      )
    ).rows,
  ).toEqual([
    { timezone: 'UTC', week_starts_on: 1, calendar_view: 'day', version: 2 },
  ])
})
it('preserves completed and archived history, permits removal, blocks new work on archived tasks', async () => {
  await asUser(alice)
  await db.query(
    `update public.cards set completed_at = '2026-10-09T11:00Z', archived_at = now() where id = '${card}'`,
  )
  await expect(create()).rejects.toThrow('Active task unavailable')
  const snapshot = (
    await db.query<{
      data: { sessions: unknown[]; cards: { completed_at: string }[] }
    }>('select public.get_scheduling_snapshot() as data')
  ).rows[0]!.data
  expect(snapshot.sessions).toHaveLength(1)
  expect(snapshot.cards[0]!.completed_at).toBeTruthy()
  await db.query(
    `select public.delete_session('50000000-0000-0000-0000-000000000002', 1)`,
  )
  expect((await db.query('select * from public.cards')).rows).toHaveLength(1)
  await db.query(
    `update public.cards set archived_at = null where id = '${card}'`,
  )
  await db.query(
    `update public.boards set archived_at = now() where id = '${board}'`,
  )
  await expect(create()).rejects.toThrow('Active board unavailable')
})
