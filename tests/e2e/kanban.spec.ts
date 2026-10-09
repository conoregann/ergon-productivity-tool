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
  await page
    .getByRole('button', { name: 'Board settings', exact: true })
    .click()
}

test('completes tasks with the keyboard, preserves drafts on cancel, and honours reduced motion', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  const task = page.getByRole('button', { name: 'Open task Prepare proposal' })
  await task.click()
  const dialog = page.getByRole('dialog', { name: 'Edit task' })
  const completed = dialog.getByRole('checkbox', { name: 'Completed' })
  await completed.focus()
  await page.keyboard.press('Space')
  await expect(completed).toBeChecked()
  await expect(
    dialog.getByRole('checkbox', { name: 'Archived' }),
  ).not.toBeChecked()
  await page.screenshot({
    path: testInfo.outputPath('task-editor-completed.png'),
    fullPage: true,
  })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(task).toBeFocused()
  await expect(task.getByText('Completed', { exact: true })).toHaveCount(0)
  await task.click()
  await expect(completed).not.toBeChecked()
  await completed.check()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(task.getByText('Completed', { exact: true })).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(task.getByText('Completed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Use dark mode' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await task.click()
  await expect(completed).toBeChecked()
  await completed.uncheck()
  await completed.check()
  expect(
    await dialog
      .locator('.completion-control .status-checkbox > svg')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none')
  await page.screenshot({
    path: testInfo.outputPath('task-editor-dark.png'),
    fullPage: true,
  })
  await expect(
    dialog.getByRole('button', { name: 'Delete task' }),
  ).toBeVisible()
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
})

test('opens a board without a loading screen while its snapshot is pending', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rest/v1/rpc/get_board_snapshot', async (route) => {
    await pending
    await route.fallback()
  })
  await page.reload()
  const tile = page.getByRole('button', {
    name: 'Open board Personal projects',
  })
  await expect(tile).toBeVisible()
  await expect(page.getByText(/Loading|Opening board/)).toHaveCount(0)
  await tile.click()
  await expect(
    page.getByRole('heading', { name: 'Personal projects', exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/Loading|Opening board/)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Back to boards' }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: /sidebar/ })).toBeVisible()
  await page.getByRole('button', { name: /sidebar/ }).focus()
  await expect(page.getByRole('button', { name: /sidebar/ })).toBeFocused()
  await page.screenshot({
    path: testInfo.outputPath('board-pending.png'),
    fullPage: true,
  })
  release()
  await expect(
    page.getByRole('button', { name: 'Open task Prepare proposal' }),
  ).toBeVisible()
  await expect(page.getByText(/Loading|Opening board/)).toHaveCount(0)
})

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
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).check()
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
  await expect(page.locator('.background-preview')).toHaveCSS(
    'background-color',
    'rgb(242, 239, 249)',
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
  await expect(page.locator('.board-canvas')).toHaveCSS(
    'background-color',
    'rgb(242, 239, 249)',
  )
  await expect(page.locator('.priority-high')).toHaveCSS(
    'background-color',
    'rgb(255, 241, 220)',
  )
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
  await page.getByLabel('Due time', { exact: true }).fill('14:35')
  await page.getByRole('button', { name: 'Adjust due time' }).click()
  const hourSlider = page.getByRole('slider', { name: 'Hour', exact: true })
  await hourSlider.focus()
  await hourSlider.press('ArrowRight')
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue(
    '15:35',
  )
  await hourSlider.press('Home')
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue(
    '00:35',
  )
  const minuteSlider = page.getByRole('slider', { name: 'Minute', exact: true })
  await minuteSlider.focus()
  await minuteSlider.press('End')
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue(
    '00:59',
  )
  await page.screenshot({
    path: testInfo.outputPath('due-time-sliders.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Clear due time' }).click()
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue('')
  await minuteSlider.press('ArrowRight')
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue(
    '09:01',
  )
  await minuteSlider.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Adjust due time' }),
  ).toBeFocused()
  await expect(
    page.getByRole('group', { name: 'Due time controls' }),
  ).toHaveCount(0)
  await page.getByLabel('Due time', { exact: true }).fill('14:35')
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
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Due time', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Choose due date' }).click()
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  await expect(page.getByLabel('Due date', { exact: true })).toHaveValue(date)
  await page.getByLabel('Due time', { exact: true }).fill('09:05')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(
    page.getByText(`Due ${date} at 09:05`, { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  await expect(page.getByLabel('Due time', { exact: true })).toHaveValue(
    '09:05',
  )
  await page.getByLabel('Due time', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(`Due ${date}`, { exact: true })).toBeVisible()
})

test('lands the drag preview in the new column without flashing at its origin', async ({
  page,
}) => {
  const backend = await installBackend(page)
  await createWorkspace(page)
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
  await expect(page.locator('.drag-preview')).toBeVisible()
  await page.mouse.move(
    Math.min(page.viewportSize()!.width - 24, target.x + target.width / 2),
    target.y + 80,
    {
      steps: 12,
    },
  )
  await expect(page.getByRole('status')).toContainText('In progress')
  backend.delayNext = 700
  await page.evaluate(() => {
    const samples: {
      x: number
      destinationX: number
      sourceVisible: boolean
    }[] = []
    ;(window as unknown as { dropFrames: typeof samples }).dropFrames = samples
    document.addEventListener(
      'mouseup',
      () => {
        const end = performance.now() + 500
        const sample = () => {
          const preview = document.querySelector('.drag-preview')
          const sourceCard = document.querySelector(
            '[aria-label="To do"] .task-card',
          )
          if (preview)
            samples.push({
              x: preview.getBoundingClientRect().x,
              destinationX: document
                .querySelector('[aria-label="In progress"] .column-dropzone')!
                .getBoundingClientRect().x,
              sourceVisible: Boolean(
                sourceCard &&
                Number(getComputedStyle(sourceCard).opacity) > 0.5,
              ),
            })
          if (performance.now() < end) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      },
      { once: true },
    )
  })
  await page.mouse.up()
  await expect(page.locator('.drag-preview')).toHaveCount(0)
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Prepare proposal' }),
  ).toBeVisible()
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          dropFrames: {
            x: number
            destinationX: number
            sourceVisible: boolean
          }[]
        }
      ).dropFrames,
  )
  expect(frames.length).toBeGreaterThan(0)
  expect(frames.some((frame) => frame.sourceVisible)).toBe(false)
  expect(frames.every((frame) => frame.x >= frame.destinationX - 5)).toBe(true)
})

