import { describe, expect, it, vi } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, fromHex, generateFossil, generateLegacyFossil, randomSource, toHex } from './engine'

const grid = (rows: string[]) => rows.flatMap(row => [...row].map(c => c === '#'))
const ring = grid(['........', '........', '..####..', '..#..#..', '..#..#..', '..####..', '........', '........'])

describe('化石生成与结构规则', () => {
  it('旧生成器冻结，种子仍可复现历史模型', () => {
    expect(generateLegacyFossil(123456)).toEqual(generateLegacyFossil(123456))
    expect(generateLegacyFossil(123456)).not.toEqual(generateLegacyFossil(654321))
  })
  it('每个像素仅由对应随机位决定，没有相邻像素依赖', () => {
    for (let index = 0; index < 64; index++) {
      const bytes = new Uint8Array(8)
      bytes[Math.floor(index / 8)] = 1 << (7 - index % 8)
      expect(generateFossil(bytes)).toEqual(Array.from({ length: 64 }, (_, i) => i === index))
      for (let i = 0; i < 8; i++) bytes[i] ^= 255
      expect(generateFossil(bytes)).toEqual(Array.from({ length: 64 }, (_, i) => i !== index))
    }
  })
  it('全空和全满不被过滤，默认只请求一次 64 位安全随机数', () => {
    const source = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => array!)
    try {
      expect(generateFossil()).toEqual(Array(64).fill(false))
      expect(source).toHaveBeenCalledTimes(1)
      expect(source.mock.calls[0][0]?.byteLength).toBe(8)
    } finally { source.mockRestore() }
    expect(generateFossil(new Uint8Array(8).fill(255))).toEqual(Array(64).fill(true))
    expect(() => generateFossil(new Uint8Array(7))).toThrow()
  })
  it('均匀字节样本的逐格频率和相邻联合频率符合半概率模型', () => {
    const rng = randomSource(4123)
    const counts = Array(64).fill(0)
    const pairs = Array(63).fill(0)
    for (let sample = 0; sample < 20000; sample++) {
      const board = generateFossil(Uint8Array.from({ length: 8 }, () => Math.floor(rng() * 256)))
      board.forEach((cell, i) => { if (cell) counts[i]++; if (cell && board[i + 1]) pairs[i]++ })
    }
    counts.forEach(count => expect(Math.abs(count / 20000 - 0.5)).toBeLessThan(0.02))
    pairs.forEach(count => expect(Math.abs(count / 20000 - 0.25)).toBeLessThan(0.02))
  })
  it('识别居中的方环及组合成就', () => {
    const metrics = analyzeFossil(ring)
    expect(metrics.components).toHaveLength(1)
    expect(metrics.holes).toHaveLength(1)
    expect(metrics.holes[0]).toHaveLength(4)
    expect(metrics).toMatchObject({ count: 12, mirrorX: true, mirrorY: true, quarterTurn: true, interior: true, centered: true })
    const traits = evaluateTraits(metrics)
    expect(traits.map(t => t.id)).toEqual(expect.arrayContaining(['ring', 'hidden-heart']))
    expect(calculateScore(traits)).toBe(140)
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
  it('上下位结构只计上位，组合奖励封顶', () => {
    const traits = evaluateTraits(analyzeFossil(ring))
    const symmetry = traits.filter(t => t.group === 'symmetry')
    // 八面玲珑压制双轴对称与两条对角镜像；四向回转压制半周重逢。
    expect(calculateScore(symmetry)).toBe(72)
    expect(calculateScore([...traits.filter(t => t.group === 'combo'), ...traits.filter(t => t.group === 'combo')])).toBe(12)
  })
})
