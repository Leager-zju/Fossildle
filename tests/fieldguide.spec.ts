import { test, expect } from '@playwright/test'
import { analyzeFossil, evaluateTraits, fromHex, toHex, TRAITS } from '../src/lib/engine'
import { classifyTraitRarity, RARITIES } from '../src/lib/rarity'
import { TRAIT_EXAMPLES } from '../src/lib/traitExamples'
import { allCatalogueBoards } from './fixtures/catalogue'

const key = 'fossildle.collection.v1'
const ring = '00003c24243c0000'
const ringTraits = evaluateTraits(analyzeFossil(fromHex(ring)))
const total = TRAITS.length
const found = ringTraits.length
const remaining = total - found

async function seedCollection(page: import('@playwright/test').Page, specimens: { date: string; hex: string }[], version = 1) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.evaluate(({ key, specimens, version }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, visitorId: 'fieldguide-test-player', specimens: specimens.map(item => ({ ...item, version, favorite: false })) }))
  }, { key, specimens, version })
  await page.goto('/#fieldguide')
  await page.reload()
}

test('未发现项只显示问号，占位不泄露名字或条件，合并为单网格', async ({ page }, testInfo) => {
  await page.goto('/#fieldguide')
  await expect(page.locator('.guide-grid')).toHaveCount(1)
  await expect(page.locator('.guide-card')).toHaveCount(total)
  await expect(page.locator('.guide-card.locked')).toHaveCount(total)
  await expect(page.locator('.guide-card h3')).toHaveText(Array(total).fill('???'))
  await expect(page.locator('.guide-card > p')).toHaveText(Array(total).fill('尚未发现'))
  await expect(page.getByRole('progressbar', { name: '图鉴解锁进度' })).toHaveAttribute('aria-valuenow', '0')
  await expect(page.locator('.site-footer')).toContainText(`图鉴 0/${total}`)
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
  await expect(page.locator('.guide-card')).toHaveCount(total)
  await page.getByRole('button', { name: '全部图鉴', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('compact-locked-guide.png'), fullPage: true })
  const dimensions = await page.locator('.guide-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height))
  expect(Math.max(...dimensions)).toBeLessThanOrEqual(160)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('旧藏品补充新成就并保留首次发现链接，重复天数不增加条目数', async ({ page }, testInfo) => {
  await seedCollection(page, Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, hex: ring })))
  const traits = ringTraits
  await expect(page.locator('.guide-card.unlocked')).toHaveCount(found)
  await expect(page.locator('.guide-card.locked')).toHaveCount(remaining)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(found))
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(total))
  await expect(page.locator('.guide-progress > strong')).toHaveText(`${found}/ ${total}`)
  await expect(page.locator('.site-footer')).toContainText(`图鉴 ${found}/${total}`)
  expect(found).toBeGreaterThan(10)
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
  await expect(page.locator('.guide-card')).toHaveCount(remaining)
  await expect(page.locator('.guide-card h3')).toHaveText(Array(remaining).fill('???'))
  await page.getByRole('button', { name: '全部图鉴', exact: true }).click()
  await page.locator('.guide-card.unlocked a').first().click()
  await expect(page).toHaveURL(new RegExp(`#specimen/v1/2026-09-01/${ring}$`))
  await expect(page.getByText('来自你的藏馆')).toBeVisible()
  await page.getByRole('link', { name: /我的藏馆/ }).click()
  await expect(page.locator('.collection-stats > div').nth(2)).toContainText(`${found}/ ${total} 项`)
})

test('全解锁时等待相遇为空，扩展图鉴在窄屏和平板上均不溢出', async ({ page }, testInfo) => {
  const examples = [...new Set(allCatalogueBoards.map(toHex))]
  const discovered = new Set(allCatalogueBoards.flatMap(board => evaluateTraits(analyzeFossil(board)).map(trait => trait.id)))
  expect(discovered.size).toBe(total)
  await seedCollection(page, examples.map((hex, index) => ({ hex, date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10) })), 2)
  await expect(page.locator('.guide-card.unlocked')).toHaveCount(total)
  await expect(page.locator('.site-footer')).toContainText(`图鉴 ${total}/${total}`)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(total))
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('expanded-unlocked-guide.png'), fullPage: true })
  await page.getByRole('button', { name: '等待相遇', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('所有结构都已发现。')
})

