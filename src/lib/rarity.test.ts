import { describe, expect, it } from 'vitest'
import reference from '../data/rarity-v1.json'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, GENERATOR_VERSION, toHex, TRAITS } from './engine'
import { classifyRarity, describeSpecimen, traitFrequency } from './rarity'

describe('版本化的概率参考', () => {
  it('参考样本完整，覆盖全部结构', () => {
    expect(reference.generatorVersion).toBe(GENERATOR_VERSION)
    expect(reference.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(reference.samples)
    expect(reference.samples).toBe(1_000_000)
    TRAITS.forEach(trait => {
      expect(traitFrequency(trait.id)).toBeGreaterThan(0)
      expect(traitFrequency(trait.id)).toBeLessThanOrEqual(1)
    })
  })
  it('分数提高时尾部概率不增加，稀有等级不降低', () => {
    let previous = classifyRarity(0)
    for (let score = 1; score <= 100; score++) {
      const rarity = classifyRarity(score)
      expect(rarity.tail).toBeLessThanOrEqual(previous.tail)
      expect(rarity.tail).toBeGreaterThan(0)
      expect(rarity.rank).toBeGreaterThanOrEqual(previous.rank)
      previous = rarity
    }
    expect(classifyRarity(0).tail).toBe(1)
  })
  it('存档的结构解读与生成规则一致', () => {
    const board = generateFossil(56789)
    const description = describeSpecimen({ date: '2026-09-28', hex: toHex(board), version: 1, favorite: false })
    expect(description.board).toEqual(board)
    expect(description.score).toBe(calculateScore(evaluateTraits(analyzeFossil(board))))
    expect(description.name.length).toBeGreaterThan(0)
  })
})
