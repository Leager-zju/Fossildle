import { describe, expect, it, vi } from 'vitest'
import { discover, parseCollection, parseSpecimenHash, sameSpecimen, specimenHash, timeUntilReset, utcDate, validSpecimen, type Collection, type Specimen } from './collection'

const empty: Collection = { schemaVersion: 1, visitorId: 'test-visitor-123', specimens: [] }

describe('每日发现与存档', () => {
  it('每天一次且重试幂等', () => {
    const first = discover(empty, '2026-09-28')
    const again = discover(first.collection, '2026-09-28')
    expect(again.specimen).toEqual(first.specimen)
    expect(again.collection.specimens).toHaveLength(1)
    expect(empty.specimens).toHaveLength(0)
    expect(discover(first.collection, '2026-09-29').collection.specimens).toHaveLength(2)
  })
  it('以 UTC 日期跨日，午夜倒计时重置', () => {
    expect(utcDate(new Date('2026-09-29T07:59:59+08:00'))).toBe('2026-09-28')
    expect(timeUntilReset(new Date('2026-09-28T23:59:59Z'))).toBe('00:00:01')
    expect(timeUntilReset(new Date('2026-09-29T00:00:00Z'))).toBe('24:00:00')
  })
  it('存档与分享链接可往返，分享解析不修改收藏', () => {
    const result = discover(empty, '2026-09-28')
    expect(parseCollection(JSON.stringify(result.collection))).toEqual(result.collection)
    expect(parseSpecimenHash(specimenHash(result.specimen))).toEqual(result.specimen)
    expect(empty.specimens).toHaveLength(0)
  })
  it('拒绝错误、重复日期和非法分享链接', () => {
    expect(() => parseCollection('{')).toThrow()
    expect(() => parseCollection(JSON.stringify({ ...empty, specimens: [{}] }))).toThrow()
    const result = discover(empty, '2026-09-28')
    expect(() => parseCollection(JSON.stringify({ ...result.collection, specimens: [result.specimen, result.specimen] }))).toThrow()
    expect(parseSpecimenHash('#specimen/v1/2026-02-30/ffffffffffffffff')).toBeNull()
    expect(parseSpecimenHash('#specimen/v3/2026-09-28/00003c24243c0000')).toBeNull()
  })
  it('保留历史当天记录，后续日期创建 v2，混合存档无损往返', () => {
    const old: Specimen = { date: '2026-09-28', hex: '00003c24243c0000', version: 1, favorite: true }
    const collection = { ...empty, specimens: [old] }
    expect(discover(collection, old.date).specimen).toBe(old)
    const next = discover(collection, '2026-09-29')
    expect(next.specimen.version).toBe(2)
    expect(parseCollection(JSON.stringify(next.collection))).toEqual(next.collection)
    expect(specimenHash(old)).toContain('/v1/')
    expect(specimenHash(next.specimen)).toContain('/v2/')
    expect(parseSpecimenHash(specimenHash(old))?.version).toBe(1)
    expect(sameSpecimen(old, { ...old, version: 2 })).toBe(false)
  })
  it('v2 接受全空、全满，v1 不放宽原格式，随机结果只生成一次', () => {
    for (const hex of ['0000000000000000', 'ffffffffffffffff']) {
      const specimen = { date: '2026-09-28', hex, version: 2 as const, favorite: false }
      expect(validSpecimen(specimen)).toBe(true)
      expect(parseSpecimenHash(specimenHash(specimen))).toEqual(specimen)
      expect(validSpecimen({ ...specimen, version: 1 })).toBe(false)
    }
    const source = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => array!)
    try {
      const first = discover(empty, '2026-09-28')
      expect(first.specimen.hex).toBe('0000000000000000')
      expect(parseCollection(JSON.stringify(first.collection))).toEqual(first.collection)
      expect(discover(first.collection, '2026-09-28').specimen).toEqual(first.specimen)
      expect(source).toHaveBeenCalledTimes(1)
    } finally { source.mockRestore() }
  })
})
