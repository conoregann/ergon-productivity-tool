import { test, expect } from '@playwright/test'

test('foundation loads on desktop and mobile without backend credentials', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle('Ergon — Tasks & Time')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Welcome to Ergon' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
