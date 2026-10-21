/**
 * Desempenho (seção 7.4). Metas de referência:
 * - mediana da reavaliação incremental < 16 ms;
 * - nenhuma tarefa longa (> 50 ms) causada pela extensão na varredura inicial;
 * - nenhum loop de auto-observação.
 * Reporta p50, p95 e máximo em reports/perf-report.{json,md}.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { percentiles } from '../../src/core/instrumentation';
import type { BatchRecord, DebugState } from '../../src/messaging/protocol';
import {
  BASE_URL,
  debugState,
  expect,
  tabIdOf,
  test,
  waitForIdle,
} from '../e2e-support/extension';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const LONGTASK_RECORDER = `
window.__longTasks = [];
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push({ start: e.startTime, duration: e.duration });
  }).observe({ type: 'longtask', buffered: true });
} catch {}
`;

interface Report {
  page: string;
  elements: number;
  /** Todos os nós (elementos, texto, comentários), como no documento de requisitos. */
  nodes: number;
  initialScan: DebugState['instrumentation']['initialScan'];
  longTasksDuringScan: { start: number; duration: number }[];
  incremental: ReturnType<typeof percentiles>;
  incrementalMaxSliceMs: number;
  batches: number;
  occurrences: number;
}

/** Um arquivo por teste: workers reiniciados após falhas não perdem resultados. */
const CASES_DIR = resolve(root, 'test-results/perf-cases');
function record(r: Report): void {
  mkdirSync(CASES_DIR, { recursive: true });
  writeFileSync(resolve(CASES_DIR, `${r.page}.json`), JSON.stringify(r));
}
function allReports(): Report[] {
  if (!existsSync(CASES_DIR)) return [];
  return readdirSync(CASES_DIR).map(
    (f) => JSON.parse(readFileSync(resolve(CASES_DIR, f), 'utf8')) as Report,
  );
}

function countNodes(): number {
  const w = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
  let n = 0;
  while (w.nextNode()) n++;
  return n;
}

function stats(batches: readonly BatchRecord[]): ReturnType<typeof percentiles> {
  return percentiles(
    batches.filter((b) => b.kind === 'incremental').map((b) => b.durationMs),
  );
}

test.afterAll(() => {
  const reports = allReports();
  if (reports.length === 0) return;
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(
    resolve(root, 'reports/perf-report.json'),
    `${JSON.stringify(reports, null, 2)}\n`,
  );
  const f = (n: number | undefined): string => (n === undefined ? '—' : n.toFixed(2));
  const md = [
    '# Relatório de desempenho',
    '',
    '| Página | Nós | Elementos | Varredura inicial (ms, total) | CPU ativa (ms) | Maior fatia (ms) | Tarefas longas na varredura | Reavaliações (n) | p50 (ms) | p95 (ms) | máx. (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...reports.map(
      (r) =>
        `| ${r.page} | ${r.nodes} | ${r.elements} | ${f(r.initialScan?.wallMs)} | ${f(r.initialScan?.activeMs)} | ${f(r.initialScan?.maxSliceMs)} | ${r.longTasksDuringScan.length} | ${r.incremental.n} | ${f(r.incremental.p50)} | ${f(r.incremental.p95)} | ${f(r.incremental.max)} |`,
    ),
    '',
  ].join('\n');
  writeFileSync(resolve(root, 'reports/perf-report.md'), md);
  console.log(md);
});

