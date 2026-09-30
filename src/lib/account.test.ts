import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeCollections, type Collection, type Specimen } from './collection'
import { ACCOUNT_KEY, deleteRemote, GIST_DESCRIPTION, GIST_FILE, readAccount, readRemote, saveAccount, signIn, writeRemote, type Account } from './account'

const specimen = (date: string, hex = '00003c24243c0000', favorite = false): Specimen => ({ date, hex, version: 2, favorite })
const collection = (visitorId: string, specimens: Specimen[]): Collection => ({ schemaVersion: 1, visitorId, specimens })
const account: Account = { provider: 'github', login: 'leager-zju', avatarUrl: '', gistId: 'gist-1', savedAt: '2026-09-30T00:00:00.000Z', token: 'ghp_test', rankOptIn: true }

interface Call { url: string; method: string; body?: string }
const calls: Call[] = []
const respond = (payload: unknown, status = 200) => ({ ok: status < 400, status, json: async () => payload }) as Response

function routeFetch(routes: (call: Call) => Response | null) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined }
    calls.push(call)
    const response = routes(call)
    if (!response) throw new Error(`未覆盖的请求：${call.method} ${call.url}`)
    return response
  }))
}

const gistPayload = (specimens: Specimen[], visitorId = 'cloud-visitor') => ({ id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: { content: JSON.stringify(collection(visitorId, specimens)) } } })

beforeEach(() => {
  calls.length = 0
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('云端与本地合并', () => {
  it('补入仅本地存在的日期，重复日期以云端图案为准并合并珍藏标记', () => {
    const remote = collection('cloud-visitor', [specimen('2026-09-27'), specimen('2026-09-28', 'ffff00000000ffff', true)])
    const local = collection('local-visitor', [specimen('2026-09-28', '00003c24243c0000'), specimen('2026-09-29', '00ff00ff00ff00ff')])
    const merged = mergeCollections(local, remote)
    expect(merged.added).toBe(1)
    expect(merged.overwritten).toBe(1)
    expect(merged.collection.visitorId).toBe('cloud-visitor')
    expect(merged.collection.specimens.map(item => item.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29'])
    expect(merged.collection.specimens[1]).toMatchObject({ hex: 'ffff00000000ffff', favorite: true })
  })
  it('同日期同图案只合并珍藏标记，不计为覆盖', () => {
    const remote = collection('cloud-visitor', [specimen('2026-09-28')])
    const local = collection('local-visitor', [specimen('2026-09-28', '00003c24243c0000', true)])
    const merged = mergeCollections(local, remote)
    expect(merged).toMatchObject({ added: 0, overwritten: 0 })
    expect(merged.collection.specimens[0].favorite).toBe(true)
  })
})

describe('账号记录', () => {
  it('存取往返并忽略伪造或损坏的记录', () => {
    expect(readAccount()).toBeNull()
    saveAccount(account)
    expect(readAccount()).toEqual(account)
    localStorage.setItem(ACCOUNT_KEY, '{broken')
    expect(readAccount()).toBeNull()
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ provider: 'gitlab', token: 'x' }))
    expect(readAccount()).toBeNull()
    saveAccount(null)
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull()
  })
  it('令牌为空时不发起请求', async () => {
    routeFetch(() => respond({}))
    await expect(signIn('   ', collection('visitor', []))).rejects.toThrow('请先填入访问令牌')
    expect(calls).toHaveLength(0)
  })
})

describe('GitHub 同步接口', () => {
  it('缺少 gist 权限时给出可读提示', async () => {
    routeFetch(call => call.url.endsWith('/user') ? respond({ message: 'Bad credentials' }, 401) : null)
    await expect(signIn('ghp_bad', collection('visitor', []))).rejects.toThrow('访问令牌无效或已过期')
  })
  it('首次登录新建私有 Gist 并保留本地藏馆', async () => {
    const local = collection('local-visitor', [specimen('2026-09-28')])
    routeFetch(call => {
      if (call.url.endsWith('/user')) return respond({ login: 'leager-zju', avatar_url: 'https://avatars.example/u.png' })
      if (call.url.includes('/gists?per_page')) return respond([])
      if (call.url.endsWith('/gists') && call.method === 'POST') return respond({ id: 'gist-new' }, 201)
      return null
    })
    const result = await signIn('ghp_new', local)
    expect(result.account).toMatchObject({ login: 'leager-zju', gistId: 'gist-new', avatarUrl: 'https://avatars.example/u.png' })
    expect(result.collection).toEqual(local)
    expect(result).toMatchObject({ added: 0, overwritten: 0 })
    const created = JSON.parse(calls.at(-1)!.body!)
    expect(created).toMatchObject({ public: false, description: GIST_DESCRIPTION })
    expect(created.files[GIST_FILE].content).toBe(JSON.stringify(local))
  })
  it('已有 Gist 时先合并再回写，云端身份与记录都被保留', async () => {
    const local = collection('local-visitor', [specimen('2026-09-29', '00ff00ff00ff00ff')])
    const remote = [specimen('2026-09-28', 'ffff00000000ffff', true)]
    routeFetch(call => {
      if (call.url.endsWith('/user')) return respond({ login: 'leager-zju', avatar_url: '' })
      if (call.url.includes('/gists?per_page')) return respond([{ id: 'gist-1', description: '其他 Gist', files: { 'notes.md': {} } }, gistPayload(remote)])
      if (call.url.endsWith('/gists/gist-1') && call.method === 'GET') return respond(gistPayload(remote))
      if (call.url.endsWith('/gists/gist-1') && call.method === 'PATCH') return respond(gistPayload(remote))
      return null
    })
    const result = await signIn('ghp_ok', local)
    expect(result.account.gistId).toBe('gist-1')
    expect(result).toMatchObject({ added: 1, overwritten: 0 })
    expect(result.collection.visitorId).toBe('cloud-visitor')
    const pushed = JSON.parse(calls.at(-1)!.body!)
    expect(JSON.parse(pushed.files[GIST_FILE].content).specimens.map((item: Specimen) => item.date)).toEqual(['2026-09-28', '2026-09-29'])
  })
  it('云端存档损坏时停止同步而不是覆盖本地', async () => {
    routeFetch(call => {
      if (call.url.includes('/gists/gist-1') && call.method === 'GET') return respond({ id: 'gist-1', description: GIST_DESCRIPTION, files: { [GIST_FILE]: { content: '{broken' } } })
      return null
    })
    await expect(readRemote('ghp_ok', 'gist-1')).rejects.toThrow('云端存档格式无法识别')
    expect(calls.map(call => call.method)).toEqual(['GET'])
  })
  it('缺少藏馆文件时报错', async () => {
    routeFetch(() => respond({ id: 'gist-1', description: GIST_DESCRIPTION, files: {} }))
    await expect(readRemote('ghp_ok', 'gist-1')).rejects.toThrow('缺少藏馆文件')
  })
  it('写入与删除都调用对应端点', async () => {
    routeFetch(call => call.method === 'PATCH' ? respond(gistPayload([])) : respond(undefined, 204))
    await writeRemote('ghp_ok', 'gist-1', collection('visitor', [specimen('2026-09-28')]))
    await deleteRemote('ghp_ok', 'gist-1')
    expect(calls.map(call => call.method)).toEqual(['PATCH', 'DELETE'])
    expect(calls.every(call => call.url.startsWith('https://api.github.com/gists/gist-1'))).toBe(true)
  })
  it('网络不可达时提示检查网络', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(signIn('ghp_ok', collection('visitor', []))).rejects.toThrow('无法连接 GitHub 接口')
  })
})
