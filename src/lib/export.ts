/**
 * Exportação dos dados do estudo (seção 6):
 * - Ocorrências (Apêndice A): uma linha por par elemento × critério.
 * - Teste dinâmico (Apêndice B): evento, critério esperado, sinalizou, tempo.
 * - Desempenho: varredura inicial e reavaliações incrementais.
 */
import type { ExperimentData, Occurrence } from '../messaging/protocol';
import { percentiles } from '../core/instrumentation';

export interface ExportEnv {
  readonly extensionVersion: string;
  readonly browserVersion: string;
}

export const OCCURRENCE_COLUMNS = [
  'pagina_url',
  'criterio_wcag',
  'regra_id',
  'seletor_css',
  'resultado',
  'timestamp',
  'versao_extensao',
  'versao_navegador',
] as const;

export const DYNAMIC_COLUMNS = [
  'evento_id',
  'criterio_esperado',
  'sinalizou',
  'tempo_ate_sinalizacao_ms',
] as const;

export const PERFORMANCE_COLUMNS = [
  'tipo',
  'lote_id',
  'nos_avaliados',
  'regras_executadas',
  'duracao_ms',
  'tempo_total_ms',
  'fatias',
  'maior_fatia_ms',
  'mutacoes',
] as const;

export interface OccurrenceRow {
  readonly pagina_url: string;
  readonly criterio_wcag: string;
  readonly regra_id: string;
  readonly seletor_css: string;
  readonly resultado: string;
  readonly timestamp: string;
  readonly versao_extensao: string;
  readonly versao_navegador: string;
}

export interface DynamicRow {
  readonly evento_id: string;
  readonly criterio_esperado: string;
  readonly sinalizou: boolean;
  readonly tempo_ate_sinalizacao_ms: number | null;
}

const round = (v: number): number => Math.round(v * 1000) / 1000;

export function occurrenceRows(data: ExperimentData, env: ExportEnv): OccurrenceRow[] {
  return [...data.occurrences].sort(compareOccurrences).map((o) => ({
    pagina_url: data.pageUrl,
    criterio_wcag: o.wcag,
    regra_id: o.rules.map((r) => r.ruleId).join('|'),
    seletor_css: o.selector,
    resultado: o.outcome,
    timestamp: new Date(o.firstSeen).toISOString(),
    versao_extensao: env.extensionVersion,
    versao_navegador: env.browserVersion,
  }));
}

function compareOccurrences(a: Occurrence, b: Occurrence): number {
  return (
    a.wcag.localeCompare(b.wcag, 'en', { numeric: true }) ||
    a.selector.localeCompare(b.selector) ||
    a.id.localeCompare(b.id)
  );
}

export function dynamicRows(data: ExperimentData): DynamicRow[] {
  return data.dynamicEvents.map((e) => ({
    evento_id: e.eventId,
    criterio_esperado: e.expected ?? '',
    sinalizou: e.flagged,
    tempo_ate_sinalizacao_ms: e.timeToFlagMs === undefined ? null : round(e.timeToFlagMs),
  }));
}

export interface PerformanceSummary {
  readonly varredura_inicial_ms: number | null;
  readonly varredura_inicial_ativa_ms: number | null;
  readonly nos_varredura_inicial: number | null;
  readonly reavaliacoes: {
    readonly lote_id: number;
    readonly duracao_ms: number;
    readonly tempo_total_ms: number;
    readonly nos_avaliados: number;
    readonly regras_executadas: number;
    readonly mutacoes: number;
  }[];
  readonly estatisticas_reavaliacao_ms: {
    readonly p50: number;
    readonly p95: number;
    readonly max: number;
    readonly n: number;
  };
}

