import { expect, test } from '@playwright/test'
import { installBackend } from './backend.js'

test('opens boards from the gallery and sidebar when the database returns a pre-label snapshot', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const control = await installBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New board', exact: true }).click()
  await page.getByLabel('Board name', { exact: true }).fill('Recovery board')
  await page.getByRole('button', { name: 'Create board', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add task to To do', exact: true })
    .click()
  await page.getByLabel('Title', { exact: true }).fill('Existing task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  control.legacyBoardSnapshot = true
  await page.reload()
  const board = page.getByRole('button', { name: 'Open board Recovery board' })
  await board.focus()
  await page.keyboard.press('Enter')
  const task = page.getByRole('button', { name: 'Open task Existing task' })
  await expect(task).toBeVisible()
  await task.click()
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(task).toBeFocused()
  if (await page.getByRole('button', { name: 'Expand sidebar' }).isVisible())
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Boards', exact: true }).click()
  await page
    .getByRole('button', { name: 'Recovery board', exact: true })
    .click()
  await expect(task).toBeVisible()
  expect(errors).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('recovered-board.png'),
    fullPage: true,
  })
})
