import { defineConfig } from '@playwright/test';

/**
 * Testes em navegador controlado (Chromium) com a extensão carregada via
 * `launchPersistentContext` (ver tests/e2e-support/extension.ts).
 *
 * Projetos: act (regras ACT do W3C), dynamic (Apêndice B), perf (desempenho),
 * ui (acessibilidade da própria extensão) e regression (DOM intacto).
 */
export const TEST_PORT = 4173;

export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  webServer: {
    command: `pnpm exec tsx scripts/serve.ts ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}/health`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'act', testMatch: /act\/.*\.spec\.ts/ },
    { name: 'dynamic', testMatch: /dynamic\/.*\.spec\.ts/ },
    { name: 'regression', testMatch: /regression\/.*\.spec\.ts/ },
    { name: 'ui', testMatch: /ui\/.*\.spec\.ts/ },
    { name: 'perf', testMatch: /perf\/.*\.spec\.ts/, timeout: 600_000 },
  ],
});
