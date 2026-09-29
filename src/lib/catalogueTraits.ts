import type { Board, Trait, TraitGroup } from './engine'
import { structurePoints } from './traitPoints'

export type CatalogueMatches = ReadonlyMap<string, readonly number[]>

const structure = (id: string, name: string, description: string, group: TraitGroup): Trait => ({
  id, name, description, group, points: structurePoints(id), highlight: 'none',
  matches: metrics => metrics.catalogue.has(id),
  cells: metrics => metrics.catalogue.get(id) ?? [],
})

export const EVERYDAY_TRAITS: Trait[] = [
  structure('stone-hook', '拾光石钩', '任意 3×3 窗口恰好两条相邻边填满，共 5 格，其余留白，可旋转。', 'geometry'),
  structure('ship-bow', '小舟破浪', '任意 3×3 窗口恰好按两格、错后一格的两格、最末一格排列，可旋转或翻转。', 'geometry'),
  structure('budding-branch', '石上新芽', '任意 3×3 窗口仅一条中央直线和侧边中点填满，共 4 格，可旋转。', 'geometry'),
  structure('twin-crystal', '晶旁孤星', '任意 3×3 窗口仅一角的 2×2 晶块及相对角落填满，可旋转。', 'geometry'),
  structure('stone-moth', '展翼小蛾', '任意 3×3 窗口仅一行两端、中央一格及末行三格填满，共 6 格，可旋转。', 'texture'),
  structure('saddle', '山口石鞍', '任意 3×3 窗口恰好一行两端填满、中间行全实、末行全空，可旋转。', 'geometry'),
  structure('single-pebble', '独立小石', '至少有 1 个独立化石像素，上下左右均无化石相邻。', 'connection'),
  structure('paired-pebble', '并肩小石', '至少有 1 个恰好由 2 格组成的四邻接连通块。', 'connection'),
  structure('equal-fragments', '同重碎片', '至少两个四邻接连通块面积相同，且各不少于 2 格。', 'connection'),
  structure('two-corners', '两角相望', '棋盘四角恰好有两个填满，另外两个留白。', 'boundary'),
  structure('narrow-gate', '双石岸门', '棋盘至少一条边恰好只有 2 格化石，其他边不限。', 'boundary'),
  structure('gentle-balance', '轻盈天平', '化石非空，左右半场或上下半场的化石数量相差不超过 1 格。', 'layout'),
  structure('central-ember', '地心余火', '棋盘中央 2×2 区域恰好只有 1 格化石，其余三格留白。', 'layout'),
  structure('central-duet', '双芯合鸣', '棋盘中央 2×2 区域恰好有 2 格化石、2 格空白。', 'layout'),
  structure('contrasting-shores', '岸线反差', '上边与下边，或左边与右边的化石数量相差至少 4 格。', 'boundary'),
  structure('stratum-crest', '地层小峰', '某个非首尾行的化石数量，分别比其上、下相邻行都多至少 2 格。', 'population'),
]

