import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
assert(url && publicKey, 'Configure .env.local before running live checks')
const projectRef = new URL(url).hostname.split('.')[0]
// Read the admin key into this process only. Never write it to a file or frontend env.
const keys = JSON.parse(
  execFileSync(
    'npx',
    [
      'supabase',
      'projects',
      'api-keys',
      '--project-ref',
      projectRef,
      '--output',
      'json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ),
)
const adminKey = keys.find((key) => key.name === 'service_role')?.api_key
assert(
  adminKey,
  'The authenticated Supabase CLI must have access to the project admin key',
)
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, adminKey, options)
const users = []
function checked(result, step) {
  assert(!result.error, `${step}: ${result.error?.message ?? ''}`)
  return result.data
}
try {
  const clients = []
  for (let index = 0; index < 2; index++) {
    const email = `ergon-verification-${randomUUID()}@example.invalid`
    const password = randomUUID() + randomUUID()
    const data = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
      'Create temporary test user',
    )
    assert(data.user)
    users.push(data.user.id)
    const client = createClient(url, publicKey, options)
    checked(
      await client.auth.signInWithPassword({ email, password }),
      'Authenticate temporary user',
    )
    clients.push(client)
  }
  console.log('Temporary users authenticated. Checking hosted board writes…')
  const [alice, bob] = clients
  const boardId = checked(
    await alice.rpc('create_board', {
      p_title: 'Temporary verification board',
    }),
    'Create owned board',
  )
  let snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Read owner snapshot',
  )
  assert.equal(snapshot.columns.length, 3)
  assert(Array.isArray(snapshot.labels), 'Apply the labels migration')
  assert(Array.isArray(snapshot.cardLabels), 'Apply the labels migration')
  const labelId = checked(
    await alice.rpc('create_label', {
      p_board_id: boardId,
      p_version: snapshot.board.version,
      p_name: 'Verification',
      p_color: '#244e3c',
    }),
    'Create owned label',
  )
  snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Refresh label snapshot',
  )
  const cardId = checked(
    await alice.rpc('create_card', {
      p_board_id: boardId,
      p_version: snapshot.board.version,
      p_column_id: snapshot.columns[0].id,
      p_title: 'Temporary task',
      p_priority: 'high',
      p_label_ids: [labelId],
    }),
    'Create task',
  )
  snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Refresh snapshot',
  )
  const version = snapshot.board.version
  checked(
    await alice.rpc('move_card', {
      p_board_id: boardId,
      p_version: version,
      p_card_id: cardId,
      p_column_id: snapshot.columns[1].id,
    }),
    'Move task',
  )
  const stale = await alice.rpc('move_card', {
    p_board_id: boardId,
    p_version: version,
    p_card_id: cardId,
    p_column_id: snapshot.columns[2].id,
  })
  assert.equal(
    stale.error?.code,
    'PT409',
    `Stale write response: ${stale.status} ${stale.error?.message ?? 'no error'}`,
  )
  console.log('Hosted stale-write conflict verified. Checking isolation…')
  const hidden = checked(
    await bob.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Read second-user snapshot',
  )
  assert.equal(hidden, null)
  const foreign = await bob.rpc('create_card', {
    p_board_id: boardId,
    p_version: version,
    p_column_id: snapshot.columns[0].id,
    p_title: 'Forbidden',
  })
  assert(foreign.error, 'Foreign board writes must be denied')
  for (const table of [
    'boards',
    'columns',
    'cards',
    'labels',
    'card_labels',
    'scheduled_sessions',
  ]) {
    const field =
      table === 'boards'
        ? 'id'
        : table === 'scheduled_sessions'
          ? 'card_id'
          : 'board_id'
    const value = table === 'scheduled_sessions' ? cardId : boardId
    assert.deepEqual(
      checked(
        await bob.from(table).select('*').eq(field, value),
        `Second-user isolation: ${table}`,
      ),
      [],
    )
  }
  snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Verify persisted move',
  )
  assert.equal(snapshot.cards[0].column_id, snapshot.columns[1].id)
  assert.equal(snapshot.cards[0].priority, 'high')
  checked(
    await alice.rpc('save_card', {
      p_board_id: boardId,
      p_version: snapshot.board.version,
      p_card_id: cardId,
      p_title: 'Temporary task',
      p_description: '',
      p_due_date: '2026-10-09',
      p_due_time: '14:30',
      p_label_ids: [labelId],
      p_completed: false,
      p_archived: false,
      p_priority: 'urgent',
    }),
    'Save task priority, label assignment, and deadline time',
  )
  snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Verify priority persistence',
  )
  assert.equal(snapshot.cards[0].priority, 'urgent')
  assert.equal(snapshot.cards[0].due_date, '2026-10-09')
  assert.equal(snapshot.cards[0].due_time, '14:30')
  assert.equal(snapshot.cardLabels[0].label_id, labelId)
  checked(
    await alice.rpc('save_board', {
      p_board_id: boardId,
      p_version: snapshot.board.version,
      p_title: 'Temporary verification board',
      p_archived: false,
      p_background: 'teal',
    }),
    'Set board background',
  )
  snapshot = checked(
    await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
    'Verify board background',
  )
  assert.equal(snapshot.board.background, 'teal')
  assert.equal(snapshot.cardLabels[0].label_id, labelId)
  const sessionId = randomUUID()
  checked(
    await alice.rpc('create_session', {
      p_id: sessionId,
      p_card_id: cardId,
      p_starts_at: '2026-10-09T08:00:00Z',
      p_ends_at: '2026-10-09T09:00:00Z',
    }),
    'Create scheduled session',
  )
  checked(
    await alice.rpc('save_calendar_preferences', {
      p_version: 0,
      p_timezone: 'Europe/Dublin',
      p_week_starts_on: 1,
      p_calendar_view: 'agenda',
    }),
    'Save calendar preferences',
  )
  const schedule = checked(
    await alice.rpc('get_scheduling_snapshot'),
    'Read scheduling snapshot',
  )
  assert.equal(schedule.sessions[0].id, sessionId)
  assert.equal(schedule.preferences.timezone, 'Europe/Dublin')
  assert.equal(schedule.cards[0].column_id, snapshot.cards[0].column_id)
  assert.equal(schedule.cards[0].version, snapshot.cards[0].version)
  assert.equal(schedule.boards[0].version, snapshot.board.version)
  const foreignSchedule = checked(
    await bob.rpc('get_scheduling_snapshot'),
    'Read second-user schedule',
  )
  assert.deepEqual(foreignSchedule.sessions, [])
  assert.deepEqual(foreignSchedule.cards, [])
  const exported = checked(
    await alice.rpc('export_workspace'),
    'Export workspace',
  )
  assert.equal(exported.card_labels[0].label_id, labelId)
  assert.equal(exported.scheduled_sessions[0].id, sessionId)
  checked(
    await bob.rpc('import_workspace', { p_data: exported }),
    'Import independent copies for second user',
  )
  const imported = checked(await bob.rpc('export_workspace'), 'Export copies')
  assert.equal(imported.boards.length, 1)
  assert.notEqual(imported.boards[0].id, boardId)
  assert.notEqual(imported.cards[0].id, cardId)
  assert.equal(imported.card_labels[0].card_id, imported.cards[0].id)
  assert.equal(imported.scheduled_sessions[0].card_id, imported.cards[0].id)
  const foreignBackground = await bob.rpc('save_board', {
    p_board_id: boardId,
    p_version: snapshot.board.version,
    p_title: 'Forbidden',
    p_archived: false,
    p_background: 'rose',
  })
  assert(
    foreignBackground.error,
    'Foreign board appearance writes must be denied',
  )
  console.log('Checking hosted sharing links, editor access, and revocation…')
  const readOwner = async () =>
    checked(
      await alice.rpc('get_board_snapshot', { p_board_id: boardId }),
      'Refresh sharing revision',
    )
  const setSharing = async (access) =>
    checked(
      await alice.rpc('set_board_sharing', {
        p_board_id: boardId,
        p_version: (await readOwner()).board.version,
        p_access: access,
      }),
      'Set sharing access',
    )
  const share = await setSharing('viewer')
  const linkOptions = {
    ...options,
    global: { headers: { 'x-board-share': share.token } },
  }
  const visitor = createClient(url, publicKey, linkOptions)
  const shared = checked(
    await visitor.rpc('get_shared_board'),
    'Anonymous link read',
  )
  assert.equal(shared.board.id, boardId)
  assert.equal(shared.cards[0].id, cardId)
  assert.equal(shared.access, 'viewer')
  assert(
    !JSON.stringify(shared).includes(share.token),
    'Snapshots must omit sharing tokens',
  )
  const collaborator = createClient(url, publicKey, linkOptions)
  checked(
    await collaborator.auth.setSession(
      checked(await bob.auth.getSession(), 'Get collaborator session').session,
    ),
    'Authenticate link collaborator',
  )
  const addSharedColumn = () =>
    collaborator.rpc('create_column', {
      p_board_id: boardId,
      p_version: shared.board.version,
      p_title: 'Collaborator column',
    })
  assert((await addSharedColumn()).error, 'Viewer writes must be denied')
  assert(
    (
      await visitor.rpc('create_column', {
        p_board_id: boardId,
        p_version: shared.board.version,
        p_title: 'Anonymous write',
      })
    ).error,
    'Anonymous writes must be denied',
  )
  assert.equal((await setSharing('editor')).token, share.token)
  shared.board.version = (await readOwner()).board.version
  const sharedColumn = checked(
    await addSharedColumn(),
    'Link editor creates a column',
  )
  const edited = await readOwner()
  assert.equal(
    edited.columns.find((column) => column.id === sharedColumn).owner_id,
    users[0],
  )
  assert(
    (
      await collaborator.rpc('delete_board', {
        p_board_id: boardId,
        p_version: edited.board.version,
      })
    ).error,
    'Link editors must not delete boards',
  )
  assert(
    (
      await collaborator.rpc('set_board_sharing', {
        p_board_id: boardId,
        p_version: edited.board.version,
        p_access: null,
      })
    ).error,
    'Link editors must not control sharing',
  )
  const privateBoard = checked(
    await alice.rpc('create_board', { p_title: 'Temporary private board' }),
    'Create private isolation board',
  )
  assert.equal(
    checked(
      await collaborator.rpc('get_board_snapshot', {
        p_board_id: privateBoard,
      }),
      'Read unrelated board',
    ),
    null,
  )
  assert(
    checked(
      await collaborator
        .from('board_shares')
        .select('*')
        .eq('board_id', boardId),
      'Sharing token isolation',
    ).length === 0,
  )
  assert(
    !checked(
      await collaborator.rpc('get_scheduling_snapshot'),
      'Personal calendar isolation',
    ).sessions.some((session) => session.id === sessionId),
  )
  await setSharing('viewer')
  shared.board.version = (await readOwner()).board.version
  assert(
    (await addSharedColumn()).error,
    'Downgraded editor writes must be denied',
  )
  await setSharing(null)
  assert.equal(
    checked(await visitor.rpc('get_shared_board'), 'Revoked anonymous read'),
    null,
  )
  assert.equal(
    checked(
      await collaborator.rpc('get_board_snapshot', { p_board_id: boardId }),
      'Revoked authenticated read',
    ),
    null,
  )
  assert(
    (await addSharedColumn()).error,
    'Revoked editor writes must be denied',
  )
  assert.notEqual((await setSharing('viewer')).token, share.token)
  assert.equal(
    checked(await visitor.rpc('get_shared_board'), 'Old token remains revoked'),
    null,
  )
  console.log(
    'PASS: hosted viewer/editor sharing, private-board and calendar isolation, downgrade, revocation, and token replacement.',
  )
  checked(await alice.auth.signOut(), 'Sign out temporary user')
  assert(
    (await alice.from('boards').select('id').eq('id', boardId)).error,
    'Signed-out access must be denied',
  )
  console.log(
    'PASS: hosted board/card/label persistence, transactional movement, scheduling/preferences, JSON export/import, stale-write rejection, two-user isolation, and logout denial.',
  )
} catch (error) {
  console.error('Live check failed:', error.message)
  throw error
} finally {
  const failures = []
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) failures.push(id)
  }
  assert.equal(
    failures.length,
    0,
    `Temporary user cleanup failed for: ${failures.join(', ')}`,
  )
  console.log('Temporary verification users and their owned data removed.')
}
