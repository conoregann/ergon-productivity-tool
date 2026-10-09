import { test, expect } from '@playwright/test'
import { installBackend } from './backend.js'

test('calendar preferences persist, retain failed drafts, and require reviewing conflicts', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00Z'))
  const control = await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  await page
    .getByRole('button', { name: 'Calendar preferences', exact: true })
    .click()
  await page.getByLabel('Timezone', { exact: true }).fill('Europe/Dublin')
  await page
    .getByRole('combobox', { name: 'Week starts on', exact: true })
    .selectOption('0')
  await page
    .getByRole('combobox', { name: 'Calendar view', exact: true })
    .selectOption('agenda')
  control.failNext = true
  await page
    .getByRole('button', { name: 'Save preferences', exact: true })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Simulated write failure',
  )
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue(
    'Europe/Dublin',
  )
  await page
    .getByRole('button', { name: 'Save preferences', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('combobox', { name: 'View', exact: true }),
  ).toHaveValue('agenda')
  await expect(page.locator('.agenda-day').first()).toContainText(
    'Sunday 4 Oct',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  await page
    .getByRole('button', { name: 'Calendar preferences', exact: true })
    .click()
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue(
    'Europe/Dublin',
  )
  await expect(
    page.getByRole('combobox', { name: 'Week starts on', exact: true }),
  ).toHaveValue('0')
  await expect(
    page.getByRole('combobox', { name: 'Calendar view', exact: true }),
  ).toHaveValue('agenda')
  await page.getByLabel('Timezone', { exact: true }).fill('UTC')
  control.conflictNext = true
  await page
    .getByRole('button', { name: 'Save preferences', exact: true })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Changed on another device',
  )
  await expect(
    page.getByRole('button', { name: 'Save preferences', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('UTC')
  await page
    .getByRole('button', { name: 'Close draft and review latest preferences' })
    .click()
  await page
    .getByRole('button', { name: 'Calendar preferences', exact: true })
    .click()
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue(
    'Europe/Dublin',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Calendar preferences', exact: true }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('calendar-preferences.png'),
    fullPage: true,
  })
})

test('uses the saved timezone for session writes and retains the task after removal', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00Z'))
  await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Work')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Timezone task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const initialRead = page.waitForResponse((response) =>
    response.url().endsWith('/get_scheduling_snapshot'),
  )
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  const initial = (await (await initialRead).json()) as { cards: unknown[] }
  await page
    .getByRole('button', { name: 'Calendar preferences', exact: true })
    .click()
  await page.getByLabel('Timezone', { exact: true }).fill('Europe/Dublin')
  await page
    .getByRole('combobox', { name: 'Calendar view', exact: true })
    .selectOption('agenda')
  await page
    .getByRole('button', { name: 'Save preferences', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Schedule task', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Task', exact: true })
    .selectOption({ label: 'Timezone task' })
  await page.getByLabel('Start time', { exact: true }).fill('2026-10-09T09:00')
  await page.getByLabel('End time', { exact: true }).fill('2026-10-09T10:00')
  const write = page.waitForRequest((request) =>
    request.url().endsWith('/create_session'),
  )
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  expect((await write).postDataJSON()).toMatchObject({
    p_starts_at: '2026-10-09T08:00:00.000Z',
    p_ends_at: '2026-10-09T09:00:00.000Z',
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: /^Edit session Timezone task/ })
    .click()
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue(
    '2026-10-09T09:00',
  )
  const removedRead = page.waitForResponse((response) =>
    response.url().endsWith('/get_scheduling_snapshot'),
  )
  await page
    .getByRole('button', { name: 'Remove session', exact: true })
    .click()
  const removed = (await (await removedRead).json()) as {
    cards: unknown[]
    sessions: unknown[]
  }
  expect(removed.cards).toEqual(initial.cards)
  expect(removed.sessions).toEqual([])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.locator('[data-task-id]').filter({ hasText: 'Timezone task' }),
  ).toBeVisible()
})
