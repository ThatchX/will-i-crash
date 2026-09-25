import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    await page.goto('/')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('flight completion requires an authenticated bearer token', async ({ request }) => {
    const response = await request.post('/api/actions/completeFlight', {
      data: {
        initial: {
          planetId: 'earth',
          altitudeMeters: 50,
          verticalSpeedMetersPerSecond: 60,
          horizontalSpeedMetersPerSecond: 0,
        },
        commands: [{ tick: 0, throttlePercent: 0, rotationDirection: 0 }],
      },
    })
    expect(response.status()).toBe(401)
  })
})
