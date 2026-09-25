import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create or recover test accounts with the DeepSpace CLI.`,
)

test('a signed-in pilot can fly and save a verified landing result', async ({ users }) => {
  const [pilot] = await users(1)
  await pilot.page.goto('/')
  await expect(pilot.page.getByRole('heading', { name: 'You have the controls.' })).toBeVisible({ timeout: 15_000 })

  await pilot.page.getByTestId('flight-altitudeMeters').fill('50')
  await pilot.page.getByTestId('flight-verticalSpeedMetersPerSecond').fill('60')
  await pilot.page.getByTestId('flight-horizontalSpeedMetersPerSecond').fill('0')
  await pilot.page.getByTestId('start-flight').click()

  await expect(pilot.page.getByTestId('flight-result')).toContainText('Surface impact')
  await expect(pilot.page.getByTestId('flight-history')).toContainText('Earth')
})

test('saved attempts stay private to their pilot', async ({ users }) => {
  const [a, b] = await users(2)
  const uniqueHeight = String(50 + (Date.now() % 40))
  await Promise.all([a.page.goto('/'), b.page.goto('/')])
  await Promise.all([
    expect(a.page.getByTestId('flight-stage')).toBeVisible({ timeout: 15_000 }),
    expect(b.page.getByTestId('flight-stage')).toBeVisible({ timeout: 15_000 }),
  ])

  await a.page.getByTestId('flight-altitudeMeters').fill(uniqueHeight)
  await a.page.getByTestId('flight-verticalSpeedMetersPerSecond').fill('60')
  await a.page.getByTestId('flight-horizontalSpeedMetersPerSecond').fill('0')
  await a.page.getByTestId('start-flight').click()
  await expect(a.page.getByTestId('flight-history')).toContainText(`Started ${uniqueHeight} m`)
  await expect(b.page.getByTestId('flight-history')).not.toContainText(`Started ${uniqueHeight} m`)
})

test('flight log updates across two sessions for the same pilot', async ({ users }) => {
  const [pilot] = await users(1)
  const secondPage = await pilot.context.newPage()
  const uniqueHeight = String(50 + (Date.now() % 40))
  await Promise.all([pilot.page.goto('/'), secondPage.goto('/')])
  await Promise.all([
    expect(pilot.page.getByTestId('flight-stage')).toBeVisible({ timeout: 15_000 }),
    expect(secondPage.getByTestId('flight-stage')).toBeVisible({ timeout: 15_000 }),
  ])

  await pilot.page.getByTestId('flight-altitudeMeters').fill(uniqueHeight)
  await pilot.page.getByTestId('flight-verticalSpeedMetersPerSecond').fill('60')
  await pilot.page.getByTestId('flight-horizontalSpeedMetersPerSecond').fill('0')
  await pilot.page.getByTestId('start-flight').click()
  await expect(secondPage.getByTestId('flight-history')).toContainText(`Started ${uniqueHeight} m`)
})
