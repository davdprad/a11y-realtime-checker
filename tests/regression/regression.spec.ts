/**
 * Regressão (seção 7.6):
 * - a extensão não altera o DOM da página (só anexa o próprio host do overlay);
 * - desativar a verificação na origem remove o overlay e desconecta os observers;
 * - não há loop de auto-observação; iframes de mesma origem e shadow DOM aberto
 *   são avaliados.
 */
import {
  BASE_URL,
  debugState,
  expect,
  tabIdOf,
  test,
  waitForIdle,
  type ExtensionHandle,
} from '../e2e-support/extension';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Registra (no mundo da página) toda mutação ocorrida após o DOMContentLoaded. */
const RECORDER = `
(() => {
  const records = [];
  window.__a11yRtRecords = records;
  document.addEventListener('DOMContentLoaded', () => {
    window.__a11yRtBodyAtDCL = document.body ? document.body.outerHTML : '';
    const describe = (n) => n.nodeType === 1 ? n.localName + (n.id ? '#' + n.id : '') : '#' + n.nodeName;
    const mo = new MutationObserver((list) => {
      for (const r of list) {
        records.push({
          type: r.type,
          target: describe(r.target),
          attr: r.attributeName,
          added: [...r.addedNodes].map(describe),
          removed: [...r.removedNodes].map(describe),
        });
      }
    });
    mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const host = document.getElementById('host');
    if (host && host.shadowRoot) mo.observe(host.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
  });
})();
`;

interface Rec {
  type: string;
  target: string;
  attr: string | null;
  added: string[];
  removed: string[];
}

async function setOriginDisabled(
  ext: ExtensionHandle,
  origin: string,
  disabled: boolean,
): Promise<void> {
  await ext.controller.evaluate(
    async ([o, d]) => {
      await chrome.storage.local.set({ disabledOrigins: d ? [o] : [] });
    },
    [origin, disabled] as const,
  );
}

