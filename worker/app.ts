import { analyzeFossil, calculateScore, evaluateTraits, generateSeededFossil, GENERATOR_VERSION, SCORING_VERSION } from '../src/lib/engine'
import { classifyRarity } from '../src/lib/rarity'
import { utcDate } from '../src/lib/collection'
import { bearerToken, verifyToken } from './github'
import { HttpError, corsHeaders, json } from './http'
import { dailySeed } from './seed'
import type { RankStore } from './store'
import type { ScoreRow } from './types'

export const LEADERBOARD_LIMIT = 50
export const RETENTION_DAYS = 90

export interface AppDeps {
  store: RankStore
  secret: string
  allowedOrigins: string[]
  now?: () => Date
}

const entry = (row: ScoreRow, rank: number) => ({ rank, playerId: row.player_id, score: row.score, rarityId: row.rarity_id, submittedAt: row.submitted_at })

export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => new Date())
  const today = () => utcDate(now())

  async function authenticate(request: Request): Promise<string> {
    const token = bearerToken(request)
    if (!token) throw new HttpError(401, '需要连接 GitHub 账号后才能参与排行。')
    const { login } = await verifyToken(token)
    return login
  }

  async function play(request: Request) {
    const login = await authenticate(request)
    const date = today()
    const existing = await deps.store.readSeed(login, date)
    if (existing) return { date, seed: existing.seed, replay: true, generatorVersion: GENERATOR_VERSION, scoringVersion: SCORING_VERSION }
    const seed = await dailySeed(deps.secret, login, date, GENERATOR_VERSION)
    await deps.store.insertSeed({ player_id: login, date, seed })
    const stored = await deps.store.readSeed(login, date)
    return { date, seed: stored?.seed ?? seed, replay: false, generatorVersion: GENERATOR_VERSION, scoringVersion: SCORING_VERSION }
  }

  async function resultPayload(row: ScoreRow, date: string) {
    const [players, ahead] = await Promise.all([deps.store.countPlayers(date), deps.store.countAhead(date, row.score, row.submitted_at)])
    return { date, score: row.score, rarityId: row.rarity_id, rank: ahead + 1, players, submittedAt: row.submitted_at, generatorVersion: row.generator_version, scoringVersion: row.scoring_version }
  }

  async function submit(request: Request) {
    const login = await authenticate(request)
    const date = today()
    const existing = await deps.store.readScore(date, login)
    if (existing) return await resultPayload(existing, date)
    const seedRow = await deps.store.readSeed(login, date)
    if (!seedRow) throw new HttpError(409, '今天还没有领取种子，请先参与今日排行，再提交成绩。')
    const traits = evaluateTraits(analyzeFossil(generateSeededFossil(seedRow.seed)))
    const score = calculateScore(traits)
    const submittedAt = now().toISOString()
    const rarityId = classifyRarity(score, GENERATOR_VERSION).id
    await deps.store.insertScore({
      date, player_id: login, score, rarity_id: rarityId,
      generator_version: GENERATOR_VERSION, scoring_version: SCORING_VERSION, submitted_at: submittedAt,
    })
    const stored = await deps.store.readScore(date, login)
    return await resultPayload(stored ?? { date, player_id: login, score, rarity_id: rarityId, generator_version: GENERATOR_VERSION, scoring_version: SCORING_VERSION, submitted_at: submittedAt }, date)
  }

  async function leaderboard(request: Request, url: URL) {
    const requested = url.searchParams.get('date')
    const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today()
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? LEADERBOARD_LIMIT) || LEADERBOARD_LIMIT, 1), 100)
    const [rows, players] = await Promise.all([deps.store.listTop(date, limit), deps.store.countPlayers(date)])
    let me = null
    const token = bearerToken(request)
    if (token) {
      try {
        const { login } = await verifyToken(token)
        const mine = await deps.store.readScore(date, login)
        if (mine) me = { ...entry(mine, 0), rank: (await deps.store.countAhead(date, mine.score, mine.submitted_at)) + 1 }
      } catch { me = null }
    }
    return { date, players, top: rows.map((row, index) => entry(row, index + 1)), me }
  }

  return async function handle(request: Request): Promise<Response> {
    const headers = corsHeaders(request.headers.get('Origin'), deps.allowedOrigins)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    try {
      const route = `${request.method} ${url.pathname.replace(/\/+$/, '') || '/'}`
      if (route === 'POST /api/play') return json(await play(request), 200, headers)
      if (route === 'POST /api/play/submit') return json(await submit(request), 200, headers)
      if (route === 'GET /api/leaderboard') return json(await leaderboard(request, url), 200, headers)
      if (route === 'GET /api/health') return json({ ok: true, date: today(), generatorVersion: GENERATOR_VERSION, scoringVersion: SCORING_VERSION }, 200, headers)
      return json({ error: '没有这个接口。' }, 404, headers)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, headers)
      return json({ error: '排行服务暂时不可用，请稍后再试。' }, 500, headers)
    }
  }
}

export async function purge(store: RankStore, days = RETENTION_DAYS, now: Date = new Date()): Promise<string> {
  const cutoff = utcDate(new Date(now.getTime() - days * 86400000))
  await store.purgeBefore(cutoff)
  return cutoff
}
