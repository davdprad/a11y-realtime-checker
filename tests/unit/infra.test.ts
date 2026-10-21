import { describe, expect, it, vi } from 'vitest';
import {
  DYNAMIC_EVENT_TIMEOUT_MS,
  Instrumentation,
  percentiles,
} from '../../src/core/instrumentation';
import { Debouncer, yieldToMain } from '../../src/core/scheduler';
import {
  browserVersionFromUA,
  csvField,
  dynamicCsv,
  experimentJson,
  occurrencesCsv,
  performanceCsv,
  performanceSummary,
} from '../../src/lib/export';
import {
  looksGenerated,
  pathSelector,
  resolveSelector,
  uniqueSelector,
} from '../../src/lib/selector';
import type {
  BatchRecord,
  ExperimentData,
  Occurrence,
} from '../../src/messaging/protocol';
import {
  isBackgroundToContent,
  isContentToPanel,
  isDebugRequest,
  isPanelToBackground,
  isPanelToContent,
  parseMutateDetail,
} from '../../src/messaging/protocol';
import { mount, q } from './helpers';

describe('Debouncer (debounce com espera máxima)', () => {
  it('agrupa disparos e respeita a espera máxima', () => {
    vi.useFakeTimers();
    let now = 0;
    const fn = vi.fn();
    const d = new Debouncer(fn, 150, 300, () => now);
    for (let t = 0; t < 600; t += 100) {
      now = t;
      d.trigger();
      vi.advanceTimersByTime(100);
    }
    // Disparos a cada 100 ms nunca deixam 150 ms de silêncio: a espera máxima força execuções.
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(d.pending || fn.mock.calls.length >= 2).toBe(true);
    d.cancel();
    expect(d.pending).toBe(false);
    vi.useRealTimers();
  });

  it('dispara uma vez após silêncio', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = new Debouncer(fn, 150, 1000);
    d.trigger();
    d.trigger();
    vi.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    d.trigger();
    d.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('yieldToMain cede o thread', async () => {
    let flag = false;
    setTimeout(() => (flag = true), 0);
    await yieldToMain();
    await new Promise((r) => setTimeout(r, 1));
    expect(flag).toBe(true);
  });
});

const occ = (
  id: string,
  wcag: string,
  outcome: Occurrence['outcome'] = 'violation',
): Occurrence => ({
  id,
  wcag,
  level: 'A',
  outcome,
  rules: [{ ruleId: 'button-name', outcome, messageKey: 'button_name' }],
  selector: id === 'x' ? '=cmd()' : 'button.fechar',
  snippet: '<button>',
  tag: 'button',
  pageLevel: false,
  firstSeen: Date.UTC(2026, 0, 2, 3, 4, 5),
  updatedAt: 0,
  frameId: 0,
  frameUrl: 'http://localhost/',
});

const batch = (
  batchId: number,
  kind: BatchRecord['kind'],
  durationMs: number,
): BatchRecord => ({
  batchId,
  kind,
  nodesEvaluated: 10,
  rulesRun: 170,
  durationMs,
  wallMs: durationMs + 1,
  slices: 1,
  maxSliceMs: durationMs,
  mutations: 2,
  startedAt: 0,
});

describe('Instrumentação', () => {
  it('registra varredura inicial e reavaliações', () => {
    const i = new Instrumentation();
    i.recordBatch(batch(1, 'initial', 40));
    i.recordBatch(batch(2, 'incremental', 2));
    expect(i.initialScan?.activeMs).toBe(40);
    expect(i.batches).toHaveLength(2);
  });

  it('tempo até a sinalização: evento → delta → pintura', () => {
    const i = new Instrumentation();
    i.onMutateEvent({ eventId: 'E1', t: 100, expected: '4.1.2' }, 100);
    i.onDelta({ added: [occ('a', '1.1.1')], updated: [], removed: [] }, 150);
    expect(i.hasUnpaintedMatches).toBe(false);
    i.onDelta({ added: [occ('b', '4.1.2')], updated: [], removed: [] }, 260);
    expect(i.hasUnpaintedMatches).toBe(true);
    i.markPainted(275);
    const [ev] = i.dynamicEvents();
    expect(ev).toMatchObject({
      eventId: 'E1',
      flagged: true,
      timeToFlagMs: 175,
      occurrenceId: 'b',
    });
  });

  it('eventos de correção medem a remoção', () => {
    const i = new Instrumentation();
    i.onMutateEvent({ eventId: 'F1', t: 0, expected: '1.1.1', kind: 'fix' }, 0);
    i.onDelta({ added: [], updated: [], removed: ['0:3:1.1.1'] }, 10);
    i.markPainted(20);
    expect(i.dynamicEvents()[0]).toMatchObject({
      kind: 'fix',
      flagged: true,
      timeToFlagMs: 20,
    });
  });

  it('eventos expirados não são associados', () => {
    const i = new Instrumentation();
    i.onMutateEvent({ eventId: 'E9', t: 0 }, 0);
    i.onDelta(
      { added: [occ('b', '4.1.2')], updated: [], removed: [] },
      DYNAMIC_EVENT_TIMEOUT_MS + 1,
    );
    i.markPainted(DYNAMIC_EVENT_TIMEOUT_MS + 2);
    expect(i.dynamicEvents()[0]?.flagged).toBe(false);
  });

  it('log de ocorrências só no modo experimento', () => {
    const i = new Instrumentation();
    i.onDelta({ added: [occ('a', '1.1.1')], updated: [], removed: [] }, 1);
    expect(i.log).toHaveLength(0);
    i.setLogEnabled(true);
    i.onDelta(
      { added: [occ('a', '1.1.1')], updated: [occ('a', '1.1.1')], removed: ['a'] },
      2,
    );
    expect(i.log.map((e) => e.change)).toEqual(['added', 'updated', 'removed']);
  });

  it('percentis', () => {
    expect(percentiles([])).toEqual({ p50: 0, p95: 0, max: 0, n: 0 });
    const p = percentiles([5, 1, 3, 2, 4, 100]);
    expect(p.p50).toBe(3);
    expect(p.max).toBe(100);
    expect(p.p95).toBe(100);
  });
});

describe('Exportação (Apêndices A e B)', () => {
  const data: ExperimentData = {
    sessionId: 's1',
    pageUrl: 'http://localhost:3000/',
    startedAt: 0,
    extensionVersion: '0.1.0',
    userAgent: 'x',
    occurrences: [occ('b', '4.1.2'), occ('a', '1.1.1', 'incomplete'), occ('x', '1.4.3')],
    log: [],
    initialScan: {
      startedAt: 0,
      wallMs: 50.12345,
      activeMs: 30,
      nodesEvaluated: 100,
      slices: 4,
      maxSliceMs: 9,
    },
    batches: [
      batch(1, 'initial', 30),
      batch(2, 'incremental', 2),
      batch(3, 'incremental', 4),
    ],
    dynamicEvents: [
      {
        eventId: 'E1',
        expected: '4.1.2',
        kind: 'flag',
        t: 0,
        flagged: true,
        flaggedAt: 12.3456,
        timeToFlagMs: 12.3456,
      },
      { eventId: 'E2', kind: 'flag', t: 0, flagged: false },
    ],
  };
  const env = { extensionVersion: '0.1.0', browserVersion: 'Chrome 140.0.0.0' };

  it('CSV de ocorrências com as colunas do Apêndice A', () => {
    const csv = occurrencesCsv(data, env);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'pagina_url,criterio_wcag,regra_id,seletor_css,resultado,timestamp,versao_extensao,versao_navegador',
    );
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(
      'http://localhost:3000/,1.1.1,button-name,button.fechar,incomplete,2026-01-02T03:04:05.000Z,0.1.0,Chrome 140.0.0.0',
    );
    expect(lines[2]).toContain("'=cmd()"); // fórmula de planilha neutralizada
  });

  it('CSV do teste dinâmico (Apêndice B)', () => {
    expect(dynamicCsv(data)).toBe(
      'evento_id,criterio_esperado,sinalizou,tempo_ate_sinalizacao_ms\r\nE1,4.1.2,true,12.346\r\nE2,,false,\r\n',
    );
  });

  it('desempenho: varredura inicial e estatísticas das reavaliações', () => {
    const s = performanceSummary(data);
    expect(s.varredura_inicial_ms).toBe(50.123);
    expect(s.reavaliacoes).toHaveLength(2);
    expect(s.estatisticas_reavaliacao_ms).toMatchObject({ p50: 2, max: 4, n: 2 });
    expect(performanceCsv(data).split('\r\n')[1]).toMatch(/^varredura_inicial,1,/);
  });

  it('JSON completo', () => {
    const j = JSON.parse(experimentJson(data, env)) as Record<string, unknown>;
    expect(j.formato).toBe('a11y-rt/1');
    expect(Array.isArray(j.ocorrencias)).toBe(true);
    expect(Array.isArray(j.teste_dinamico)).toBe(true);
  });

  it('escape de campos CSV', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField(null)).toBe('');
    expect(csvField(3)).toBe('3');
    expect(csvField('+1')).toBe("'+1");
  });

  it('versão do navegador pelo user agent', () => {
    expect(browserVersionFromUA('Mozilla/5.0 Chrome/140.0.1.2 Safari/537.36')).toBe(
      'Chrome 140.0.1.2',
    );
    expect(browserVersionFromUA('Mozilla/5.0 Chrome/140 Safari Edg/140.1')).toBe(
      'Edge 140.1',
    );
    expect(browserVersionFromUA('curl')).toBe('desconhecida');
  });
});

