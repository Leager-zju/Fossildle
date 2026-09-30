import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, generateSeededFossil, GENERATOR_VERSION, SCORING_VERSION } from '../src/lib/engine'
import { BOARD_PATH, HEALTH_PATH, SEED_PATH, SUBMIT_PATH } from '../src/lib/ranking'
import { createApp, purge, RETENTION_DAYS, type AppDeps } from './app'
import { memoryStore, type RankStore } from './store'

const DATE = '2026-09-30'
const ORIGIN = 'https://leager-zju.github.io'

const tokens: Record<string, string> = { 'token-alice': 'alice', 'token-bob': 'bob' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const header = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '')
    const login = tokens[header.replace(/^Bearer\s+/i, '')]
    if (!login) return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ login }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => vi.unstubAllGlobals())

function build(store: RankStore = memoryStore(), deps: Partial<AppDeps> = {}, now = new Date(`${DATE}T12:00:00.000Z`)) {
  const handle = createApp({ store, secret: 'test-secret', allowedOrigins: [ORIGIN], now: () => now, ...deps })
  return {
    store,
    play: (token?: string) => handle(new Request('https://rank.test/api/play', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })),
    submit: (token?: string) => handle(new Request('https://rank.test/api/play/submit', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: '{}' })),
    board: (query = '', token?: string) => handle(new Request(`https://rank.test/api/leaderboard${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })),
    raw: (path: string, init?: RequestInit) => handle(new Request(`https://rank.test${path}`, init)),
    handle,
  }
}

const json = async (response: Response) => await response.json() as Record<string, any>

describe('身份校验', () => {
  it('没有令牌时拒绝领取种子', async () => {
    const response = await build().play()
    expect(response.status).toBe(401)
    expect((await json(response)).error).toContain('需要连接 GitHub')
  })
  it('令牌无效时给出可读提示', async () => {
    const response = await build().play('token-evil')
    expect(response.status).toBe(401)
    expect((await json(response)).error).toContain('令牌无效或已过期')
  })
})

describe('每日种子', () => {
  it('首次领取签发种子，重复领取返回同一个种子', async () => {
    const app = build()
    const first = await json(await app.play('token-alice'))
    expect(first).toMatchObject({ date: DATE, replay: false, generatorVersion: GENERATOR_VERSION, scoringVersion: SCORING_VERSION })
    expect(Number.isSafeInteger(first.seed)).toBe(true)
    const again = await json(await app.play('token-alice'))
    expect(again).toMatchObject({ seed: first.seed, replay: true })
  })
  it('不同玩家、不同日期的种子互不相同', async () => {
    const alice = await json(await build().play('token-alice'))
    const bob = await json(await build().play('token-bob'))
    const tomorrow = await json(await build(memoryStore(), {}, new Date('2026-10-01T00:05:00.000Z')).play('token-alice'))
    expect(new Set([alice.seed, bob.seed, tomorrow.seed]).size).toBe(3)
  })
})

describe('成绩提交', () => {
  it('没有领取种子就提交会被拒绝', async () => {
    const response = await build().submit('token-alice')
    expect(response.status).toBe(409)
  })
  it('分数由服务端按种子重算，与客户端复现的分数一致', async () => {
    const app = build()
    const { seed } = await json(await app.play('token-alice'))
    const result = await json(await app.submit('token-alice'))
    const expected = calculateScore(evaluateTraits(analyzeFossil(generateSeededFossil(seed))))
    expect(result).toMatchObject({ date: DATE, score: expected, rank: 1, players: 1, generatorVersion: GENERATOR_VERSION })
    expect(typeof result.rarityId).toBe('string')
    expect(result.rarityId.length).toBeGreaterThan(0)
  })
  it('重复提交保持原成绩，不会重算或产生第二条记录', async () => {
    const app = build()
    await app.play('token-alice')
    const first = await json(await app.submit('token-alice'))
    const second = await json(await app.submit('token-alice'))
    expect(second).toEqual(first)
    expect(await app.store.countPlayers(DATE)).toBe(1)
  })
  it('一天只有一条成绩，名次按分数与提交时间排序', async () => {
    const store = memoryStore()
    const alice = build(store, {}, new Date(`${DATE}T09:00:00.000Z`))
    await alice.play('token-alice')
    const aliceResult = await json(await alice.submit('token-alice'))
    const bob = build(store, {}, new Date(`${DATE}T10:00:00.000Z`))
    await bob.play('token-bob')
    const bobResult = await json(await bob.submit('token-bob'))
    const board = await json(await alice.board('', 'token-alice'))
    expect(board.players).toBe(2)
    expect(board.top.map((item: { score: number }) => item.score)).toEqual([...board.top.map((item: { score: number }) => item.score)].sort((a: number, b: number) => b - a))
    expect(board.me.playerId).toBe('alice')
    expect(board.me.rank).toBe(aliceResult.score > bobResult.score ? 1 : (aliceResult.score === bobResult.score ? 1 : 2))
  })
})

