import { defineConfig } from '@playwright/test';

// 설치된 Google Chrome(channel: chrome)으로 실행한다. 별도 브라우저 다운로드가 필요 없다.
export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    actionTimeout: 15_000,
    baseURL: 'http://127.0.0.1:4174',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
