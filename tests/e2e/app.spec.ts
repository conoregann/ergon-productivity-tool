import { test, expect } from '@playwright/test'

test('signed-out workspace loads on desktop and mobile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle('Ergon — Tasks & Time')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Your private workspace' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
