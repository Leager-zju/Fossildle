import { CATALOGUE_TRAITS, detectCatalogue, type CatalogueMatches } from './catalogueTraits'
import { COVERED_BY } from './families'
import { structurePoints } from './traitPoints'

export const GENERATOR_VERSION = 2
export const SCORING_VERSION = 5
export type GeneratorVersion = 1 | 2
export const SIZE = 8
export type Board = boolean[]
export const TRAIT_GROUPS = {
  connection: '连通星群', cavity: '空洞秘境', symmetry: '对称回声', span: '贯穿脉络',
  layout: '空间布局', combo: '组合奇遇', geometry: '几何遗形', texture: '地层纹理',
  boundary: '边界风景', population: '疏密节律',
} as const
export type TraitGroup = keyof typeof TRAIT_GROUPS
export type Highlight = 'none' | 'components' | 'holes' | 'symmetry'

export interface Metrics {
  count: number
  components: number[][]
  holes: number[][]
  mirrorX: boolean
  mirrorY: boolean
  quarterTurn: boolean
  fullRow: boolean
  fullColumn: boolean
  interior: boolean
  centered: boolean
  readonly catalogue: CatalogueMatches
}

export interface Trait {
  id: string
  name: string
  description: string
  group: TraitGroup
  points: number
  highlight: Highlight
  cells?: (metrics: Metrics) => readonly number[]
  matches: (metrics: Metrics) => boolean
}

export const TRAITS: Trait[] = [
  { id: 'connected', name: '一体遗存', description: '所有化石像素通过上下左右连接，恰好形成一个连通块。', group: 'connection', points: structurePoints('connected'), highlight: 'components', matches: m => m.components.length === 1 },
  { id: 'islands', name: '三座遗迹', description: '化石恰好由三个互不相连的连通块组成。', group: 'connection', points: structurePoints('islands'), highlight: 'components', matches: m => m.components.length === 3 },
  { id: 'cavities', name: '重重空腔', description: '化石中封存了至少两个彼此独立的空白区域。', group: 'cavity', points: structurePoints('cavities'), highlight: 'holes', matches: m => m.holes.length >= 2 },
  { id: 'mirror-x', name: '左右镜像', description: '关于整个棋盘的垂直中线，左右像素完全重合。', group: 'symmetry', points: structurePoints('mirror-x'), highlight: 'symmetry', matches: m => m.mirrorX },
  { id: 'mirror-y', name: '上下镜像', description: '关于整个棋盘的水平中线，上下像素完全重合。', group: 'symmetry', points: structurePoints('mirror-y'), highlight: 'symmetry', matches: m => m.mirrorY },
  { id: 'double-mirror', name: '双轴对称', description: '同时关于整个棋盘的水平中线与垂直中线对称。', group: 'symmetry', points: structurePoints('double-mirror'), highlight: 'symmetry', matches: m => m.mirrorX && m.mirrorY },
  { id: 'rotation', name: '四向回转', description: '围绕棋盘中心旋转 90° 后，图案保持不变。', group: 'symmetry', points: structurePoints('rotation'), highlight: 'symmetry', matches: m => m.quarterTurn },
  { id: 'span', name: '贯穿地层', description: '至少一整行或一整列都被化石像素填满。', group: 'span', points: structurePoints('span'), highlight: 'none', matches: m => m.fullRow || m.fullColumn },
  { id: 'cross', name: '十字贯穿', description: '同时存在至少一整行和一整列被填满。', group: 'span', points: structurePoints('cross'), highlight: 'none', matches: m => m.fullRow && m.fullColumn },
  { id: 'interior', name: '深藏其中', description: '所有化石像素都不接触棋盘的四条边缘。', group: 'layout', points: structurePoints('interior'), highlight: 'none', matches: m => m.interior },
  { id: 'centered', name: '重心居中', description: '所有化石像素的平均坐标恰好位于棋盘中心。', group: 'layout', points: structurePoints('centered'), highlight: 'none', matches: m => m.centered },
  { id: 'ring', name: '独眼之环', description: '一个连通块、一个空洞，且具有左右或上下镜像。', group: 'combo', points: structurePoints('ring'), highlight: 'holes', matches: m => m.components.length === 1 && m.holes.length === 1 && (m.mirrorX || m.mirrorY) },
  { id: 'symmetric-islands', name: '对称群岛', description: '至少两个连通块，且具有左右或上下镜像。', group: 'combo', points: structurePoints('symmetric-islands'), highlight: 'components', matches: m => m.components.length >= 2 && (m.mirrorX || m.mirrorY) },
  { id: 'hidden-heart', name: '藏心遗迹', description: '化石不触及棋盘边缘，且重心恰好位于中心。', group: 'combo', points: structurePoints('hidden-heart'), highlight: 'none', matches: m => m.interior && m.centered },
  { id: 'maze', name: '空腔迷宫', description: '一体相连的化石，封存了至少两个空洞。', group: 'combo', points: structurePoints('maze'), highlight: 'holes', matches: m => m.components.length === 1 && m.holes.length >= 2 },
  ...CATALOGUE_TRAITS,
]

