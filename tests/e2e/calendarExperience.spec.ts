import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installBackend } from './backend.js'

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-09T08:00:00Z'))
  const control = await installBackend(page)
  const base = {
    owner_id: '00000000-0000-0000-0000-000000000001',
    version: 1,
    created_at: '2026-10-08T09:00:00Z',
    updated_at: '2026-10-08T09:00:00Z',
  }
  for (const [id, title] of [
    ['work', 'Work'],
    ['home', 'Home'],
  ]) {
    const cards = [
      {
        ...base,
        id: `${id}-task`,
        board_id: id!,
        column_id: `${id}-column`,
        title: id === 'work' ? 'Proposal history' : 'Research',
        description: '',
        priority: 'none',
        position: 0,
        due_date: id === 'work' ? '2026-10-09' : null,
        completed_at: id === 'work' ? '2026-10-08T12:00:00Z' : null,
        archived_at: null,
      },
    ]
    control.seed.boards.set(id!, {
      board: {
        ...base,
        id: id!,
        title: title!,
        background: 'neutral',
        archived_at: null,
      },
      columns: [
        {
          ...base,
          id: `${id}-column`,
          board_id: id!,
          title: 'To do',
          position: 0,
        },
      ],
      cards,
      labels:
        id === 'work'
          ? [
              {
                ...base,
                id: 'focus',
                board_id: id!,
                name: 'Focus',
                color: '#244e3c',
              },
            ]
          : [],
      cardLabels:
        id === 'work'
          ? [
              {
                owner_id: base.owner_id,
                board_id: id!,
                card_id: 'work-task',
                label_id: 'focus',
              },
            ]
          : [],
    })
    control.seed.sessions.set(`${id}-session`, {
      ...base,
      id: `${id}-session`,
      card_id: `${id}-task`,
      starts_at:
        id === 'work' ? '2026-10-09T09:00:00Z' : '2026-10-09T09:30:00Z',
      ends_at: id === 'work' ? '2026-10-09T10:00:00Z' : '2026-10-09T10:30:00Z',
    })
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Timetable', exact: true }).click()
  return control
}

test('agenda combines filters, retains hidden overlap warnings, and preserves completed session history', async ({
  page,
}, testInfo) => {
  const control = await setup(page)
  await page
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('agenda')
  const work = page.getByRole('button', {
    name: /^Edit session Proposal history,/,
  })
  const home = page.getByRole('button', { name: /^Edit session Research,/ })
  await expect(work).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Deadline Proposal history Completed' }),
  ).toBeVisible()
  await expect(home).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Completion', exact: true })
    .selectOption('completed')
  await expect(home).toHaveCount(0)
  await expect(work).toContainText('Overlaps another session')
  await page
    .getByRole('combobox', { name: 'Label', exact: true })
    .selectOption('focus')
  await expect(work).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Board', exact: true })
    .selectOption('home')
  await expect(
    page.getByRole('combobox', { name: 'Label', exact: true }),
  ).toHaveValue('')
  await expect(work).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await work.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Edit session' })).toBeVisible()
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue(
    '2026-10-09T09:00',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await home.click()
  await page.getByRole('button', { name: 'Edit task', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(home).toContainText('Completed')
  expect(control.seed.sessions.get('home-session')!.starts_at).toBe(
    '2026-10-09T09:30:00Z',
  )
  expect(control.seed.sessions.get('work-session')!.ends_at).toBe(
    '2026-10-09T10:00:00Z',
  )
  await page.screenshot({
    path: testInfo.outputPath('calendar-agenda.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('calendar shows date-only deadlines and keyboard session controls in the desktop grid', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop grid; mobile uses native agenda controls',
  )
  await setup(page)
  const deadline = page.locator('.calendar-deadline')
  await expect(deadline).toHaveCount(1)
  await expect(deadline).toContainText('Deadline: Proposal history')
  const session = page.locator('[data-session-id="work-session"]')
  await expect(session).toContainText('Completed')
  await session.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Edit session' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('button', { name: 'Calendar preferences', exact: true })
    .click()
  await page.getByLabel('Timezone', { exact: true }).fill('America/New_York')
  await page
    .getByRole('button', { name: 'Save preferences', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(deadline).toHaveCount(1)
  await session.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue(
    '2026-10-09T05:00',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.screenshot({
    path: testInfo.outputPath('calendar-desktop.png'),
    fullPage: true,
  })
})

test('mobile scheduling form moves and resizes sessions without drag gestures', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile agenda')
  const control = await setup(page)
  await expect(page.locator('.calendar-grid')).toHaveCount(0)
  const session = page.getByRole('button', { name: /^Edit session Research,/ })
  await session.click()
  await page.getByLabel('Start time', { exact: true }).fill('2026-10-09T11:00')
  await page.getByLabel('End time', { exact: true }).fill('2026-10-09T12:30')
  await page.getByRole('button', { name: 'Save session', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(session).toContainText('11:00 – 12:30')
  expect(control.seed.sessions.get('home-session')!.starts_at).toBe(
    '2026-10-09T11:00:00.000Z',
  )
  expect(control.seed.sessions.get('home-session')!.ends_at).toBe(
    '2026-10-09T12:30:00.000Z',
  )
  await session.click()
  await page
    .getByRole('button', { name: 'Remove session', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(control.seed.boards.get('home')!.cards[0]!.title).toBe('Research')
  await expect(page.locator('[data-task-id="home-task"]')).toBeVisible()
})
