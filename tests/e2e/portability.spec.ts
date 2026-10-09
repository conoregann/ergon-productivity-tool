import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { installBackend } from './backend.js'
import { workspaceFixture } from '../fixtures/workspace.js'

test('downloads JSON, validates files, previews and imports copies with keyboard controls', async ({
  page,
}, testInfo) => {
  await installBackend(page)
  let imported: unknown = null
  await page.route('https://ergon.test/rest/v1/rpc/export_workspace', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(workspaceFixture),
    }),
  )
  await page.route(
    'https://ergon.test/rest/v1/rpc/import_workspace',
    async (route) => {
      imported = route.request().postDataJSON().p_data
      await route.fulfill({ contentType: 'application/json', body: 'null' })
    },
  )
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Export and import JSON' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('ergon-export.json')
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(
    workspaceFixture,
  )
  const file = dialog.getByLabel('Import JSON file')
  await file.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(dialog.getByRole('alert')).toContainText('not valid JSON')
  expect(imported).toBeNull()
  await expect(
    dialog.getByRole('button', { name: 'Import copies' }),
  ).toHaveCount(0)
  await file.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(workspaceFixture)),
  })
  await expect(dialog).toContainText(
    'Ready to import: boards: 1, columns: 1, cards: 1, labels: 1, sessions: 1',
  )
  expect(imported).toBeNull()
  await page.screenshot({ path: testInfo.outputPath('import-preview.png') })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await dialog.getByRole('button', { name: 'Import copies' }).click()
  await expect(dialog.getByRole('status')).toContainText('Import complete')
  expect(imported).toEqual(workspaceFixture)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('shows server errors and retains the import preview for retry', async ({
  page,
}) => {
  await installBackend(page)
  await page.route('https://ergon.test/rest/v1/rpc/import_workspace', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Import rejected' }),
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Export and import JSON' }).click()
  await page.getByLabel('Import JSON file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(workspaceFixture)),
  })
  await page.getByRole('button', { name: 'Import copies' }).click()
  await expect(page.getByRole('alert')).toContainText('Import rejected')
  await expect(
    page.getByRole('button', { name: 'Import copies' }),
  ).toBeEnabled()
})
