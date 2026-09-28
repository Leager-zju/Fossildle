import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discover, saveCollection, STORAGE_KEY, type Collection } from './collection'
import { assertCurrentLocalBuild, initializeCollection, LOCAL_BUILD_KEY, localBuildForHost } from './localMode'

const a = '01759100000000000000-' + 'a'.repeat(32)
const b = '01759100000000000001-' + 'b'.repeat(32)
const empty: Collection = { schemaVersion: 1, visitorId: 'existing-local-identity', specimens: [] }

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('本地构建隔离', () => {
  it('只接受本地版本标识与本机或私网地址', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.1.3', '10.0.1.1', '172.16.0.2']) expect(localBuildForHost(a, host)).toBe(a)
    for (const host of ['leager-zju.github.io', 'example.com', '172.32.0.1', '192.168.999.1', 'localhost.evil.test']) expect(localBuildForHost(a, host)).toBe('')
    expect(localBuildForHost(undefined, 'localhost')).toBe('')
    expect(localBuildForHost('wrong', 'localhost')).toBe('')
  })
  it('新本地版本重置化石和身份，只操作本应用数据', () => {
    const old = discover(empty, '2026-09-28').collection
    saveCollection(old)
    localStorage.setItem('another-app', 'keep')
    const fresh = initializeCollection(a)
    expect(fresh.visitorId).not.toBe(old.visitorId)
    expect(fresh.specimens).toHaveLength(0)
    expect(localStorage.getItem('another-app')).toBe('keep')
    expect(localStorage.getItem(LOCAL_BUILD_KEY)).toBe(a)
    const reroll = discover(fresh, '2026-09-28')
    expect(reroll.collection.specimens).toHaveLength(1)
  })
  it('同版本刷新和重复初始化不会清空，下一版本重新开放', () => {
    const first = discover(initializeCollection(a), '2026-09-28').collection
    saveCollection(first)
    expect(initializeCollection(a)).toEqual(first)
    expect(initializeCollection(a)).toEqual(first)
    const next = initializeCollection(b)
    expect(next.specimens).toHaveLength(0)
    expect(next.visitorId).not.toBe(first.visitorId)
  })
  it('旧版本不反向重置或覆盖新版本', () => {
    const next = initializeCollection(b)
    expect(() => initializeCollection(a)).toThrow('本地版本已更新')
    expect(() => assertCurrentLocalBuild(a)).toThrow('本地版本已更新')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(next)
  })
  it('普通构建无论本地标记为何都保留藏馆', () => {
    const old = discover(empty, '2026-09-28').collection
    saveCollection(old)
    localStorage.setItem(LOCAL_BUILD_KEY, a)
    expect(initializeCollection('')).toEqual(old)
    expect(localStorage.getItem(LOCAL_BUILD_KEY)).toBe(a)
  })
  it('正式构建保护损坏记录，本地新版本可清理损坏调试数据', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(() => initializeCollection('')).toThrow()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken')
    expect(initializeCollection(a).specimens).toHaveLength(0)
  })
})
