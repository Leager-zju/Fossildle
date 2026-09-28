import { describe, expect, it } from 'vitest'
import { discover, parseCollection, parseSpecimenHash, specimenHash, timeUntilReset, utcDate, type Collection } from './collection'

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
    expect(parseSpecimenHash('#specimen/v2/2026-09-28/00003c24243c0000')).toBeNull()
  })
})
