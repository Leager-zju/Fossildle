import { fromHex, generateFossil, hashSeed, toHex } from './engine'

export const STORAGE_KEY = 'fossildle.collection.v1'
export interface Specimen {
  date: string
  hex: string
  version: 1
  favorite: boolean
}
export interface Collection {
  schemaVersion: 1
  visitorId: string
  specimens: Specimen[]
}
export const MILESTONES = [
  { id: 'days-1', name: '初见地层', days: 1, description: '完成第一次每日发现。' },
  { id: 'days-7', name: '七日手记', days: 7, description: '累计探索 7 天，不要求连续。' },
  { id: 'days-30', name: '月度观察员', days: 30, description: '累计探索 30 天，不要求连续。' },
  { id: 'days-100', name: '时间收藏家', days: 100, description: '累计探索 100 天，不要求连续。' },
]

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
  if (!validDate(item.date) || item.version !== 1 || typeof item.favorite !== 'boolean' || typeof item.hex !== 'string' || !/^[0-9a-f]{16}$/.test(item.hex)) return false
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
export function discover(collection: Collection, date: string): { collection: Collection; specimen: Specimen } {
  if (!validDate(date)) throw new Error('无效的发现日期。')
  const existing = collection.specimens.find(item => item.date === date)
  if (existing) return { collection, specimen: existing }
  const board = generateFossil(hashSeed(`1:${collection.visitorId}:${date}`))
  const specimen: Specimen = { date, hex: toHex(board), version: 1, favorite: false }
  return { collection: { ...collection, specimens: [...collection.specimens, specimen].sort((a, b) => a.date.localeCompare(b.date)) }, specimen }
}
export function specimenHash(specimen: Specimen): string {
  return `#specimen/v1/${specimen.date}/${specimen.hex}`
}
export function parseSpecimenHash(hash: string): Specimen | null {
  const match = /^#specimen\/v1\/(\d{4}-\d{2}-\d{2})\/([0-9a-f]{16})$/.exec(hash)
  if (!match) return null
  const specimen = { date: match[1], hex: match[2], favorite: false, version: 1 as const }
  return validSpecimen(specimen) ? specimen : null
}
