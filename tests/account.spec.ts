import { test, expect, type Route } from '@playwright/test'
import { GIST_DESCRIPTION, GIST_FILE } from '../src/lib/account'

const storageKey = 'fossildle.collection.v1'
const accountKey = 'fossildle.account.v1'
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })

interface Frame { content: string | null }
const cloud = (specimens: unknown[], visitorId = 'cloud-visitor') => JSON.stringify({ schemaVersion: 1, visitorId, specimens })

async function mockGitHub(page: import('@playwright/test').Page, frame: Frame, hooks: { onDelete?: () => void; tokenStatus?: number } = {}) {
  await page.route('https://api.github.com/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    if (path === '/user') return hooks.tokenStatus ? reply(route, { message: 'Bad credentials' }, hooks.tokenStatus) : reply(route, { login: 'leager-zju', avatar_url: 'https://avatars.example/u.png' })
    if (path === '/gists' && request.method() === 'GET') return reply(route, [{ id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: {} } }])
    if (path === '/gists' && request.method() === 'POST') {
      frame.content = JSON.parse(request.postData()!).files[GIST_FILE].content
      return reply(route, { id: 'gist-1' }, 201)
    }
    if (path === '/gists/gist-1' && request.method() === 'PATCH') {
      frame.content = JSON.parse(request.postData()!).files[GIST_FILE].content
      return reply(route, { id: 'gist-1' })
    }
    if (path === '/gists/gist-1' && request.method() === 'DELETE') {
      hooks.onDelete?.()
      return route.fulfill({ status: 204, headers: cors })
    }
    if (path === '/gists/gist-1') return reply(route, { id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: { content: frame.content } } })
    return reply(route, { message: 'Not Found' }, 404)
  })
}

test('登录后合并云端藏馆，断开连接只清本机令牌', async ({ page }, testInfo) => {
  const frame: Frame = { content: cloud([{ date: '2026-09-20', hex: '00003c24243c0000', version: 2, favorite: true }]) }
  await mockGitHub(page, frame)
  await page.goto('/')
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  const today = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens[0].date, storageKey)
  expect(today).not.toBe('2026-09-20')

  await page.getByRole('button', { name: '登录并同步藏馆' }).click()
  await page.getByLabel('GitHub 访问令牌').fill('ghp_e2e_token')
  await page.getByRole('button', { name: '登录并同步', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('@leager-zju')
  await expect(page.getByRole('dialog')).toContainText('本地补入 1 枚')
  await expect(page.getByRole('button', { name: '云端同步：@leager-zju' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('account-signed-in.png') })

  const merged = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)
  expect(merged.visitorId).toBe('cloud-visitor')
  expect(merged.specimens.map((item: { date: string }) => item.date).sort()).toEqual(['2026-09-20', today].sort())
  expect(merged.specimens.find((item: { date: string }) => item.date === '2026-09-20').favorite).toBe(true)
  expect(JSON.parse(frame.content!).specimens).toHaveLength(2)
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), accountKey)
  expect(stored).toMatchObject({ provider: 'github', login: 'leager-zju', gistId: 'gist-1' })

  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await page.getByRole('link', { name: /我的藏馆/ }).click()
  await expect(page.locator('.specimen-tile')).toHaveCount(2)

  await page.getByRole('button', { name: '云端同步：@leager-zju' }).click()
  await page.getByRole('button', { name: '断开连接' }).click()
  await expect(page.getByRole('button', { name: '登录并同步藏馆' })).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), accountKey)).toBeNull()
  expect(JSON.parse(frame.content!).specimens).toHaveLength(2)
  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await expect(page.locator('.specimen-tile')).toHaveCount(2)
})

test('令牌无效时给出提示且不写入任何账号信息', async ({ page }, testInfo) => {
  await mockGitHub(page, { content: null }, { tokenStatus: 401 })
  await page.goto('/')
  await page.getByRole('button', { name: '登录并同步藏馆' }).click()
  await page.screenshot({ path: testInfo.outputPath('account-sign-in-form.png') })
  await page.getByLabel('GitHub 访问令牌').fill('ghp_bad')
  await page.getByRole('button', { name: '登录并同步', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('访问令牌无效或已过期')
  expect(await page.evaluate(key => localStorage.getItem(key), accountKey)).toBeNull()
  await expect(page.getByRole('button', { name: '登录并同步藏馆' })).toBeVisible()
})

test('删除云端存档会调用 GitHub 删除并行断开连接', async ({ page }) => {
  let deleted = 0
  const frame: Frame = { content: cloud([]) }
  await mockGitHub(page, frame, { onDelete: () => { deleted++ } })
  await page.goto('/')
  await page.getByRole('button', { name: '登录并同步藏馆' }).click()
  await page.getByLabel('GitHub 访问令牌').fill('ghp_e2e_token')
  await page.getByRole('button', { name: '登录并同步', exact: true }).click()
  await expect(page.getByRole('button', { name: '云端同步：@leager-zju' })).toBeVisible()
  await page.getByRole('button', { name: '删除云端存档并断开' }).click()
  await page.getByRole('button', { name: '确认删除云端存档并断开' }).click()
  await expect(page.getByRole('dialog')).toContainText('云端存档已删除')
  expect(deleted).toBe(1)
  expect(await page.evaluate(key => localStorage.getItem(key), accountKey)).toBeNull()
})
