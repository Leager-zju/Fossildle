import { test, expect } from '@playwright/test'
import { analyzeFossil, evaluateTraits, fromHex } from '../src/lib/engine'

const key = 'fossildle.collection.v1'
const ring = '00003c24243c0000'

test('底栏倒计时居中分享靠右，结构稀有度位于名称与新图鉴之间', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.evaluate(({ key, ring }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, visitorId: 'independent-test-identity', specimens: [{ date: '2026-09-28', hex: ring, version: 2, favorite: false }] })), { key, ring })
  await page.goto(`/#specimen/v2/2026-09-28/${ring}`)
  await page.reload()
  await expect(page.locator('.field-notes')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.specimen-caption')).toHaveCount(0)
  await expect(page.locator('.card-bottomline .bottomline-share')).toBeEnabled()
  await expect(page.locator('.score-entry .trait-name + .trait-rarity + .new-trait')).toHaveCount(evaluateTraits(analyzeFossil(fromHex(ring))).length)
  await expect(page.locator('[data-trait="mirror-x"] .trait-rarity')).toHaveText('典藏')
  await expect(page.locator('[data-trait="connected"] > .score-entry-head .trait-rarity')).toHaveText('珍奇')
  await expect(page.locator('[data-trait="ring"] .trait-rarity')).toHaveAttribute('title', /未观测到/)
  await expect(page.locator('.score-total .overall-rarity')).toHaveCount(1)
  await expect(page.getByTestId('structure-score')).toHaveText('140分')
  for (const width of [testInfo.project.name === 'mobile' ? 390 : 1440, 320, 700]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect.poll(() => page.locator('.card-bottomline').evaluate(bar => {
      const countdown = bar.querySelector('.countdown')!.getBoundingClientRect()
      const button = bar.querySelector('.bottomline-share')!
      const share = button.getBoundingClientRect()
      const bounds = bar.getBoundingClientRect()
      const padding = parseFloat(getComputedStyle(bar).paddingRight)
      return {
        centered: Math.abs(countdown.x + countdown.width / 2 - bounds.x - bounds.width / 2) < 2,
        separate: share.x >= countdown.x + countdown.width,
        rightAligned: Math.abs(bounds.x + bounds.width - share.x - share.width - padding) < 2,
        sameRow: Math.abs(share.y + share.height / 2 - countdown.y - countdown.height / 2) < 2,
        debug: { viewport: innerWidth, bar: bounds.width, countdown: countdown.width, button: share.width, margin: getComputedStyle(button).marginRight },
      }
    })).toMatchObject({ centered: true, separate: true, rightAligned: true, sameRow: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 390 : 1440, height: 1000 })
  await page.screenshot({ path: testInfo.outputPath('independent-final-layout.png'), fullPage: true })
  await page.getByRole('button', { name: '分享发现', exact: true }).click()
  await expect(page.getByLabel('只读分享链接')).toHaveValue(/#specimen\/v2\//)
})

for (const [hex, cells] of [['0000000000000000', 0], ['ffffffffffffffff', 64]] as const) {
  test(`独立随机允许 ${cells} 像素且当天刷新不重抽`, async ({ page }) => {
    await page.addInitScript(fill => {
      const original = crypto.getRandomValues.bind(crypto)
      crypto.getRandomValues = function <T extends ArrayBufferView>(array: T): T {
        if (array instanceof Uint8Array && array.length === 8) { array.fill(fill); return array }
        return original(array) as T
      }
    }, cells ? 255 : 0)
    await page.goto('/')
    await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
    await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeEnabled()
    const record = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens[0], key)
    expect(record.hex).toBe(hex)
    expect(record.version).toBe(2)
    await expect(page.locator('.main-fossil .fossil-cell')).toHaveCount(cells)
    await expect(page.locator('.score-total')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeEnabled()
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens, key)).toEqual([record])
    await page.getByRole('button', { name: '分享发现', exact: true }).click()
    const link = await page.getByLabel('只读分享链接').inputValue()
    await page.goto(link)
    await expect(page.locator('.main-fossil .fossil-cell')).toHaveCount(cells)
  })
}

test('旧 v1 记录不被同图案 v2 分享认领，原分享与备份仍可读取', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  const legacy = { date: '2026-09-28', hex: ring, version: 1, favorite: true }
  await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, visitorId: 'legacy-test-identity', specimens: [legacy] })), { key, legacy })
  await page.goto(`/#specimen/v2/2026-09-28/${ring}`)
  await page.reload()
  await expect(page.getByText('只读分享 · 不会加入你的收藏')).toBeVisible()
  await expect(page.locator('.score-entry .new-trait')).toHaveCount(0)
  await expect(page.locator('.field-notes')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('[data-trait="connected"] > .score-entry-head .trait-rarity')).toHaveText('珍奇')
  await page.goto(`/#specimen/v1/2026-09-28/${ring}`)
  await expect(page.getByText('来自你的藏馆')).toBeVisible()
  await expect(page.locator('.field-notes')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('[data-trait="connected"] > .score-entry-head .trait-rarity')).toHaveText('特别')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens[0], key)).toEqual(legacy)
  await page.getByRole('button', { name: '分享发现', exact: true }).click()
  await expect(page.getByLabel('只读分享链接')).toHaveValue(/#specimen\/v1\//)
})
