/**
 * Tipos das mensagens trocadas entre content script, service worker e side
 * panel (uniões discriminadas por `type`) e validação na entrada.
 */
import type { Level, ReportedOutcome, ResultData } from '../rules/types';

// ---------------------------------------------------------------------------
// Ocorrências (unidade de contagem: elemento × critério)
// ---------------------------------------------------------------------------

export interface OccurrenceRule {
  readonly ruleId: string;
  readonly outcome: ReportedOutcome;
  readonly messageKey: string;
  readonly data?: ResultData;
}

export interface Occurrence {
  /** `${frameId}:${elementId}:${wcag}` após agregação no frame de topo. */
  readonly id: string;
  readonly wcag: string;
  readonly level: Level;
  /** Pior resultado entre as regras do critério (violation > incomplete > recommendation). */
  readonly outcome: ReportedOutcome;
  readonly rules: readonly OccurrenceRule[];
  readonly selector: string;
  readonly snippet: string;
  readonly tag: string;
  /** Ocorrência de documento (título, idioma, viewport). */
  readonly pageLevel: boolean;
  /** Primeira detecção (epoch ms). */
  readonly firstSeen: number;
  readonly updatedAt: number;
  readonly frameId: number;
  readonly frameUrl: string;
}

export interface Delta {
  readonly added: readonly Occurrence[];
  readonly updated: readonly Occurrence[];
  readonly removed: readonly string[];
}

export const EMPTY_DELTA: Delta = { added: [], updated: [], removed: [] };

export function isEmptyDelta(d: Delta): boolean {
  return d.added.length === 0 && d.updated.length === 0 && d.removed.length === 0;
}

// ---------------------------------------------------------------------------
// Instrumentação e exportação
// ---------------------------------------------------------------------------

export interface BatchRecord {
  readonly batchId: number;
  readonly kind: 'initial' | 'incremental';
  readonly nodesEvaluated: number;
  readonly rulesRun: number;
  /** Tempo ativo de CPU no thread principal (soma das fatias). */
  readonly durationMs: number;
  /** Do início da primeira fatia ao fim da última (inclui cessões do thread). */
  readonly wallMs: number;
  readonly slices: number;
  readonly maxSliceMs: number;
  readonly mutations: number;
  readonly startedAt: number;
}

export interface InitialScanRecord {
  readonly startedAt: number;
  readonly wallMs: number;
  readonly activeMs: number;
  readonly nodesEvaluated: number;
  readonly slices: number;
  readonly maxSliceMs: number;
}

export interface DynamicEventRecord {
  readonly eventId: string;
  readonly expected?: string;
  readonly kind: 'flag' | 'fix';
  /** `performance.now()` informado pela página no evento `a11y-rt:mutate`. */
  readonly t: number;
  readonly flagged: boolean;
  readonly flaggedAt?: number;
  readonly timeToFlagMs?: number;
  readonly occurrenceId?: string;
}

export interface OccurrenceLogEntry {
  readonly at: number;
  readonly change: 'added' | 'updated' | 'removed';
  readonly id: string;
  readonly occurrence?: Occurrence;
}

export interface ExperimentData {
  readonly sessionId: string;
  readonly pageUrl: string;
  readonly startedAt: number;
  readonly extensionVersion: string;
  readonly userAgent: string;
  readonly occurrences: readonly Occurrence[];
  readonly log: readonly OccurrenceLogEntry[];
  readonly initialScan: InitialScanRecord | null;
  readonly batches: readonly BatchRecord[];
  readonly dynamicEvents: readonly DynamicEventRecord[];
}

// ---------------------------------------------------------------------------
// Estado da aba enviado ao side panel
// ---------------------------------------------------------------------------

export interface TabState {
  readonly origin: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly scanning: boolean;
  readonly overlayVisible: boolean;
  readonly experimentMode: boolean;
  readonly occurrences: readonly Occurrence[];
}

// ---------------------------------------------------------------------------
// Side panel ⇄ content script (Port por aba, frame de topo)
// ---------------------------------------------------------------------------

export const PANEL_PORT_NAME = 'a11y-rt-panel';

export type PanelToContent =
  | { type: 'panel:hello' }
  | { type: 'panel:focus'; id: string }
  | { type: 'panel:set-overlay'; visible: boolean }
  | { type: 'panel:export'; requestId: number }
  | { type: 'panel:rescan' };

export type ContentToPanel =
  | { type: 'snapshot'; state: TabState }
  | { type: 'delta'; delta: Delta; scanning: boolean }
  | {
      type: 'status';
      scanning: boolean;
      overlayVisible: boolean;
      experimentMode: boolean;
      enabled: boolean;
    }
  | { type: 'export'; requestId: number; data: ExperimentData };

// ---------------------------------------------------------------------------
// Content script ⇄ service worker (runtime.sendMessage)
// ---------------------------------------------------------------------------

export type ContentToBackground =
  | { type: 'badge'; count: number }
  /** Frame filho → frame de topo (o service worker roteia). */
  | { type: 'frame:report'; payload: FramePayload }
  /** Frame de topo → frame filho (ação vinda do painel). */
  | { type: 'frame:forward'; frameId: number; payload: FrameCommand };

