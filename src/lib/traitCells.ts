import { analyzeFossil, SIZE, TRAITS, type Board, type Metrics, type Trait } from './engine'

const EDGES = [
  Array.from({ length: SIZE }, (_, x) => x),
  Array.from({ length: SIZE }, (_, x) => (SIZE - 1) * SIZE + x),
  Array.from({ length: SIZE }, (_, y) => y * SIZE),
  Array.from({ length: SIZE }, (_, y) => y * SIZE + SIZE - 1),
]
const EDGE_NAMES = ['上边', '下边', '左边', '右边']
const QUADRANT_NAMES = ['左上', '右上', '左下', '右下']

export interface TraitCellGroup {
  cells: readonly number[]
  label: string
}

// 单一高亮集合：所选结构命中的全部证据格。
function highlightCells(board: Board, metrics: Metrics, trait: Trait): ReadonlySet<number> {
  const pixels = board.flatMap((filled, index) => filled ? [index] : [])
  if (trait.cells) return new Set(trait.cells(metrics))

  if (trait.id === 'span' || trait.id === 'cross') {
    const cells = new Set<number>()
    for (let line = 0; line < SIZE; line++) {
      const row = Array.from({ length: SIZE }, (_, column) => line * SIZE + column)
      const column = Array.from({ length: SIZE }, (_, row) => row * SIZE + line)
      for (const indices of [row, column]) {
        if (indices.every(index => board[index])) indices.forEach(index => cells.add(index))
      }
    }
    return cells
  }

  if (['cavities', 'ring', 'maze'].includes(trait.id)) {
    // 空白采用八邻接，围住空洞的边界也包括对角方向的化石。
    const cells = new Set<number>()
    for (const index of metrics.holes.flat()) {
      const x = index % SIZE
      const y = Math.floor(index / SIZE)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue
          const neighbor = ny * SIZE + nx
          if (board[neighbor]) cells.add(neighbor)
        }
      }
    }
    return cells
  }

  // 连通块数量、全局对称与重心等条件由全部化石像素共同决定。
  return new Set(pixels)
}

export function traitCells(board: Board, traitId: string): ReadonlySet<number> {
  const metrics = analyzeFossil(board)
  const trait = TRAITS.find(item => item.id === traitId)
  if (!trait?.matches(metrics)) return new Set()
  return highlightCells(board, metrics, trait)
}

function holeBoundary(board: Board, hole: readonly number[]): number[] {
  const cells = new Set<number>()
  for (const index of hole) {
    const x = index % SIZE
    const y = Math.floor(index / SIZE)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue
        const neighbor = ny * SIZE + nx
        if (board[neighbor]) cells.add(neighbor)
      }
    }
  }
  return [...cells]
}

function byComponent(components: readonly (readonly number[])[], active: ReadonlySet<number>): TraitCellGroup[] {
  const owner = new Map<number, number>()
  components.forEach((cells, index) => cells.forEach(cell => owner.set(cell, index)))
  const groups: number[][] = components.map(() => [])
  for (const cell of active) {
    const index = owner.get(cell)
    if (index !== undefined) groups[index].push(cell)
  }
  return groups.filter(group => group.length > 0).map((cells, index) => ({ cells, label: `第 ${index + 1} 个连通块` }))
}

/**
 * 把命中证据按可区分的组返回：连通块、空洞、半场、象限、对边各自成组，并带上用于说明的标签。
 * 其余结构返回单个组（无标签），渲染时沿用统一的原色。
 */
export function traitCellGroups(board: Board, traitId: string): readonly TraitCellGroup[] {
  const metrics = analyzeFossil(board)
  const trait = TRAITS.find(item => item.id === traitId)
  if (!trait?.matches(metrics)) return []
  const active = highlightCells(board, metrics, trait)
  if (!active.size) return []

  if (trait.group === 'connection' || trait.id === 'symmetric-islands') {
    return byComponent(metrics.components, active)
  }
  if (['cavities', 'pinhole', 'lake', 'maze'].includes(trait.id)) {
    return metrics.holes
      .map(hole => holeBoundary(board, hole).filter(cell => active.has(cell)))
      .filter(group => group.length > 0)
      .map((cells, index) => ({ cells, label: `第 ${index + 1} 个空洞` }))
  }
  if (trait.id === 'contrasting-shores') {
    const filled = (edge: readonly number[]) => edge.filter(index => board[index])
    const counts = EDGES.map(filled).map(cells => cells.length)
    const groups: TraitCellGroup[] = []
    for (const [a, b] of [[0, 1], [2, 3]]) if (Math.abs(counts[a] - counts[b]) >= 4) groups.push({ cells: filled(EDGES[a]), label: EDGE_NAMES[a] }, { cells: filled(EDGES[b]), label: EDGE_NAMES[b] })
    return groups
  }
  if (trait.id === 'gentle-balance' || trait.id === 'even-quadrants') {
    const quadrants = Array.from({ length: 4 }, () => [] as number[])
    for (const cell of active) quadrants[Math.floor(Math.floor(cell / SIZE) / (SIZE / 2)) * 2 + Math.floor((cell % SIZE) / (SIZE / 2))].push(cell)
    if (trait.id === 'even-quadrants') return quadrants.map((cells, index) => ({ cells, label: QUADRANT_NAMES[index] })).filter(group => group.cells.length > 0)
    const [topLeft, topRight, bottomLeft, bottomRight] = quadrants.map(group => group.length)
    const horizontal = Math.abs(topLeft + topRight - (bottomLeft + bottomRight))
    const vertical = Math.abs(topLeft + bottomLeft - (topRight + bottomRight))
    const axis = horizontal <= vertical ? 'horizontal' : 'vertical'
    const inHalf = (cell: number, second: boolean) => {
      const coordinate = axis === 'horizontal' ? cell % SIZE : Math.floor(cell / SIZE)
      return second ? coordinate >= SIZE / 2 : coordinate < SIZE / 2
    }
    const left = axis === 'horizontal' ? '左半场' : '上半场'
    const right = axis === 'horizontal' ? '右半场' : '下半场'
    return [false, true].map(second => ({ cells: [...active].filter(cell => inHalf(cell, second)), label: second ? right : left }))
  }
  return [{ cells: [...active], label: '' }]
}
