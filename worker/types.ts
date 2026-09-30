// 最小 D1 类型定义：避免为了类型检查引入 @cloudflare/workers-types 依赖。
export interface D1Result<T> { results: T[] }
export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}
export interface D1Like { prepare(query: string): D1Prepared }

export interface Env {
  DB: D1Like
  SERVER_SECRET: string
  ALLOWED_ORIGIN?: string
}

export interface SeedRow { player_id: string; date: string; seed: number }

export interface ScoreRow {
  date: string
  player_id: string
  score: number
  rarity_id: string
  generator_version: number
  scoring_version: number
  submitted_at: string
}
