import { describe, expect, it } from 'vitest'
import referenceV1 from '../data/rarity-v1-s5.json'
import referenceV2 from '../data/rarity-v2-s5.json'
import { EVERYDAY_TRAITS } from './catalogueTraits'
import { analyzeFossil, calculateScore, evaluateTraits, generateFossil, GENERATOR_VERSION, SCORING_RULES, SCORING_VERSION, toHex, TRAITS } from './engine'
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
      expect(traitFrequency(trait.id, 1)).toBeGreaterThanOrEqual(0)
      expect(traitFrequency(trait.id, 2)).toBeGreaterThanOrEqual(0)
      expect(traitFrequency(trait.id, 2)).toBeLessThanOrEqual(1)
      expect(classifyTraitRarity(trait.id, 2).probability).toBeGreaterThan(0)
    })
  })
  it('全部计分结构双版本频率完整，扩展或改分必须同步校准', () => {
    for (const reference of [referenceV1, referenceV2]) {
      expect(reference.scoringVersion).toBe(SCORING_VERSION)
      expect(reference.scoringRules).toEqual(SCORING_RULES)
      expect(Object.keys(reference.traitFrequencies).sort()).toEqual(TRAITS.map(trait => trait.id).sort())
      for (const count of Object.values(reference.traitFrequencies)) {
        expect(Number.isInteger(count)).toBe(true)
        expect(count).toBeGreaterThanOrEqual(0)
        expect(count).toBeLessThanOrEqual(reference.samples)
      }
    }
    expect(classifyTraitRarity('diagonal-main', 2).probability).toBe(2 ** -28 - 2 ** -64)
    expect(classifyTraitRarity('eightfold', 2).probability).toBe(2 ** -54 - 2 ** -64)
    expect(classifyTraitRarity('counterpoint', 2).probability).toBe(2 ** -32)
    expect(classifyTraitRarity('central-gem', 2)).toMatchObject({ probability: 1 / 16, basis: 'exact' })
    expect(classifyTraitRarity('living-thread', 2).note).toContain('未观测到')
    expect(() => traitFrequency('missing')).toThrow('未知结构')
  })
  it('本轮新增结构经百万样本验证均属于常见或特别，而非硬编码等级', () => {
    const rarities = EVERYDAY_TRAITS.map(trait => classifyTraitRarity(trait.id, 2))
    expect(rarities.filter(rarity => rarity.id === 'common').length).toBeGreaterThanOrEqual(5)
    expect(rarities.filter(rarity => rarity.id === 'unusual').length).toBeGreaterThanOrEqual(10)
    for (const rarity of rarities) {
      expect(['common', 'unusual']).toContain(rarity.id)
      expect(rarity.probability).toBeGreaterThan(0.12)
      expect(rarity.probability).toBeLessThan(1)
      expect(rarity.basis).toBe('simulation')
    }
  })
  it('分数提高时尾部概率不增加，稀有等级不降低', () => {
    let previous = classifyRarity(0)
    for (let score = 1; score <= TRAITS.reduce((sum, trait) => sum + trait.points, 0); score++) {
      const rarity = classifyRarity(score)
      expect(rarity.tail).toBeLessThanOrEqual(previous.tail)
      expect(rarity.tail).toBeGreaterThan(0)
      expect(rarity.rank).toBeGreaterThanOrEqual(previous.rank)
      previous = rarity
    }
    expect(classifyRarity(0).tail).toBe(1)
  })
  it('旧藏品也按新评分计算，并选择其生成器的新分布', () => {
    expect(classifyRarity(40, 1).observed).toBe(259611)
    expect(classifyRarity(40, 2).observed).toBe(11503)
    expect(classifyTraitRarity('connected', 1).id).toBe('unusual')
    expect(classifyTraitRarity('connected', 2).id).toBe('remarkable')
    expect(classifyTraitRarity('cross', 2).id).toBe('archival')
    for (const version of [1, 2] as const) {
      const specimen = { date: '2026-09-28', hex: '00003c24243c0000', version, favorite: true }
      const copy = { ...specimen }
      const data = describeSpecimen(specimen)
      expect(data.score).toBe(140)
      expect(data.rarity).toEqual(classifyRarity(140, version))
      expect(specimen).toEqual(copy)
    }
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
