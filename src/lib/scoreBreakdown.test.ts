import { describe, expect, it } from 'vitest'
import { analyzeFossil, calculateScore, evaluateTraits, fromHex, generateFossil, scoreBreakdown, TRAITS } from './engine'

describe('逐项结构计分明细', () => {
  it('全部命中项都展示，同组只由最高项加分', () => {
    const traits = evaluateTraits(analyzeFossil(fromHex('00003c24243c0000')))
    const entries = scoreBreakdown(traits)
    expect(entries.map(item => item.trait.id)).toEqual(traits.map(trait => trait.id))
    expect(entries.reduce((sum, item) => sum + item.awarded, 0)).toBe(72)
    expect(entries.find(item => item.trait.id === 'mirror-x')).toMatchObject({ awarded: 0 })
    expect(entries.find(item => item.trait.id === 'rotation')).toMatchObject({ awarded: 30 })
    expect(entries.find(item => item.trait.id === 'interior')?.reason).toContain('重心居中')
  })
  it('组合分封顶，并标记不再计入的命中项', () => {
    const entries = scoreBreakdown(TRAITS.filter(trait => trait.group === 'combo'))
    expect(entries.map(item => item.awarded)).toEqual([6, 6, 0, 0])
    expect(entries[3].reason).toContain('上限')
  })
  it('没有命中项时返回空列表', () => {
    expect(scoreBreakdown([])).toEqual([])
  })
  it('明细加总与固定 v1 算法对所有生成类型一致', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const traits = evaluateTraits(analyzeFossil(generateFossil()))
      expect(scoreBreakdown(traits).reduce((sum, item) => sum + item.awarded, 0)).toBe(calculateScore(traits))
    }
  })
})
