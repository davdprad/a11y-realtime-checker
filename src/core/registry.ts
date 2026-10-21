/**
 * Registry: registro único das ocorrências da aba (fonte da verdade).
 *
 * - Lookup: `WeakMap<Element, Map<RuleId, RuleResult>>` com os resultados
 *   reportáveis (violation/incomplete/recommendation); `pass` e
 *   `inapplicable` não são guardados.
 * - Exibição/exportação: `Map<id, Occurrence>` serializável, uma entrada por
 *   par (elemento, critério) — a unidade de contagem do estudo.
 * - `commit()` devolve o delta (added/updated/removed) desde o último commit.
 */
import { elementSnippet } from '../lib/dom';
import type { Delta, Occurrence, OccurrenceRule } from '../messaging/protocol';
import type { ReportedOutcome, RuleResult } from '../rules/types';

const SEVERITY: Record<ReportedOutcome, number> = {
  violation: 3,
  incomplete: 2,
  recommendation: 1,
};

export function isReported(outcome: string): outcome is ReportedOutcome {
  return (
    outcome === 'violation' || outcome === 'incomplete' || outcome === 'recommendation'
  );
}

export function worstOutcome(
  outcomes: Iterable<ReportedOutcome>,
): ReportedOutcome | null {
  let worst: ReportedOutcome | null = null;
  for (const o of outcomes) if (!worst || SEVERITY[o] > SEVERITY[worst]) worst = o;
  return worst;
}

export interface RegistryOptions {
  readonly selectorOf: (el: Element) => string;
  readonly now?: () => number;
  readonly frameId?: number;
  readonly frameUrl?: () => string;
  /** Regras de documento (marcam a ocorrência como `pageLevel`). */
  readonly documentRuleIds?: ReadonlySet<string>;
}

export class Registry {
  private readonly results = new WeakMap<Element, Map<string, RuleResult>>();
  private readonly elementIds = new WeakMap<Element, number>();
  private nextElementId = 1;
  /** Elementos com ao menos um resultado guardado (referência forte, limpa ao desconectar). */
  private readonly flagged = new Set<Element>();
  private readonly occurrences = new Map<string, Occurrence>();
  private readonly occurrenceElement = new Map<string, Element>();
  private readonly elementOccurrences = new Map<Element, Set<string>>();
  private readonly dirty = new Set<Element>();
  private readonly byRule = new Map<string, Set<Element>>();
  private readonly now: () => number;

  constructor(private readonly opts: RegistryOptions) {
    this.now = opts.now ?? (() => Date.now());
  }

  elementId(el: Element): number {
    let id = this.elementIds.get(el);
    if (id === undefined) {
      id = this.nextElementId++;
      this.elementIds.set(el, id);
    }
    return id;
  }

  /** Grava (ou remove, quando o resultado não é reportável) o resultado de uma regra. */
  set(el: Element, ruleId: string, result: RuleResult | null): void {
    const keep = result !== null && isReported(result.outcome) ? result : null;
    let map = this.results.get(el);
    const prev = map?.get(ruleId);
    if (!keep) {
      if (!prev || !map) return;
      map.delete(ruleId);
      this.byRule.get(ruleId)?.delete(el);
      if (map.size === 0) {
        this.results.delete(el);
        this.flagged.delete(el);
      }
      this.dirty.add(el);
      return;
    }
    if (prev && sameResult(prev, keep)) return;
    if (!map) {
      map = new Map();
      this.results.set(el, map);
    }
    map.set(ruleId, keep);
    this.flagged.add(el);
    let set = this.byRule.get(ruleId);
    if (!set) {
      set = new Set();
      this.byRule.set(ruleId, set);
    }
    set.add(el);
    this.dirty.add(el);
  }

  get(el: Element, ruleId: string): RuleResult | undefined {
    return this.results.get(el)?.get(ruleId);
  }

  /** Elementos com resultado guardado para a regra (para reavaliações globais). */
  elementsForRule(ruleId: string): Element[] {
    return [...(this.byRule.get(ruleId) ?? [])];
  }

  /** Substitui todos os resultados de uma regra de documento pelo novo conjunto. */
  replaceRuleResults(ruleId: string, results: readonly RuleResult[]): void {
    const next = new Map<Element, RuleResult>();
    for (const r of results) next.set(r.element, r);
    for (const el of this.elementsForRule(ruleId)) {
      if (!next.has(el)) this.set(el, ruleId, null);
    }
    for (const [el, r] of next) this.set(el, ruleId, r);
  }

  /** Remove resultados de elementos desconectados do documento. */
  dropDisconnected(): number {
    let n = 0;
    for (const el of [...this.flagged]) {
      if (el.isConnected) continue;
      const map = this.results.get(el);
      if (map) for (const ruleId of [...map.keys()]) this.set(el, ruleId, null);
      n++;
    }
    return n;
  }

  /** Remove todos os resultados (ao desativar a verificação). */
  clearAll(): void {
    for (const el of [...this.flagged]) {
      const map = this.results.get(el);
      if (map) for (const ruleId of [...map.keys()]) this.set(el, ruleId, null);
    }
  }

  get hasPendingChanges(): boolean {
    return this.dirty.size > 0;
  }

