import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.FOSSILDLE_TEST_PORT ?? 4173)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 30000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    // 端到端构建指向测试用的排行服务地址，测试里用 page.route 拦截 https://rank.test/**。
    command: 'VITE_FOSSILDLE_API=https://rank.test npm run build && node scripts/serve-pages.mjs',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30000,
  },
})
