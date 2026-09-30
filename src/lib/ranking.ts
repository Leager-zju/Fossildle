/**
 * 每日排行（运气榜）客户端。
 * 后端是独立的 Cloudflare Worker（worker/ 目录），这里只负责签发当日种子、提交成绩与拉取榜单。
 * 未配置 VITE_FOSSILDLE_API 时整个功能自动降级：游戏照常本地随机生成，不参与排行。
 */

export const RANKING_KEY = 'fossildle.ranking.v1'
export const API_BASE = (import.meta.env.VITE_FOSSILDLE_API ?? '').trim().replace(/\/+$/, '')

// 与 worker/app.ts 的路由一一对应；worker/index.test.ts 会用这些常量反向校验后端确实处理了它们。
export const SEED_PATH = '/api/play'
export const SUBMIT_PATH = '/api/play/submit'
export const BOARD_PATH = '/api/leaderboard'
export const HEALTH_PATH = '/api/health'

export interface RankedDay {
  seed: number
  score?: number
  rarityId?: string
  rank?: number
  players?: number
  submittedAt?: string
}

export interface RankingState { dates: Record<string, RankedDay> }

export interface BoardEntry {
  rank: number
  playerId: string
  score: number
  rarityId: string
  submittedAt: string
}

export interface Board {
  date: string
  players: number
  top: BoardEntry[]
  me: BoardEntry | null
}

export const rankingEnabled = (): boolean => API_BASE !== ''
export const avatarUrl = (playerId: string, size = 64): string => `https://github.com/${encodeURIComponent(playerId)}.png?size=${size}`

export function readRanking(): RankingState {
  try {
    const raw = localStorage.getItem(RANKING_KEY)
    if (!raw) return { dates: {} }
    const value = JSON.parse(raw) as RankingState
    if (!value || typeof value !== 'object' || !value.dates || typeof value.dates !== 'object') return { dates: {} }
    const dates: Record<string, RankedDay> = {}
    for (const [date, day] of Object.entries(value.dates)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== 'object' || !Number.isSafeInteger((day as RankedDay).seed)) continue
      dates[date] = day as RankedDay
    }
    return { dates }
  } catch { return { dates: {} } }
}

export function saveRanking(state: RankingState): void {
  try { localStorage.setItem(RANKING_KEY, JSON.stringify(state)) } catch { /* 存储不可用时只影响本机记录 */ }
}

export function rankingFor(date: string): RankedDay | null {
  return readRanking().dates[date] ?? null
}

export function rememberDay(date: string, value: Partial<RankedDay>): RankedDay {
  const state = readRanking()
  const dates = { ...state.dates, [date]: { ...state.dates[date], ...value } }
  const recent = Object.keys(dates).sort().slice(-120)
  saveRanking({ dates: Object.fromEntries(recent.map(key => [key, dates[key]])) })
  return readRanking().dates[date] ?? value
}

function errorFor(status: number): string {
  if (status === 401) return '登录状态已失效，请在账号面板重新连接 GitHub。'
  if (status === 403) return '当前令牌无法访问排行服务，请确认令牌未过期。'
  if (status === 429) return '请求过于频繁，请稍后再试。'
  if (status === 503) return '排行服务正在维护，请稍后再试。'
  if (status >= 500) return '排行服务暂时不可用，请稍后再试。'
  return `排行服务返回 HTTP ${status}。`
}

async function request<T>(path: string, token: string | null, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!rankingEnabled()) throw new Error('当前构建没有配置排行服务地址。')
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new Error(`无法连接排行服务（${API_BASE}）：请确认该地址在浏览器可直接打开；部分地区会阻断 *.workers.dev，需要给 Worker 绑定自定义域名。`)
  }
  if (!response.ok) throw new Error(errorFor(response.status))
  return await response.json() as T
}

export interface SeedPayload {
  date: string
  seed: number
  replay: boolean
  generatorVersion: number
  scoringVersion: number
}

/** 领取当日种子：同一玩家同一天只会拿到同一个种子，重复调用是幂等的。 */
export async function requestSeed(token: string): Promise<SeedPayload> {
  return await request<SeedPayload>(SEED_PATH, token, { method: 'POST', body: {} })
}

/** 提交当日成绩：分数由服务端用种子重算，客户端不提交任何分数。 */
export async function submitScore(token: string, date: string): Promise<RankedDay & { date: string }> {
  const payload = await request<RankedDay & { date: string }>(SUBMIT_PATH, token, { method: 'POST', body: { date } })
  if (typeof payload?.score !== 'number' || typeof payload?.rank !== 'number') throw new Error('排行服务返回的数据无法识别。')
  return payload
}

export async function fetchBoard(date: string, token?: string | null): Promise<Board> {
  const query = `?date=${encodeURIComponent(date)}`
  const board = await request<Board>(`${BOARD_PATH}${query}`, token ?? null)
  return { date: board.date ?? date, players: board.players ?? 0, top: Array.isArray(board.top) ? board.top : [], me: board.me ?? null }
}