describe('榜单', () => {
  it('未登录也能读取榜单，且不返回我的名次', async () => {
    const app = build()
    await app.play('token-alice')
    await app.submit('token-alice')
    const board = await json(await app.board())
    expect(board.players).toBe(1)
    expect(board.me).toBeNull()
    expect(board.top).toHaveLength(1)
    expect(board.top[0]).toMatchObject({ rank: 1, playerId: 'alice' })
  })
  it('榜外玩家也能查到自己的名次', async () => {
    const store = memoryStore()
    await store.insertScore({ date: DATE, player_id: 'alice', score: 60, rarity_id: 'rare', generator_version: 2, scoring_version: 5, submitted_at: `${DATE}T09:00:00.000Z` })
    await store.insertScore({ date: DATE, player_id: 'bob', score: 20, rarity_id: 'common', generator_version: 2, scoring_version: 5, submitted_at: `${DATE}T10:00:00.000Z` })
    const app = build(store)
    const board = await json(await app.board('?limit=1', 'token-bob'))
    expect(board.top.map((item: { playerId: string }) => item.playerId)).toEqual(['alice'])
    expect(board.me).toMatchObject({ playerId: 'bob', rank: 2, score: 20 })
  })
  it('同分时先提交者名次靠前', async () => {
    const store = memoryStore()
    await store.insertScore({ date: DATE, player_id: 'alice', score: 40, rarity_id: 'unusual', generator_version: 2, scoring_version: 5, submitted_at: `${DATE}T09:00:00.000Z` })
    await store.insertScore({ date: DATE, player_id: 'bob', score: 40, rarity_id: 'unusual', generator_version: 2, scoring_version: 5, submitted_at: `${DATE}T10:00:00.000Z` })
    const board = await json(await build(store).board())
    expect(board.top.map((item: { playerId: string }) => item.playerId)).toEqual(['alice', 'bob'])
    expect(board.top.map((item: { rank: number }) => item.rank)).toEqual([1, 2])
  })
  it('非法的日期参数回退到今天，超出范围的 limit 也会被收窄', async () => {
    const app = build()
    const board = await json(await app.board('?date=../etc/passwd&limit=9999'))
    expect(board.date).toBe(DATE)
    expect(board.top).toEqual([])
  })
  it('未知令牌读取榜单时不报错，只是没有我的名次', async () => {
    const app = build()
    const response = await app.board('', 'token-evil')
    expect(response.status).toBe(200)
    expect((await json(response)).me).toBeNull()
  })
  it('未知接口返回 404', async () => {
    const response = await build().raw('/api/nope')
    expect(response.status).toBe(404)
  })
})

describe('与前端共用的接口路径', () => {
  it('客户端使用的路径都由后端处理，缺少 /api 前缀的旧路径会 404', async () => {
    const app = build()
    // 未带令牌时应当被鉴权拦下（401）而不是路由未命中（404）。
    expect((await app.raw(SEED_PATH, { method: 'POST' })).status).toBe(401)
    expect((await app.raw(SUBMIT_PATH, { method: 'POST' })).status).toBe(401)
    expect((await app.raw(BOARD_PATH)).status).toBe(200)
    expect((await app.raw(HEALTH_PATH)).status).toBe(200)
    expect((await app.raw('/play', { method: 'POST' })).status).toBe(404)
    expect((await app.raw('/leaderboard')).status).toBe(404)
  })
})

describe('跨域与清理', () => {
  it('仅对白名单来源返回 CORS 头，预检直接放行', async () => {
    const app = build()
    const allowed = await app.raw('/api/leaderboard', { headers: { Origin: ORIGIN } })
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const preflight = await app.raw('/api/play', { method: 'OPTIONS', headers: { Origin: ORIGIN } })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    const blocked = await app.raw('/api/leaderboard', { headers: { Origin: 'https://evil.example' } })
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('白名单写 * 时对任意来源回显 CORS 头', async () => {
    const handle = createApp({ store: memoryStore(), secret: 'test-secret', allowedOrigins: ['*'], now: () => new Date(`${DATE}T12:00:00.000Z`) })
    const response = await handle(new Request(`https://rank.test${HEALTH_PATH}`, { headers: { Origin: 'https://any.example' } }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://any.example')
  })
  it('定时清理只删除保留期之外的数据', async () => {
    const store = memoryStore()
    const old = build(store, {}, new Date('2026-01-01T12:00:00.000Z'))
    await old.play('token-alice')
    await old.submit('token-alice')
    const today = build(store)
    await today.play('token-bob')
    await today.submit('token-bob')
    const cutoff = await purge(store, RETENTION_DAYS, new Date(`${DATE}T12:00:00.000Z`))
    expect(cutoff).toBe('2026-07-02')
    expect(await store.countPlayers(DATE)).toBe(1)
    expect(await store.countPlayers('2026-01-01')).toBe(0)
    expect(await store.readSeed('alice', '2026-01-01')).toBeNull()
  })
})