for (const trait of TRAITS) {
  if (!Number.isSafeInteger(trait.points) || trait.points <= 0) throw new Error(`结构「${trait.id}」必须配置正整数分值。`)
}
export const SCORING_RULES = TRAITS.map(({ id, group, points }) => ({ id, group, points }))

export function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function randomSource(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function neighbors(index: number, diagonal = false): number[] {
  const x = index % SIZE
  const y = Math.floor(index / SIZE)
  const output: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (!diagonal && dx && dy)) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) output.push(ny * SIZE + nx)
    }
  }
  return output
}

const FOUR_NEIGHBORS = Array.from({ length: 64 }, (_, i) => neighbors(i))
const EIGHT_NEIGHBORS = Array.from({ length: 64 }, (_, i) => neighbors(i, true))
const isEdge = (i: number) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7

export function generateFossil(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(8))): Board {
  if (bytes.length !== 8) throw new Error('独立像素生成需要 8 个随机字节。')
  return Array.from({ length: 64 }, (_, index) => (bytes[Math.floor(index / 8)] & (1 << (7 - index % 8))) !== 0)
}

// 每日排行的确定性生成：同一个 seed 在浏览器与服务端得到同一枚化石。
// 派生方式与 scripts/calibrate.ts 完全一致，因此现有概率与稀有度数据无需重新校准。
export function generateSeededFossil(seed: number): Board {
  const rng = randomSource(seed >>> 0)
  return generateFossil(Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256)))
}

export function generateLegacyFossil(seed: number): Board {
  const rng = randomSource(seed)
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
  const board: Board = Array(64).fill(false)
  const mode = rng()
  const shuffled = (values: number[]) => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[values[i], values[j]] = [values[j], values[i]]
    }
    return values
  }
  const grow = (target: number, excluded = new Set<number>()) => {
    let count = board.filter(Boolean).length
    while (count < target) {
      const frontier = new Set<number>()
      board.forEach((filled, i) => {
        if (filled) FOUR_NEIGHBORS[i].forEach(j => {
          if (!board[j] && !excluded.has(j)) frontier.add(j)
        })
      })
      if (!frontier.size) break
      const candidates = [...frontier]
      board[candidates[int(0, candidates.length - 1)]] = true
      count++
    }
  }
  if (mode < 0.45) {
    shuffled(Array.from({ length: 64 }, (_, i) => i)).slice(0, int(12, 36)).forEach(i => { board[i] = true })
  } else if (mode < 0.75) {
    board[int(0, 63)] = true
    grow(int(12, 36))
  } else if (mode < 0.95) {
    const symmetry = int(0, 3)
    const visited = new Set<number>()
    const orbits: number[][] = []
    for (let i = 0; i < 64; i++) {
      if (visited.has(i)) continue
      const x = i % 8
      const y = Math.floor(i / 8)
      let orbit: number[]
      if (symmetry === 0) orbit = [i, y * 8 + 7 - x]
      else if (symmetry === 1) orbit = [i, (7 - y) * 8 + x]
      else if (symmetry === 2) orbit = [i, y * 8 + 7 - x, (7 - y) * 8 + x, (7 - y) * 8 + 7 - x]
      else orbit = [i, x * 8 + 7 - y, (7 - y) * 8 + 7 - x, (7 - x) * 8 + y]
      orbit = [...new Set(orbit)]
      orbit.forEach(j => visited.add(j))
      orbits.push(orbit)
    }
    const unit = orbits[0].length
    shuffled(orbits.map((_, i) => i)).slice(0, int(Math.ceil(12 / unit), Math.floor(36 / unit))).forEach(i => {
      orbits[i].forEach(j => { board[j] = true })
    })
  } else {
    const width = int(3, 6)
    const height = int(3, 6)
    const left = int(0, 8 - width)
    const top = int(0, 8 - height)
    const inside = new Set<number>()
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        const i = y * 8 + x
        if (x === left || x === left + width - 1 || y === top || y === top + height - 1) board[i] = true
        else inside.add(i)
      }
    }
    grow(int(Math.max(12, board.filter(Boolean).length), 36), inside)
  }
  return board
}