  /** Recalcula as ocorrências dos elementos alterados e devolve o delta. */
  commit(): Delta {
    const added: Occurrence[] = [];
    const updated: Occurrence[] = [];
    const removed: string[] = [];
    const now = this.now();
    for (const el of this.dirty) {
      const map = this.results.get(el);
      const byWcag = new Map<string, RuleResult[]>();
      for (const r of map?.values() ?? []) {
        const list = byWcag.get(r.wcag);
        if (list) list.push(r);
        else byWcag.set(r.wcag, [r]);
      }
      const elId = this.elementId(el);
      const prevIds = this.elementOccurrences.get(el) ?? new Set<string>();
      const nextIds = new Set<string>();
      for (const [wcag, list] of byWcag) {
        const id = `${this.opts.frameId ?? 0}:${elId}:${wcag}`;
        nextIds.add(id);
        const prev = this.occurrences.get(id);
        const occ = this.buildOccurrence(id, el, wcag, list, prev, now);
        if (!prev) {
          added.push(occ);
        } else if (!sameOccurrence(prev, occ)) {
          updated.push(occ);
        } else {
          continue;
        }
        this.occurrences.set(id, occ);
        this.occurrenceElement.set(id, el);
      }
      for (const id of prevIds) {
        if (nextIds.has(id)) continue;
        this.occurrences.delete(id);
        this.occurrenceElement.delete(id);
        removed.push(id);
      }
      if (nextIds.size > 0) this.elementOccurrences.set(el, nextIds);
      else this.elementOccurrences.delete(el);
    }
    this.dirty.clear();
    return { added, updated, removed };
  }

  private buildOccurrence(
    id: string,
    el: Element,
    wcag: string,
    list: RuleResult[],
    prev: Occurrence | undefined,
    now: number,
  ): Occurrence {
    const sorted = [...list].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    const rules: OccurrenceRule[] = sorted.map((r) => ({
      ruleId: r.ruleId,
      outcome: r.outcome as ReportedOutcome,
      messageKey: r.messageKey,
      ...(r.data ? { data: r.data } : {}),
    }));
    const outcome = worstOutcome(rules.map((r) => r.outcome)) ?? 'incomplete';
    const first = sorted[0];
    return {
      id,
      wcag,
      level: first?.level ?? 'A',
      outcome,
      rules,
      selector: prev?.selector ?? this.opts.selectorOf(el),
      snippet: prev?.snippet ?? elementSnippet(el),
      tag: el.localName,
      pageLevel: sorted.some((r) => this.opts.documentRuleIds?.has(r.ruleId) === true),
      firstSeen: prev?.firstSeen ?? now,
      updatedAt: now,
      frameId: this.opts.frameId ?? 0,
      frameUrl: prev?.frameUrl ?? this.opts.frameUrl?.() ?? '',
    };
  }

  snapshot(): Occurrence[] {
    return [...this.occurrences.values()];
  }

  occurrence(id: string): Occurrence | undefined {
    return this.occurrences.get(id);
  }

  elementFor(id: string): Element | undefined {
    return this.occurrenceElement.get(id);
  }

  occurrenceIdsFor(el: Element): string[] {
    return [...(this.elementOccurrences.get(el) ?? [])];
  }

  /** Elementos com ocorrência ativa (para o overlay). */
  occurrenceElements(): Element[] {
    return [...this.elementOccurrences.keys()];
  }

  get size(): number {
    return this.occurrences.size;
  }

  countByOutcome(outcome: ReportedOutcome): number {
    let n = 0;
    for (const o of this.occurrences.values()) if (o.outcome === outcome) n++;
    return n;
  }
}

function sameData(a: RuleResult['data'], b: RuleResult['data']): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function sameResult(a: RuleResult, b: RuleResult): boolean {
  return (
    a.outcome === b.outcome && a.messageKey === b.messageKey && sameData(a.data, b.data)
  );
}

function sameOccurrence(a: Occurrence, b: Occurrence): boolean {
  if (a.outcome !== b.outcome || a.rules.length !== b.rules.length) return false;
  return a.rules.every((r, i) => {
    const o = b.rules[i];
    return (
      o?.ruleId === r.ruleId &&
      o.outcome === r.outcome &&
      o.messageKey === r.messageKey &&
      sameData(o.data, r.data)
    );
  });
}

/** Aplica um delta a um mapa de ocorrências (usado pelo painel e pelo agregador). */
export function applyDelta(target: Map<string, Occurrence>, delta: Delta): void {
  for (const id of delta.removed) target.delete(id);
  for (const o of delta.added) target.set(o.id, o);
  for (const o of delta.updated) target.set(o.id, o);
}

/** Delta entre dois conjuntos de ocorrências (ex.: snapshot novo vs. anterior). */
export function diffOccurrences(
  prev: ReadonlyMap<string, Occurrence>,
  next: readonly Occurrence[],
): Delta {
  const added: Occurrence[] = [];
  const updated: Occurrence[] = [];
  const seen = new Set<string>();
  for (const o of next) {
    seen.add(o.id);
    const p = prev.get(o.id);
    if (!p) added.push(o);
    else if (!sameOccurrence(p, o)) updated.push(o);
  }
  const removed = [...prev.keys()].filter((id) => !seen.has(id));
  return { added, updated, removed };
}