export const CATALOGUE_TRAITS: Trait[] = [
  structure('twin-isles', '双生浮岛', '恰好两个四邻接连通块，像素数相同且各不少于 2 格。', 'connection'),
  structure('archipelago', '碎星群岛', '至少 8 个互不相连的四邻接连通块。', 'connection'),
  structure('stardust', '四散星尘', '至少 4 颗独立像素；上下左右均没有其他化石格。', 'connection'),
  structure('domino', '成双遗珠', '至少两个恰好由 2 格组成的独立连通块。', 'connection'),
  structure('triplets', '三重回声', '恰好三个连通块，像素数完全相同且各不少于 2 格。', 'connection'),
  structure('mainland', '大陆与卫星', '至少三个连通块，其中一个占全部化石像素的四分之三或更多。', 'connection'),
  structure('string-of-pearls', '不相触的星', '至少 6 个化石像素，且每个像素都独立成块。', 'connection'),
  structure('living-thread', '蜿蜒长卷', '全部化石连成一条不少于 8 格的无分叉路径，恰有两个端点，不闭环。', 'connection'),
  structure('diagonal-main', '斜镜映痕', '整个棋盘关于左上至右下的对角线镜像对称，且不全空。', 'symmetry'),
  structure('diagonal-anti', '逆镜映痕', '整个棋盘关于右上至左下的对角线镜像对称，且不全空。', 'symmetry'),
  structure('half-turn', '半周重逢', '整个棋盘旋转 180° 后完全重合，且不全空。', 'symmetry'),
  structure('eightfold', '八面玲珑', '整个非空棋盘同时具有水平、垂直及两条对角线的镜像对称。', 'symmetry'),
  structure('counterpoint', '阴阳对位', '旋转 180° 后，每一个位置都恰好化石与空白互换。', 'symmetry'),
  structure('tiled-quarters', '四季同纹', '四个 4×4 象限的图案完全相同，且化石与空白均存在。', 'symmetry'),
  structure('crystal-square', '九格晶核', '任意位置出现一个完整填满的 3×3 方块；允许连接其他化石。', 'geometry'),
  structure('amber-window', '琥珀小窗', '任意 3×3 窗口的外围 8 格填满，中心 1 格留白。', 'geometry'),
  structure('little-cross', '五瓣石花', '任意 3×3 窗口恰好呈加号：中心及上下左右填满，四角留白。', 'geometry'),
  structure('saltire', '斜生花瓣', '任意 3×3 窗口恰好呈叉号：中心与四角填满，其余留白。', 'geometry'),
  structure('staircase', '时光阶梯', '任意 3×3 窗口恰好由 1、2、3 格排成实心三角阶梯，可旋转或翻转。', 'geometry'),
  structure('hammerhead', '丁字遗骨', '存在一个独立的 4 格 T 形连通块，可旋转或翻转。', 'geometry'),
  structure('elbow', '折角遗骨', '存在一个独立的 3 格 L 形连通块，可旋转或翻转。', 'geometry'),
  structure('zigzag', '曲折遗骨', '存在一个独立的 4 格 S 形或 Z 形连通块，可旋转。', 'geometry'),
  structure('stone-arch', '远古石门', '任意 3×3 窗口恰好呈 7 格 U 形，两侧及底部填满，可旋转或翻转。', 'geometry'),
  structure('hourglass', '凝固沙漏', '任意 3×3 窗口恰好两端各 3 格、中间仅 1 格填满，可旋转。', 'geometry'),
  structure('checkerboard', '黑白棋韵', '任意 4×4 窗口中，化石与空白逐格交替，任一颜色均可先开始。', 'texture'),
  structure('ladder', '地层天梯', '任意 3×4 窗口两侧填满，横档与空心档交替，可旋转或翻转。', 'texture'),
  structure('ribbed', '沉积条纹', '任意 4×4 窗口恰好实心行与空白行交替，横向或纵向均可。', 'texture'),
  structure('parallel-veins', '平行地层', '至少两整行或两整列被填满；两条平行线不必相邻。', 'span'),
  structure('cross-current', '交叉星轨', '棋盘两条长度为 8 的主对角线均完全填满。', 'span'),
  structure('herringbone', '鱼骨织纹', '任意 5×3 窗口恰好呈 3、2、3 格交错点阵，可旋转或翻转。', 'texture'),
  structure('woven-mat', '双晶拼花', '任意 4×4 窗口恰好两个对角的 2×2 方块填满，另两个方块留白。', 'texture'),
  structure('four-corners', '四隅灯塔', '棋盘四个角落均有化石像素。', 'boundary'),
  structure('frame', '封边画框', '棋盘最外圈的 28 格全部填满，内部不限。', 'boundary'),
  structure('one-shore', '独岸停泊', '至少 4 格化石，恰好只接触棋盘的一条边；角落同时算接触两边。', 'boundary'),
  structure('coast-to-coast', '彼岸长桥', '同一个四邻接连通块同时连接上、下两边，或左、右两边。', 'boundary'),
  structure('four-ports', '四方驿站', '棋盘上、下、左、右四条边各恰好有 1 格化石；角落可被两边共同计数。', 'boundary'),
  structure('cornerless', '留白四隅', '至少 16 格化石，且四个角落全部留白。', 'boundary'),
  structure('half-filled', '半石半空', '64 格中恰好 32 格为化石，32 格为空白。', 'population'),
  structure('sparse-sky', '寥落晨星', '整枚标本仅有 1 至 8 个化石像素。', 'population'),
  structure('dense-stratum', '厚重岩层', '至少 56 格为化石，空白不超过 8 格。', 'population'),
  structure('even-quadrants', '四野均衡', '四个 4×4 象限中化石像素数完全相同，且都不为零。', 'layout'),
  structure('pinhole', '针孔星簇', '至少三个封闭空洞各仅占 1 格；斜向连到外界的不算空洞。', 'cavity'),
  structure('rising-tide', '渐深潮汐', '从上到下每行的化石数量不减少，且至少出现 4 种不同的行像素数。', 'population'),
  structure('quiet-channel', '无声断层', '内部存在一整行或一整列空白，并且这条空白线的两侧都有化石。', 'layout'),
  structure('central-gem', '地心方晶', '棋盘正中央的 2×2 方块全部填满，其他位置不限。', 'geometry'),
  structure('lake', '封存内海', '至少一个八邻接封闭空洞的面积达到 6 格。', 'cavity'),
  // 形状族层级：语义统一为「存在至少该规模」，因此强级一定蕴含弱级。
  structure('cross-forward-5', '正向十字·五格', '存在一个化石格，其上下左右四格均为化石，构成至少 5 格的十字。', 'geometry'),
  structure('cross-forward-9', '正向十字·九格', '存在一个至少 9 格的十字：中心之外，上下左右各方向都有 2 格连续化石。', 'geometry'),
  structure('cross-forward-13', '正向十字·十三格', '存在一个至少 13 格的十字：中心之外，上下左右各方向都有 3 格连续化石。', 'geometry'),
  structure('cross-x-5', '斜向十字·五格', '存在一个化石格，其四个对角相邻格均为化石，构成至少 5 格的斜十字。', 'geometry'),
  structure('cross-x-9', '斜向十字·九格', '存在一个至少 9 格的斜十字：中心之外，四个对角方向各有 2 格连续化石。', 'geometry'),
  structure('cross-x-13', '斜向十字·十三格', '存在一个至少 13 格的斜十字：中心之外，四个对角方向各有 3 格连续化石。', 'geometry'),
  structure('solid-2', '二阶方阵', '任意位置有一个完整填满的 2×2 方块。', 'geometry'),
  structure('solid-4', '四阶方阵', '任意位置有一个完整填满的 4×4 方块。', 'geometry'),
  structure('solid-5', '五阶方阵', '任意位置有一个完整填满的 5×5 方块。', 'geometry'),
  structure('solid-6', '六阶方阵', '任意位置有一个完整填满的 6×6 方块。', 'geometry'),
  structure('solid-7', '七阶方阵', '任意位置有一个完整填满的 7×7 方块。', 'geometry'),
  structure('solid-8', '八阶方阵', '整块棋盘的全部 64 格都是化石。', 'geometry'),
  structure('frame-4', '四阶画框', '任意位置有一个 4×4 空心方框：外圈 12 格填满、内部 4 格留白。', 'geometry'),
  structure('frame-5', '五阶画框', '任意位置有一个 5×5 空心方框：外圈 16 格填满、内部 9 格留白。', 'geometry'),
  structure('frame-6', '六阶画框', '任意位置有一个 6×6 空心方框：外圈 20 格填满、内部 16 格留白。', 'geometry'),
  structure('frame-7', '七阶画框', '任意位置有一个 7×7 空心方框。', 'geometry'),
  structure('frame-8', '八阶画框', '整个棋盘外圈 28 格填满、内部 6×6 全部留白。', 'geometry'),
  structure('lines-3', '三线贯穿', '至少有 3 整行或 3 整列被化石填满。', 'span'),
  structure('lines-4', '四线贯穿', '至少有 4 整行或 4 整列被化石填满。', 'span'),
  structure('grid-2', '双线十字', '至少有 2 整行与 2 整列同时被化石填满。', 'span'),
  structure('grid-3', '三线十字', '至少有 3 整行与 3 整列同时被化石填满。', 'span'),
  structure('holes-3', '三重空腔', '化石中封存了至少三个彼此独立的空白区域。', 'cavity'),
  ...EVERYDAY_TRAITS,
]

