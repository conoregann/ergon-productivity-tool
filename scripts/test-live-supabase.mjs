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
  const cardId = checked(
    await alice.rpc('create_card', {
      p_board_id: boardId,
      p_version: snapshot.board.version,
      p_column_id: snapshot.columns[0].id,
      p_title: 'Temporary task',
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
  checked(await alice.auth.signOut(), 'Sign out temporary user')
  assert(
    (await alice.from('boards').select('id').eq('id', boardId)).error,
    'Signed-out access must be denied',
  )
  console.log(
    'PASS: hosted creation, persistence, transactional movement, stale-write rejection, two-user isolation, and logout denial.',
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
