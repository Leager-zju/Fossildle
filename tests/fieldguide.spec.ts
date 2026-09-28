import { test, expect } from '@playwright/test'
import { analyzeFossil, evaluateTraits, fromHex, generateLegacyFossil as generateFossil, toHex, TRAITS } from '../src/lib/engine'

const key = 'fossildle.collection.v1'
const ring = '00003c24243c0000'

async function seedCollection(page: import('@playwright/test').Page, specimens: { date: string; hex: string }[]) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.evaluate(({ key, specimens }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, visitorId: 'fieldguide-test-player', specimens: specimens.map(item => ({ ...item, version: 1, favorite: false })) }))
  }, { key, specimens })
  await page.goto('/#fieldguide')
  await page.reload()
}

test('未发现项只显示问号，占位不泄露名字或条件，合并为单网格', async ({ page }, testInfo) => {
  await page.goto('/#fieldguide')
  await expect(page.locator('.guide-grid')).toHaveCount(1)
  await expect(page.locator('.guide-card')).toHaveCount(16)
  await expect(page.locator('.guide-card.locked')).toHaveCount(16)
  await expect(page.locator('.guide-card h3')).toHaveText(Array(16).fill('???'))
  await expect(page.locator('.guide-card > p')).toHaveText(Array(16).fill('尚未发现'))
  await expect(page.getByRole('progressbar', { name: '图鉴解锁进度' })).toHaveAttribute('aria-valuenow', '0')
  await expect(page.locator('.site-footer')).toContainText('图鉴 0/16')
  await expect(page.locator('.guide-section, .milestone, .trait-detail, .guide-card button, .guide-card a')).toHaveCount(0)
  await expect(page.getByText('判定与频率', { exact: true })).toHaveCount(0)
  for (const title of ['基础结构', '组合发现', '观察者足迹']) await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
  const markup = await page.locator('.guide-grid').innerHTML()
  for (const trait of TRAITS) {
    expect(markup).not.toContain(trait.name)
    expect(markup).not.toContain(trait.description)
  }
  await page.getByRole('button', { name: '已经发现', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('还没有发现结构')
  await page.getByRole('button', { name: '等待相遇', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(16)
  await page.getByRole('button', { name: '全部图鉴', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('compact-locked-guide.png'), fullPage: true })
  const dimensions = await page.locator('.guide-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height))
  expect(Math.max(...dimensions)).toBeLessThanOrEqual(160)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('已发现项保留条件与首次发现链接，16项计数不受探索天数影响', async ({ page }, testInfo) => {
  await seedCollection(page, Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, hex: ring })))
  const traits = evaluateTraits(analyzeFossil(fromHex(ring)))
  await expect(page.locator('.guide-card.unlocked')).toHaveCount(10)
  await expect(page.locator('.guide-card.locked')).toHaveCount(6)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '16')
  await expect(page.locator('.guide-progress > strong')).toHaveText('10/ 16')
  await expect(page.locator('.site-footer')).toContainText('图鉴 10/16')
  for (const trait of traits) {
    const card = page.locator('.guide-card').filter({ has: page.getByRole('heading', { name: trait.name, exact: true }) })
    await expect(card.locator(':scope > p')).toHaveText(trait.description)
    await expect(card.locator('a')).toHaveText('首次发现 2026-09-01')
    await expect(card.locator('a')).toHaveAttribute('href', `#specimen/v1/2026-09-01/${ring}`)
    await expect(card.locator('a .lucide-arrow-right')).toHaveCount(0)
  }
  const lockedMarkup = (await page.locator('.guide-card.locked').allInnerTexts()).join(' ')
  for (const trait of TRAITS.filter(trait => !traits.includes(trait))) expect(lockedMarkup).not.toContain(trait.name)
  await page.screenshot({ path: testInfo.outputPath('compact-mixed-guide.png'), fullPage: true })
  const numbers = await page.locator('.guide-card.unlocked').evaluateAll(cards => cards.map(card => card.getAttribute('data-number')))
  await page.getByRole('button', { name: '已经发现', exact: true }).click()
  await expect(page.getByRole('button', { name: '已经发现', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('.guide-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-number')))).toEqual(numbers)
  await page.getByRole('button', { name: '等待相遇', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(6)
  await expect(page.locator('.guide-card h3')).toHaveText(Array(6).fill('???'))
  await page.getByRole('button', { name: '全部图鉴', exact: true }).click()
  await page.locator('.guide-card.unlocked a').first().click()
  await expect(page).toHaveURL(new RegExp(`#specimen/v1/2026-09-01/${ring}$`))
  await expect(page.getByText('来自你的藏馆')).toBeVisible()
  await page.getByRole('link', { name: /我的藏馆/ }).click()
  await expect(page.locator('.collection-stats > div').nth(2)).toContainText('10/ 16 项')
})

test('全解锁时等待相遇为空，卡片在平板上紧凑且不溢出', async ({ page }) => {
  const discovered = new Set<string>()
  const examples: string[] = []
  for (let seed = 0; seed < 100000 && discovered.size < TRAITS.length; seed++) {
    const board = generateFossil(seed)
    const traits = evaluateTraits(analyzeFossil(board))
    if (traits.some(trait => !discovered.has(trait.id))) {
      examples.push(toHex(board))
      traits.forEach(trait => discovered.add(trait.id))
    }
  }
  expect(discovered.size).toBe(16)
  await page.setViewportSize({ width: 700, height: 1000 })
  await seedCollection(page, examples.map((hex, index) => ({ hex, date: `2026-08-${String(index + 1).padStart(2, '0')}` })))
  await expect(page.locator('.guide-card.unlocked')).toHaveCount(16)
  await expect(page.locator('.site-footer')).toContainText('图鉴 16/16')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '16')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '等待相遇', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('所有结构都已发现。')
})
