import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, it, expect } from 'vitest'
import {
  validateWorkspaceExport,
  type WorkspaceExport,
} from '../../src/domain/portability.js'

const db = new PGlite()
const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
let backup: WorkspaceExport
async function asUser(user: string) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub = '${user}';`,
  )
}
async function exportData() {
  const { rows } = await db.query<{ data: WorkspaceExport }>(
    'select public.export_workspace() as data',
  )
  return validateWorkspaceExport(rows[0]!.data)
}
async function importData(data: unknown) {
  await db.query('select public.import_workspace($1::jsonb)', [
    JSON.stringify(data),
  ])
}
// Replace generated IDs with stable fixture names to compare data and all links.
function canonical(data: WorkspaceExport) {
  const names = new Map<string, string>()
  for (const b of data.boards) names.set(b.id, b.title)
  for (const c of data.columns) names.set(c.id, c.title)
  for (const c of data.cards) names.set(c.id, c.title)
  for (const l of data.labels) names.set(l.id, l.name)
  for (const s of data.scheduled_sessions) names.set(s.id, s.starts_at)
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value
            .map((row: Record<string, unknown>) =>
              Object.fromEntries(
                Object.entries(row).map(([field, value]) => [
                  field,
                  field === 'id' || field.endsWith('_id')
                    ? names.get(value as string)
                    : value,
                ]),
              ),
            )
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
        : value,
    ]),
  )
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');
  `)
  for (const name of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    await db.exec(
      await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'),
    )
  }
  await asUser(alice)
  await db.exec(`
    insert into public.boards(id, title, background) values ('10000000-0000-0000-0000-000000000001', 'History', 'sage');
    insert into public.boards(title) values ('Empty');
    insert into public.columns(id, board_id, title, position) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Done', 3);
    insert into public.cards(id, board_id, column_id, title, description, position, priority, due_date, due_time, completed_at, archived_at)
      values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Proposal', 'Long description 🌱', 2, 'urgent', '2026-10-09', '14:35', '2026-10-08T10:00:00Z', null);
    insert into public.labels(id, board_id, name, color) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Work', '#AABBCC');
    insert into public.card_labels(board_id, card_id, label_id) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');
    insert into public.scheduled_sessions(card_id, starts_at, ends_at) values
      ('30000000-0000-0000-0000-000000000001', '2026-10-08T09:00:00+01:00', '2026-10-08T10:00:00+01:00'),
      ('30000000-0000-0000-0000-000000000001', '2026-10-09T09:00:00+01:00', '2026-10-09T10:00:00+01:00');
    update public.cards set archived_at = '2026-10-08T11:00:00Z';
    update public.boards set archived_at = '2026-10-08T12:00:00Z' where title = 'History';
  `)
  backup = await exportData()
})
afterAll(() => db.close())

it('exports only the signed-in owner, without account or revision metadata', async () => {
  expect(backup.boards).toHaveLength(2)
  expect(JSON.stringify(backup)).not.toMatch(/owner_id|created_at|updated_at/)
  await asUser(bob)
  expect((await exportData()).boards).toEqual([])
})
it('round trips every entity and relationship across accounts and again with fresh IDs', async () => {
  await asUser(bob)
  await importData(backup)
  const imported = await exportData()
  expect(canonical(imported)).toEqual(canonical(backup))
  expect(
    imported.boards.every((b) => !backup.boards.some((old) => old.id === b.id)),
  ).toBe(true)
  await db.exec('delete from public.boards')
  await importData(imported)
  expect(canonical(await exportData())).toEqual(canonical(backup))
  await asUser(alice)
  expect(await exportData()).toEqual(backup)
})
it('adds copies without replacing existing boards', async () => {
  await asUser(bob)
  await importData(backup)
  expect((await exportData()).boards).toHaveLength(4)
})
it('rejects malformed data and broken relationships atomically even when bypassing client validation', async () => {
  await asUser(bob)
  const before = await exportData()
  const variants = [
    { ...backup, version: 2 },
    { ...backup, labels: null },
    { ...backup, boards: [...backup.boards, backup.boards[0]] },
    {
      ...backup,
      cards: backup.cards.map((c) => ({
        ...c,
        column_id: backup.boards[0]!.id,
      })),
    },
    {
      ...backup,
      card_labels: backup.card_labels.map((l) => ({
        ...l,
        board_id: backup.boards.find((b) => b.title === 'Empty')!.id,
      })),
    },
    {
      ...backup,
      scheduled_sessions: backup.scheduled_sessions.map((s) => ({
        ...s,
        card_id: '30000000-0000-0000-0000-000000000099',
      })),
    },
    {
      ...backup,
      scheduled_sessions: backup.scheduled_sessions.map((s) => ({
        ...s,
        ends_at: s.starts_at,
      })),
    },
    { ...backup, cards: backup.cards.map((c) => ({ ...c, position: -1 })) },
    { ...backup, boards: backup.boards.map((b) => ({ ...b, title: 12 })) },
  ]
  for (const invalid of variants) {
    await expect(importData(invalid)).rejects.toThrow()
    expect(await exportData()).toEqual(before)
  }
})
it('ignores supplied ownership and remaps source IDs instead of linking to existing data', async () => {
  await asUser(bob)
  await importData({
    ...backup,
    boards: backup.boards.map((b) => ({ ...b, owner_id: alice })),
  })
  const owners = await db.query<{ owner_id: string }>(
    'select distinct owner_id from public.boards',
  )
  expect(owners.rows).toEqual([{ owner_id: bob }])
})
it('denies anonymous RPC calls', async () => {
  await db.exec('reset role; set role anon;')
  await expect(exportData()).rejects.toThrow(/permission denied/)
  await expect(importData(backup)).rejects.toThrow(/permission denied/)
})
