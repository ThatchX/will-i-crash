import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create or recover test accounts with the DeepSpace CLI.`,
)

test('a signed-in operator can assess and save a landing', async ({ users }) => {
  const [operator] = await users(1)
  await operator.page.goto('/home')
  await expect(operator.page.getByRole('heading', { name: 'Will I crash?' })).toBeVisible({ timeout: 15_000 })

  await operator.page.getByRole('button', { name: 'Safe' }).click()
  await operator.page.getByTestId('check-landing').click()

  await expect(operator.page.getByTestId('landing-result')).toContainText('Safe approach')
  await expect(operator.page.getByTestId('landing-history')).toContainText('100 m high')
})

test('saved checks stay private to their owner', async ({ users }) => {
  const [a, b] = await users(2)
  const uniqueHeight = String(300 + (Date.now() % 500))
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])
  await Promise.all([
    expect(a.page.getByRole('heading', { name: 'Will I crash?' })).toBeVisible({ timeout: 15_000 }),
    expect(b.page.getByRole('heading', { name: 'Will I crash?' })).toBeVisible({ timeout: 15_000 }),
  ])

  await a.page.getByTestId('landing-heightMeters').fill(uniqueHeight)
  await a.page.getByTestId('check-landing').click()
  await expect(a.page.getByTestId('landing-history')).toContainText(`${uniqueHeight} m high`)
  await expect(b.page.getByTestId('landing-history')).not.toContainText(`${uniqueHeight} m high`)
})

test('history updates across two sessions for the same user', async ({ users }) => {
  const [operator] = await users(1)
  const secondPage = await operator.context.newPage()
  const uniqueHeight = String(800 + (Date.now() % 100))
  await Promise.all([operator.page.goto('/home'), secondPage.goto('/home')])
  await Promise.all([
    expect(operator.page.getByRole('heading', { name: 'Will I crash?' })).toBeVisible({ timeout: 15_000 }),
    expect(secondPage.getByRole('heading', { name: 'Will I crash?' })).toBeVisible({ timeout: 15_000 }),
  ])

  await operator.page.getByTestId('landing-heightMeters').fill(uniqueHeight)
  await operator.page.getByTestId('check-landing').click()
  await expect(secondPage.getByTestId('landing-history')).toContainText(`${uniqueHeight} m high`)
})
