import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

test.describe('Smoke tests', () => {
  test('planetary simulator loads without application errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Choose a world. Try to land.' })).toBeVisible()
    await expect(page.getByTestId('descent-stage')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run descent' })).toBeVisible()
    await expect(page.getByTestId('planet-earth')).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })

  test('all eight planets are selectable', async ({ page }) => {
    await page.goto('/')
    for (const planet of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      await expect(page.getByTestId(`planet-${planet}`)).toBeVisible()
    }
    await page.getByTestId('planet-jupiter').click()
    await expect(page.getByTestId('planet-jupiter')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Gravity 24.79 m/s²')).toBeVisible()
  })

  test('sign-in button is visible when logged out', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('legacy home URL returns to the one-page simulator', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('descent-stage')).toBeVisible()
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await expect(page.locator('text=404')).toBeVisible({ timeout: 15_000 })
  })
})
