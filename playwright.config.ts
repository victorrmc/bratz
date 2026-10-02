import { defineConfig } from '@playwright/test'

// E2E en Chromium con WebGL por software (SwiftShader).
const BASE = process.env.E2E_URL ?? 'http://localhost:4173/bratz/'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: BASE,
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
    acceptDownloads: true,
  },
  projects: [
    { name: 'iphone-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false } },
    { name: 'android-412', use: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: false } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173/bratz/',
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