export function performanceSummary(data: ExperimentData): PerformanceSummary {
  const incr = data.batches.filter((b) => b.kind === 'incremental');
  const stats = percentiles(incr.map((b) => b.durationMs));
  return {
    varredura_inicial_ms: data.initialScan ? round(data.initialScan.wallMs) : null,
    varredura_inicial_ativa_ms: data.initialScan
      ? round(data.initialScan.activeMs)
      : null,
    nos_varredura_inicial: data.initialScan?.nodesEvaluated ?? null,
    reavaliacoes: incr.map((b) => ({
      lote_id: b.batchId,
      duracao_ms: round(b.durationMs),
      tempo_total_ms: round(b.wallMs),
      nos_avaliados: b.nodesEvaluated,
      regras_executadas: b.rulesRun,
      mutacoes: b.mutations,
    })),
    estatisticas_reavaliacao_ms: {
      p50: round(stats.p50),
      p95: round(stats.p95),
      max: round(stats.max),
      n: stats.n,
    },
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Escapa um campo CSV (RFC 4180) e neutraliza fórmulas de planilha. */
export function csvField(value: unknown): string {
  let s: string;
  switch (typeof value) {
    case 'string':
      s = value;
      break;
    case 'number':
    case 'boolean':
    case 'bigint':
      s = String(value);
      break;
    case 'undefined':
      return '';
    default:
      if (value === null) return '';
      s = JSON.stringify(value);
  }
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends object>(
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvField(row[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function occurrencesCsv(data: ExperimentData, env: ExportEnv): string {
  return toCsv<OccurrenceRow>([...OCCURRENCE_COLUMNS], occurrenceRows(data, env));
}

export function dynamicCsv(data: ExperimentData): string {
  return toCsv<DynamicRow>([...DYNAMIC_COLUMNS], dynamicRows(data));
}

interface PerfRow {
  tipo: string;
  lote_id: number | string;
  nos_avaliados: number;
  regras_executadas: number;
  duracao_ms: number;
  tempo_total_ms: number;
  fatias: number;
  maior_fatia_ms: number;
  mutacoes: number;
}

export function performanceCsv(data: ExperimentData): string {
  const rows: PerfRow[] = data.batches.map((b) => ({
    tipo: b.kind === 'initial' ? 'varredura_inicial' : 'reavaliacao',
    lote_id: b.batchId,
    nos_avaliados: b.nodesEvaluated,
    regras_executadas: b.rulesRun,
    duracao_ms: round(b.durationMs),
    tempo_total_ms: round(b.wallMs),
    fatias: b.slices,
    maior_fatia_ms: round(b.maxSliceMs),
    mutacoes: b.mutations,
  }));
  return toCsv<PerfRow>([...PERFORMANCE_COLUMNS], rows);
}

/** JSON completo (ocorrências, teste dinâmico, desempenho e log bruto). */
export function experimentJson(data: ExperimentData, env: ExportEnv): string {
  return JSON.stringify(
    {
      formato: 'a11y-rt/1',
      sessao: data.sessionId,
      pagina_url: data.pageUrl,
      iniciado_em: new Date(data.startedAt).toISOString(),
      versao_extensao: env.extensionVersion,
      versao_navegador: env.browserVersion,
      ocorrencias: occurrenceRows(data, env),
      teste_dinamico: dynamicRows(data),
      desempenho: performanceSummary(data),
      detalhes: {
        ocorrencias: data.occurrences,
        log: data.log,
        lotes: data.batches,
        eventos_dinamicos: data.dynamicEvents,
      },
    },
    null,
    2,
  );
}

/** Versão do navegador a partir do user agent (fallback quando não há UA-CH). */
export function browserVersionFromUA(ua: string): string {
  // Edge e Opera também anunciam "Chrome/": a marca específica tem prioridade.
  const brands: readonly (readonly [RegExp, string])[] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chromium\/([\d.]+)/, 'Chromium'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
  ];
  for (const [re, name] of brands) {
    const v = re.exec(ua)?.[1];
    if (v) return `${name} ${v}`;
  }
  return 'desconhecida';
}
