import { test, expect } from '@playwright/test'
import { installBackend } from './backend.js'

async function createWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByLabel('Board name').fill('Personal projects')
  await page.getByRole('button', { name: 'Create board' }).click()
  await expect(
    page.getByRole('heading', { name: 'Personal projects' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Prepare proposal')
  await page.getByLabel('Description').fill('Scope, timing, and deliverables')
  await page.getByLabel('Due date').fill('2026-10-09')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
}

test('creates, edits, moves, archives and restores tasks with keyboard-friendly forms', async ({
  page,
}) => {
  await installBackend(page)
  await createWorkspace(page)
  await page
    .getByRole('button', { name: 'Move Prepare proposal', exact: true })
    .click()
  await page
    .getByLabel('Column', { exact: true })
    .selectOption({ label: 'In progress' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Personal projects', exact: true })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Edit Prepare proposal', exact: true })
    .click()
  await page.getByLabel('Completed', { exact: true }).check()
  await page.getByLabel('Archived', { exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Prepare proposal' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Archived tasks (1)' }).click()
  await page
    .getByRole('button', { name: 'Edit archived task Prepare proposal' })
    .click()
  await page.getByLabel('Archived', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add column', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Review')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Review', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Move Review earlier', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Move Review earlier', exact: true }),
  ).toBeEnabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Edit board', exact: true }).click()
  await page.getByLabel('Archived', { exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Add column', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '← All boards', exact: true }).click()
  await page.getByRole('button', { name: 'Show archived boards' }).click()
  await expect(
    page.getByRole('button', { name: 'Personal projects', exact: true }),
  ).toBeVisible()
})

test('rolls back failed optimistic movement and retains failed/conflicting drafts', async ({
  page,
}) => {
  const backend = await installBackend(page)
  await createWorkspace(page)
  await page
    .getByRole('button', { name: 'Move Prepare proposal', exact: true })
    .click()
  await page
    .getByLabel('Column', { exact: true })
    .selectOption({ label: 'In progress' })
  backend.failNext = true
  backend.delayNext = 500
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Simulated write failure')
  await expect(
    page
      .getByRole('region', { name: 'To do', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  await expect(page.getByLabel('Column', { exact: true })).toHaveValue(
    (await page
      .getByLabel('Column', { exact: true })
      .locator('option')
      .filter({ hasText: 'In progress' })
      .getAttribute('value')) ?? '',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('button', { name: 'Edit Prepare proposal', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('My unsaved draft')
  backend.conflictNext = true
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'changed on another device',
  )
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'My unsaved draft',
  )
  await page
    .getByRole('button', { name: 'Close draft and review latest board' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
})

test('moves a task with its keyboard drag grip', async ({ page }, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Second task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const grip = page.getByRole('button', { name: 'Drag task Prepare proposal' })
  await expect(grip).toBeEnabled()
  await grip.focus()
  await grip.press('Space')
  await expect(grip).toHaveAttribute('aria-pressed', 'true')
  const announcement = page.getByRole('status')
  await expect(announcement).toContainText('moved over')
  const initialAnnouncement = await announcement.textContent()
  await grip.press('ArrowDown')
  await expect(announcement).not.toHaveText(initialAnnouncement ?? '')
  await grip.press('Space')
  await expect(
    page
      .getByRole('region', { name: 'To do', exact: true })
      .getByRole('heading', { level: 4 }),
  ).toHaveText(['Second task', 'Prepare proposal'])
  await expect(grip).not.toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('listitem').filter({ has: grip })).toHaveCSS(
    'transform',
    'none',
  )
  await page
    .getByRole('heading', { name: 'Boards', exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('kanban.png'),
    fullPage: true,
  })
})
