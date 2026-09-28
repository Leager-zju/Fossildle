import { describe, expect, it } from 'vitest'
import referenceV1 from '../data/rarity-v1.json'
import referenceV2 from '../data/rarity-v2.json'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, GENERATOR_VERSION, toHex, TRAITS } from './engine'
import { classifyRarity, classifyTraitRarity, describeSpecimen, traitFrequency } from './rarity'

describe('版本化的概率参考', () => {
  it('各版本参考样本完整，零观测仍保留明确字段', () => {
    expect(referenceV1.generatorVersion).toBe(1)
    expect(referenceV2.generatorVersion).toBe(GENERATOR_VERSION)
    for (const reference of [referenceV1, referenceV2]) {
      expect(reference.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(reference.samples)
      expect(reference.samples).toBe(1_000_000)
    }
    TRAITS.forEach(trait => {
      expect(traitFrequency(trait.id, 1)).toBeGreaterThan(0)
      expect(traitFrequency(trait.id, 2)).toBeGreaterThanOrEqual(0)
      expect(traitFrequency(trait.id, 2)).toBeLessThanOrEqual(1)
      expect(classifyTraitRarity(trait.id, 2).probability).toBeGreaterThan(0)
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
  it('历史整体稀有度不受新分布影响，结构等级使用命中频率而非分值', () => {
    expect(classifyRarity(40, 1).observed).toBe(108495)
    expect(classifyRarity(40, 2).observed).toBe(207)
    expect(classifyTraitRarity('connected', 1).id).toBe('unusual')
    expect(classifyTraitRarity('connected', 2).id).toBe('remarkable')
    expect(classifyTraitRarity('cross', 2).id).toBe('archival')
    const old = describeSpecimen({ date: '2026-09-28', hex: '00003c24243c0000', version: 1, favorite: false })
    expect(old.score).toBe(72)
    expect(old.rarity).toEqual(classifyRarity(72, 1))
  })
  it('极小概率使用理论值或明确的零观测上界，而不是零', () => {
    const mirror = classifyTraitRarity('mirror-x', 2)
    expect(mirror.basis).toBe('exact')
    expect(mirror.probability).toBe(2 ** -32 - 2 ** -64)
    expect(classifyTraitRarity('rotation', 2).probability).toBe(2 ** -48 - 2 ** -64)
    const ring = classifyTraitRarity('ring', 2)
    expect(ring.basis).toBe('upper-bound')
    expect(ring.probability).toBeGreaterThan(0)
    expect(ring.probability).toBeLessThan(0.000004)
    expect(ring.note).toContain('未观测到')
    expect(() => classifyTraitRarity('missing')).toThrow('未知结构')
  })
  it('存档的结构解读与生成规则一致', () => {
    const board = generateFossil(Uint8Array.of(13, 57, 89, 123, 177, 199, 233, 251))
    const description = describeSpecimen({ date: '2026-09-28', hex: toHex(board), version: 2, favorite: false })
    expect(description.board).toEqual(board)
    expect(description.score).toBe(calculateScore(evaluateTraits(analyzeFossil(board))))
    expect(description.name.length).toBeGreaterThan(0)
  })
})