function findRegions(board: Board, filled: boolean, diagonal: boolean): number[][] {
  const seen = new Uint8Array(64)
  const regions: number[][] = []
  for (let i = 0; i < 64; i++) {
    if (seen[i] || board[i] !== filled) continue
    const region = [i]
    seen[i] = 1
    for (let head = 0; head < region.length; head++) {
      for (const neighbor of (diagonal ? EIGHT_NEIGHBORS : FOUR_NEIGHBORS)[region[head]]) {
        if (!seen[neighbor] && board[neighbor] === filled) {
          seen[neighbor] = 1
          region.push(neighbor)
        }
      }
    }
    regions.push(region)
  }
  return regions
}

export function analyzeFossil(board: Board): Metrics {
  if (board.length !== 64 || board.some(cell => typeof cell !== 'boolean')) throw new Error('化石必须是 8×8 二值网格。')
  const pixels = board.flatMap((filled, i) => filled ? [i] : [])
  const count = pixels.length
  const components = findRegions(board, true, false)
  const holes = findRegions(board, false, true).filter(region => !region.some(isEdge))
  let catalogue: CatalogueMatches | undefined
  return {
    count,
    components,
    holes,
    get catalogue() { return catalogue ??= detectCatalogue(board, components, holes) },
    mirrorX: count > 0 && board.every((filled, i) => filled === board[Math.floor(i / 8) * 8 + 7 - i % 8]),
    mirrorY: count > 0 && board.every((filled, i) => filled === board[(7 - Math.floor(i / 8)) * 8 + i % 8]),
    quarterTurn: count > 0 && board.every((filled, i) => filled === board[(i % 8) * 8 + 7 - Math.floor(i / 8)]),
    fullRow: Array.from({ length: 8 }, (_, y) => board.slice(y * 8, y * 8 + 8).every(Boolean)).some(Boolean),
    fullColumn: Array.from({ length: 8 }, (_, x) => Array.from({ length: 8 }, (_, y) => board[y * 8 + x]).every(Boolean)).some(Boolean),
    interior: count > 0 && pixels.every(i => !isEdge(i)),
    centered: count > 0 && pixels.reduce((sum, i) => sum + (i % 8) * 2, 0) === count * 7 && pixels.reduce((sum, i) => sum + Math.floor(i / 8) * 2, 0) === count * 7,
  }
}

export function evaluateTraits(metrics: Metrics): Trait[] {
  return TRAITS.filter(trait => trait.matches(metrics))
}

