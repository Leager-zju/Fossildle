import { analyzeFossil, SIZE, TRAITS, type Board } from './engine'

export function traitCells(board: Board, traitId: string): ReadonlySet<number> {
  const metrics = analyzeFossil(board)
  const trait = TRAITS.find(item => item.id === traitId)
  if (!trait?.matches(metrics)) return new Set()
  const pixels = board.flatMap((filled, index) => filled ? [index] : [])

  if (traitId === 'span' || traitId === 'cross') {
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

  if (['eye', 'cavities', 'ring', 'maze'].includes(traitId)) {
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
