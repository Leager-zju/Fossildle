import { fromHex, type Board } from './engine'

export const cellsBoard = (cells: number[]): Board => Array.from({ length: 64 }, (_, i) => cells.includes(i))

export function stamp(rows: string[], left = 2, top = 2): Board {
  const board: Board = Array(64).fill(false)
  rows.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '#') board[(top + y) * 8 + left + x] = true }))
  return board
}

const merge = (...boards: Board[]): Board => boards.reduce((acc, board) => acc.map((cell, i) => cell || board[i]), Array(64).fill(false) as Board)

const checker = Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) + i % 8) % 2 === 0)
const diagonal = Array.from({ length: 8 }, (_, i) => i * 9)
const full = Array<boolean>(64).fill(true)
const ring = fromHex('00003c24243c0000')
const rings = (left: number) => stamp(['###', '#.#', '###'], left, 2)

// 每项结构固定一张标准示例位图：既保证命中，也尽量让证据分组清晰可辨。
export const TRAIT_EXAMPLES: Record<string, Board> = {
  // 基础结构（engine.ts）
  connected: stamp(['###', '###', '###']),
  islands: cellsBoard([0, 1, 8, 9, 27, 28, 35, 36, 50, 51, 52, 58, 59, 60]),
  cavities: merge(rings(1), rings(5)),
  'mirror-x': cellsBoard([8, 9, 14, 15, 16, 17, 22, 23]),
  'mirror-y': cellsBoard([0, 1, 8, 9, 48, 49, 56, 57]),
  'double-mirror': cellsBoard([0, 1, 6, 7, 8, 9, 14, 15, 48, 49, 54, 55, 56, 57, 62, 63]),
  rotation: cellsBoard([6, 8, 55, 57]),
  span: cellsBoard([24, 25, 26, 27, 28, 29, 30, 31]),
  cross: cellsBoard([24, 25, 26, 27, 28, 29, 30, 31, 3, 11, 19, 35, 43, 51, 59]),
  interior: stamp(['####', '####', '####', '####'], 2, 2),
  centered: cellsBoard([0, 7, 56, 63]),
  ring: stamp(['####', '#..#', '#..#', '####'], 2, 2),
  'symmetric-islands': cellsBoard([8, 9, 14, 15]),
  'hidden-heart': stamp(['##', '##'], 3, 3),
  maze: stamp(['#####', '#.#.#', '#####'], 1, 2),

  // 扩展图鉴
  'twin-isles': stamp(['##...##'], 0),
  archipelago: checker,
  stardust: checker,
  domino: stamp(['##..##'], 1),
  triplets: stamp(['##.##.##'], 0),
  mainland: stamp(['###', '###', '###']).map((cell, i) => cell || i === 0 || i === 63),
  'string-of-pearls': checker,
  'living-thread': stamp(['########'], 0),
  'diagonal-main': cellsBoard(diagonal),
  'diagonal-anti': cellsBoard(diagonal.map(i => Math.floor(i / 8) * 8 + 7 - i % 8)),
  'half-turn': cellsBoard([1, 62]),
  eightfold: ring,
  counterpoint: Array.from({ length: 64 }, (_, i) => i < 32),
  'tiled-quarters': cellsBoard([0, 4, 32, 36]),
  'crystal-square': stamp(['###', '###', '###']),
  'amber-window': stamp(['###', '#.#', '###']),
  'little-cross': stamp(['.#.', '###', '.#.']),
  saltire: stamp(['#.#', '.#.', '#.#']),
  staircase: stamp(['#..', '##.', '###']),
  hammerhead: stamp(['###', '.#.']),
  elbow: stamp(['#.', '##']),
  zigzag: stamp(['.##', '##.']),
  'stone-arch': stamp(['#.#', '#.#', '###']),
  hourglass: stamp(['###', '.#.', '###']),
  checkerboard: stamp(['#.#.', '.#.#', '#.#.', '.#.#']),
  ladder: stamp(['###', '#.#', '###', '#.#']),
  ribbed: stamp(['####', '....', '####', '....']),
  'parallel-veins': stamp(['########', '########'], 0),
  'cross-current': cellsBoard([...diagonal, ...diagonal.map(i => Math.floor(i / 8) * 8 + 7 - i % 8)]),
  herringbone: stamp(['#.#.#', '.#.#.', '#.#.#'], 1),
  'woven-mat': stamp(['##..', '##..', '..##', '..##']),
  'four-corners': cellsBoard([0, 7, 56, 63]),
  frame: Array.from({ length: 64 }, (_, i) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7),
  'one-shore': stamp(['##', '##'], 0),
  'coast-to-coast': stamp(['########'], 0),
  'four-ports': cellsBoard([3, 24, 31, 59]),
  cornerless: stamp(['####', '####', '####', '####']),
  'half-filled': Array.from({ length: 64 }, (_, i) => i < 32),
  'sparse-sky': cellsBoard([27]),
  'dense-stratum': full,
  'even-quadrants': cellsBoard([0, 7, 56, 63]),
  pinhole: stamp(['#######', '#.#.#.#', '#######'], 0),
  'rising-tide': Array.from({ length: 64 }, (_, i) => i % 8 < Math.floor(i / 8)),
  'quiet-channel': stamp(['##', '##', '..', '##', '##'], 2, 1),
  'central-gem': stamp(['##', '##'], 3, 3),
  lake: stamp(['#####', '#...#', '#...#', '#####'], 1),
  'stone-hook': stamp(['###', '#..', '#..']),
  'ship-bow': stamp(['##.', '.##', '..#']),
  'budding-branch': stamp(['.#.', '.##', '.#.']),
  'twin-crystal': stamp(['##.', '##.', '..#']),
  'stone-moth': stamp(['#.#', '.#.', '###']),
  saddle: stamp(['#.#', '###', '...']),
  'single-pebble': cellsBoard([27]),
  'paired-pebble': cellsBoard([27, 28]),
  'equal-fragments': stamp(['##..##'], 1),
  'two-corners': cellsBoard([0, 7]),
  'narrow-gate': cellsBoard([1, 6]),
  'gentle-balance': cellsBoard([0, 63]),
  'central-ember': cellsBoard([27]),
  'central-duet': cellsBoard([27, 28]),
  'contrasting-shores': cellsBoard([0, 1, 2, 3]),
  'stratum-crest': cellsBoard([24, 25]),

  // 形状族层级
  'cross-forward-5': stamp(['.#.', '###', '.#.']),
  'cross-forward-9': stamp(['..#..', '..#..', '#####', '..#..', '..#..'], 1, 1),
  'cross-forward-13': stamp(['...#...', '...#...', '...#...', '#######', '...#...', '...#...', '...#...'], 0, 0),
  'cross-x-5': stamp(['#.#', '.#.', '#.#']),
  'cross-x-9': stamp(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], 1, 1),
  'cross-x-13': stamp(['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'], 0, 0),
  'solid-2': stamp(['##', '##']),
  'solid-4': stamp(['####', '####', '####', '####']),
  'solid-5': stamp(['#####', '#####', '#####', '#####', '#####'], 1, 1),
  'solid-6': stamp(['######', '######', '######', '######', '######', '######'], 1, 1),
  'solid-7': stamp(['#######', '#######', '#######', '#######', '#######', '#######', '#######'], 0, 0),
  'solid-8': Array.from({ length: 64 }, () => true),
  'frame-4': stamp(['####', '#..#', '#..#', '####']),
  'frame-5': stamp(['#####', '#...#', '#...#', '#...#', '#####'], 1, 1),
  'frame-6': stamp(['######', '#....#', '#....#', '#....#', '#....#', '######'], 1, 1),
  'frame-7': stamp(['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], 0, 0),
  'frame-8': cellsBoard(Array.from({ length: 64 }, (_, i) => i).filter(i => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7)),
  'lines-3': stamp(['########', '########', '########'], 0, 0),
  'lines-4': stamp(['########', '########', '########', '########'], 0, 0),
  'grid-2': cellsBoard([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 3, 11, 19, 43, 51, 59, 4, 12, 20, 44, 52, 60]),
  'grid-3': cellsBoard([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 2, 10, 42, 50, 58, 3, 11, 43, 51, 59, 4, 12, 44, 52, 60]),
  'holes-3': merge(stamp(['###', '#.#', '###'], 0, 0), stamp(['###', '#.#', '###'], 4, 0), stamp(['###', '#.#', '###'], 0, 4)),
}
