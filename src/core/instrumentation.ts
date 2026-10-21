/**
 * Instrumentação do estudo: tempos da varredura inicial e das reavaliações,
 * tempo até a sinalização de eventos dinâmicos (`a11y-rt:mutate`) e log de
 * ocorrências. Tudo fica em memória; só é persistido/exportado no modo
 * experimento.
 */
import type {
  BatchRecord,
  Delta,
  DynamicEventRecord,
  InitialScanRecord,
  MutateEventDetail,
  Occurrence,
  OccurrenceLogEntry,
} from '../messaging/protocol';

const MAX_BATCHES = 20_000;
const MAX_LOG = 50_000;
/** Eventos dinâmicos sem sinalização após este prazo contam como "não sinalizou". */
export const DYNAMIC_EVENT_TIMEOUT_MS = 10_000;

interface PendingEvent {
  readonly detail: MutateEventDetail;
  readonly receivedAt: number;
  /** Ocorrência que satisfez o evento, aguardando a pintura do overlay. */
  matchedId?: string;
  flaggedAt?: number;
}

export class Instrumentation {
  initialScan: InitialScanRecord | null = null;
  readonly batches: BatchRecord[] = [];
  readonly log: OccurrenceLogEntry[] = [];
  private readonly events: PendingEvent[] = [];
  private logEnabled = false;

  setLogEnabled(enabled: boolean): void {
    this.logEnabled = enabled;
  }

  recordBatch(record: BatchRecord): void {
    if (record.kind === 'initial' && this.initialScan === null) {
      this.initialScan = {
        startedAt: record.startedAt,
        wallMs: record.wallMs,
        activeMs: record.durationMs,
        nodesEvaluated: record.nodesEvaluated,
        slices: record.slices,
        maxSliceMs: record.maxSliceMs,
      };
    }
    this.batches.push(record);
    if (this.batches.length > MAX_BATCHES)
      this.batches.splice(0, this.batches.length - MAX_BATCHES);
  }

  /** Evento `a11y-rt:mutate` emitido pela página imediatamente antes de alterar o DOM. */
  onMutateEvent(detail: MutateEventDetail, now: number): void {
    this.events.push({ detail, receivedAt: now });
  }

  /** Associa deltas aos eventos pendentes (a sinalização efetiva ocorre na pintura). */
  onDelta(delta: Delta, at: number): void {
    if (this.logEnabled) {
      for (const o of delta.added)
        this.pushLog({ at, change: 'added', id: o.id, occurrence: o });
      for (const o of delta.updated)
        this.pushLog({ at, change: 'updated', id: o.id, occurrence: o });
      for (const id of delta.removed) this.pushLog({ at, change: 'removed', id });
    }
    for (const ev of this.events) {
      if (ev.matchedId !== undefined) continue;
      if (at - ev.receivedAt > DYNAMIC_EVENT_TIMEOUT_MS) continue;
      const kind = ev.detail.kind ?? 'flag';
      if (kind === 'flag') {
        const hit = [...delta.added, ...delta.updated].find(
          (o) => o.outcome === 'violation' && matchesExpected(o, ev.detail.expected),
        );
        if (hit) ev.matchedId = hit.id;
      } else {
        const hit = delta.removed.find((id) => matchesExpectedId(id, ev.detail.expected));
        if (hit) ev.matchedId = hit;
      }
    }
  }

  /** Chamado no requestAnimationFrame que desenhou o overlay. */
  markPainted(now: number): void {
    for (const ev of this.events) {
      if (ev.matchedId !== undefined && ev.flaggedAt === undefined) ev.flaggedAt = now;
    }
  }

  get hasUnpaintedMatches(): boolean {
    return this.events.some(
      (e) => e.matchedId !== undefined && e.flaggedAt === undefined,
    );
  }

  dynamicEvents(): DynamicEventRecord[] {
    return this.events.map((ev) => {
      const flagged = ev.flaggedAt !== undefined;
      return {
        eventId: ev.detail.eventId,
        ...(ev.detail.expected !== undefined ? { expected: ev.detail.expected } : {}),
        kind: ev.detail.kind ?? 'flag',
        t: ev.detail.t,
        flagged,
        ...(flagged && ev.flaggedAt !== undefined
          ? { flaggedAt: ev.flaggedAt, timeToFlagMs: ev.flaggedAt - ev.detail.t }
          : {}),
        ...(ev.matchedId !== undefined ? { occurrenceId: ev.matchedId } : {}),
      };
    });
  }

  private pushLog(entry: OccurrenceLogEntry): void {
    this.log.push(entry);
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
  }
}

function matchesExpected(o: Occurrence, expected: string | undefined): boolean {
  return expected === undefined || o.wcag === expected;
}

function matchesExpectedId(id: string, expected: string | undefined): boolean {
  return expected === undefined || id.endsWith(`:${expected}`);
}

/** Estatísticas descritivas (p50, p95, máx.) usadas nos relatórios de desempenho. */
export function percentiles(values: readonly number[]): {
  p50: number;
  p95: number;
  max: number;
  n: number;
} {
  if (values.length === 0) return { p50: 0, p95: 0, max: 0, n: 0 };
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number): number =>
    s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? 0;
  return { p50: at(0.5), p95: at(0.95), max: s[s.length - 1] ?? 0, n: s.length };
}
