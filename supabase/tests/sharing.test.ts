import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'

const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001'
const editor = '00000000-0000-0000-0000-000000000002'
let board: string
let otherBoard: string
let column: string
let otherColumn: string
let token: string

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    insert into auth.users values ('${owner}'), ('${editor}');`)
  for (const file of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((file) => file.endsWith('.sql'))
    .sort())
    await db.exec(
      await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'),
    )
  await identity(owner)
  board = (
    await db.query<{ id: string }>("select public.create_board('Shared') as id")
  ).rows[0]!.id
  otherBoard = (
    await db.query<{ id: string }>(
      "select public.create_board('Private') as id",
    )
  ).rows[0]!.id
  column = (
    await db.query<{ id: string }>(
      'select id from public.columns where board_id = $1 order by position',
      [board],
    )
  ).rows[0]!.id
  otherColumn = (
    await db.query<{ id: string }>(
      'select id from public.columns where board_id = $1 order by position',
      [otherBoard],
    )
  ).rows[0]!.id
})
afterAll(() => db.close())

async function identity(user: string | null, link = '') {
  await db.exec(`reset role; set role ${user ? 'authenticated' : 'anon'};`)
  await db.query(
    "select set_config('request.jwt.claim.sub', $1, false), set_config('request.headers', $2, false)",
    [user ?? '', JSON.stringify({ 'x-board-share': link })],
  )
}
async function version() {
  return (
    await db.query<{ version: number }>(
      'select version from public.boards where id = $1',
      [board],
    )
  ).rows[0]!.version
}
async function sharing(access: string | null) {
  await identity(owner)
  const result = await db.query<{ share: { token: string } | null }>(
    'select public.set_board_sharing($1, $2, $3) as share',
    [board, await version(), access],
  )
  return result.rows[0]!.share?.token
}

it('keeps boards private until sharing is enabled; invalid tokens reveal nothing', async () => {
  await identity(null)
  expect(
    (await db.query('select public.get_shared_board() as snapshot')).rows,
  ).toEqual([{ snapshot: null }])
  await identity(editor, 'invalid')
  expect((await db.query('select * from public.boards')).rows).toHaveLength(0)
  token = (await sharing('viewer'))!
})

it('allows anonymous viewing of only the linked board, without revealing the token or calendars', async () => {
  await identity(null, token)
  const { rows } = await db.query<{
    snapshot: { board: { id: string }; access: string; columns: unknown[] }
  }>('select public.get_shared_board() as snapshot')
  expect(rows[0]!.snapshot.board.id).toBe(board)
  expect(rows[0]!.snapshot.access).toBe('viewer')
  expect(rows[0]!.snapshot.columns).toHaveLength(3)
  expect(JSON.stringify(rows)).not.toContain(token)
  for (const table of [
    'board_shares',
    'boards',
    'scheduled_sessions',
    'user_preferences',
  ])
    await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
      /permission denied/,
    )
  await expect(
    db.query('select public.create_column($1, 1, $2)', [board, 'Denied']),
  ).rejects.toThrow(/permission denied/)
})

it('denies viewer writes through RPCs and direct tables', async () => {
  await identity(editor, token)
  expect((await db.query('select id from public.boards')).rows).toEqual([
    { id: board },
  ])
  expect(
    (await db.query('select * from public.board_shares')).rows,
  ).toHaveLength(0)
  expect(
    (
      await db.query('select public.get_board_snapshot($1) as snapshot', [
        otherBoard,
      ])
    ).rows,
  ).toEqual([{ snapshot: null }])
  await expect(
    db.query('select public.create_column($1, $2, $3)', [
      board,
      await version(),
      'Denied',
    ]),
  ).rejects.toThrow(/Board unavailable/)
  expect(
    (
      await db.query(
        'update public.columns set title = $1 where id = $2 returning id',
        ['Denied', column],
      )
    ).rows,
  ).toHaveLength(0)
  expect(
    (
      await db.query('delete from public.columns where id = $1 returning id', [
        column,
      ])
    ).rows,
  ).toHaveLength(0)
  await expect(
    db.query(
      'insert into public.columns (board_id,title,position) values ($1,$2,3)',
      [board, 'Denied'],
    ),
  ).rejects.toThrow(/Active board unavailable/)
})

it('supports signed-in editing with owner relationships and revision checks', async () => {
  expect(await sharing('editor')).toBe(token)
  await identity(null, token)
  await expect(
    db.query('select public.create_column($1,1,$2)', [board, 'Denied']),
  ).rejects.toThrow(/permission denied/)
  await identity(editor, token)
  const revision = await version()
  const card = (
    await db.query<{ id: string }>(
      'select public.create_card($1,$2,$3,$4) as id',
      [board, revision, column, 'Collaborative task'],
    )
  ).rows[0]!.id
  expect(
    (await db.query('select owner_id from public.cards where id = $1', [card]))
      .rows,
  ).toEqual([{ owner_id: owner }])
  await expect(
    db.query('select public.create_column($1,$2,$3)', [
      board,
      revision,
      'Stale',
    ]),
  ).rejects.toThrow(/Board changed/)
  const label = (
    await db.query<{ id: string }>(
      'select public.create_label($1,$2,$3,$4) as id',
      [board, await version(), 'Shared label', '#244e3c'],
    )
  ).rows[0]!.id
  await db.query(
    'select public.save_card($1,$2,$3,$4,$5,null,false,false,null,$6::jsonb)',
    [
      board,
      await version(),
      card,
      'Edited task',
      'Shared description',
      JSON.stringify([label]),
    ],
  )
  expect(
    (await db.query('select owner_id from public.card_labels')).rows,
  ).toEqual([{ owner_id: owner }])
  await db.query('select public.move_card($1,$2,$3,$4)', [
    board,
    await version(),
    card,
    column,
  ])
  await db.query('select public.save_column($1,$2,$3,$4)', [
    board,
    await version(),
    column,
    'Edited column',
  ])
  await expect(
    db.query('update public.cards set column_id = $1 where id = $2', [
      otherColumn,
      card,
    ]),
  ).rejects.toThrow(/foreign key/)
  await db.query('select public.delete_card($1,$2,$3)', [
    board,
    await version(),
    card,
  ])
})

it('keeps sharing, board deletion/settings, unrelated boards and personal data owner-only', async () => {
  await identity(editor, token)
  await expect(
    db.query('select public.set_board_sharing($1,$2,null)', [
      board,
      await version(),
    ]),
  ).rejects.toThrow(/Board unavailable/)
  await expect(
    db.query('select public.delete_board($1,$2)', [board, await version()]),
  ).rejects.toThrow(/Board unavailable/)
  await expect(
    db.query('select public.save_board($1,$2,$3,false)', [
      board,
      await version(),
      'Stolen',
    ]),
  ).rejects.toThrow(/Board unavailable/)
  expect(
    (
      await db.query(
        'update public.boards set title = $1 where id = $2 returning id',
        ['Stolen', board],
      )
    ).rows,
  ).toHaveLength(0)
  await expect(
    db.query('select public.create_column($1,1,$2)', [otherBoard, 'Intruder']),
  ).rejects.toThrow(/Board unavailable/)
  expect(
    (await db.query('select * from public.scheduled_sessions')).rows,
  ).toHaveLength(0)
  expect(
    (await db.query('select * from public.user_preferences')).rows,
  ).toHaveLength(0)
})

it('downgrades editors immediately and invalidates revoked links permanently', async () => {
  await sharing('viewer')
  await identity(editor, token)
  await expect(
    db.query('select public.create_column($1,$2,$3)', [
      board,
      await version(),
      'Denied',
    ]),
  ).rejects.toThrow(/Board unavailable/)
  await sharing(null)
  await identity(editor, token)
  expect((await db.query('select * from public.boards')).rows).toHaveLength(0)
  expect(
    (await db.query('select public.get_shared_board() as snapshot')).rows,
  ).toEqual([{ snapshot: null }])
  const replacement = await sharing('editor')
  expect(replacement).not.toBe(token)
  await identity(null, token)
  expect(
    (await db.query('select public.get_shared_board() as snapshot')).rows,
  ).toEqual([{ snapshot: null }])
})
