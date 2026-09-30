import type { D1Like, ScoreRow, SeedRow } from './types'

/** 排行服务需要的全部数据操作。测试与本地预览使用 memoryStore()，线上使用 D1。 */
export interface RankStore {
  readSeed(playerId: string, date: string): Promise<SeedRow | null>
  insertSeed(row: SeedRow): Promise<void>
  readScore(date: string, playerId: string): Promise<ScoreRow | null>
  insertScore(row: ScoreRow): Promise<void>
  listTop(date: string, limit: number): Promise<ScoreRow[]>
  countPlayers(date: string): Promise<number>
  countAhead(date: string, score: number, submittedAt: string): Promise<number>
  purgeBefore(cutoff: string): Promise<void>
}

export function d1Store(db: D1Like): RankStore {
  return {
    readSeed: async (playerId, date) => await db.prepare('SELECT player_id, date, seed FROM daily_seeds WHERE player_id = ? AND date = ?').bind(playerId, date).first<SeedRow>(),
    insertSeed: async row => { await db.prepare('INSERT INTO daily_seeds (player_id, date, seed, issued_at) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, date) DO NOTHING').bind(row.player_id, row.date, row.seed, new Date().toISOString()).run() },
    readScore: async (date, playerId) => await db.prepare('SELECT date, player_id, score, rarity_id, generator_version, scoring_version, submitted_at FROM daily_scores WHERE date = ? AND player_id = ?').bind(date, playerId).first<ScoreRow>(),
    insertScore: async row => { await db.prepare('INSERT INTO daily_scores (date, player_id, score, rarity_id, generator_version, scoring_version, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (date, player_id) DO NOTHING').bind(row.date, row.player_id, row.score, row.rarity_id, row.generator_version, row.scoring_version, row.submitted_at).run() },
    listTop: async (date, limit) => (await db.prepare('SELECT date, player_id, score, rarity_id, generator_version, scoring_version, submitted_at FROM daily_scores WHERE date = ? ORDER BY score DESC, submitted_at ASC LIMIT ?').bind(date, limit).all<ScoreRow>()).results,
    countPlayers: async date => (await db.prepare('SELECT COUNT(*) AS total FROM daily_scores WHERE date = ?').bind(date).first<{ total: number }>())?.total ?? 0,
    countAhead: async (date, score, submittedAt) => (await db.prepare('SELECT COUNT(*) AS total FROM daily_scores WHERE date = ? AND (score > ? OR (score = ? AND submitted_at < ?))').bind(date, score, score, submittedAt).first<{ total: number }>())?.total ?? 0,
    purgeBefore: async cutoff => {
      await db.prepare('DELETE FROM daily_scores WHERE date < ?').bind(cutoff).run()
      await db.prepare('DELETE FROM daily_seeds WHERE date < ?').bind(cutoff).run()
    },
  }
}

/** 内存实现：单元测试用，逻辑与 D1 版保持一致。 */
export function memoryStore(): RankStore {
  const seeds = new Map<string, SeedRow>()
  const scores = new Map<string, ScoreRow>()
  const seedKey = (playerId: string, date: string) => `${date}|${playerId}`
  return {
    readSeed: async (playerId, date) => seeds.get(seedKey(playerId, date)) ?? null,
    insertSeed: async row => { if (!seeds.has(seedKey(row.player_id, row.date))) seeds.set(seedKey(row.player_id, row.date), row) },
    readScore: async (date, playerId) => scores.get(seedKey(playerId, date)) ?? null,
    insertScore: async row => { if (!scores.has(seedKey(row.player_id, row.date))) scores.set(seedKey(row.player_id, row.date), row) },
    listTop: async (date, limit) => [...scores.values()].filter(row => row.date === date).sort((a, b) => b.score - a.score || a.submitted_at.localeCompare(b.submitted_at) || a.player_id.localeCompare(b.player_id)).slice(0, limit),
    countPlayers: async date => [...scores.values()].filter(row => row.date === date).length,
    countAhead: async (date, score, submittedAt) => [...scores.values()].filter(row => row.date === date && (row.score > score || (row.score === score && row.submitted_at < submittedAt))).length,
    purgeBefore: async cutoff => {
      for (const [key, row] of seeds) if (row.date < cutoff) seeds.delete(key)
      for (const [key, row] of scores) if (row.date < cutoff) scores.delete(key)
    },
  }
}
