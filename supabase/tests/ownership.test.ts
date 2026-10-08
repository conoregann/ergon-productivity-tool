import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
const board = '10000000-0000-0000-0000-000000000001'
const column = '20000000-0000-0000-0000-000000000001'
const card = '30000000-0000-0000-0000-000000000001'
const label = '40000000-0000-0000-0000-000000000001'

// Only Supabase's auth identity plumbing is substituted; schema/RLS runs in PostgreSQL.
beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');
  `)
  for (const name of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(
      await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'),
    )
  }
  await db.exec(`
    set role authenticated;
    set request.jwt.claim.sub = '${alice}';
    insert into public.boards (id, title) values ('${board}', 'Private');
    insert into public.columns (id, board_id, title, position) values ('${column}', '${board}', 'To do', 0);
    insert into public.cards (id, board_id, column_id, title, position, due_date)
      values ('${card}', '${board}', '${column}', 'Proposal', 0, '2026-10-09');
    insert into public.labels (id, board_id, name) values ('${label}', '${board}', 'Work');
    insert into public.card_labels (board_id, card_id, label_id) values ('${board}', '${card}', '${label}');
    insert into public.scheduled_sessions (card_id, starts_at, ends_at)
      values ('${card}', '2026-10-08T09:00:00+01:00', '2026-10-08T10:00:00+01:00');
    insert into public.user_preferences (timezone) values ('Europe/Dublin');
  `)
})
afterAll(() => db.close())

async function asUser(user: string) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub = '${user}';`,
  )
}

const tables = [
  'boards',
  'columns',
  'cards',
  'labels',
  'card_labels',
  'scheduled_sessions',
  'user_preferences',
]
describe('ownership', () => {
  it.each(tables)('isolates %s for read, update, and delete', async (table) => {
    await asUser(bob)
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    )
    expect(
      (
        await db.query(
          `update public.${table} set owner_id = owner_id returning *`,
        )
      ).rows,
    ).toHaveLength(0)
    expect(
      (await db.query(`delete from public.${table} returning *`)).rows,
    ).toHaveLength(0)
    await asUser(alice)
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      1,
    )
  })

  it.each(tables)('denies anonymous access to %s', async (table) => {
    await db.exec('reset role; set role anon;')
    await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('rejects owner impersonation', async () => {
    await asUser(bob)
    await expect(
      db.query(
        `insert into public.boards (owner_id, title) values ('${alice}', 'Stolen')`,
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('rejects cross-owner relationships on every child table', async () => {
    await asUser(bob)
    await db.exec(`
      insert into public.boards (id, title) values ('10000000-0000-0000-0000-000000000003', 'Bob');
      insert into public.labels (id, board_id, name) values ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Bob');
    `)
    const statements = [
      `insert into public.columns (board_id, title, position) values ('${board}', 'Intruder', 1)`,
      `insert into public.cards (board_id, column_id, title, position) values ('${board}', '${column}', 'Intruder', 1)`,
      `insert into public.labels (board_id, name) values ('${board}', 'Intruder')`,
      `insert into public.card_labels (board_id, card_id, label_id) values ('${board}', '${card}', '40000000-0000-0000-0000-000000000003')`,
      `insert into public.scheduled_sessions (card_id, starts_at, ends_at) values ('${card}', now(), now() + interval '1 hour')`,
    ]
    for (const sql of statements)
      await expect(db.query(sql)).rejects.toThrow(
        /foreign key|Active board unavailable/,
      )
  })

  it('rejects cross-board cards and labels even for the same owner', async () => {
    await asUser(alice)
    await db.exec(
      `insert into public.boards (id, title) values ('10000000-0000-0000-0000-000000000002', 'Other');`,
    )
    await expect(
      db.query(
        `insert into public.cards (board_id, column_id, title, position) values ('10000000-0000-0000-0000-000000000002', '${column}', 'Wrong board', 1)`,
      ),
    ).rejects.toThrow(/foreign key|Active board unavailable/)
    await db.exec(
      `insert into public.labels (id, board_id, name) values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Other');`,
    )
    await expect(
      db.query(
        `insert into public.card_labels (board_id, card_id, label_id) values ('${board}', '${card}', '40000000-0000-0000-0000-000000000002')`,
      ),
    ).rejects.toThrow(/foreign key|Active board unavailable/)
  })
})

describe('data invariants', () => {
  it('rejects blank titles, invalid positions, intervals and timezones', async () => {
    await asUser(alice)
    for (const sql of [
      `insert into public.boards (title) values (' ')`,
      `insert into public.columns (board_id, title, position) values ('${board}', 'Bad', -1)`,
      `insert into public.scheduled_sessions (card_id, starts_at, ends_at) values ('${card}', now(), now())`,
      `update public.user_preferences set timezone = 'Mars/Olympus'`,
    ])
      await expect(db.query(sql)).rejects.toThrow(
        /check constraint|Unknown timezone/,
      )
  })

  it('stores sessions as instants without changing card status or date-only deadlines', async () => {
    await asUser(alice)
    const result = await db.query<{ utc: string }>(
      `select to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as utc from public.scheduled_sessions`,
    )
    expect(result.rows[0]?.utc).toBe('2026-10-08 08:00')
    const task = await db.query<{
      deadline: string
      completed_at: null
      column_id: string
    }>(
      `select due_date::text as deadline, completed_at, column_id from public.cards`,
    )
    expect(task.rows[0]).toEqual({
      deadline: '2026-10-09',
      completed_at: null,
      column_id: column,
    })
  })

  it('increments versions and allows stale writes to be detected', async () => {
    await asUser(alice)
    expect(
      (
        await db.query(
          `update public.cards set title = 'Updated' where id = '${card}' and version = 1 returning version`,
        )
      ).rows,
    ).toEqual([{ version: 2 }])
    expect(
      (
        await db.query(
          `update public.cards set title = 'Stale' where id = '${card}' and version = 1 returning version`,
        )
      ).rows,
    ).toHaveLength(0)
    await db.query(`update public.cards set version = 999 where id = '${card}'`)
    expect(
      (await db.query(`select version from public.cards where id = '${card}'`))
        .rows,
    ).toEqual([{ version: 3 }])
  })

  it('preserves session history on completion and cascades deletion', async () => {
    await asUser(alice)
    await db.query(
      `update public.cards set completed_at = now() where id = '${card}'`,
    )
    expect(
      (await db.query('select * from public.scheduled_sessions')).rows,
    ).toHaveLength(1)
    await db.query(`delete from public.boards where id = '${board}'`)
    for (const table of [
      'columns',
      'cards',
      'card_labels',
      'scheduled_sessions',
    ]) {
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0)
    }
  })
})
