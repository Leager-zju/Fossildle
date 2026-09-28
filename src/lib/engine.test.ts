import { describe, expect, it } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, fromHex, generateFossil, toHex } from './engine'

const grid = (rows: string[]) => rows.flatMap(row => [...row].map(c => c === '#'))
const ring = grid(['........', '........', '..####..', '..#..#..', '..#..#..', '..####..', '........', '........'])

describe('化石生成与结构规则', () => {
  it('相同种子生成相同图案', () => {
    expect(generateFossil(123456)).toEqual(generateFossil(123456))
    expect(generateFossil(123456)).not.toEqual(generateFossil(654321))
  })
  it('各生成分支都输出 12～36 格的 8×8 图案', () => {
    for (let seed = 0; seed < 4000; seed++) {
      const board = generateFossil(seed)
      expect(board).toHaveLength(64)
      expect(board.filter(Boolean).length).toBeGreaterThanOrEqual(12)
      expect(board.filter(Boolean).length).toBeLessThanOrEqual(36)
    }
  })
  it('识别居中的方环及组合成就', () => {
    const metrics = analyzeFossil(ring)
    expect(metrics.components).toHaveLength(1)
    expect(metrics.holes).toHaveLength(1)
    expect(metrics.holes[0]).toHaveLength(4)
    expect(metrics).toMatchObject({ count: 12, mirrorX: true, mirrorY: true, quarterTurn: true, interior: true, centered: true })
    const traits = evaluateTraits(metrics)
    expect(traits.map(t => t.id)).toEqual(expect.arrayContaining(['ring', 'hidden-heart']))
    expect(calculateScore(traits)).toBe(72)
  })
  it('化石用四邻接，空白用八邻接', () => {
    const board = grid(['........', '........', '...#....', '..#.#...', '...#....', '........', '........', '........'])
    const metrics = analyzeFossil(board)
    expect(metrics.components).toHaveLength(4)
    expect(metrics.holes).toHaveLength(0)
  })
  it('四向回转不必等于镜面对称', () => {
    const board = Array(64).fill(false)
    ;[11, 30, 52, 33].forEach(i => { board[i] = true })
    expect(analyzeFossil(board)).toMatchObject({ quarterTurn: true, mirrorX: false, mirrorY: false })
  })
  it('空棋盘不获得对称或居中成就，满棋盘没有空洞', () => {
    expect(evaluateTraits(analyzeFossil(Array(64).fill(false)))).toHaveLength(0)
    const full = analyzeFossil(Array(64).fill(true))
    expect(full.holes).toHaveLength(0)
    expect(full.fullRow && full.fullColumn).toBe(true)
  })
  it('位图无损转换，拒绝错误编码', () => {
    expect(fromHex(toHex(ring))).toEqual(ring)
    expect(() => fromHex('not-a-fossil')).toThrow()
    expect(() => analyzeFossil([true])).toThrow()
  })
  it('同一组仅取最高分，组合奖励封顶', () => {
    const traits = evaluateTraits(analyzeFossil(ring))
    const symmetry = traits.filter(t => t.group === 'symmetry')
    expect(calculateScore(symmetry)).toBe(30)
    expect(calculateScore([...traits.filter(t => t.group === 'combo'), ...traits.filter(t => t.group === 'combo')])).toBe(12)
  })
})