export type FramePayload =
  | { kind: 'snapshot'; occurrences: readonly Occurrence[]; idle: boolean; url: string }
  | { kind: 'delta'; delta: Delta; idle: boolean }
  | { kind: 'gone' };

export interface FrameCommand {
  kind: 'focus';
  localId: string;
}

export type BackgroundToContent =
  | { type: 'command'; command: CommandName }
  | { type: 'frame:relay'; frameId: number; payload: FramePayload }
  | { type: 'frame:command'; payload: FrameCommand }
  | { type: 'origin:changed' };

export type CommandName = 'next-violation' | 'prev-violation' | 'toggle-overlay';

// Mensagens de diagnóstico (só do próprio contexto da extensão; usadas pelos testes).
export type DebugRequest =
  | { type: 'debug:state' }
  | { type: 'debug:overlay' }
  | { type: 'debug:focus'; id: string };

export interface DebugState {
  readonly idle: boolean;
  readonly enabled: boolean;
  readonly batches: number;
  readonly framesPending: number;
  readonly occurrences: readonly Occurrence[];
  readonly instrumentation: ExperimentData;
}

export interface DebugOverlayState {
  readonly visible: boolean;
  readonly outlines: number;
  readonly cardOpen: boolean;
  readonly cardOccurrenceIds: readonly string[];
  readonly focusInCard: boolean;
  readonly activeElementTag: string;
}

// ---------------------------------------------------------------------------
// Side panel → service worker
// ---------------------------------------------------------------------------

export type PanelToBackground =
  | { type: 'origin:enable'; tabId: number; origin: string }
  | { type: 'origin:disable'; tabId: number; origin: string };

// ---------------------------------------------------------------------------
// Validação de entrada
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isPanelToContent(v: unknown): v is PanelToContent {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'panel:hello':
    case 'panel:rescan':
      return true;
    case 'panel:focus':
      return typeof v.id === 'string';
    case 'panel:set-overlay':
      return typeof v.visible === 'boolean';
    case 'panel:export':
      return typeof v.requestId === 'number';
    default:
      return false;
  }
}

export function isContentToPanel(v: unknown): v is ContentToPanel {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'snapshot':
      return isRecord(v.state) && Array.isArray(v.state.occurrences);
    case 'delta':
      return (
        isRecord(v.delta) &&
        Array.isArray(v.delta.added) &&
        Array.isArray(v.delta.removed)
      );
    case 'status':
      return typeof v.scanning === 'boolean';
    case 'export':
      return typeof v.requestId === 'number' && isRecord(v.data);
    default:
      return false;
  }
}

const COMMANDS: readonly string[] = [
  'next-violation',
  'prev-violation',
  'toggle-overlay',
];

export function isCommandName(v: unknown): v is CommandName {
  return typeof v === 'string' && COMMANDS.includes(v);
}

export function isBackgroundToContent(v: unknown): v is BackgroundToContent {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'command':
      return isCommandName(v.command);
    case 'frame:relay':
      return (
        typeof v.frameId === 'number' &&
        isRecord(v.payload) &&
        typeof v.payload.kind === 'string'
      );
    case 'frame:command':
      return (
        isRecord(v.payload) &&
        v.payload.kind === 'focus' &&
        typeof v.payload.localId === 'string'
      );
    case 'origin:changed':
      return true;
    default:
      return false;
  }
}

export function isContentToBackground(v: unknown): v is ContentToBackground {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'badge':
      return typeof v.count === 'number';
    case 'frame:report':
      return isRecord(v.payload) && typeof v.payload.kind === 'string';
    case 'frame:forward':
      return typeof v.frameId === 'number' && isRecord(v.payload);
    default:
      return false;
  }
}

export function isPanelToBackground(v: unknown): v is PanelToBackground {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  return (
    (v.type === 'origin:enable' || v.type === 'origin:disable') &&
    typeof v.tabId === 'number' &&
    typeof v.origin === 'string'
  );
}

export function isDebugRequest(v: unknown): v is DebugRequest {
  if (!isRecord(v) || typeof v.type !== 'string') return false;
  return (
    v.type === 'debug:state' ||
    v.type === 'debug:overlay' ||
    (v.type === 'debug:focus' && typeof v.id === 'string')
  );
}

/** Evento da página de teste dinâmico: `detail` é uma string JSON. */
export interface MutateEventDetail {
  readonly eventId: string;
  readonly t: number;
  readonly expected?: string;
  readonly kind?: 'flag' | 'fix';
}

export function parseMutateDetail(detail: unknown): MutateEventDetail | null {
  if (typeof detail !== 'string' || detail.length > 2000) return null;
  let v: unknown;
  try {
    v = JSON.parse(detail);
  } catch {
    return null;
  }
  if (!isRecord(v) || typeof v.eventId !== 'string' || typeof v.t !== 'number')
    return null;
  if (!Number.isFinite(v.t)) return null;
  const out: { eventId: string; t: number; expected?: string; kind?: 'flag' | 'fix' } = {
    eventId: v.eventId.slice(0, 100),
    t: v.t,
  };
  if (typeof v.expected === 'string') out.expected = v.expected.slice(0, 20);
  if (v.kind === 'fix' || v.kind === 'flag') out.kind = v.kind;
  return out;
}
