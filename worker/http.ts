export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * 跨域放行规则：白名单里的来源 + 任意本机地址；白名单写 `*` 时对任何来源回显（本项目只靠
 * Authorization 头鉴权、不使用 cookie，因此放开来源不会引入 CSRF 风险，方便在手机/局域网调试验收）。
 */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin) return {}
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (!local && !allowed.includes(origin) && !allowed.includes('*')) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, content-type, accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
  } catch { return {} }
}