test.describe('DOM intacto e ciclo de vida', () => {
  test('a extensão só anexa o próprio host; corpo, atributos e shadow DOM ficam intactos', async ({
    ext,
  }) => {
    const page = await ext.context.newPage();
    await page.addInitScript(RECORDER);
    await page.goto(`${BASE_URL}/fixtures/regression.html`);
    const tabId = await tabIdOf(ext, page);
    const state = await waitForIdle(ext, tabId);
    expect(state?.occurrences.length ?? 0).toBeGreaterThan(5);
    await sleep(300);

    const { records, bodyBefore, bodyAfter, frameRecords } = await page.evaluate(() => {
      const w = window as unknown as {
        __a11yRtRecords: Rec[];
        __a11yRtBodyAtDCL: string;
      };
      const frame = document.getElementById('frame') as HTMLIFrameElement | null;
      const fw = frame?.contentWindow as unknown as { __a11yRtRecords?: Rec[] } | null;
      return {
        records: w.__a11yRtRecords,
        bodyBefore: w.__a11yRtBodyAtDCL,
        bodyAfter: document.body.outerHTML,
        frameRecords: fw?.__a11yRtRecords ?? [],
      };
    });
    // Únicas mutações permitidas: anexar o host do overlay ao <html> e mudanças no próprio host.
    const foreign = [...records, ...frameRecords].filter(
      (r) =>
        !(
          r.type === 'childList' &&
          r.target === 'html' &&
          r.added.every((a) => a === 'a11y-rt-overlay') &&
          r.removed.length === 0
        ) && r.target !== 'a11y-rt-overlay',
    );
    expect(foreign).toEqual([]);
    expect(bodyAfter).toBe(bodyBefore);
    expect(
      await page.evaluate(() => document.querySelectorAll('a11y-rt-overlay').length),
    ).toBe(1);
    await page.close();
  });

  test('avalia iframe de mesma origem e shadow DOM aberto', async ({ ext }) => {
    const page = await ext.context.newPage();
    await page.goto(`${BASE_URL}/fixtures/regression.html`);
    const tabId = await tabIdOf(ext, page);
    await page.waitForFunction(() => {
      const f = document.getElementById('frame') as HTMLIFrameElement | null;
      return f?.contentDocument?.readyState === 'complete';
    });
    let state = await waitForIdle(ext, tabId);
    for (
      let i = 0;
      i < 40 && !(state?.occurrences.some((o) => o.frameId !== 0) ?? false);
      i++
    ) {
      await sleep(100);
      state = await waitForIdle(ext, tabId);
    }
    const inFrame = state?.occurrences.filter((o) => o.frameId !== 0) ?? [];
    expect(inFrame.map((o) => `${o.wcag} ${o.selector}`).sort()).toEqual(
      expect.arrayContaining(['1.1.1 #img-frame', '4.1.2 #btn-frame']),
    );
    const inShadow = state?.occurrences.filter((o) => o.selector.includes('>>>')) ?? [];
    expect(inShadow.map((o) => o.wcag).sort()).toEqual(
      expect.arrayContaining(['1.4.3', '4.1.2']),
    );
    // Critérios esperados na página principal.
    const crit = new Set(
      state?.occurrences.filter((o) => o.outcome === 'violation').map((o) => o.wcag),
    );
    for (const c of ['1.1.1', '1.3.1', '1.4.3', '1.4.4', '2.4.4', '2.5.8', '4.1.2'])
      expect(crit.has(c), c).toBe(true);
    expect(
      state?.occurrences.some(
        (o) => o.outcome === 'recommendation' && o.wcag === '1.3.1',
      ),
    ).toBe(true);
    await page.close();
  });

  test('sem loop de auto-observação: página estática não gera novos lotes', async ({
    ext,
  }) => {
    const page = await ext.context.newPage();
    await page.goto(`${BASE_URL}/fixtures/regression.html`);
    const tabId = await tabIdOf(ext, page);
    const first = await waitForIdle(ext, tabId);
    // Interações com o overlay (abrir/fechar cartão) escrevem só no host.
    await ext.controller.evaluate(async (id) => {
      await chrome.tabs.sendMessage(
        id,
        { type: 'command', command: 'next-violation' },
        { frameId: 0 },
      );
    }, tabId);
    await sleep(300);
    await page.keyboard.press('Escape');
    await sleep(2000);
    const later = await debugState(ext, tabId);
    expect(later?.batches).toBe(first?.batches);
    await page.close();
  });

  test('desativar na origem remove o overlay e desconecta os observers; reativar volta a verificar', async ({
    ext,
  }) => {
    const page = await ext.context.newPage();
    await page.goto(`${BASE_URL}/fixtures/regression.html`);
    const tabId = await tabIdOf(ext, page);
    await waitForIdle(ext, tabId);
    expect(
      await page.evaluate(() => document.querySelector('a11y-rt-overlay') !== null),
    ).toBe(true);

    const origin = new URL(BASE_URL).origin;
    await setOriginDisabled(ext, origin, true);
    await expect
      .poll(() => page.evaluate(() => document.querySelector('a11y-rt-overlay') === null))
      .toBe(true);
    const off = await debugState(ext, tabId);
    expect(off?.enabled).toBe(false);
    expect(off?.occurrences).toEqual([]);

    // Mutação com violação enquanto desativado: nada é avaliado.
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      document.body.append(img);
    });
    await sleep(600);
    const still = await debugState(ext, tabId);
    expect(still?.occurrences).toEqual([]);
    expect(still?.batches).toBe(0);

    await setOriginDisabled(ext, origin, false);
    const back = await waitForIdle(ext, tabId);
    expect(back?.enabled).toBe(true);
    expect(
      back?.occurrences.filter((o) => o.wcag === '1.1.1').length,
    ).toBeGreaterThanOrEqual(2);
    await page.close();
  });
});