interface Pattern { width: number; height: number; rows: number[]; cells: number[][] }

function variants(rows: string[]): Pattern[] {
  const unique = new Map<string, string[]>()
  let current = rows
  for (let turn = 0; turn < 4; turn++) {
    for (const shape of [current, current.map(row => [...row].reverse().join(''))]) unique.set(shape.join('/'), shape)
    current = Array.from({ length: current[0].length }, (_, x) => current.map(row => row[x]).reverse().join(''))
  }
  return [...unique.values()].map(shape => ({
    width: shape[0].length, height: shape.length,
    rows: shape.map(row => parseInt([...row].map(cell => cell === '#' ? '1' : '0').join(''), 2)),
    cells: shape.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '#' ? [[x, y]] : [])),
  }))
}

export const LOCAL_PATTERNS = [
  ['crystal-square', ['###', '###', '###']],
  ['amber-window', ['###', '#.#', '###']],
  ['little-cross', ['.#.', '###', '.#.']],
  ['saltire', ['#.#', '.#.', '#.#']],
  ['staircase', ['#..', '##.', '###']],
  ['stone-arch', ['#.#', '#.#', '###']],
  ['hourglass', ['###', '.#.', '###']],
  ['checkerboard', ['#.#.', '.#.#', '#.#.', '.#.#']],
  ['ladder', ['###', '#.#', '###', '#.#']],
  ['ribbed', ['####', '....', '####', '....']],
  ['herringbone', ['#.#.#', '.#.#.', '#.#.#']],
  ['woven-mat', ['##..', '##..', '..##', '..##']],
  ['stone-hook', ['###', '#..', '#..']],
  ['ship-bow', ['##.', '.##', '..#']],
  ['budding-branch', ['.#.', '.##', '.#.']],
  ['twin-crystal', ['##.', '##.', '..#']],
  ['stone-moth', ['#.#', '.#.', '###']],
  ['saddle', ['#.#', '###', '...']],
] as const
const compiledPatterns = LOCAL_PATTERNS.map(([id, rows]) => ({ id, patterns: variants([...rows]) }))
const componentPatterns = [
  { id: 'hammerhead', patterns: variants(['###', '.#.']) },
  { id: 'elbow', patterns: variants(['#.', '##']) },
  { id: 'zigzag', patterns: variants(['.##', '##.']) },
]
const corners = [0, 7, 56, 63]
const edges = [
  Array.from({ length: 8 }, (_, x) => x), Array.from({ length: 8 }, (_, x) => 56 + x),
  Array.from({ length: 8 }, (_, y) => y * 8), Array.from({ length: 8 }, (_, y) => y * 8 + 7),
]
const rim = [...new Set(edges.flat())]

