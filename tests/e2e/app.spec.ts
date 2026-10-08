import { test, expect } from '@playwright/test'

test('signed-out workspace loads on desktop and mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle('Ergon — Tasks & Time')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Welcome to Ergon' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign up with GitHub' }),
  ).toBeVisible()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('authentication.png'),
    fullPage: true,
  })
})
