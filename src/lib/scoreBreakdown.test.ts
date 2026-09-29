import { describe, expect, it } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, fromHex, generateFossil, scoreBreakdown, TRAITS } from './engine'

describe('逐项结构计分明细', () => {
  it('全部命中项都展示，只有被上位结构覆盖的下位项不计分', () => {
    const traits = evaluateTraits(analyzeFossil(fromHex('00003c24243c0000')))
    const entries = scoreBreakdown(traits)
    expect(entries.map(item => item.trait.id)).toEqual(traits.map(trait => trait.id))
    expect(entries.reduce((sum, item) => sum + item.awarded, 0)).toBe(140)
    expect(entries.find(item => item.trait.id === 'stone-hook')).toMatchObject({ awarded: 2 })
    expect(entries.find(item => item.trait.id === 'stratum-crest')).toMatchObject({ awarded: 2 })
    expect(entries.find(item => item.trait.id === 'mirror-x')).toMatchObject({ awarded: 0, supersededBy: 'eightfold' })
    expect(entries.find(item => item.trait.id === 'double-mirror')).toMatchObject({ awarded: 0, supersededBy: 'eightfold' })
    expect(entries.find(item => item.trait.id === 'half-turn')).toMatchObject({ awarded: 0, supersededBy: 'rotation' })
    expect(entries.find(item => item.trait.id === 'rotation')).toMatchObject({ awarded: 34 })
    expect(entries.find(item => item.trait.id === 'eightfold')).toMatchObject({ awarded: 38 })
    expect(entries.find(item => item.trait.id === 'even-quadrants')).toMatchObject({ awarded: 6 })
    expect(entries.find(item => item.trait.id === 'even-quadrants')?.supersededBy).toBeNull()
    expect(entries.find(item => item.trait.id === 'eightfold')?.supersededBy).toBeNull()
  })
  it('组合分封顶，并标记不再计入的命中项', () => {
    const entries = scoreBreakdown(TRAITS.filter(trait => trait.group === 'combo'))
    expect(entries.map(item => item.awarded)).toEqual([12, 0, 0, 0])
    expect(entries[3].reason).toContain('上限')
    expect(entries.every(item => item.supersededBy === null)).toBe(true)
  })
  it('没有命中项时返回空列表', () => {
    expect(scoreBreakdown([])).toEqual([])
  })
  it('全结构明细加总与总分一致', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const traits = evaluateTraits(analyzeFossil(generateFossil()))
      expect(scoreBreakdown(traits).reduce((sum, item) => sum + item.awarded, 0)).toBe(calculateScore(traits))
    }
  })
})
