import { test, expect } from '@playwright/test'
import { installBackend } from './backend.js'
import type { Page } from '@playwright/test'

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00Z'))
  const control = await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Planning')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Write proposal')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Timetable', exact: true }),
  ).toBeVisible()
  return control
}
async function schedule(page: Page, start: string, end: string) {
  await page.getByRole('button', { name: 'Schedule task', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Task', exact: true })
    .selectOption({ label: 'Write proposal' })
  await page.getByLabel('Start time', { exact: true }).fill(start)
  await page.getByLabel('End time', { exact: true }).fill(end)
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
function sessions(page: Page) {
  return page.locator('[data-session-id]').filter({ hasText: 'Write proposal' })
}

test('daily and weekly planning keeps multiple sessions attached to the same task', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop time-grid interactions',
  )
  await setup(page)
  await page
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('day')
  await schedule(page, '2026-10-09T09:00', '2026-10-09T10:00')
  await expect(sessions(page)).toHaveCount(1)
  await expect(page.locator('[data-task-id]')).toHaveCount(0)
  await schedule(page, '2026-10-09T11:00', '2026-10-09T12:00')
  await expect(sessions(page)).toHaveCount(2)
  await sessions(page).first().click()
  await page.getByLabel('Start time', { exact: true }).fill('2026-10-09T09:30')
  await page.getByLabel('End time', { exact: true }).fill('2026-10-09T10:30')
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('week')
  await expect(sessions(page)).toHaveCount(2)
  await sessions(page).first().click()
  await page.getByRole('button', { name: 'Edit task', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Revised proposal')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const revised = page
    .locator('[data-session-id]')
    .filter({ hasText: 'Revised proposal' })
  await expect(revised).toHaveCount(2)
  await revised.first().click()
  await page
    .getByRole('button', { name: 'Remove session', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(revised).toHaveCount(1)
  await page.reload()
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  await expect(revised).toHaveCount(1)
  await revised.first().click()
  await page
    .getByRole('button', { name: 'Remove session', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-task-id]')).toHaveCount(0)
  if (await page.getByRole('button', { name: 'Expand sidebar' }).isVisible())
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Planning', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open task Revised proposal', exact: true })
    .click()
  await page.getByRole('button', { name: 'Placement', exact: true }).click()
  await expect(page.getByLabel('Column', { exact: true })).toHaveValue(
    (await page
      .getByLabel('Column', { exact: true })
      .locator('option')
      .filter({ hasText: 'To do' })
      .getAttribute('value')) as string,
  )
})

test('failed scheduling retains the draft and allows a retry', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop timetable')
  const control = await setup(page)
  await page.getByRole('button', { name: 'Schedule task', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Task', exact: true })
    .selectOption({ label: 'Write proposal' })
  await page.getByLabel('Start time', { exact: true }).fill('2026-10-09T09:00')
  await page.getByLabel('End time', { exact: true }).fill('2026-10-09T10:00')
  control.failNext = true
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Simulated write failure')
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue(
    '2026-10-09T09:00',
  )
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(sessions(page)).toHaveCount(1)
})

test('pointer dragging moves and resizes a saved session', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop pointer interactions',
  )
  const control = await setup(page)
  await page
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('day')
  async function slot(time: string) {
    const box = await page
      .locator(`[data-time="${time}:00"]`)
      .last()
      .boundingBox()
    expect(box).not.toBeNull()
    return { x: box!.x + box!.width - 80, y: box!.y + box!.height / 2 }
  }
  async function drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 20 })
    await page.mouse.up()
  }
  const nine = await slot('09:00')
  await schedule(page, '2026-10-09T09:00', '2026-10-09T10:00')
  await expect.poll(() => control.seed.sessions.size).toBe(1)
  const saved = () => [...control.seed.sessions.values()][0]!
  await expect(sessions(page)).toHaveCount(1)
  const initial = saved().starts_at
  const event = await sessions(page).boundingBox()
  const eleven = await slot('11:00')
  await drag({ x: event!.x + event!.width / 2, y: event!.y + 12 }, eleven)
  await expect.poll(() => saved().starts_at).not.toBe(initial)
  const originalEnd = saved().ends_at
  const moved = await sessions(page).boundingBox()
  const ten = await slot('10:00')
  await drag(
    { x: moved!.x + moved!.width / 2, y: moved!.y + moved!.height - 2 },
    {
      x: moved!.x + moved!.width / 2,
      y: moved!.y + moved!.height - 2 + Math.abs(ten.y - nine.y),
    },
  )
  await expect
    .poll(() => Date.parse(saved().ends_at))
    .toBeGreaterThan(Date.parse(originalEnd))
  await page.reload()
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  await expect(sessions(page)).toHaveCount(1)
  expect(saved().card_id).toBe(
    [...control.seed.boards.values()][0]!.cards[0]!.id,
  )
  await page.screenshot({
    path: testInfo.outputPath('desktop-timetable.png'),
    fullPage: true,
  })
})
