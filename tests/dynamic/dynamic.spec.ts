/**
 * Detecção dinâmica (seção 7.3, roteiro do Apêndice B).
 *
 * Para cada evento E1–E5, a página altera o DOM via JavaScript (sem recarregar)
 * e o teste verifica que a violação esperada aparece no Registry sem nenhuma
 * ação manual, com o tempo até a sinalização medido pela própria extensão.
 * O caso inverso (correção) deve remover a ocorrência.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dynamicCsv } from '../../src/lib/export';
import type {
  DebugState,
  DynamicEventRecord,
  Occurrence,
} from '../../src/messaging/protocol';
import {
  BASE_URL,
  debugState,
  expect,
  tabIdOf,
  test,
  waitForIdle,
  type ExtensionHandle,
} from '../e2e-support/extension';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const EVENTS = [
  {
    id: 'E1',
    wcag: '4.1.2',
    selector: '#fechar',
    description: 'modal com botão de fechar sem nome acessível',
  },
  {
    id: 'E2',
    wcag: '1.4.3',
    selector: '#texto-card',
    description: 'tema reduz o contraste do texto',
  },
  {
    id: 'E3',
    wcag: '1.1.1',
    selector: '#grafico',
    description: 'imagem informativa sem texto alternativo',
  },
  { id: 'E4', wcag: '2.4.4', selector: '#link-carrinho', description: 'link sem texto' },
  {
    id: 'E5',
    wcag: '1.3.1',
    selector: '#email',
    description: 'rótulo removido do campo',
  },
] as const;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  ext: ExtensionHandle,
  tabId: number,
  predicate: (s: DebugState) => boolean,
  timeoutMs = 5000,
): Promise<DebugState> {
  const start = Date.now();
  for (;;) {
    const s = await debugState(ext, tabId);
    if (s && predicate(s)) return s;
    if (Date.now() - start > timeoutMs) {
      const summary = s && {
        occ: s.occurrences.map((o) => `${o.outcome} ${o.wcag} ${o.selector}`),
        events: s.instrumentation.dynamicEvents,
      };
      throw new Error(`condição não atingida no prazo: ${JSON.stringify(summary)}`);
    }
    await sleep(20);
  }
}

const violationsOf = (s: DebugState, wcag: string): Occurrence[] =>
  s.occurrences.filter((o) => o.wcag === wcag && o.outcome === 'violation');

test('E1–E5 são sinalizados sem nova execução manual e as correções removem as ocorrências', async ({
  ext,
}) => {
  const page = await ext.context.newPage();
  await page.goto(`${BASE_URL}/fixtures/dynamic.html`);
  const tabId = await tabIdOf(ext, page);
  const initial = await waitForIdle(ext, tabId);
  expect(initial, 'content script ativo').not.toBeNull();
  const initialViolations =
    initial?.occurrences.filter((o) => o.outcome === 'violation') ?? [];
  expect(initialViolations, 'a página começa sem violações').toEqual([]);

  for (const ev of EVENTS) {
    await page.evaluate((id) => {
      (
        window as unknown as { a11yRtDynamic: { run(id: string): void } }
      ).a11yRtDynamic.run(id);
    }, ev.id);
    const s = await waitFor(ext, tabId, (st) =>
      st.instrumentation.dynamicEvents.some((d) => d.eventId === ev.id && d.flagged),
    );
    const found = violationsOf(s, ev.wcag);
    expect(found.length, `${ev.id}: violação ${ev.wcag} presente`).toBeGreaterThan(0);
    const selectors = found.map((o) => o.selector).join(' | ');
    expect(selectors, `${ev.id}: elemento sinalizado`).toContain(
      ev.selector.replace('#', ''),
    );
  }

  for (const ev of EVENTS) {
    await page.evaluate((id) => {
      (
        window as unknown as { a11yRtDynamic: { fix(id: string): void } }
      ).a11yRtDynamic.fix(id);
    }, ev.id);
    await waitFor(ext, tabId, (st) => violationsOf(st, ev.wcag).length === 0);
  }

  const final = await waitForIdle(ext, tabId);
  expect(final?.occurrences.filter((o) => o.outcome === 'violation')).toEqual([]);

  const events: readonly DynamicEventRecord[] =
    final?.instrumentation.dynamicEvents ?? [];
  const flags = events.filter((e) => e.kind === 'flag');
  const fixes = events.filter((e) => e.kind === 'fix');
  expect(flags.map((e) => e.eventId)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5']);
  expect(flags.every((e) => e.flagged)).toBe(true);
  expect(fixes.every((e) => e.flagged)).toBe(true);
  for (const e of [...flags, ...fixes]) {
    expect(e.timeToFlagMs ?? -1).toBeGreaterThan(0);
    expect(e.timeToFlagMs ?? Infinity).toBeLessThan(2000);
  }

  // Relatório no formato do Apêndice B.
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  if (final) {
    writeFileSync(
      resolve(root, 'reports/dynamic-apendice-b.csv'),
      dynamicCsv(final.instrumentation),
    );
    writeFileSync(
      resolve(root, 'reports/dynamic-report.json'),
      `${JSON.stringify({ eventos: EVENTS, resultados: events }, null, 2)}\n`,
    );
  }
  console.log(
    events
      .map(
        (e) =>
          `${e.eventId} (${e.kind}, ${e.expected ?? '-'}): ${e.flagged ? `${(e.timeToFlagMs ?? 0).toFixed(1)} ms` : 'não sinalizou'}`,
      )
      .join('\n'),
  );
  await page.close();
});
