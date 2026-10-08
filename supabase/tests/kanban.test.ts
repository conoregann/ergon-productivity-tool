import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'

const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
let board: string
let columns: { id: string; position: number }[]
async function revision() {
  return (
    await db.query<{ version: number }>(
      'select version from public.boards where id = $1',
      [board],
    )
  ).rows[0]!.version
}
async function rpc(name: string, args: unknown[]) {
  return db.query<{ result: unknown }>(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`,
    args,
  )
}
async function addCard(column = columns[0]!.id, title = 'Task') {
  return (await rpc('create_card', [board, await revision(), column, title]))
    .rows[0]!.result as string
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
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
})
beforeEach(async () => {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub = '${alice}';`,
  )
  board = (await rpc('create_board', ['Work'])).rows[0]!.result as string
  columns = (
    await db.query<{ id: string; position: number }>(
      'select id, position from public.columns where board_id = $1 order by position',
      [board],
    )
  ).rows
})
afterAll(() => db.close())

it('creates default columns atomically and rolls back invalid input', async () => {
  expect(columns.map((c) => c.position)).toEqual([0, 1, 2])
  const before = (await db.query('select id from public.boards')).rows
  await expect(rpc('create_board', [' '])).rejects.toThrow(/check constraint/)
  expect((await db.query('select id from public.boards')).rows).toEqual(before)
})
it('moves cards across columns and within a column with contiguous ordering', async () => {
  const a = await addCard()
  const b = await addCard()
  const c = await addCard()
  await rpc('move_card', [board, await revision(), c, columns[0]!.id, a])
  let rows = (
    await db.query<{ id: string; position: number }>(
      'select id, position from public.cards where board_id = $1 order by position',
      [board],
    )
  ).rows
  expect(rows.map((row) => row.id)).toEqual([c, a, b])
  expect(rows.map((row) => row.position)).toEqual([0, 1, 2])
  await rpc('move_card', [board, await revision(), a, columns[1]!.id, null])
  rows = (
    await db.query<{ id: string; position: number }>(
      'select id, position from public.cards where column_id = $1 order by position',
      [columns[0]!.id],
    )
  ).rows
  expect(rows.map((row) => row.id)).toEqual([c, b])
  expect(rows.map((row) => row.position)).toEqual([0, 1])
  expect(
    (
      await db.query(
        'select column_id, position from public.cards where id = $1',
        [a],
      )
    ).rows,
  ).toEqual([{ column_id: columns[1]!.id, position: 0 }])
})
it('rejects stale edits and rolls back an invalid move completely', async () => {
  const card = await addCard()
  const stale = await revision()
  await rpc('save_card', [
    board,
    stale,
    card,
    'Updated',
    '',
    null,
    false,
    false,
  ])
  await expect(
    rpc('move_card', [board, stale, card, columns[1]!.id]),
  ).rejects.toThrow(/Board changed/)
  const before = (await rpc('get_board_snapshot', [board])).rows
  await expect(
    rpc('move_card', [
      board,
      await revision(),
      card,
      columns[1]!.id,
      '11111111-1111-1111-1111-111111111111',
    ]),
  ).rejects.toThrow(/Destination card/)
  expect((await rpc('get_board_snapshot', [board])).rows).toEqual(before)
})
it('rejects cross-board targets and cannot expose or mutate another user board', async () => {
  const card = await addCard()
  const other = (await rpc('create_board', ['Other'])).rows[0]!.result
  const foreignColumn = (
    await db.query<{ id: string }>(
      'select id from public.columns where board_id = $1 limit 1',
      [other],
    )
  ).rows[0]!.id
  await expect(
    rpc('move_card', [board, await revision(), card, foreignColumn]),
  ).rejects.toThrow(/Destination column/)
  const version = await revision()
  await db.exec(`set request.jwt.claim.sub = '${bob}';`)
  expect((await rpc('get_board_snapshot', [board])).rows[0]!.result).toBeNull()
  await expect(
    rpc('save_board', [board, version, 'Stolen', false]),
  ).rejects.toThrow(/Board unavailable/)
  await expect(
    rpc('create_card', [board, version, columns[0]!.id, 'Stolen']),
  ).rejects.toThrow(/Board unavailable/)
})
it('reorders columns and refuses deleting columns containing archived cards', async () => {
  await rpc('move_column', [
    board,
    await revision(),
    columns[2]!.id,
    columns[0]!.id,
  ])
  expect(
    (
      await db.query<{ id: string }>(
        'select id from public.columns where board_id = $1 order by position',
        [board],
      )
    ).rows.map((row) => row.id),
  ).toEqual([columns[2]!.id, columns[0]!.id, columns[1]!.id])
  const card = await addCard()
  await rpc('save_card', [
    board,
    await revision(),
    card,
    'Task',
    '',
    null,
    false,
    true,
  ])
  await expect(
    rpc('delete_column', [board, await revision(), columns[0]!.id]),
  ).rejects.toThrow(/including archived cards/)
  await rpc('delete_column', [board, await revision(), columns[1]!.id])
  expect(
    (
      await db.query<{ position: number }>(
        'select position from public.columns where board_id = $1 order by position',
        [board],
      )
    ).rows.map((row) => row.position),
  ).toEqual([0, 1])
})
it('keeps archived card positions valid, restores cards, and preserves completion history', async () => {
  const card = await addCard()
  await addCard()
  await db.query(
    `insert into public.scheduled_sessions (card_id, starts_at, ends_at) values ($1, now(), now() + interval '1 hour')`,
    [card],
  )
  await rpc('save_card', [
    board,
    await revision(),
    card,
    'Task',
    '',
    '2026-10-09',
    true,
    true,
  ])
  await addCard()
  await rpc('save_card', [
    board,
    await revision(),
    card,
    'Task',
    '',
    '2026-10-09',
    true,
    false,
  ])
  expect(
    (
      await db.query(
        'select * from public.scheduled_sessions where card_id = $1',
        [card],
      )
    ).rows,
  ).toHaveLength(1)
  expect(
    (
      await db.query<{ completed_at: unknown; archived_at: null }>(
        'select completed_at, archived_at from public.cards where id = $1',
        [card],
      )
    ).rows[0]?.archived_at,
  ).toBeNull()
  expect(
    (
      await db.query<{ completed_at: unknown }>(
        'select completed_at from public.cards where id = $1',
        [card],
      )
    ).rows[0]?.completed_at,
  ).not.toBeNull()
})
it('blocks archived board writes and permits explicit restoration', async () => {
  await rpc('save_board', [board, await revision(), 'Work', true])
  await expect(
    rpc('create_column', [board, await revision(), 'Blocked']),
  ).rejects.toThrow(/Board is archived/)
  await rpc('save_board', [board, await revision(), 'Restored', false])
  await rpc('create_column', [board, await revision(), 'Allowed'])
  expect(
    (
      await db.query('select id from public.columns where board_id = $1', [
        board,
      ])
    ).rows,
  ).toHaveLength(4)
})
it('deletes cards transactionally and keeps positions contiguous', async () => {
  const a = await addCard()
  const b = await addCard()
  const c = await addCard()
  await rpc('delete_card', [board, await revision(), b])
  expect(
    (
      await db.query(
        'select id, position from public.cards where board_id = $1 order by position',
        [board],
      )
    ).rows,
  ).toEqual([
    { id: a, position: 0 },
    { id: c, position: 1 },
  ])
})
it('denies anonymous RPC access', async () => {
  await db.exec('reset role; set role anon;')
  await expect(rpc('create_board', ['Anonymous'])).rejects.toThrow(
    /permission denied/,
  )
  await expect(rpc('get_board_snapshot', [board])).rejects.toThrow(
    /permission denied/,
  )
})

it('allows only one competing write at the same revision', async () => {
  const version = await revision()
  const results = await Promise.allSettled([
    rpc('create_column', [board, version, 'First']),
    rpc('create_column', [board, version, 'Second']),
  ])
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1)
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1,
  )
  await expect(
    rpc('save_board', [board, null, 'Bypass', false]),
  ).rejects.toThrow(/Board changed/)
})

it('allows the restricted auth service to cascade account deletion', async () => {
  await addCard()
  await db.exec(
    `reset role; create role auth_admin; grant usage on schema auth to auth_admin; grant select, delete on auth.users to auth_admin; set role auth_admin;`,
  )
  await expect(
    db.query('delete from auth.users where id = $1', [alice]),
  ).resolves.toBeDefined()
  await db.exec('reset role;')
  expect(
    (
      await db.query('select id from public.boards where owner_id = $1', [
        alice,
      ])
    ).rows,
  ).toHaveLength(0)
})
