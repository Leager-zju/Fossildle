import { test, expect } from '@playwright/test'
import { analyzeFossil, evaluateTraits, scoreBreakdown, toHex } from '../src/lib/engine'
import { classifyTraitRarity, RARITIES } from '../src/lib/rarity'
import { allCatalogueBoards } from './fixtures/catalogue'

const palette = {
  common: { surface: '#f0f4eb', active: '#dfe9d7', border: '#bdccb2' },
  unusual: { surface: '#eaf6f2', active: '#d3eae2', border: '#9fc8b9' },
  rare: { surface: '#fcf4e5', active: '#f3e3bf', border: '#dec189' },
  remarkable: { surface: '#fcf0e9', active: '#f2dace', border: '#daa792' },
  archival: { surface: '#f4eef9', active: '#e5d8f0', border: '#bea7d2' },
}
const rgb = (hex: string) => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`

test('未发现卡片统一灰色，已发现卡片随稀有度着色', async ({ page }, testInfo) => {
  await page.goto('/#fieldguide')
  const lockedBackgrounds: string[] = []
  const lockedBorders: string[] = []
  for (const rarity of RARITIES) {
    const card = page.locator(`.guide-card.locked[data-rarity="${rarity.id}"]`).first()
    await expect(card.locator('h3')).toHaveText('???')
    await expect(card).toHaveCSS('background-color', rgb('#f1f1ec'))
    await expect(card).toHaveCSS('border-top-color', rgb('#c8c8bd'))
    await expect(card).toHaveCSS('border-top-style', 'dashed')
    await expect(card.locator('.guide-symbol')).toHaveCSS('color', rgb('#a3a69a'))
    await expect(card.locator('.guide-points')).toHaveCSS('color', rgb('#9b9e93'))
    await expect(card.locator('.rarity')).toHaveCSS('color', rgb('#9b9e93'))
    lockedBackgrounds.push(await card.evaluate(element => getComputedStyle(element).backgroundColor))
    lockedBorders.push(await card.evaluate(element => getComputedStyle(element).borderTopColor))
  }
  expect(new Set(lockedBackgrounds).size).toBe(1)
  expect(new Set(lockedBorders).size).toBe(1)
  const specimens = [...new Set(allCatalogueBoards.map(toHex))].map((hex, index) => ({
    hex, date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), version: 2, favorite: false,
  }))
  await page.evaluate(specimens => localStorage.setItem('fossildle.collection.v1', JSON.stringify({ schemaVersion: 1, visitorId: 'rarity-colors-test', specimens })), specimens)
  await page.reload()
  for (const rarity of RARITIES) {
    const card = page.locator(`.guide-card.unlocked[data-rarity="${rarity.id}"]`).first()
    await page.mouse.move(0, 0)
    await expect(card).toHaveCSS('background-color', rgb(palette[rarity.id].surface))
    await expect(card).toHaveCSS('border-top-color', rgb(rarity.color))
    await expect(card).toHaveCSS('border-top-style', 'solid')
    await card.locator('a').focus()
    await expect(card).toHaveCSS('background-color', rgb(palette[rarity.id].active))
    await expect(card.locator('a')).toBeFocused()
    await card.locator('a').evaluate(link => (link as HTMLElement).blur())
    await card.locator('a').hover()
    await expect(card.locator('a')).toHaveCSS('color', rgb('#a65637'))
    await expect(card.locator('a')).toHaveCSS('text-decoration-line', 'underline')
    await expect(card.locator('.guide-points')).toHaveCSS('color', rgb('#a65637'))
  }
  await page.getByLabel('按结构稀有度筛选').selectOption('common')
  await page.screenshot({ path: testInfo.outputPath('common-guide-colors.png'), fullPage: true })
  await page.getByLabel('按结构稀有度筛选').selectOption('unusual')
  await page.screenshot({ path: testInfo.outputPath('unusual-guide-colors.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('计分条目按结构稀有度着色，悬停和选中不影响分数与高亮', async ({ page }, testInfo) => {
  const candidates = allCatalogueBoards.flatMap(board => scoreBreakdown(evaluateTraits(analyzeFossil(board))).filter(entry => entry.awarded > 0).map(({ trait }) => ({ hex: toHex(board), id: trait.id, rarity: classifyTraitRarity(trait.id, 2).id })))
  for (const rarity of RARITIES) {
    const sample = candidates.find(candidate => candidate.rarity === rarity.id)
    expect(sample).toBeDefined()
    await page.goto(`/#specimen/v2/2026-09-28/${sample!.hex}`)
    await expect(page.locator('.field-notes')).toHaveAttribute('data-phase', 'complete')
    const entry = page.locator(`.score-entry[data-trait="${sample!.id}"]`)
    const score = await page.getByTestId('structure-score').textContent()
    await page.mouse.move(0, 0)
    await expect(entry).toHaveAttribute('data-rarity', rarity.id)
    await expect(entry).toHaveCSS('background-color', rgb(palette[rarity.id].surface))
    await expect(entry).toHaveCSS('border-left-color', rgb(rarity.color))
    await expect(entry).toHaveCSS('border-right-color', rgb(palette[rarity.id].border))
    await expect(entry.locator('.score-entry-head .trait-mark')).toHaveCSS('color', rgb(rarity.color))
    await entry.hover()
    await expect(entry).toHaveCSS('background-color', rgb(palette[rarity.id].active))
    await entry.locator('.score-entry-head').click()
    await page.mouse.move(0, 0)
    await expect(entry.locator('.score-entry-head')).toHaveAttribute('aria-pressed', 'true')
    await expect(entry).toHaveCSS('background-color', rgb(palette[rarity.id].active))
    expect(await entry.evaluate(element => getComputedStyle(element).boxShadow)).toContain('inset')
    await expect(page.locator('.main-fossil [data-dimmed="false"]')).not.toHaveCount(0)
    await expect(page.getByTestId('structure-score')).toHaveText(score!)
    await entry.locator('.score-entry-head').press('Enter')
    await page.mouse.move(0, 0)
    await expect(entry.locator('.score-entry-head')).toHaveAttribute('aria-pressed', 'false')
    await expect(entry).toHaveCSS('background-color', rgb(palette[rarity.id].surface))
    await expect(page.locator('.main-fossil [data-dimmed="true"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('score-entry-rarity-colors.png'), fullPage: true })
})
