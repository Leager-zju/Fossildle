// Worker 入口只保留默认导出：具名导出会被运行时当成 handler 映射，逻辑放在 app.ts 里。
import { createApp, purge } from './app'
import { d1Store } from './store'
import type { Env } from './types'

export default {
  fetch: (request: Request, env: Env) => createApp({
    store: d1Store(env.DB),
    secret: env.SERVER_SECRET,
    allowedOrigins: (env.ALLOWED_ORIGIN ?? '').split(',').map(value => value.trim()).filter(Boolean),
  })(request),
  async scheduled(_event: unknown, env: Env) {
    await purge(d1Store(env.DB))
  },
}
