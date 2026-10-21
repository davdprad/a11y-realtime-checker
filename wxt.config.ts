import { defineConfig } from 'wxt';

/**
 * Configuração do build (WXT + Vite).
 *
 * - `mode === 'test'` gera `.output/chrome-mv3-test`, idêntico ao build de
 *   produção exceto pelo Shadow DOM do overlay, que fica `open` para que os
 *   testes de UI (Playwright + axe) consigam inspecionar os cartões.
 * - O manifest declara apenas o mínimo de permissões (seção 3.6 do prompt).
 */
export default defineConfig({
  srcDir: 'src',
  outDir: '.output',
  manifestVersion: 3,
  browser: 'chrome',
  vite: (env) => ({
    define: {
      __A11Y_RT_TEST__: JSON.stringify(env.mode === 'test'),
    },
    oxc: {
      jsx: { runtime: 'automatic', importSource: 'preact' },
    },
    build: {
      // Builds determinísticos e legíveis facilitam a auditoria do código
      // distribuído (requisito de "nenhum código remoto").
      minify: env.mode === 'production',
      sourcemap: env.mode !== 'production',
    },
  }),
  manifest: {
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'pt_BR',
    // chrome.sidePanel.open (116) e Element.checkVisibility com
    // visibilityProperty/opacityProperty (121).
    minimum_chrome_version: '121',
    permissions: ['storage', 'sidePanel', 'scripting', 'activeTab'],
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
    optional_host_permissions: ['<all_urls>'],
    action: {
      default_title: '__MSG_actionTitle__',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+A' },
        description: '__MSG_cmdOpenPanel__',
      },
      'next-violation': {
        suggested_key: { default: 'Alt+Shift+N' },
        description: '__MSG_cmdNext__',
      },
      'prev-violation': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: '__MSG_cmdPrev__',
      },
      'toggle-overlay': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: '__MSG_cmdToggleOverlay__',
      },
    },
  },
});
