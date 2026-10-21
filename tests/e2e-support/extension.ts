/**
 * Suporte aos testes Playwright: Chromium com a extensão carregada
 * (`launchPersistentContext` + `--load-extension`), bloqueio de rede externa e
 * acesso ao estado do content script pelas mensagens de diagnóstico.
 */
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DebugOverlayState, DebugState } from '../../src/messaging/protocol';

export const PORT = 4173;
export const BASE_URL = `http://localhost:${PORT}`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type BuildKind = 'prod' | 'test';

export interface ExtensionHandle {
  readonly context: BrowserContext;
  readonly extensionId: string;
  /** Página da extensão usada para chamar APIs `chrome.*` (sobrevive ao SW efêmero). */
  readonly controller: Page;
  close(): Promise<void>;
}

export async function launchWithExtension(
  build: BuildKind = 'prod',
): Promise<ExtensionHandle> {
  const extPath = resolve(
    root,
    build === 'prod' ? '.output/chrome-mv3' : '.output/chrome-mv3-test',
  );
  const userDataDir = mkdtempSync(join(tmpdir(), 'a11y-rt-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: process.env.HEADED !== '1',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  });
  // Nenhuma requisição sai da máquina durante os testes.
  await context.route(
    (url) =>
      /^https?:$/.test(url.protocol) &&
      !['localhost', '127.0.0.1'].includes(url.hostname),
    (route) => route.abort(),
  );
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(sw.url()).host;
  const controller = await context.newPage();
  await controller.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=-1`);
  return {
    context,
    extensionId,
    controller,
    async close() {
      await context.close();
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        /* Windows pode manter arquivos presos por alguns instantes */
      }
    },
  };
}

/** Id da aba (chrome.tabs) correspondente a uma página do Playwright. */
export async function tabIdOf(ext: ExtensionHandle, page: Page): Promise<number> {
  const url = page.url();
  const id = await ext.controller.evaluate(async (u) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url === u)?.id ?? -1;
  }, url);
  if (id < 0) throw new Error(`aba não encontrada para ${url}`);
  return id;
}

export async function sendToTab<T>(
  ext: ExtensionHandle,
  tabId: number,
  message: unknown,
): Promise<T | null> {
  return ext.controller.evaluate(
    async ([id, msg]) => {
      try {
        return (await chrome.tabs.sendMessage(id, msg, { frameId: 0 })) as unknown;
      } catch {
        return null;
      }
    },
    [tabId, message] as const,
  ) as Promise<T | null>;
}

export function debugState(
  ext: ExtensionHandle,
  tabId: number,
): Promise<DebugState | null> {
  return sendToTab<DebugState>(ext, tabId, { type: 'debug:state' });
}

export function overlayState(
  ext: ExtensionHandle,
  tabId: number,
): Promise<DebugOverlayState | null> {
  return sendToTab<DebugOverlayState>(ext, tabId, { type: 'debug:overlay' });
}

export async function sendCommand(
  ext: ExtensionHandle,
  tabId: number,
  command: string,
): Promise<void> {
  await sendToTab(ext, tabId, { type: 'command', command });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Espera o sinal de "idle" da extensão (varredura e reavaliações concluídas,
 * frames filhos inclusive), estável por duas leituras seguidas.
 * Devolve `null` se não houver content script na página.
 */
export async function waitForIdle(
  ext: ExtensionHandle,
  tabId: number,
  opts: { timeoutMs?: number; stableMs?: number; noScriptGiveUpMs?: number } = {},
): Promise<DebugState | null> {
  const timeout = opts.timeoutMs ?? 20_000;
  const stableMs = opts.stableMs ?? 250;
  const giveUp = opts.noScriptGiveUpMs ?? 3_000;
  const start = Date.now();
  let lastBatches = -1;
  let stableSince = 0;
  for (;;) {
    const s = await debugState(ext, tabId);
    const elapsed = Date.now() - start;
    if (!s) {
      if (elapsed > giveUp) return null;
    } else if (s.idle && s.framesPending === 0) {
      if (s.batches === lastBatches) {
        if (Date.now() - stableSince >= stableMs) return s;
      } else {
        lastBatches = s.batches;
        stableSince = Date.now();
      }
    } else {
      lastBatches = -1;
    }
    if (elapsed > timeout)
      throw new Error(
        `timeout esperando idle (${JSON.stringify(s && { idle: s.idle, framesPending: s.framesPending })})`,
      );
    await sleep(50);
  }
}

/** Fixture com um contexto por worker (reaproveitado entre testes). */
export const test = base.extend<object, { ext: ExtensionHandle }>({
  ext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const ext = await launchWithExtension('prod');
      await use(ext);
      await ext.close();
    },
    { scope: 'worker' },
  ],
});

export const testWithTestBuild = base.extend<object, { ext: ExtensionHandle }>({
  ext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const ext = await launchWithExtension('test');
      await use(ext);
      await ext.close();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
