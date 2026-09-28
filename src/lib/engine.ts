export const GENERATOR_VERSION = 2
export type GeneratorVersion = 1 | 2
export const SIZE = 8
export type Board = boolean[]
export type TraitGroup = 'connection' | 'cavity' | 'symmetry' | 'span' | 'layout' | 'combo'
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
}

export interface Trait {
  id: string
  name: string
  description: string
  group: TraitGroup
  points: number
  highlight: Highlight
  matches: (metrics: Metrics) => boolean
}

export const TRAITS: Trait[] = [
  { id: 'connected', name: '一体遗存', description: '所有化石像素通过上下左右连接，恰好形成一个连通块。', group: 'connection', points: 10, highlight: 'components', matches: m => m.components.length === 1 },
  { id: 'islands', name: '三座遗迹', description: '化石恰好由三个互不相连的连通块组成。', group: 'connection', points: 8, highlight: 'components', matches: m => m.components.length === 3 },
  { id: 'eye', name: '封存之眼', description: '恰好一个空白区域无法通过八邻接到达棋盘外部。', group: 'cavity', points: 10, highlight: 'holes', matches: m => m.holes.length === 1 },
  { id: 'cavities', name: '重重空腔', description: '化石中封存了至少两个彼此独立的空白区域。', group: 'cavity', points: 18, highlight: 'holes', matches: m => m.holes.length >= 2 },
  { id: 'mirror-x', name: '左右镜像', description: '关于整个棋盘的垂直中线，左右像素完全重合。', group: 'symmetry', points: 16, highlight: 'symmetry', matches: m => m.mirrorX },
  { id: 'mirror-y', name: '上下镜像', description: '关于整个棋盘的水平中线，上下像素完全重合。', group: 'symmetry', points: 16, highlight: 'symmetry', matches: m => m.mirrorY },
  { id: 'double-mirror', name: '双轴对称', description: '同时关于整个棋盘的水平中线与垂直中线对称。', group: 'symmetry', points: 24, highlight: 'symmetry', matches: m => m.mirrorX && m.mirrorY },
  { id: 'rotation', name: '四向回转', description: '围绕棋盘中心旋转 90° 后，图案保持不变。', group: 'symmetry', points: 30, highlight: 'symmetry', matches: m => m.quarterTurn },
  { id: 'span', name: '贯穿地层', description: '至少一整行或一整列都被化石像素填满。', group: 'span', points: 8, highlight: 'none', matches: m => m.fullRow || m.fullColumn },
  { id: 'cross', name: '十字贯穿', description: '同时存在至少一整行和一整列被填满。', group: 'span', points: 12, highlight: 'none', matches: m => m.fullRow && m.fullColumn },
  { id: 'interior', name: '深藏其中', description: '所有化石像素都不接触棋盘的四条边缘。', group: 'layout', points: 6, highlight: 'none', matches: m => m.interior },
  { id: 'centered', name: '重心居中', description: '所有化石像素的平均坐标恰好位于棋盘中心。', group: 'layout', points: 10, highlight: 'none', matches: m => m.centered },
  { id: 'ring', name: '独眼之环', description: '一个连通块、一个空洞，且具有左右或上下镜像。', group: 'combo', points: 6, highlight: 'holes', matches: m => m.components.length === 1 && m.holes.length === 1 && (m.mirrorX || m.mirrorY) },
  { id: 'symmetric-islands', name: '对称群岛', description: '至少两个连通块，且具有左右或上下镜像。', group: 'combo', points: 6, highlight: 'components', matches: m => m.components.length >= 2 && (m.mirrorX || m.mirrorY) },
  { id: 'hidden-heart', name: '藏心遗迹', description: '化石不触及棋盘边缘，且重心恰好位于中心。', group: 'combo', points: 6, highlight: 'none', matches: m => m.interior && m.centered },
  { id: 'maze', name: '空腔迷宫', description: '一体相连的化石，封存了至少两个空洞。', group: 'combo', points: 6, highlight: 'holes', matches: m => m.components.length === 1 && m.holes.length >= 2 },
]

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
  return {
    count,
    components: findRegions(board, true, false),
    holes: findRegions(board, false, true).filter(region => !region.some(isEdge)),
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

export function calculateScore(traits: Trait[]): number {
  const best = new Map<TraitGroup, number>()
  let combo = 0
  traits.forEach(trait => {
    if (trait.group === 'combo') combo += trait.points
    else best.set(trait.group, Math.max(best.get(trait.group) ?? 0, trait.points))
  })
  return [...best.values()].reduce((a, b) => a + b, 0) + Math.min(12, combo)
}

export function scoreBreakdown(traits: Trait[]) {
  const best = new Map<TraitGroup, Trait>()
  traits.filter(trait => trait.group !== 'combo').forEach(trait => {
    if ((best.get(trait.group)?.points ?? -1) < trait.points) best.set(trait.group, trait)
  })
  let comboBudget = 12
  return traits.map(trait => {
    const winner = best.get(trait.group)
    const awarded = trait.group === 'combo' ? Math.min(comboBudget, trait.points) : winner?.id === trait.id ? trait.points : 0
    if (trait.group === 'combo') comboBudget -= awarded
    const reason = awarded === trait.points ? (trait.group === 'combo' ? '组合加分' : '计入总分')
      : trait.group === 'combo' ? '组合加分上限 12 分' : `同组由「${winner?.name}」计分`
    return { trait, awarded, reason }
  })
}

export function featuredTraits(traits: Trait[]): Trait[] {
  const best = new Map<TraitGroup, Trait>()
  traits.forEach(trait => {
    if ((best.get(trait.group)?.points ?? -1) < trait.points) best.set(trait.group, trait)
  })
  return [...best.values()].sort((a, b) => b.points - a.points).slice(0, 3)
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
