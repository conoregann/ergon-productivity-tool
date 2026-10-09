import { test, expect } from '@playwright/test'
import { installBackend } from './backend.js'

const editor = '00000000-0000-0000-0000-000000000002'

test('owner enables sharing and revokes the old link', async ({
  page,
}, testInfo) => {
  const backend = await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Shared planning')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  await page.getByRole('button', { name: 'Share board', exact: true }).click()
  const access = page.getByLabel('Link access')
  await expect(access).toHaveValue('private')
  await access.selectOption('viewer')
  const link = page.getByLabel('Sharing link')
  await expect(link).toBeVisible()
  const first = await link.inputValue()
  await access.selectOption('editor')
  await expect(access).toBeEnabled()
  await expect(link).toHaveValue(first)
  await page.screenshot({ path: testInfo.outputPath('sharing-settings.png') })
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Share board', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Share board', exact: true }).click()
  await access.selectOption('private')
  await expect(link).toHaveCount(0)
  await expect(access).toBeEnabled()
  await access.selectOption('viewer')
  await expect(link).toBeVisible()
  expect(await link.inputValue()).not.toBe(first)
  backend.seed.shares.clear()
  await page.goto(first)
  await expect(
    page.getByRole('heading', { name: 'Board unavailable' }),
  ).toBeVisible()
})

for (const role of ['viewer', 'editor'] as const) {
  test(`anonymous ${role} link shows a board without edit controls`, async ({
    page,
  }, testInfo) => {
    const backend = await installBackend(page)
    const id = '10000000-0000-0000-0000-000000000001'
    backend.seed.boards.set(id, {
      board: {
        id,
        owner_id: 'owner',
        title: 'Shared planning',
        version: 1,
        background: 'neutral',
        archived_at: null,
        created_at: '',
        updated_at: '',
      },
      columns: [
        {
          id: 'column',
          board_id: id,
          owner_id: 'owner',
          title: 'To do',
          position: 0,
          version: 1,
          created_at: '',
          updated_at: '',
        },
      ],
      cards: [
        {
          id: 'card',
          board_id: id,
          column_id: 'column',
          owner_id: 'owner',
          title: 'Prepare proposal',
          description: 'Scope, timing, and deliverables',
          position: 0,
          version: 1,
          created_at: '',
          updated_at: '',
          due_date: null,
          due_time: null,
          priority: 'high',
          completed_at: null,
          archived_at: null,
        },
      ],
      labels: [],
      cardLabels: [],
    })
    backend.seed.shares.set(id, {
      board_id: id,
      token: 'valid-link',
      access: role,
    })
    await page.addInitScript(() =>
      localStorage.removeItem('sb-ergon-auth-token'),
    )
    await page.goto('/?share=valid-link')
    await expect(
      page.getByRole('heading', { name: 'Shared planning' }),
    ).toBeVisible()
    await expect(page.getByText('View only', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Prepare proposal' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Add column', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Board settings', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Share board', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Sign in to edit' }),
    ).toHaveCount(role === 'editor' ? 1 : 0)
    await page.screenshot({ path: testInfo.outputPath('shared-viewer.png') })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    backend.seed.shares.clear()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Board unavailable' }),
    ).toBeVisible()
  })
}

test('signed-in link editor can edit tasks while owner settings remain hidden', async ({
  page,
}, testInfo) => {
  const backend = await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Shared planning')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  const id = [...backend.seed.boards.keys()][0]!
  backend.seed.shares.set(id, {
    board_id: id,
    token: 'editor-link',
    access: 'editor',
  })
  await page.addInitScript(
    ({ editor }) => {
      const session = JSON.parse(localStorage.getItem('sb-ergon-auth-token')!)
      session.user.id = editor
      localStorage.setItem('sb-ergon-auth-token', JSON.stringify(session))
    },
    { editor },
  )
  await page.goto('/?share=editor-link')
  await expect(
    page.getByRole('button', { name: 'Board settings', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Share board', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Shared task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open task Shared task' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open task Shared task' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Edited shared task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open task Edited shared task' }),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('shared-editor.png') })
})