test('manages labels and combines search, label, priority and completion filters', async ({
  page,
}, testInfo) => {
  const backend = await installBackend(page)
  await createWorkspace(page)
  const header = page.locator('.board-header')
  for (const name of ['Filters', 'Manage labels', 'Board settings']) {
    const control = header.getByRole('button', { name, exact: true })
    await expect(control).toBeVisible()
    await expect(control).toHaveText('')
    const bounds = await control.boundingBox()
    expect(bounds?.width).toBe(40)
    expect(bounds?.height).toBe(40)
  }
  await page.screenshot({
    path: testInfo.outputPath('board-toolbar.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Manage labels', exact: true }).click()
  await page.getByRole('button', { name: 'New label', exact: true }).click()
  await page.getByLabel('Label name', { exact: true }).fill('Client')
  await page.getByRole('radio', { name: 'Blue', exact: true }).check()
  await expect(page.getByLabel('Label colour', { exact: true })).toHaveValue(
    '#345da5',
  )
  await page.screenshot({
    path: testInfo.outputPath('label-editor.png'),
    fullPage: true,
  })
  await page.getByLabel('Label colour').fill('#125abc')
  backend.failNext = true
  await page.getByRole('button', { name: 'Save label', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Simulated write failure',
  )
  await expect(page.getByLabel('Label name', { exact: true })).toHaveValue(
    'Client',
  )
  await page.getByRole('button', { name: 'Save label', exact: true }).click()
  await page.screenshot({
    path: testInfo.outputPath('label-manager.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Manage labels', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Open task Prepare proposal' }).click()
  const labelCheckbox = page.getByRole('checkbox', {
    name: 'Client',
    exact: true,
  })
  await labelCheckbox.focus()
  await labelCheckbox.press('Space')
  await expect(labelCheckbox).toBeChecked()
  await page.screenshot({
    path: testInfo.outputPath('task-label-choices.png'),
    fullPage: true,
  })
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const task = page.getByRole('button', { name: 'Open task Prepare proposal' })
  const labelTab = task.getByText('Client', { exact: true })
  await expect(labelTab).toBeVisible()
  await expect(labelTab).toHaveCSS('background-color', 'rgb(18, 90, 188)')
  await expect(labelTab).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.screenshot({
    path: testInfo.outputPath('card-label-tabs.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Other task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const filters = page.getByRole('button', { name: /^Filters/ })
  await expect(filters).toHaveAttribute('aria-expanded', 'false')
  await filters.focus()
  await filters.press('Enter')
  await expect(page.getByLabel('Search tasks', { exact: true })).toBeFocused()
  await page.getByLabel('Search tasks', { exact: true }).fill(' DELIVERABLES ')
  await expect(page.getByLabel('Search tasks', { exact: true })).toHaveValue(
    ' DELIVERABLES ',
  )
  await expect(
    page.getByRole('button', { name: 'Open task Other task' }),
  ).toHaveCount(0)
  await page.getByRole('radio', { name: 'Client', exact: true }).check()
  const highPriority = page.getByRole('radio', { name: 'High', exact: true })
  await highPriority.check()
  await highPriority.focus()
  await highPriority.press('ArrowRight')
  await expect(
    page.getByRole('radio', { name: 'Urgent', exact: true }),
  ).toBeChecked()
  await page.keyboard.press('ArrowLeft')
  await expect(highPriority).toBeChecked()
  await page.getByRole('radio', { name: 'Completed', exact: true }).check()
  await expect(page.getByLabel('Search tasks', { exact: true })).toHaveValue(
    ' DELIVERABLES ',
  )
  await expect(filters).toContainText('4')
  await page
    .getByRole('radio', { name: 'Completed', exact: true })
    .press('Escape')
  await expect(filters).toBeFocused()
  await expect(filters).toHaveAttribute('aria-expanded', 'false')
  await expect(task).toBeVisible()
  await filters.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Open task Other task' }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('task-filters.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('radio', { name: 'Incomplete', exact: true }).check()
  await expect(
    page.getByText('No tasks match your search and filters.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open task Other task' }),
  ).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(task.getByText('Client', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Manage labels', exact: true }).click()
  await page
    .getByRole('button', { name: 'Edit label Client', exact: true })
    .click()
  await page.getByLabel('Label name', { exact: true }).fill('Customer')
  backend.conflictNext = true
  await page.getByRole('button', { name: 'Save label', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'another device',
  )
  await expect(page.getByLabel('Label name', { exact: true })).toHaveValue(
    'Customer',
  )
  await page
    .getByRole('button', { name: 'Discard draft and review labels' })
    .click()
  await page
    .getByRole('button', { name: 'Edit label Client', exact: true })
    .click()
  await page.getByLabel('Label name', { exact: true }).fill('Customer')
  await page.getByRole('button', { name: 'Save label', exact: true }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(task.getByText('Customer', { exact: true })).toBeVisible()
  await task.click()
  await page.getByRole('checkbox', { name: 'Customer', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(task.getByText('Customer', { exact: true })).toHaveCount(0)
  await task.click()
  await page.getByRole('checkbox', { name: 'Customer', exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByRole('radio', { name: 'Customer', exact: true }).check()
  await page.getByRole('button', { name: 'Manage labels', exact: true }).click()
  await page
    .getByRole('button', { name: 'Edit label Customer', exact: true })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete label', exact: true }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(task.getByText('Customer', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(
    page.getByRole('radio', { name: 'All labels', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Close filters', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Task filters' }),
  ).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open task Other task' }),
  ).toBeVisible()
})

test('keeps snapping suspended throughout column movement and its drop animation', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  await createWorkspace(page)
  const handle = page.getByRole('button', { name: 'Drag column To do' })
  await handle.focus()
  await handle.press('Space')
  await expect(page.locator('.column-drag-preview')).toBeVisible()
  await expect(page.locator('.kanban-grid')).toHaveCSS(
    'scroll-snap-type',
    'none',
  )
  await handle.press('ArrowRight')
  await page.screenshot({ path: testInfo.outputPath('column-movement.png') })
  await handle.press('Space')
  await expect(page.locator('.kanban-grid > section').first()).toHaveAttribute(
    'aria-label',
    'In progress',
  )
  await expect(page.locator('.column-drag-preview')).toHaveCount(0)
  await expect(page.locator('.kanban-grid')).toHaveCSS('scroll-snap-type', 'x')
  await page.reload()
  await page
    .getByRole('button', { name: 'Open board Personal projects' })
    .click()
  await expect(page.locator('.kanban-grid > section').first()).toHaveAttribute(
    'aria-label',
    'In progress',
  )
})
