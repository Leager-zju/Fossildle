import { describe, expect, it } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, GENERATOR_VERSION, randomSource, scoreBreakdown, TRAITS } from './engine'
import { CATALOGUE_TRAITS, EVERYDAY_TRAITS, LOCAL_PATTERNS } from './catalogueTraits'
import { POINT_BASIS_VERSION, POINT_MAX, POINT_MIN, pointsForProbability, structureProbability } from './traitPoints'
import { traitCells } from './traitCells'
import { allCatalogueBoards, catalogueExamples, cellsBoard, stamp } from '../../tests/fixtures/catalogue'

const has = (board: boolean[], id: string) => evaluateTraits(analyzeFossil(board)).some(trait => trait.id === id)

describe('扩展结构图鉴', () => {
  it('所有结构及后续扩展必须有正整数分值并参与计分', () => {
    expect(TRAITS.length).toBeGreaterThanOrEqual(99)
    expect(TRAITS).toHaveLength(CATALOGUE_TRAITS.length + 15)
    expect(EVERYDAY_TRAITS.length).toBeGreaterThanOrEqual(16)
    expect(new Set(TRAITS.map(trait => trait.id)).size).toBe(TRAITS.length)
    expect(new Set(TRAITS.map(trait => trait.name)).size).toBe(TRAITS.length)
    for (const trait of TRAITS) {
      expect(Number.isSafeInteger(trait.points)).toBe(true)
      expect(trait.points).toBeGreaterThan(0)
      expect(trait).not.toHaveProperty('catalogueOnly')
      expect(calculateScore([trait])).toBeGreaterThan(0)
      expect(scoreBreakdown([trait])[0].awarded).toBe(calculateScore([trait]))
    }
    expect(Object.keys(catalogueExamples).sort()).toEqual(CATALOGUE_TRAITS.map(trait => trait.id).sort())
    const unlocked = new Set(allCatalogueBoards.flatMap(board => evaluateTraits(analyzeFossil(board)).map(trait => trait.id)))
    expect(unlocked.size).toBe(TRAITS.length)
  })
  it('分值由命中概率单调决定，概率越低分值越高', () => {
    expect(POINT_BASIS_VERSION).toBe(GENERATOR_VERSION)
    const ranked = TRAITS.map(trait => ({ id: trait.id, probability: structureProbability(trait.id), points: trait.points }))
    for (const item of ranked) {
      expect(item.points).toBeGreaterThanOrEqual(POINT_MIN)
      expect(item.points).toBeLessThanOrEqual(POINT_MAX)
      expect(item.points).toBe(pointsForProbability(item.probability))
    }
    const byProbability = [...ranked].sort((a, b) => b.probability - a.probability)
    for (let index = 1; index < byProbability.length; index++) {
      expect(byProbability[index].points).toBeGreaterThanOrEqual(byProbability[index - 1].points)
    }
    expect(ranked.filter(item => item.points >= POINT_MAX).length).toBeLessThan(ranked.length)
    expect(new Set(ranked.map(item => item.id)).size).toBe(TRAITS.length)
  })
  for (const trait of CATALOGUE_TRAITS) {
    it(`${trait.name}：正例、空白反例与证据格`, () => {
      const board = catalogueExamples[trait.id]
      const copy = [...board]
      expect(trait.matches(analyzeFossil(board))).toBe(true)
      expect(trait.matches(analyzeFossil(Array(64).fill(false)))).toBe(false)
      expect(trait.points).toBeGreaterThan(0)
      const cells = traitCells(board, trait.id)
      expect(cells.size).toBeGreaterThan(0)
      expect([...cells].every(i => board[i] && i >= 0 && i < 64)).toBe(true)
      expect(board).toEqual(copy)
      expect(scoreBreakdown([trait])[0]).toMatchObject({ awarded: trait.points, reason: '计入总分' })
    })
  }
  it('局部图案旋转镜像后不重复注册', () => {
    const signatures = new Set<string>()
    for (const [id, rows] of LOCAL_PATTERNS) {
      let shape: string[] = [...rows]
      const variants: string[] = []
      for (let turn = 0; turn < 4; turn++) {
        variants.push(shape.join('/'), shape.map(row => [...row].reverse().join('')).join('/'))
        shape = Array.from({ length: shape[0].length }, (_, x) => shape.map(row => row[x]).reverse().join(''))
      }
      const canonical = variants.sort()[0]
      expect(signatures.has(canonical), id).toBe(false)
      signatures.add(canonical)
    }
  })
  it('局部图形支持旋转和平移，不跨棋盘边界拼接', () => {
    for (const id of ['elbow', 'hammerhead', 'zigzag', ...LOCAL_PATTERNS.map(([id]) => id)]) {
      let board = catalogueExamples[id]
      for (let turn = 0; turn < 4; turn++) {
        expect(has(board, id)).toBe(true)
        board = board.map((_, i) => board[(7 - i % 8) * 8 + Math.floor(i / 8)])
      }
    }
    expect(has(stamp(['###', '###', '###'], 5, 5), 'crystal-square')).toBe(true)
    expect(has(cellsBoard([6, 7, 8, 14, 15, 16, 22, 23, 24]), 'crystal-square')).toBe(false)
    expect(has(cellsBoard([6, 15, 24, 33, 42]), 'diagonal-vein')).toBe(false)
  })
  it('常见结构也严格遵守连通、数量阈值及证据范围', () => {
    expect(has(cellsBoard([27, 28]), 'single-pebble')).toBe(false)
    expect(has(cellsBoard([27, 28, 29]), 'paired-pebble')).toBe(false)
    const block = stamp(['##', '##'])
    block[63] = true
    expect(traitCells(block, 'single-pebble')).toEqual(new Set([63]))
  })
  it('中心和边缘结构验证上下界，不跨角落拼接', () => {
    for (let filled = 0; filled <= 4; filled++) {
      const board = cellsBoard([27, 28, 35, 36].slice(0, filled))
      expect(has(board, 'central-ember')).toBe(filled === 1)
      expect(has(board, 'central-duet')).toBe(filled === 2)
    }
    const rim = Array.from({ length: 64 }, (_, i) => i).filter(i => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7)
    expect(has(cellsBoard(rim.slice(0, 16)), 'frame')).toBe(false)
    expect(has(cellsBoard([0, 7, 56]), 'two-corners')).toBe(false)
    const gate = Array<boolean>(64).fill(true)
    for (let i = 0; i < 8; i++) gate[i] = i === 1 || i === 6
    expect(has(gate, 'narrow-gate')).toBe(true)
    gate[2] = true
    expect(has(gate, 'narrow-gate')).toBe(false)
    expect(has(cellsBoard([24]), 'stratum-crest')).toBe(false)
    expect(has(cellsBoard([24, 25]), 'stratum-crest')).toBe(true)
  })
  it('新增结构不是必定命中，每项均存在非空反例', () => {
    const remaining = new Set(EVERYDAY_TRAITS.map(trait => trait.id))
    const rng = randomSource(924)
    for (let i = 0; i < 1000 && remaining.size; i++) {
      const metrics = analyzeFossil(generateFossil(Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256))))
      for (const trait of EVERYDAY_TRAITS) if (!trait.matches(metrics)) remaining.delete(trait.id)
    }
    expect([...remaining]).toEqual([])
  })
  it('局部证据排除远处杂点，独立遗骨不能连接额外分枝', () => {
    const board = [...catalogueExamples['crystal-square']]
    board[63] = true
    expect(traitCells(board, 'crystal-square').size).toBe(9)
    expect(traitCells(board, 'crystal-square').has(63)).toBe(false)
    const elbow = [...catalogueExamples.elbow]
    elbow[17] = true
    expect(has(elbow, 'elbow')).toBe(false)
    const flower = [...catalogueExamples['little-cross']]
    flower[18] = true
    expect(has(flower, 'little-cross')).toBe(false)
  })
  it('长卷排除分叉和闭环，角点按两条边计算', () => {
    expect(has(catalogueExamples.eightfold, 'living-thread')).toBe(false)
    const fork = [...catalogueExamples['living-thread']]
    fork[27] = true
    expect(has(fork, 'living-thread')).toBe(false)
    expect(has(stamp(['##', '##'], 0, 0), 'one-shore')).toBe(false)
    expect(has(cellsBoard([0, 63]), 'four-ports')).toBe(true)
  })
  it('空洞保持八邻接，针孔只高亮围边', () => {
    const board = [...catalogueExamples.pinhole]
    board[0] = true
    expect(traitCells(board, 'pinhole').size).toBe(18)
    board[16] = false
    expect(has(board, 'pinhole')).toBe(false)
  })
  it('上下位压制后逐项加总与总分一致，缓存分析不重复执行', () => {
    const rng = randomSource(873)
    for (let i = 0; i < 500; i++) {
      const board = generateFossil(Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256)))
      const metrics = analyzeFossil(board)
      expect(metrics.catalogue).toBe(metrics.catalogue)
      const all = evaluateTraits(metrics)
      const entries = scoreBreakdown(all)
      const total = entries.reduce((sum, item) => sum + item.awarded, 0)
      expect(calculateScore(all)).toBe(total)
      for (const entry of entries) {
        if (entry.awarded > 0) expect(entry.supersededBy).toBeNull()
        else expect(entry.supersededBy !== null || entry.trait.group === 'combo').toBe(true)
      }
    }
  })
})
