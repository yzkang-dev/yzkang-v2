// ==================== 颐智康养 — Playwright E2E 测试配置 ====================
//
// 使用方式：
//   npx playwright install chromium         # 安装浏览器
//   npx playwright test                     # 运行所有测试
//   npx playwright test --ui                # 交互式 UI 模式
//   npx playwright test --project=chromium  # 指定浏览器

import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174';

export default defineConfig({
  testDir: './tests/e2e',

  // 超时设置
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // 测试重试
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,

  // 报告
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',       // 第一次重试时收集 trace
    screenshot: 'only-on-failure',  // 失败时截图
    video: 'retain-on-failure',     // 失败时保留视频
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ['--disable-web-security'], // 本地开发环境
        },
      },
    },
    // 可选：移动端视口
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
  ],

  // 本地开发服务器 (可选)
  webServer: process.env.CI ? [] : [
    {
      command: 'node serve.cjs',
      cwd: './',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