describe('Seletor CSS', () => {
  it('evita classes geradas e produz seletor único', () => {
    const root = mount(
      '<ul class="lista"><li class="css-1x2y3z item">a</li><li class="css-9a8b7c item">b</li></ul>',
    );
    const second = root.querySelectorAll('li')[1];
    if (!second) throw new Error('fixture');
    const sel = uniqueSelector(second);
    expect(sel).not.toContain('css-');
    expect(document.querySelectorAll(sel)).toHaveLength(1);
    expect(resolveSelector(document, sel)).toBe(second);
  });

  it('heurística de nomes gerados', () => {
    expect(looksGenerated('css-1x2y3z')).toBe(true);
    expect(looksGenerated('sc-bdVaJa')).toBe(true);
    expect(looksGenerated('_3xY9a')).toBe(true);
    expect(looksGenerated('md:flex')).toBe(true);
    expect(looksGenerated('a1b2c3d4')).toBe(true);
    expect(looksGenerated('btn-primary')).toBe(false);
    expect(looksGenerated('h2')).toBe(false);
  });

  it('caminho :nth-of-type e shadow DOM com ">>>"', () => {
    const root = mount('<div id="host"></div><section><p>1</p><p>2</p></section>');
    const p2 = root.querySelectorAll('p')[1];
    if (!p2) throw new Error('fixture');
    expect(pathSelector(p2)).toMatch(/p:nth-of-type\(2\)$/);
    const host = q(root, '#host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span></span><button id="dentro">x</button>';
    const inner = shadow.querySelector('button');
    if (!inner) throw new Error('fixture');
    const sel = uniqueSelector(inner);
    expect(sel).toBe('#host >>> #dentro');
    expect(resolveSelector(document, sel)).toBe(inner);
    expect(uniqueSelector(document.documentElement)).toBe('html');
  });
});

describe('Validação de mensagens', () => {
  it('aceita mensagens bem formadas e rejeita as demais', () => {
    expect(isPanelToContent({ type: 'panel:focus', id: '0:1:1.1.1' })).toBe(true);
    expect(isPanelToContent({ type: 'panel:focus', id: 1 })).toBe(false);
    expect(isPanelToContent({ type: 'panel:set-overlay', visible: true })).toBe(true);
    expect(isPanelToContent({ type: 'panel:export', requestId: 1 })).toBe(true);
    expect(isPanelToContent({ type: 'x' })).toBe(false);
    expect(isPanelToContent(null)).toBe(false);
    expect(isContentToPanel({ type: 'delta', delta: { added: [], removed: [] } })).toBe(
      true,
    );
    expect(isContentToPanel({ type: 'snapshot', state: { occurrences: [] } })).toBe(true);
    expect(isContentToPanel({ type: 'status', scanning: false })).toBe(true);
    expect(isContentToPanel({ type: 'export', requestId: 1, data: {} })).toBe(true);
    expect(isContentToPanel({ type: 'nope' })).toBe(false);
    expect(isBackgroundToContent({ type: 'command', command: 'next-violation' })).toBe(
      true,
    );
    expect(isBackgroundToContent({ type: 'command', command: 'rm -rf' })).toBe(false);
    expect(
      isBackgroundToContent({
        type: 'frame:relay',
        frameId: 3,
        payload: { kind: 'gone' },
      }),
    ).toBe(true);
    expect(
      isBackgroundToContent({
        type: 'frame:command',
        payload: { kind: 'focus', localId: 'a' },
      }),
    ).toBe(true);
    expect(isBackgroundToContent({ type: 'origin:changed' })).toBe(true);
    expect(
      isPanelToBackground({ type: 'origin:enable', tabId: 1, origin: 'https://a' }),
    ).toBe(true);
    expect(
      isPanelToBackground({ type: 'origin:enable', tabId: '1', origin: 'https://a' }),
    ).toBe(false);
    expect(isDebugRequest({ type: 'debug:focus', id: 'x' })).toBe(true);
    expect(isDebugRequest({ type: 'debug:other' })).toBe(false);
  });

  it('detail do evento a11y-rt:mutate é uma string JSON validada', () => {
    expect(
      parseMutateDetail(JSON.stringify({ eventId: 'E1', t: 12.5, expected: '1.1.1' })),
    ).toEqual({
      eventId: 'E1',
      t: 12.5,
      expected: '1.1.1',
    });
    expect(
      parseMutateDetail(JSON.stringify({ eventId: 'F1', t: 1, kind: 'fix' }))?.kind,
    ).toBe('fix');
    expect(parseMutateDetail({ eventId: 'E1', t: 1 })).toBeNull();
    expect(parseMutateDetail('{')).toBeNull();
    expect(parseMutateDetail(JSON.stringify({ eventId: 'E1' }))).toBeNull();
    expect(parseMutateDetail('x'.repeat(3000))).toBeNull();
  });
});