test('类别、稀有度与发现状态联合筛选，排序和清除保持总进度', async ({ page }) => {
  await seedCollection(page, [{ date: '2026-09-01', hex: ring }])
  const expected = TRAITS.map((trait, index) => ({ ...trait, number: String(index + 1).padStart(2, '0'), rarity: classifyTraitRarity(trait.id) }))
  for (const rarity of RARITIES) {
    await page.getByLabel('按结构稀有度筛选').selectOption(rarity.id)
    const matches = expected.filter(trait => trait.rarity.id === rarity.id)
    await expect(page.locator('.guide-card')).toHaveCount(matches.length)
    await expect(page.locator('.guide-card .rarity')).toHaveText(matches.map(trait => trait.rarity.name))
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(found))
  }
  await page.getByLabel('按结构类别筛选').selectOption('symmetry')
  await page.getByLabel('按结构稀有度筛选').selectOption('archival')
  await page.getByRole('button', { name: '已经发现', exact: true }).click()
  const matches = expected.filter(trait => trait.group === 'symmetry' && trait.rarity.id === 'archival' && ringTraits.some(item => item.id === trait.id))
  await expect(page.locator('.guide-card h3')).toHaveText(matches.map(trait => trait.name))
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(total)
  await page.getByLabel('图鉴排序').selectOption('rarity')
  const sorted = [...expected].sort((a, b) => b.rarity.rank - a.rarity.rank || Number(a.number) - Number(b.number))
  expect(await page.locator('.guide-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-number')))).toEqual(sorted.map(trait => trait.number))
})

test('已发现卡片点击弹出居中示例窗口，多组证据按不同颜色区分', async ({ page }, testInfo) => {
  await seedCollection(page, [
    { date: '2026-09-01', hex: toHex(TRAIT_EXAMPLES.islands) },
    { date: '2026-09-02', hex: ring },
  ], 2)
  const dialog = page.getByRole('dialog')
  const islands = page.locator('.guide-card').filter({ has: page.getByRole('heading', { name: '三座遗迹', exact: true }) })
  await expect(islands).toHaveClass(/unlocked/)
  await islands.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('三座遗迹')
  const art = dialog.locator('.fossil-art')
  await expect(art.locator('.fossil-cell[data-dimmed="false"]')).toHaveCount(14)
  const fills = await art.locator('.fossil-cell[data-dimmed="false"] .cell-fill').evaluateAll(nodes => nodes.map(node => node.getAttribute('fill')))
  expect(new Set(fills).size).toBe(3)
  await expect(dialog.locator('.example-legend li')).toHaveCount(3)
  await expect(dialog.locator('.example-legend .legend-label')).toHaveText(['第 1 个连通块', '第 2 个连通块', '第 3 个连通块'])
  await page.screenshot({ path: testInfo.outputPath('guide-example-modal.png'), fullPage: true })
  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await expect(dialog).toHaveCount(0)
  const connected = page.locator('.guide-card').filter({ has: page.getByRole('heading', { name: '一体遗存', exact: true }) })
  await connected.click()
  await expect(dialog).toContainText('一体遗存')
  await expect(dialog.locator('.example-legend')).toHaveCount(0)
  const single = await dialog.locator('.fossil-cell[data-dimmed="false"] .cell-fill').evaluateAll(nodes => nodes.map(node => node.getAttribute('fill')))
  expect(new Set(single)).toEqual(new Set(['#a35b3e']))
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.locator('.guide-card.locked').first().click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('搜索不泄露未发现名称，编号可检索，已发现条件可搜索', async ({ page }) => {
  await page.goto('/#fieldguide')
  await page.getByLabel('搜索结构图鉴').fill('九格晶核')
  await expect(page.locator('.guide-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('没有符合条件')
  await page.getByLabel('搜索结构图鉴').fill('64')
  await expect(page.locator('.guide-card')).toHaveCount(1)
  await expect(page.locator('.guide-card h3')).toHaveText('???')
  await seedCollection(page, [{ date: '2026-09-01', hex: ring }])
  await page.getByLabel('搜索结构图鉴').fill('八面玲珑')
  await expect(page.locator('.guide-card h3')).toHaveText('八面玲珑')
  await expect(page.locator('.guide-card .guide-points')).toHaveText('38')
  await page.getByLabel('按结构类别筛选').selectOption('texture')
  await expect(page.locator('.guide-card')).toHaveCount(0)
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.guide-card')).toHaveCount(total)
})
