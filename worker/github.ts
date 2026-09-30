import { HttpError } from './http'

export interface GitHubUser { login: string }

/** 用玩家自己的 GitHub 令牌确认身份。服务端不保存令牌，只保存 GitHub 用户名。 */
export async function verifyToken(token: string): Promise<GitHubUser> {
  let response: Response
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fossildle-rank',
      },
    })
  } catch {
    throw new HttpError(503, '无法校验 GitHub 身份，请稍后再试。')
  }
  if (response.status === 401) throw new HttpError(401, 'GitHub 令牌无效或已过期，请在账号面板重新连接。')
  if (response.status === 403) throw new HttpError(429, 'GitHub 校验请求过于频繁，请稍后再试。')
  if (!response.ok) throw new HttpError(502, 'GitHub 身份校验失败，请稍后再试。')
  const payload = await response.json() as { login?: unknown }
  if (typeof payload.login !== 'string' || !payload.login) throw new HttpError(502, 'GitHub 身份校验失败，请稍后再试。')
  return { login: payload.login }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}
