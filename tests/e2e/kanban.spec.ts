import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installBackend } from './backend.js'

async function createWorkspace(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Personal projects')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Rename board name: Personal projects',
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Prepare proposal')
  await page.getByLabel('Description').fill('Scope, timing, and deliverables')
  await page.getByLabel('Priority', { exact: true }).selectOption('high')
  await page.getByLabel('Due date', { exact: true }).fill('2026-10-09')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toBeVisible()
}
async function openPlacement(page: Page) {
  await page
    .getByRole('button', { name: 'Open task Prepare proposal', exact: true })
    .click()
  await page.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Move task' })).toBeVisible()
}
async function overview(page: Page) {
  if (await page.getByRole('button', { name: 'Expand sidebar' }).isVisible())
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Boards', exact: true }).click()
}
async function boardSettings(page: Page) {
  await page.getByLabel('Board options', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Board settings', exact: true })
    .click()
}

test('edits in a centred dialog, persists placement and priorities, and restores archived content', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit task' })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toBeFocused()
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  await expect
    .poll(async () => {
      const current = await dialog.boundingBox()
      return current
        ? Math.abs(current.x + current.width / 2 - viewport.width / 2)
        : Infinity
    })
    .toBeLessThan(3)
  await expect
    .poll(async () => {
      const current = await dialog.boundingBox()
      return current
        ? Math.abs(current.y + current.height / 2 - viewport.height / 2)
        : Infinity
    })
    .toBeLessThan(3)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('task-editor.png'),
    fullPage: true,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toBeFocused()
  await openPlacement(page)
  await page
    .getByLabel('Column', { exact: true })
    .selectOption({ label: 'In progress' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  await page.getByLabel('Priority', { exact: true }).selectOption('urgent')
  await page.getByLabel('Completed', { exact: true }).check()
  await page.getByLabel('Archived', { exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Archived tasks (1)' }).click()
  await page
    .getByRole('button', { name: 'Open archived task Prepare proposal' })
    .click()
  await page.getByLabel('Archived', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page
      .getByRole('button', { name: 'Open task Prepare proposal' })
      .getByText('Urgent', { exact: true }),
  ).toBeVisible()
  await boardSettings(page)
  await page.getByLabel('Archived', { exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Add column', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Archived boards', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await boardSettings(page)
  await page.getByLabel('Archived', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Add column', exact: true }),
  ).toBeEnabled()
})

test('rolls back failed movement and keeps conflicting drafts inside the modal', async ({
  page,
}) => {
  const backend = await installBackend(page)
  await createWorkspace(page)
  await openPlacement(page)
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
  ).toHaveCount(1)
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Simulated write failure',
  )
  await expect(
    page
      .getByRole('region', { name: 'To do', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toHaveCount(1)
  await expect(
    page.getByLabel('Column', { exact: true }).locator('option:checked'),
  ).toHaveText('In progress')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  await page.getByLabel('Title', { exact: true }).fill('My unsaved draft')
  backend.conflictNext = true
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'changed on another device',
  )
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'My unsaved draft',
  )
  await page
    .getByRole('button', { name: 'Close draft and review latest board' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toBeVisible()
})

test('sorts cards with the keyboard without opening the editor', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Second task')
  await page.getByLabel('Priority', { exact: true }).selectOption('medium')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const card = page.getByRole('button', { name: 'Open task Prepare proposal' })
  await card.focus()
  await card.press('Space')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  const announcement = page.getByRole('status')
  await expect(announcement).toContainText('moved over')
  const initial = await announcement.textContent()
  await card.press('ArrowDown')
  await expect(announcement).not.toHaveText(initial ?? '')
  await card.press('Space')
  await expect(
    page
      .getByRole('region', { name: 'To do', exact: true })
      .getByRole('heading', { level: 4 }),
  ).toHaveText(['Second task', 'Prepare proposal'])
  await expect(card).not.toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const item of await page.getByRole('listitem').all())
    await expect(item).toHaveCSS('transform', 'none')
  await page.getByRole('button', { name: /sidebar/ }).focus()
  await page.screenshot({
    path: testInfo.outputPath('kanban.png'),
    fullPage: true,
  })
})

test('renames boards and columns inline, places add-column after the lists, and persists dark mode', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  await page
    .getByRole('button', { name: 'Rename board name: Personal projects' })
    .click()
  await page.getByLabel('Board name', { exact: true }).fill('Client work')
  await page.getByLabel('Board name', { exact: true }).press('Enter')
  await expect(
    page.getByRole('button', { name: 'Rename board name: Client work' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Rename column name: To do' }).click()
  await page.getByLabel('Column name', { exact: true }).fill('Backlog')
  await page.getByLabel('Column name', { exact: true }).press('Enter')
  await expect(
    page.getByRole('region', { name: 'Backlog', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add column', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Review')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Review', exact: true }),
  ).toBeVisible()
  expect(
    await page.locator('.kanban-grid > :last-child').getAttribute('class'),
  ).toBe('add-column-tile')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Use dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page
    .getByRole('button', { name: 'Open task Prepare proposal' })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('dark-board.png'),
    fullPage: true,
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Open board Client work' }).click()
  await expect(
    page.getByRole('region', { name: 'Backlog', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Use light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await overview(page)
  await expect(
    page.getByRole('button', { name: 'Open board Client work' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'New board', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('board-overview.png'),
    fullPage: true,
  })
})

test('toggles sidebar board navigation and drags the card surface on desktop', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  const toggle = page.getByRole('button', { name: /sidebar/ })
  const expanded = await toggle.getAttribute('aria-expanded')
  await toggle.click()
  await expect(toggle).toHaveAttribute(
    'aria-expanded',
    expanded === 'true' ? 'false' : 'true',
  )
  await toggle.click()
  if (testInfo.project.name !== 'mobile') {
    await expect(page.locator('.sidebar')).toHaveCSS('width', '218px')
    const card = page.getByRole('button', {
      name: 'Open task Prepare proposal',
    })
    const source = await page
      .getByRole('heading', { name: 'Prepare proposal' })
      .boundingBox()
    const target = await page
      .getByRole('region', { name: 'In progress', exact: true })
      .locator('.column-dropzone')
      .boundingBox()
    if (!source || !target)
      throw new Error('Drag source or destination unavailable')
    await page.mouse.move(source.x + 12, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(source.x + 25, source.y + source.height / 2, {
      steps: 3,
    })
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.drag-preview')).toBeVisible()
    await page.mouse.move(target.x + target.width / 2, target.y + 80, {
      steps: 12,
    })
    await expect(page.getByRole('status')).toContainText('In progress')
    await expect(page.locator('.drop-target')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('drag-preview.png') })
    await page.mouse.up()
    await expect(page.locator('.drag-preview')).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'In progress', exact: true })
        .getByRole('heading', { name: 'Prepare proposal' }),
    ).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await overview(page)
  await page
    .getByRole('button', { name: 'Personal projects', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Move Prepare proposal' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit Prepare proposal' }),
  ).toHaveCount(0)
})

test('reorders columns with the keyboard and honours reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installBackend(page)
  await createWorkspace(page)
  const column = page.getByRole('button', { name: 'Drag column To do' })
  await column.focus()
  await column.press('Space')
  await expect(column).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toContainText('moved over')
  const initial = await page.getByRole('status').textContent()
  await column.press('ArrowRight')
  await expect(page.getByRole('status')).not.toHaveText(initial ?? '')
  await column.press('Space')
  await expect(page.locator('.kanban-grid > section').first()).toHaveAttribute(
    'aria-label',
    'In progress',
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page
      .locator('.app-layout')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s')
})

test('scrolls horizontally over every column and keeps vertical scrolling local', async ({
  page,
}) => {
  await installBackend(page)
  await createWorkspace(page)
  const grid = page.getByRole('group', { name: 'Board columns' })
  const columns = page.locator('.column-dropzone')
  for (let index = 0; index < 3; index++) {
    await grid.evaluate((el) => {
      el.style.scrollBehavior = 'auto'
      el.style.scrollSnapType = 'none'
      el.scrollLeft = 0
    })
    await columns.nth(index).scrollIntoViewIfNeeded()
    const before = await grid.evaluate((el) => el.scrollLeft)
    const bounds = await grid.boundingBox()
    const column = await columns.nth(index).boundingBox()
    if (!bounds || !column) throw new Error('Column unavailable')
    const x = Math.min(
      bounds.x + bounds.width - 12,
      Math.max(bounds.x + 12, column.x + 40),
    )
    await page.mouse.move(x, column.y + 80)
    await page.mouse.wheel(150, 0)
    await expect
      .poll(() => grid.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(before)
  }
  await grid.evaluate((el) => {
    el.scrollLeft = 0
  })
  const zone = columns.first()
  await zone.evaluate((el) => {
    const filler = document.createElement('div')
    filler.style.height = '2000px'
    el.append(filler)
  })
  const box = await zone.boundingBox()
  if (!box) throw new Error('Column unavailable')
  await page.mouse.move(box.x + 40, box.y + 80)
  await page.mouse.wheel(0, 200)
  await expect
    .poll(() => zone.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  expect(await grid.evaluate((el) => el.scrollLeft)).toBe(0)
})

test('previews and persists board backgrounds with rollback on failed writes', async ({
  page,
}, testInfo) => {
  const backend = await installBackend(page)
  await createWorkspace(page)
  await boardSettings(page)
  await page.getByRole('button', { name: 'Lavender background' }).click()
  await expect(page.locator('.background-preview')).toHaveAttribute(
    'data-background',
    'lavender',
  )
  await page.screenshot({
    path: testInfo.outputPath('background-settings.png'),
  })
  backend.failNext = true
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Simulated write failure',
  )
  await expect(page.locator('.board-canvas')).toHaveAttribute(
    'data-background',
    'neutral',
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.board-canvas')).toHaveAttribute(
    'data-background',
    'lavender',
  )
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(page.locator('.board-canvas')).toHaveAttribute(
    'data-background',
    'lavender',
  )
  await page
    .getByRole('button', { name: 'Open task Prepare proposal' })
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('lavender-board.png') })
  await overview(page)
  await expect(
    page.getByRole('button', { name: 'Overview', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('.board-miniature')).toHaveAttribute(
    'data-background',
    'lavender',
  )
  await page.getByRole('button', { name: 'Hide board list' }).click()
  await expect(
    page.getByRole('button', { name: 'Personal projects', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Show board list' }).click()
  await expect(
    page.getByRole('button', { name: 'Personal projects', exact: true }),
  ).toBeVisible()
})

test('chooses deadlines with a keyboard calendar, preserves date-only values, and clears dates', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  await page.getByRole('button', { name: 'Choose due date' }).click()
  const selected = page.locator('[data-date="2026-10-09"]')
  await expect(selected).toBeFocused()
  await selected.press('ArrowRight')
  await expect(page.locator('[data-date="2026-10-10"]')).toBeFocused()
  await page.locator('[data-date="2026-10-10"]').press('Enter')
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue(
    '2026-10-10',
  )
  await expect(
    page.getByRole('button', { name: 'Choose due date' }),
  ).toBeFocused()
  await page.getByLabel('Due date', { exact: true }).fill('2028-02-29')
  await page.getByRole('button', { name: 'Choose due date' }).click()
  await page.locator('[data-date="2028-02-29"]').press('ArrowRight')
  await expect(page.locator('[data-date="2028-03-01"]')).toBeFocused()
  await page.locator('[data-date="2028-03-01"]').press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Choose due date' }).click()
  await page.screenshot({ path: testInfo.outputPath('date-picker.png') })
  const bounds = await page.locator('.date-calendar').boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
  await page.mouse.click(viewport.width - 4, viewport.height / 2)
  await expect(
    page.getByRole('button', { name: 'Choose due date' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Choose due date' }).click()
  await page.getByRole('button', { name: 'Clear date', exact: true }).click()
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Choose due date' }).click()
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue(date)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(page.getByText(`Due ${date}`, { exact: true })).toBeVisible()
})
