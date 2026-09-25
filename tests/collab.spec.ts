import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create or recover test accounts with the DeepSpace CLI.`,
)

test('a signed-in pilot can run and save a planetary descent', async ({ users }) => {
  const [pilot] = await users(1)
  await pilot.page.goto('/')
  await expect(pilot.page.getByRole('heading', { name: 'Choose a world. Try to land.' })).toBeVisible({ timeout: 15_000 })

  await pilot.page.getByTestId('run-descent').click()

  await expect(pilot.page.getByTestId('landing-result')).toContainText('Landing secured')
  await expect(pilot.page.getByTestId('landing-history')).toContainText('Earth')
})

test('saved attempts stay private to their pilot', async ({ users }) => {
  const [a, b] = await users(2)
  const uniqueHeight = String(300 + (Date.now() % 500))
  await Promise.all([a.page.goto('/'), b.page.goto('/')])
  await Promise.all([
    expect(a.page.getByTestId('descent-stage')).toBeVisible({ timeout: 15_000 }),
    expect(b.page.getByTestId('descent-stage')).toBeVisible({ timeout: 15_000 }),
  ])

  await a.page.getByTestId('landing-heightMeters').fill(uniqueHeight)
  await a.page.getByTestId('run-descent').click()
  await expect(a.page.getByTestId('landing-history')).toContainText(`${uniqueHeight} m`)
  await expect(b.page.getByTestId('landing-history')).not.toContainText(`${uniqueHeight} m`)
})

test('flight log updates across two sessions for the same pilot', async ({ users }) => {
  const [pilot] = await users(1)
  const secondPage = await pilot.context.newPage()
  const uniqueHeight = String(800 + (Date.now() % 100))
  await Promise.all([pilot.page.goto('/'), secondPage.goto('/')])
  await Promise.all([
    expect(pilot.page.getByTestId('descent-stage')).toBeVisible({ timeout: 15_000 }),
    expect(secondPage.getByTestId('descent-stage')).toBeVisible({ timeout: 15_000 }),
  ])

  await pilot.page.getByTestId('landing-heightMeters').fill(uniqueHeight)
  await pilot.page.getByTestId('run-descent').click()
  await expect(secondPage.getByTestId('landing-history')).toContainText(`${uniqueHeight} m`)
})