export function detectCatalogue(board: Board, components: number[][], holes: number[][]): CatalogueMatches {
  const found = new Map<string, readonly number[]>()
  const pixels: number[] = []
  const rowBits = Array<number>(8).fill(0)
  const rowCounts = Array<number>(8).fill(0)
  const columnCounts = Array<number>(8).fill(0)
  const quadrants = Array<number>(4).fill(0)
  for (let i = 0; i < 64; i++) if (board[i]) {
    const x = i % 8, y = Math.floor(i / 8)
    pixels.push(i)
    rowBits[y] |= 1 << (7 - x)
    rowCounts[y]++
    columnCounts[x]++
    quadrants[Math.floor(y / 4) * 2 + Math.floor(x / 4)]++
  }
  const count = pixels.length
  if (!count) return found
  const mark = (id: string, condition: boolean, cells: readonly number[] = pixels) => { if (condition) found.set(id, cells) }
  const sizes = components.map(component => component.length)
  const singles = components.filter(component => component.length === 1).flat()
  const pairs = components.filter(component => component.length === 2).flat()
  mark('twin-isles', sizes.length === 2 && sizes[0] >= 2 && sizes[0] === sizes[1])
  mark('archipelago', sizes.length >= 8)
  mark('stardust', singles.length >= 4, singles)
  mark('domino', pairs.length >= 4, pairs)
  mark('triplets', sizes.length === 3 && sizes[0] >= 2 && sizes.every(size => size === sizes[0]))
  mark('mainland', sizes.length >= 3 && sizes.some(size => size * 4 >= count * 3))
  mark('string-of-pearls', count >= 6 && sizes.length === count)
  if (sizes.length === 1 && count >= 8) {
    const degrees = pixels.map(i => Number(i >= 8 && board[i - 8]) + Number(i < 56 && board[i + 8]) + Number(i % 8 > 0 && board[i - 1]) + Number(i % 8 < 7 && board[i + 1]))
    mark('living-thread', degrees.every(degree => degree <= 2) && degrees.filter(degree => degree === 1).length === 2)
  }
  const diagonalMain = board.every((value, i) => value === board[i % 8 * 8 + Math.floor(i / 8)])
  const diagonalAnti = board.every((value, i) => value === board[(7 - i % 8) * 8 + 7 - Math.floor(i / 8)])
  mark('diagonal-main', diagonalMain)
  mark('diagonal-anti', diagonalAnti)
  mark('half-turn', board.every((value, i) => value === board[63 - i]))
  mark('eightfold', diagonalMain && diagonalAnti && board.every((value, i) => value === board[Math.floor(i / 8) * 8 + 7 - i % 8]))
  mark('counterpoint', board.every((value, i) => value !== board[63 - i]))
  mark('tiled-quarters', count < 64 && board.every((value, i) => value === board[Math.floor(i / 8) % 4 * 8 + i % 4]))

  for (const { id, patterns } of compiledPatterns) {
    // 「任意 N×M 窗口」类结构可能有多处区块同时满足条件，只保留最靠上、最靠左的一处作为证据。
    let match: readonly number[] | undefined
    for (let y = 0; y < 8 && !match; y++) for (let x = 0; x < 8 && !match; x++) {
      for (const pattern of patterns) {
        if (y + pattern.height > 8 || x + pattern.width > 8) continue
        const mask = (1 << pattern.width) - 1
        const shift = 8 - pattern.width - x
        if (pattern.rows.every((row, dy) => ((rowBits[y + dy] >> shift) & mask) === row)) {
          match = pattern.cells.map(([dx, dy]) => (y + dy) * 8 + x + dx)
          break
        }
      }
    }
    if (match) found.set(id, match)
  }
  for (const { id, patterns } of componentPatterns) {
    // 「存在一个独立的 N 格遗骨」同理，只标记最先找到的那一块。
    for (const component of components) {
      if (component.length !== patterns[0].cells.length) continue
      const left = Math.min(...component.map(i => i % 8)), top = Math.min(...component.map(i => Math.floor(i / 8)))
      if (patterns.some(pattern => pattern.cells.every(([x, y]) => left + x < 8 && top + y < 8 && component.includes((top + y) * 8 + left + x)))) {
        found.set(id, [...component])
        break
      }
    }
  }
  const rowsFull = rowCounts.filter(value => value === 8).length
  const columnsFull = columnCounts.filter(value => value === 8).length
  const lineCells = pixels.filter(i => rowCounts[Math.floor(i / 8)] === 8 || columnCounts[i % 8] === 8)
  if (rowsFull >= 2 || columnsFull >= 2) found.set('parallel-veins', lineCells)
  if (Math.max(rowsFull, columnsFull) >= 3) found.set('lines-3', lineCells)
  if (Math.max(rowsFull, columnsFull) >= 4) found.set('lines-4', lineCells)
  if (Math.min(rowsFull, columnsFull) >= 2) found.set('grid-2', lineCells)
  if (Math.min(rowsFull, columnsFull) >= 3) found.set('grid-3', lineCells)
  const diagonals = Array.from({ length: 8 }, (_, i) => [i * 9, i * 8 + 7 - i]).flat()
  mark('cross-current', diagonals.every(i => board[i]), diagonals)
  const edgeCounts = edges.map(edge => edge.filter(i => board[i]).length)
  mark('four-corners', corners.every(i => board[i]), corners)
  mark('frame', rim.every(i => board[i]), rim)
  mark('one-shore', count >= 4 && edgeCounts.filter(value => value > 0).length === 1)
  const bridges = components.filter(component => {
    const touched = edges.map(edge => edge.some(i => component.includes(i)))
    return (touched[0] && touched[1]) || (touched[2] && touched[3])
  }).flat()
  mark('coast-to-coast', bridges.length > 0, bridges)
  mark('four-ports', edgeCounts.every(value => value === 1), rim.filter(i => board[i]))
  mark('cornerless', count >= 16 && corners.every(i => !board[i]))
  mark('half-filled', count === 32)
  mark('sparse-sky', count <= 8)
  mark('dense-stratum', count >= 56)
  mark('even-quadrants', quadrants.every(value => value === quadrants[0]))
  mark('rising-tide', new Set(rowCounts).size >= 4 && rowCounts.every((value, i) => i === 0 || value >= rowCounts[i - 1]))
  mark('quiet-channel', [rowCounts, columnCounts].some(lines => lines.some((value, i) => i > 0 && i < 7 && value === 0 && lines.slice(0, i).some(Boolean) && lines.slice(i + 1).some(Boolean))))
  const center = [27, 28, 35, 36]
  mark('central-gem', center.every(i => board[i]), center)
  const boundaryOf = (regions: number[][]) => {
    const cells = new Set<number>()
    for (const i of regions.flat()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = i % 8 + dx, y = Math.floor(i / 8) + dy
      if (x >= 0 && x < 8 && y >= 0 && y < 8 && board[y * 8 + x]) cells.add(y * 8 + x)
    }
    return [...cells]
  }
  const pinholes = holes.filter(hole => hole.length === 1)
  if (pinholes.length >= 3) found.set('pinhole', boundaryOf(pinholes))
  const lakes = holes.filter(hole => hole.length >= 6)
  if (lakes.length) found.set('lake', boundaryOf(lakes))

  mark('single-pebble', singles.length > 0, singles)
  mark('paired-pebble', pairs.length > 0, pairs)
  const sizeCounts = new Map<number, number>()
  sizes.forEach(size => sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1))
  const equal = components.filter(component => component.length >= 2 && sizeCounts.get(component.length)! >= 2).flat()
  mark('equal-fragments', equal.length > 0, equal)
  const cornerPixels = corners.filter(i => board[i])
  mark('two-corners', cornerPixels.length === 2, cornerPixels)
  const gates = edges.filter((_, i) => edgeCounts[i] === 2).flat().filter(i => board[i])
  mark('narrow-gate', gates.length > 0, [...new Set(gates)])
  const horizontalDifference = Math.abs(quadrants[0] + quadrants[1] - quadrants[2] - quadrants[3])
  const verticalDifference = Math.abs(quadrants[0] + quadrants[2] - quadrants[1] - quadrants[3])
  mark('gentle-balance', horizontalDifference <= 1 || verticalDifference <= 1)
  const centerPixels = center.filter(i => board[i])
  mark('central-ember', centerPixels.length === 1, centerPixels)
  mark('central-duet', centerPixels.length === 2, centerPixels)
  const contrasting = new Set<number>()
  for (const [a, b] of [[0, 1], [2, 3]]) if (Math.abs(edgeCounts[a] - edgeCounts[b]) >= 4) {
    [...edges[a], ...edges[b]].filter(i => board[i]).forEach(i => contrasting.add(i))
  }
  mark('contrasting-shores', contrasting.size > 0, [...contrasting])
  const crests = new Set<number>()
  for (let row = 1; row < 7; row++) if (rowCounts[row] >= rowCounts[row - 1] + 2 && rowCounts[row] >= rowCounts[row + 1] + 2) {
    pixels.filter(i => Math.abs(Math.floor(i / 8) - row) <= 1).forEach(i => crests.add(i))
  }
  mark('stratum-crest', crests.size > 0, [...crests])

  // 形状族层级：十字（正向/斜向）、实心方阵、空心方框、空洞数量。
  const scanArms = (directions: readonly (readonly number[])[]) => {
    let arms = 0
    let center = -1
    for (let index = 0; index < 64; index++) {
      if (!board[index]) continue
      const x = index % 8
      const y = Math.floor(index / 8)
      let reached = 0
      expand: while (true) {
        for (const [dx, dy] of directions) {
          const nx = x + dx * (reached + 1)
          const ny = y + dy * (reached + 1)
          if (nx < 0 || nx > 7 || ny < 0 || ny > 7 || !board[ny * 8 + nx]) break expand
        }
        reached++
      }
      if (reached > arms) { arms = reached; center = index }
    }
    return { arms, center }
  }
  const armCells = (center: number, arms: number, directions: readonly (readonly number[])[]) => {
    if (center < 0 || arms < 1) return []
    const x = center % 8
    const y = Math.floor(center / 8)
    const cells = [center]
    for (const [dx, dy] of directions) for (let step = 1; step <= arms; step++) cells.push((y + dy * step) * 8 + x + dx * step)
    return cells
  }
  const forwardArms = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const diagonalArms = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  const forward = scanArms(forwardArms)
  const diagonal = scanArms(diagonalArms)
  if (forward.arms >= 1) {
    const cells = armCells(forward.center, forward.arms, forwardArms)
    if (forward.arms >= 1) found.set('cross-forward-5', cells)
    if (forward.arms >= 2) found.set('cross-forward-9', cells)
    if (forward.arms >= 3) found.set('cross-forward-13', cells)
  }
  if (diagonal.arms >= 1) {
    const cells = armCells(diagonal.center, diagonal.arms, diagonalArms)
    if (diagonal.arms >= 1) found.set('cross-x-5', cells)
    if (diagonal.arms >= 2) found.set('cross-x-9', cells)
    if (diagonal.arms >= 3) found.set('cross-x-13', cells)
  }

  let solidSize = 0
  let solidCells: number[] = []
  let frameSize = 0
  let frameCells: number[] = []
  for (let size = 2; size <= 8; size++) for (let top = 0; top + size <= 8; top++) for (let left = 0; left + size <= 8; left++) {
    const cells: number[] = []
    let solid = true
    let frame = true
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const index = (top + dy) * 8 + left + dx
      const filled = board[index]
      if (filled) cells.push(index)
      if (!filled) solid = false
      const border = dy === 0 || dy === size - 1 || dx === 0 || dx === size - 1
      if (border !== filled) frame = false
    }
    if (solid && size > solidSize) { solidSize = size; solidCells = cells }
    if (frame && size > frameSize) { frameSize = size; frameCells = cells }
  }
  for (const [id, size] of [['solid-2', 2], ['solid-4', 4], ['solid-5', 5], ['solid-6', 6], ['solid-7', 7], ['solid-8', 8]] as const) if (solidSize >= size) found.set(id, solidCells)
  for (const [id, size] of [['frame-4', 4], ['frame-5', 5], ['frame-6', 6], ['frame-7', 7], ['frame-8', 8]] as const) if (frameSize >= size) found.set(id, frameCells)
  if (holes.length >= 3) found.set('holes-3', boundaryOf(holes))
  return found
}
