import { test, expect } from '@playwright/test'
import { analyzeFossil, evaluateTraits, fromHex, TRAITS } from '../src/lib/engine'

const key = 'fossildle.collection.v1'

test('GitHub Pages 仓库子路径加载、刷新与分享', async ({ page }) => {
  const failed: string[] = []
  page.on('requestfailed', request => failed.push(request.url()))
  await page.goto('/Fossildle/')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await page.getByRole('button', { name: '分享发现', exact: true }).click()
  const link = await page.getByLabel('只读分享链接').inputValue()
  expect(link).toContain('/Fossildle/#specimen/v2/')
  await page.goto(link)
  await page.reload()
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '结构图鉴', exact: true }).click()
  await page.reload()
  await expect(page.locator('.guide-card')).toHaveCount(TRAITS.length)
  expect(page.url()).toContain('/Fossildle/#fieldguide')
  expect(failed).toEqual([])
})

test('自动展示全部命中结构及不重复计分的明细', async ({ page }) => {
  await page.goto('/#specimen/v1/2026-09-28/101010ff10101010')
  await expect(page.locator('.field-notes')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.score-entry')).toHaveCount(evaluateTraits(analyzeFossil(fromHex('101010ff10101010'))).length)
  await expect(page.locator('.observation-notes')).toHaveCount(0)
  await expect(page.locator('[data-trait="span"]')).toHaveAttribute('data-awarded', '0')
  await expect(page.locator('[data-trait="cross"]')).toHaveAttribute('data-awarded', '7')
  await expect(page.locator('[data-trait="little-cross"]')).toHaveAttribute('data-awarded', '4')
  await expect(page.getByTestId('structure-score')).toHaveText('65分')
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

test('关于页重置存档：取消不生效，确认后清空藏馆并更换身份', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  await page.goto('/#about')
  await expect(page.locator('.backup-actions button')).toHaveText(['重置存档', '导出备份', '导入备份'])
  await page.locator('.backup-panel').screenshot({ path: testInfo.outputPath('backup-panel-reset.png') })
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  await page.getByRole('button', { name: '重置存档' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('将清空 1 枚化石')
  await page.screenshot({ path: testInfo.outputPath('reset-confirm-modal.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens.length, key)).toBe(1)
  await page.getByRole('button', { name: '重置存档' }).click()
  await page.getByRole('button', { name: '确认清空并重置' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  expect(after.specimens).toHaveLength(0)
  expect(after.visitorId).not.toBe(before.visitorId)
  await expect(page.locator('.toast')).toContainText('存档已重置')
  await page.goto('/#today')
  await expect(page.getByRole('button', { name: '发现今日化石', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: /我的藏馆/ }).click()
  await expect(page.getByText('你的第一件藏品，还在岩石里。')).toBeVisible()
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
