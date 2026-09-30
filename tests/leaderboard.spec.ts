import { test, expect, type Page, type Route } from '@playwright/test'
import { GIST_DESCRIPTION, GIST_FILE } from '../src/lib/account'

const storageKey = 'fossildle.collection.v1'
const rankingKey = 'fossildle.ranking.v1'
const today = new Date().toISOString().slice(0, 10)
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** 头像走 github.com/<login>.png，测试里给出稳定响应，避免依赖真实网络。 */
async function mockAvatars(page: Page) {
  await page.route('https://github.com/*.png*', route => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: TRANSPARENT_PNG }))
}

interface RankMock { submissions: string[]; played: number; fail?: boolean }

async function mockRank(page: Page, state: RankMock) {
  await mockAvatars(page)
  await page.route('https://rank.test/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    if (state.fail) return reply(route, { error: '排行服务暂时不可用。' }, 500)
    if (path === '/api/play') { state.played++; return reply(route, { date: today, seed: 20260930, replay: state.played > 1, generatorVersion: 2, scoringVersion: 5 }) }
    if (path === '/api/play/submit') {
      state.submissions.push(request.postData() ?? '')
      return reply(route, { date: today, score: 61, rarityId: 'rare', rank: 3, players: 12, submittedAt: `${today}T09:00:00.000Z`, generatorVersion: 2, scoringVersion: 5 })
    }
    if (path === '/api/leaderboard') {
      const me = { rank: 3, playerId: 'me', score: 61, rarityId: 'rare', submittedAt: `${today}T09:00:00.000Z` }
      const others = [
        { rank: 1, playerId: 'leager-zju', score: 88, rarityId: 'archival', submittedAt: `${today}T00:30:00.000Z` },
        { rank: 2, playerId: 'pixel-pal', score: 75, rarityId: 'unusual', submittedAt: `${today}T01:00:00.000Z` },
      ]
      const signedIn = !!request.headers()['authorization']
      return reply(route, { date: today, players: 12, top: signedIn ? [...others, me] : others, me: signedIn ? me : null })
    }
    return reply(route, { error: 'not found' }, 404)
  })
}

async function mockGitHub(page: Page) {
  await page.route('https://api.github.com/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    if (path === '/user') return reply(route, { login: 'leager-zju', avatar_url: 'https://avatars.example/u.png' })
    if (path === '/gists' && request.method() === 'GET') return reply(route, [{ id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: {} } }])
    if (path === '/gists/gist-1' && request.method() === 'PATCH') return reply(route, { id: 'gist-1' })
    if (path === '/gists/gist-1') return reply(route, { id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: { content: JSON.stringify({ schemaVersion: 1, visitorId: 'cloud-visitor', specimens: [] }) } } })
    return reply(route, { message: 'Not Found' }, 404)
  })
}

async function signIn(page: Page) {
  await page.getByRole('button', { name: '登录并同步藏馆' }).click()
  await page.getByLabel('GitHub 访问令牌').fill('ghp_e2e_token')
  await page.getByRole('button', { name: '登录并同步', exact: true }).click()
  await expect(page.getByRole('button', { name: '云端同步：@leager-zju' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('入口在结构图鉴右侧，未登录也能看今日榜单', async ({ page }, testInfo) => {
  await mockRank(page, { submissions: [], played: 0 })
  await page.goto('/')
  expect((await page.locator('.main-nav > a').allInnerTexts()).map(text => text.trim())).toEqual(['今日发现', '我的藏馆', '结构图鉴', '每日排行'])
  await page.getByRole('link', { name: /每日排行/ }).click()
  await expect(page).toHaveURL(/#leaderboard$/)
  await expect(page.locator('.guide-progress strong')).toContainText('12')
  const rows = page.locator('.rank-board[aria-label="今日排行榜"] .rank-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('leager-zju')
  await expect(rows.first().locator('.rank-avatar img')).toHaveAttribute('src', 'https://github.com/leager-zju.png?size=68')
  await expect(rows.first().locator('.rank-score')).toHaveText('88分')
  await expect(rows.nth(1)).toContainText('pixel-pal')
  await expect(page.getByText('连接 GitHub 账号即可上榜')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('leaderboard-signed-out.png'), fullPage: true })
})

test('登录后开箱先领种子再自动上榜，提交内容不含分数', async ({ page }, testInfo) => {
  const state: RankMock = { submissions: [], played: 0 }
  await mockRank(page, state)
  await mockGitHub(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  expect(state.played).toBe(1)
  await expect(page.locator('.toast')).toContainText('已上榜：61 分，当前第 3 名')
  expect(state.submissions).toHaveLength(1)
  expect(JSON.parse(state.submissions[0])).toEqual({ date: today })
  const specimen = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens[0], storageKey)
  expect(specimen.date).toBe(today)
  expect(await page.evaluate(([key, day]) => JSON.parse(localStorage.getItem(key)!).dates[day], [rankingKey, today] as const)).toMatchObject({ seed: 20260930, score: 61, rank: 3 })
  await page.getByRole('link', { name: /每日排行/ }).click()
  await expect(page.locator('.rank-stats')).toContainText('第 3')
  await expect(page.locator('.rank-prompt[data-me="true"]')).toContainText('已上榜：61 分')
  const mine = page.locator('.rank-board .rank-row[data-me="true"]')
  await expect(mine).toContainText('me')
  await expect(mine).toContainText('61分')
  await page.screenshot({ path: testInfo.outputPath('leaderboard-ranked.png'), fullPage: true })
})

test('排行服务不可用时照常开箱并对榜单报错', async ({ page }) => {
  await mockRank(page, { submissions: [], played: 0, fail: true })
  await mockGitHub(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: '发现今日化石', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('未能领取排行种子')
  await expect(page.getByRole('button', { name: '分享发现', exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).specimens.length, storageKey)).toBe(1)
  await page.getByRole('link', { name: /每日排行/ }).click()
  await expect(page.getByRole('alert')).toContainText('暂时不可用')
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
})