for (const name of ['large-dom-5k', 'large-dom-20k']) {
  test(`${name}: varredura inicial fatiada e reavaliações incrementais`, async ({
    ext,
  }) => {
    const page = await ext.context.newPage();
    await page.addInitScript(LONGTASK_RECORDER);
    await page.goto(`${BASE_URL}/fixtures/${name}.html`);
    const tabId = await tabIdOf(ext, page);
    const state = await waitForIdle(ext, tabId, { timeoutMs: 120_000 });
    const scan = state?.instrumentation.initialScan ?? null;
    expect(scan).not.toBeNull();
    const elements = await page.evaluate(() => document.getElementsByTagName('*').length);
    const nodes = await page.evaluate(countNodes);

    // Reavaliações incrementais típicas: texto, classe, inserção e remoção.
    for (let i = 0; i < 30; i++) {
      await page.evaluate((k) => {
        const cards = document.querySelectorAll('article.card');
        const card = cards[(k * 37) % cards.length];
        if (!card) return;
        switch (k % 4) {
          case 0: {
            const small = card.querySelector('small');
            if (small) small.textContent = `atualizado ${k}`;
            break;
          }
          case 1:
            card.classList.toggle('destaque');
            break;
          case 2: {
            const p = document.createElement('p');
            p.innerHTML = `Novo <a href="#n${k}">link ${k}</a>`;
            card.append(p);
            break;
          }
          default:
            card.querySelector('footer')?.remove();
        }
      }, i);
      await sleep(220);
    }
    const after = await waitForIdle(ext, tabId);
    const batches = after?.instrumentation.batches ?? [];
    const longTasks = await page.evaluate(
      () =>
        (window as unknown as { __longTasks: { start: number; duration: number }[] })
          .__longTasks,
    );
    const during = scan
      ? longTasks.filter(
          (t) =>
            t.start + t.duration >= scan.startedAt &&
            t.start <= scan.startedAt + scan.wallMs,
        )
      : [];
    const incr = batches.filter((b) => b.kind === 'incremental');
    const report: Report = {
      page: name,
      elements,
      nodes,
      initialScan: scan,
      longTasksDuringScan: during,
      incremental: stats(batches),
      incrementalMaxSliceMs: Math.max(0, ...incr.map((b) => b.maxSliceMs)),
      batches: batches.length,
      occurrences: after?.occurrences.length ?? 0,
    };
    record(report);

    // Nenhuma fatia da extensão chega a 50 ms (sem tarefas longas causadas por ela).
    expect(scan?.maxSliceMs ?? Infinity).toBeLessThan(50);
    expect(report.incrementalMaxSliceMs).toBeLessThan(50);
    expect(report.incremental.p50).toBeLessThan(16);
    await page.close();
  });
}

test('mutações frequentes (lista que cresce e contador a cada 100 ms)', async ({
  ext,
}) => {
  const page = await ext.context.newPage();
  await page.goto(`${BASE_URL}/fixtures/mutations.html`);
  const tabId = await tabIdOf(ext, page);
  await waitForIdle(ext, tabId);
  await page.evaluate(() => {
    (window as unknown as { a11yRtMutations: { start(): void } }).a11yRtMutations.start();
  });
  await sleep(6000);
  await page.evaluate(() => {
    (window as unknown as { a11yRtMutations: { stop(): void } }).a11yRtMutations.stop();
  });
  const state = await waitForIdle(ext, tabId);
  const batches = state?.instrumentation.batches ?? [];
  const s = stats(batches);
  const items = await page.evaluate(() =>
    (
      window as unknown as { a11yRtMutations: { count(): number } }
    ).a11yRtMutations.count(),
  );
  record({
    page: 'mutations',
    elements: await page.evaluate(() => document.getElementsByTagName('*').length),
    nodes: await page.evaluate(countNodes),
    initialScan: state?.instrumentation.initialScan ?? null,
    longTasksDuringScan: [],
    incremental: s,
    incrementalMaxSliceMs: Math.max(0, ...batches.map((b) => b.maxSliceMs)),
    batches: batches.length,
    occurrences: state?.occurrences.length ?? 0,
  });
  // Com debounce de 150 ms e espera máxima de 300 ms, 6 s de mutações contínuas
  // geram reavaliações periódicas (não uma por mutação, nem nenhuma).
  expect(s.n).toBeGreaterThan(10);
  expect(s.n).toBeLessThan(80);
  expect(s.p50).toBeLessThan(16);
  // Todas as imagens sem alt inseridas foram sinalizadas.
  const imgs =
    state?.occurrences.filter((o) => o.wcag === '1.1.1' && o.outcome === 'violation')
      .length ?? 0;
  expect(imgs).toBe(Math.floor(items / 10));
  // Depois que a página para de mudar, nenhum lote novo (sem auto-observação).
  const n = state?.batches ?? 0;
  await sleep(1500);
  expect((await debugState(ext, tabId))?.batches).toBe(n);
  await page.close();
});
