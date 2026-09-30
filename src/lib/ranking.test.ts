import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = []
const respond = (payload: unknown, status = 200) => ({ ok: status < 400, status, json: async () => payload }) as Response

async function load(handler: (call: { url: string; method: string }) => Response = () => respond({})) {
  vi.resetModules()
  vi.stubEnv('VITE_FOSSILDLE_API', 'https://rank.test/')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined }
    calls.push(call)
    return handler(call)
  }))
  return await import('./ranking')
}

beforeEach(() => {
  calls.length = 0
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('本地排行记录', () => {
  it('空记录与损坏记录都按空处理', async () => {
    const { readRanking, RANKING_KEY } = await load()
    expect(readRanking()).toEqual({ dates: {} })
    localStorage.setItem(RANKING_KEY, '{broken')
    expect(readRanking()).toEqual({ dates: {} })
    localStorage.setItem(RANKING_KEY, JSON.stringify({ dates: { '2026-09-30': { seed: '不是数字' }, bad: { seed: 1 } } }))
    expect(readRanking()).toEqual({ dates: {} })
  })
  it('写入后能读回，并只保留最近 120 天', async () => {
    const { rememberDay, readRanking } = await load()
    expect(rememberDay('2026-09-30', { seed: 123 })).toEqual({ seed: 123 })
    expect(rememberDay('2026-09-30', { score: 42, rank: 3 })).toEqual({ seed: 123, score: 42, rank: 3 })
    for (let day = 1; day <= 130; day++) rememberDay(`2026-${String(Math.ceil(day / 28)).padStart(2, '0')}-${String(day % 28 + 1).padStart(2, '0')}`, { seed: day })
    expect(Object.keys(readRanking().dates).length).toBeLessThanOrEqual(120)
    expect(readRanking().dates['2026-09-30']).toEqual({ seed: 123, score: 42, rank: 3 })
  })
})

describe('排行接口', () => {
  it('未配置服务地址时不发请求', async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
    const { rankingEnabled, requestSeed } = await import('./ranking')
    expect(rankingEnabled()).toBe(false)
    await expect(requestSeed('token')).rejects.toThrow('没有配置排行服务地址')
  })
  it('领取种子使用 Bearer 令牌，并去掉地址末尾斜杠', async () => {
    const { requestSeed, API_BASE } = await load(() => respond({ date: '2026-09-30', seed: 7, replay: false, generatorVersion: 2, scoringVersion: 5 }))
    expect(API_BASE).toBe('https://rank.test')
    expect(await requestSeed('ghp_token')).toMatchObject({ seed: 7 })
    expect(calls[0]).toMatchObject({ url: 'https://rank.test/play', method: 'POST' })
    expect(calls[0].headers.Authorization).toBe('Bearer ghp_token')
  })
  it('提交成绩只发送日期，服务端返回分数与名次', async () => {
    const { submitScore } = await load(() => respond({ date: '2026-09-30', score: 55, rarityId: 'rare', rank: 2, players: 9, submittedAt: '2026-09-30T09:00:00.000Z' }))
    expect(await submitScore('ghp_token', '2026-09-30')).toMatchObject({ score: 55, rank: 2, players: 9, date: '2026-09-30' })
    expect(JSON.parse(calls[0].body!)).toEqual({ date: '2026-09-30' })
    expect(calls[0].url).toBe('https://rank.test/play/submit')
  })
  it('服务端返回残缺数据时视为失败', async () => {
    const { submitScore } = await load(() => respond({ date: '2026-09-30' }))
    await expect(submitScore('ghp_token', '2026-09-30')).rejects.toThrow('无法识别')
  })
  it('榜单缺失字段时按空榜处理', async () => {
    const { fetchBoard } = await load(() => respond({ date: '2026-09-30' }))
    expect(await fetchBoard('2026-09-30')).toEqual({ date: '2026-09-30', players: 0, top: [], me: null })
    expect(calls[0].url).toBe('https://rank.test/leaderboard?date=2026-09-30')
  })
  it('各类失败给出对应提示', async () => {
    const unauthorized = await load(() => respond({ error: 'x' }, 401))
    await expect(unauthorized.fetchBoard('2026-09-30')).rejects.toThrow('登录状态已失效')
    const limited = await load(() => respond({ error: 'x' }, 429))
    await expect(limited.fetchBoard('2026-09-30')).rejects.toThrow('请求过于频繁')
    const broken = await load(() => respond({ error: 'x' }, 500))
    await expect(broken.fetchBoard('2026-09-30')).rejects.toThrow('暂时不可用')
    const offline = await load(() => { throw new TypeError('Failed to fetch') })
    await expect(offline.fetchBoard('2026-09-30')).rejects.toThrow('无法连接排行服务')
  })
  it('头像地址按用户名转义', async () => {
    const { avatarUrl } = await load()
    expect(avatarUrl('leager-zju', 64)).toBe('https://github.com/leager-zju.png?size=64')
    expect(avatarUrl('a b/c')).toBe('https://github.com/a%20b%2Fc.png?size=64')
  })
})