// 计分：组合奇遇是独立加成层；其余结构按「上下位」压制——被某个命中的上位结构严格蕴含时不计分。
// 返回压制链最顶端的那一项，保证下位结构总是挂到真正的根条目上。
function coveringTrait(trait: Trait, matched: ReadonlySet<string>): string | null {
  if (trait.group === 'combo') return null
  let current = COVERED_BY.get(trait.id)?.find(upper => matched.has(upper)) ?? null
  while (current) {
    const next = COVERED_BY.get(current)?.find(upper => matched.has(upper))
    if (!next) break
    current = next
  }
  return current
}

export function calculateScore(traits: Trait[]): number {
  const matched = new Set(traits.map(trait => trait.id))
  let combo = 0
  let total = 0
  for (const trait of traits) {
    if (trait.group === 'combo') { combo += trait.points; continue }
    if (!coveringTrait(trait, matched)) total += trait.points
  }
  return total + Math.min(12, combo)
}

export interface ScoreEntry {
  trait: Trait
  awarded: number
  reason: string
  // 被上位结构覆盖时记录上位 id，用于在观察手记中收纳到父项分支里；组合上限等其它未计分情形为 null。
  supersededBy: string | null
}

export function scoreBreakdown(traits: Trait[]): ScoreEntry[] {
  const matched = new Set(traits.map(trait => trait.id))
  let comboBudget = 12
  return traits.map(trait => {
    if (trait.group === 'combo') {
      const awarded = Math.min(comboBudget, trait.points)
      comboBudget -= awarded
      return { trait, awarded, reason: awarded === trait.points ? '组合加分' : '组合加分上限 12 分', supersededBy: null }
    }
    const covering = coveringTrait(trait, matched)
    const reason = covering ? `由上位结构「${TRAITS.find(item => item.id === covering)?.name}」覆盖` : '计入总分'
    return { trait, awarded: covering ? 0 : trait.points, reason, supersededBy: covering }
  })
}

// 观察手记中逐项揭示的单位数量：被同组更高分覆盖的条目收进父项分支，不单独计入揭示序列。
export function revealEntryCount(traits: Trait[]): number {
  return scoreBreakdown(traits).filter(entry => !entry.supersededBy).length
}

export function featuredTraits(traits: Trait[]): Trait[] {
  return scoreBreakdown(traits).filter(entry => entry.awarded > 0).sort((a, b) => b.awarded - a.awarded || b.trait.points - a.trait.points).slice(0, 3).map(entry => entry.trait)
}

export function toHex(board: Board): string {
  return Array.from({ length: 16 }, (_, i) => parseInt(board.slice(i * 4, i * 4 + 4).map(Number).join(''), 2).toString(16)).join('')
}

export function fromHex(hex: string): Board {
  if (!/^[0-9a-f]{16}$/i.test(hex)) throw new Error('无效的化石编码。')
  return [...hex].flatMap(char => [...parseInt(char, 16).toString(2).padStart(4, '0')].map(bit => bit === '1'))
}

export function fossilName(board: Board, metrics: Metrics): string {
  const adjectives = ['静默', '远古', '微光', '砂间', '暮色', '苔下', '悠远', '薄雾', '沉睡', '琥珀']
  const prefix = adjectives[hashSeed(toHex(board)) % adjectives.length]
  const noun = metrics.holes.length >= 2 ? '迷宫' : metrics.holes.length === 1 ? '之眼' : metrics.quarterTurn ? '回轮' : metrics.mirrorX && metrics.mirrorY ? '花影' : metrics.mirrorX || metrics.mirrorY ? '双生' : metrics.components.length === 1 ? '遗痕' : metrics.components.length >= 4 ? '群岛' : '回声'
  return `${prefix}${noun}`
}

export function fossilDescription(metrics: Metrics): string {
  if (metrics.holes.length) return '一圈遗痕，替时间保存了一小片空白。'
  if (metrics.quarterTurn) return '转过四季，仍然是最初的模样。'
  if (metrics.mirrorX || metrics.mirrorY) return '偶然的另一边，是恰好相同的自己。'
  if (metrics.components.length === 1) return '零散的片刻，最终连成了完整的故事。'
  return '散落在岩层里的微光，也有自己的秩序。'
}
