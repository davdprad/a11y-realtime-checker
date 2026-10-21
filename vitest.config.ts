import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Testes unitários no Chromium real (Vitest em modo navegador): as regras
 * dependem de `getComputedStyle` e `getBoundingClientRect`, que o jsdom não
 * implementa com layout. A lógica pura (cor, BCP 47, viewport, geometria,
 * Registry) roda no mesmo ambiente.
 */
export default defineConfig({
  define: {
    __A11Y_RT_TEST__: 'false',
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1024, height: 768 },
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/rules/**/*.ts',
        'src/lib/**/*.ts',
        'src/core/registry.ts',
        'src/core/scheduler.ts',
        'src/core/instrumentation.ts',
      ],
      exclude: ['src/lib/*.generated.ts', 'src/lib/i18n.ts', 'src/lib/settings.ts'],
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/rules/**': { lines: 90 },
      },
    },
  },
});
