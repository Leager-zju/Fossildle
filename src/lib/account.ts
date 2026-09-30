import { mergeCollections, parseCollection, type Collection } from './collection'

/**
 * 可选云同步：用 GitHub 账号（访问令牌）把藏馆存到用户自己的私有 Gist。
 * 项目本身没有服务器，令牌只保存在本机浏览器，且只会发往 api.github.com。
 * 浏览器无法直接完成 GitHub OAuth 授权（官方不支持 OAuth 端点的 CORS 预检），因此这里采用令牌方式。
 */

const API = 'https://api.github.com'
export const ACCOUNT_KEY = 'fossildle.account.v1'
export const GIST_FILE = 'fossildle-collection.json'
export const GIST_DESCRIPTION = 'Fossildle 藏馆存档（由 Fossildle 自动写入，请勿手动编辑）'
export const TOKEN_CREATE_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Fossildle%20%E4%BA%91%E5%90%8C%E6%AD%A5'

export interface Account {
  provider: 'github'
  login: string
  avatarUrl: string
  gistId: string
  savedAt: string
  token: string
  /** 是否参与每日排行（默认开启）：上榜会公开 GitHub 名字与头像。 */
  rankOptIn: boolean
}

interface UserPayload { login: string; avatar_url: string }
interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface GistPayload { id: string; description?: string | null; files?: Record<string, GistFile> }

function errorFor(status: number): string {
  if (status === 401) return '访问令牌无效或已过期，请重新生成后重试。'
  if (status === 403) return 'GitHub 拒绝了这次请求：令牌可能缺少 gist 权限，或暂时触发了频率限制。'
  if (status === 404) return '找不到云端存档：Gist 可能已被删除，或令牌无权访问它。'
  if (status === 422) return 'GitHub 不接受这份存档内容，请稍后重试。'
  return `GitHub 接口返回 HTTP ${status}，请稍后再试。`
}

async function request<T>(token: string, path: string, init: { method?: string; body?: string } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body,
    })
  } catch {
    throw new Error('无法连接 GitHub 接口，请检查网络或浏览器扩展后重试。')
  }
  if (!response.ok) throw new Error(errorFor(response.status))
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export const serializeCollection = (collection: Collection): string => JSON.stringify(collection)

export function readAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Account
    if (!value || value.provider !== 'github' || typeof value.token !== 'string' || typeof value.login !== 'string' || typeof value.gistId !== 'string') return null
    return {
      provider: 'github',
      login: value.login,
      avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : '',
      gistId: value.gistId,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
      token: value.token,
      rankOptIn: value.rankOptIn !== false,
    }
  } catch { return null }
}

export function saveAccount(account: Account | null): void {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  else localStorage.removeItem(ACCOUNT_KEY)
}

async function findGistId(token: string): Promise<string | null> {
  const gists = await request<GistPayload[]>(token, '/gists?per_page=100')
  return gists.find(gist => gist.description === GIST_DESCRIPTION || (gist.files ? GIST_FILE in gist.files : false))?.id ?? null
}

export async function readRemote(token: string, gistId: string): Promise<Collection> {
  const gist = await request<GistPayload>(token, `/gists/${gistId}`)
  const file = gist.files?.[GIST_FILE]
  if (!file) throw new Error('云端 Gist 中缺少藏馆文件，已停止同步以免覆盖本地记录。')
  let content = file.content ?? ''
  if (file.truncated && file.raw_url) {
    try {
      const response = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' } })
      if (!response.ok) throw new Error(errorFor(response.status))
      content = await response.text()
    } catch (error) {
      throw new Error(error instanceof Error && error.message.startsWith('GitHub') ? error.message : '云端存档读取失败，请稍后重试。')
    }
  }
  try { return parseCollection(content) } catch { throw new Error('云端存档格式无法识别，已停止同步以免覆盖本地记录。') }
}

export async function writeRemote(token: string, gistId: string, collection: Collection): Promise<void> {
  await request<GistPayload>(token, `/gists/${gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: serializeCollection(collection) } } }) })
}

export async function deleteRemote(token: string, gistId: string): Promise<void> {
  await request<void>(token, `/gists/${gistId}`, { method: 'DELETE' })
}

export interface SignInResult {
  account: Account
  collection: Collection
  added: number
  overwritten: number
}

/** 登录：校验令牌 → 找到或创建私有 Gist → 云端与本地合并后回写，返回合并结果。 */
export async function signIn(token: string, local: Collection, now: Date = new Date()): Promise<SignInResult> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('请先填入访问令牌。')
  const user = await request<UserPayload>(trimmed, '/user')
  const base = { provider: 'github' as const, login: user.login, avatarUrl: user.avatar_url ?? '', savedAt: now.toISOString(), token: trimmed, rankOptIn: true }
  const existing = await findGistId(trimmed)
  if (!existing) {
    const created = await request<GistPayload>(trimmed, '/gists', {
      method: 'POST',
      body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, files: { [GIST_FILE]: { content: serializeCollection(local) } } }),
    })
    return { account: { ...base, gistId: created.id }, collection: local, added: 0, overwritten: 0 }
  }
  const remote = await readRemote(trimmed, existing)
  const merged = mergeCollections(local, remote)
  await writeRemote(trimmed, existing, merged.collection)
  return { account: { ...base, gistId: existing }, collection: merged.collection, added: merged.added, overwritten: merged.overwritten }
}
