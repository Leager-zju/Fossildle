import { fromHex, generateFossil, GENERATOR_VERSION, toHex, type Board, type GeneratorVersion } from './engine'

export const STORAGE_KEY = 'fossildle.collection.v1'
export interface Specimen {
  date: string
  hex: string
  version: GeneratorVersion
  favorite: boolean
}
export interface Collection {
  schemaVersion: 1
  visitorId: string
  specimens: Specimen[]
}

export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
export function timeUntilReset(now: Date = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const seconds = Math.max(0, Math.floor((next - now.getTime()) / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && utcDate(parsed) === value
}
export function validSpecimen(value: unknown): value is Specimen {
  if (!value || typeof value !== 'object') return false
  const item = value as Specimen
  if (!validDate(item.date) || (item.version !== 1 && item.version !== 2) || typeof item.favorite !== 'boolean' || typeof item.hex !== 'string' || !/^[0-9a-f]{16}$/.test(item.hex)) return false
  if (item.version === 2) return true
  const count = fromHex(item.hex).filter(Boolean).length
  return count >= 12 && count <= 36
}
export function parseCollection(raw: string): Collection {
  const value = JSON.parse(raw) as Collection
  if (!value || value.schemaVersion !== 1 || typeof value.visitorId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(value.visitorId) || !Array.isArray(value.specimens) || value.specimens.length > 30000 || !value.specimens.every(validSpecimen)) throw new Error('收藏数据格式不正确，原数据未被覆盖。')
  if (new Set(value.specimens.map(item => item.date)).size !== value.specimens.length) throw new Error('收藏中存在重复日期。')
  return { schemaVersion: 1, visitorId: value.visitorId, specimens: value.specimens.map(({ date, hex, version, favorite }) => ({ date, hex, version, favorite })).sort((a, b) => a.date.localeCompare(b.date)) }
}
export function createCollection(): Collection {
  return { schemaVersion: 1, visitorId: crypto.randomUUID(), specimens: [] }
}
export function readCollection(): Collection {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw !== null) return parseCollection(raw)
  return createCollection()
}
export function saveCollection(collection: Collection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
}
export function discover(collection: Collection, date: string, board?: Board): { collection: Collection; specimen: Specimen } {
  if (!validDate(date)) throw new Error('无效的发现日期。')
  const existing = collection.specimens.find(item => item.date === date)
  if (existing) return { collection, specimen: existing }
  const specimen: Specimen = { date, hex: toHex(board ?? generateFossil()), version: GENERATOR_VERSION, favorite: false }
  return { collection: { ...collection, specimens: [...collection.specimens, specimen].sort((a, b) => a.date.localeCompare(b.date)) }, specimen }
}
export function sameSpecimen(a: Specimen, b: Specimen): boolean {
  return a.date === b.date && a.hex === b.hex && a.version === b.version
}
// 云端同步时把两份藏馆并起来：同一天两处都有时以云端图案为准（云端是账号的共享事实），
// 珍藏标记取并集；只有本地存在的日期直接补入。身份沿用云端，保证多设备一致。
export function mergeCollections(local: Collection, remote: Collection): { collection: Collection; added: number; overwritten: number } {
  const byDate = new Map(remote.specimens.map(item => [item.date, item] as const))
  let added = 0
  let overwritten = 0
  for (const item of local.specimens) {
    const existing = byDate.get(item.date)
    if (!existing) {
      byDate.set(item.date, item)
      added++
      continue
    }
    if (existing.hex !== item.hex || existing.version !== item.version) overwritten++
    byDate.set(item.date, { ...existing, favorite: existing.favorite || item.favorite })
  }
  return { collection: { schemaVersion: 1, visitorId: remote.visitorId, specimens: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }, added, overwritten }
}

export function specimenHash(specimen: Specimen): string {
  return `#specimen/v${specimen.version}/${specimen.date}/${specimen.hex}`
}
export function parseSpecimenHash(hash: string): Specimen | null {
  const match = /^#specimen\/v([12])\/(\d{4}-\d{2}-\d{2})\/([0-9a-f]{16})$/.exec(hash)
  if (!match) return null
  const specimen = { date: match[2], hex: match[3], favorite: false, version: Number(match[1]) as GeneratorVersion }
  return validSpecimen(specimen) ? specimen : null
}
