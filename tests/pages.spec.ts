import { test, expect } from '@playwright/test'

const key = 'fossildle.collection.v1'

test('GitHub Pages 仓库子路径加载、刷新与分享', async ({ page }) => {
  const failed: string[] = []
  page.on('requestfailed', request => failed.push(request.url()))
  await page.goto('/Fossildle/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await page.getByRole('button', { name: '分享发现', exact: true }).click()
  const link = await page.getByLabel('只读分享链接').inputValue()
  expect(link).toContain('/Fossildle/#specimen/v1/')
  await page.goto(link)
  await page.reload()
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '结构图鉴', exact: true }).click()
  await page.reload()
  await expect(page.locator('.guide-card')).toHaveCount(16)
  expect(page.url()).toContain('/Fossildle/#fieldguide')
  expect(failed).toEqual([])
})

test('三个结构中被去重的基础结构仍可展开', async ({ page }) => {
  await page.goto('/#specimen/v1/2026-09-28/101010ff10101010')
  await page.getByRole('button', { name: '查看全部 3 个结构' }).click()
  await expect(page.locator('.trait-row strong').filter({ hasText: /^贯穿地层$/ })).toBeVisible()
  await page.getByRole('button', { name: '收起结构' }).click()
  await expect(page.locator('.trait-row strong').filter({ hasText: /^贯穿地层$/ })).toHaveCount(0)
})

test('首次并发访问共享身份，不重置已有记录', async ({ context, page }) => {
  const second = await context.newPage()
  await Promise.all([page.goto('/'), second.goto('/')])
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await expect(second.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  const firstId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).visitorId, key)
  expect(await second.evaluate(key => JSON.parse(localStorage.getItem(key)!).visitorId, key)).toBe(firstId)
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await second.reload()
  await expect(second.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  expect(await second.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens.length, key)).toBe(1)
  await second.close()
})

test('禁用本地存储时展示保护提示而非白屏', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException('Storage disabled', 'SecurityError') }
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('本地存储不可用')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeDisabled()
  await page.goto('/#specimen/v1/2026-09-28/00003c24243c0000')
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
})
