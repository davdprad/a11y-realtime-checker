/**
 * Scanner: executa o motor de regras sobre filas de trabalho, fatiando o
 * processamento no tempo (cede o thread entre fatias) para não gerar tarefas
 * longas. Serve tanto à varredura completa inicial quanto às reavaliações
 * incrementais disparadas pelo observer.
 */
import { isOverlayNode, walkElements } from '../lib/dom';
import type { BatchRecord, Delta } from '../messaging/protocol';
import type { EvalContext, Rule } from '../rules/types';
import { createEvalContext } from './context';
import type { Registry } from './registry';
import { yieldToMain } from './scheduler';

export type WorkItem =
  | { readonly kind: 'subtree'; readonly root: Element }
  | { readonly kind: 'self'; readonly el: Element };

export interface WorkInfo {
  readonly kind: 'initial' | 'incremental';
  readonly mutations: number;
  readonly hadRemovals: boolean;
  /** Elementos removidos (raízes das subárvores), para os ganchos de reavaliação. */
  readonly removed: readonly Element[];
  /** Reavaliar regras de documento (título, idioma, viewport). */
  readonly documentDirty: boolean;
}

export interface ScannerOptions {
  readonly doc: Document;
  readonly isTopFrame: boolean;
  readonly registry: Registry;
  readonly elementRules: readonly Rule[];
  readonly documentRules: readonly Rule[];
  /** Orçamento de CPU por fatia (ms). */
  readonly sliceBudgetMs: number;
  readonly onShadowRoot: (root: ShadowRoot) => void;
  readonly shadowRoots: () => Iterable<ShadowRoot>;
  readonly onCommit: (delta: Delta) => void;
  readonly onRunComplete: (record: BatchRecord) => void;
  readonly onIdle: () => void;
}

export class Scanner {
  private queue: WorkItem[] = [];
  private pendingInfo: WorkInfo | null = null;
  private running = false;
  private stopped = false;
  private batchSeq = 0;
  private readonly warned = new Set<string>();

  constructor(private readonly opts: ScannerOptions) {}

  get idle(): boolean {
    return !this.running && this.queue.length === 0 && this.pendingInfo === null;
  }

  get batchCount(): number {
    return this.batchSeq;
  }

  enqueue(items: readonly WorkItem[], info: WorkInfo): void {
    if (this.stopped) return;
    this.queue.push(...items);
    const p = this.pendingInfo;
    this.pendingInfo = p
      ? {
          kind:
            p.kind === 'initial' || info.kind === 'initial' ? 'initial' : 'incremental',
          mutations: p.mutations + info.mutations,
          hadRemovals: p.hadRemovals || info.hadRemovals,
          removed: [...p.removed, ...info.removed].slice(0, 1000),
          documentDirty: p.documentDirty || info.documentDirty,
        }
      : { ...info };
    if (!this.running) void this.run();
  }

  /** Método (e não leitura direta) para o TS não estreitar o valor através do await. */
  private isStopped(): boolean {
    return this.stopped;
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.pendingInfo = null;
  }

  /** Itera elementos da fila (inclusive itens adicionados durante a execução). */
  private *iterate(seen: Set<Element>): Generator<Element> {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      if (item.kind === 'self') {
        const el = item.el;
        if (seen.has(el) || !el.isConnected || isOverlayNode(el)) continue;
        seen.add(el);
        yield el;
        continue;
      }
      if (!item.root.isConnected || isOverlayNode(item.root)) continue;
      for (const el of walkElements(item.root, {
        onShadowRoot: this.opts.onShadowRoot,
      })) {
        if (seen.has(el)) continue;
        seen.add(el);
        yield el;
      }
    }
  }

  private evaluateElement(
    el: Element,
    ctx: EvalContext,
    triggered: Map<string, Element[]>,
    rules: readonly Rule[],
  ): number {
    const reg = this.opts.registry;
    for (const rule of rules) {
      let result = null;
      try {
        if (rule.isApplicable(el, ctx)) result = rule.evaluate(el, ctx);
        if (rule.revalidate?.trigger(el, ctx)) {
          const list = triggered.get(rule.id);
          if (list) list.push(el);
          else triggered.set(rule.id, [el]);
        }
      } catch (err) {
        this.warnOnce(rule.id, err);
      }
      reg.set(el, rule.id, result);
    }
    return rules.length;
  }

  private warnOnce(ruleId: string, err: unknown): void {
    if (this.warned.has(ruleId)) return;
    this.warned.add(ruleId);
    console.warn(`[a11y-rt] erro na regra ${ruleId}:`, err);
  }

  /** Reavaliações globais e regras de documento (ao fim de uma execução). */
  private finishRun(
    ctx: EvalContext,
    seen: Set<Element>,
    triggered: Map<string, Element[]>,
    hadRemovals: boolean,
    removed: readonly Element[],
    documentDirty: boolean,
  ): { nodes: number; rules: number } {
    const reg = this.opts.registry;
    let nodes = 0;
    let rulesRun = 0;
    if (hadRemovals) reg.dropDisconnected();
    for (const rule of this.opts.elementRules) {
      const hook = rule.revalidate;
      if (!hook) continue;
      const changed = triggered.get(rule.id) ?? [];
      // Remoção só importa se a subárvore removida continha elementos da regra.
      const removedHit = removed.some(
        (n) => n.matches(hook.selector) || n.querySelector(hook.selector) !== null,
      );
      if (changed.length === 0 && !removedHit) continue;
      const targets = new Set(hook.targets(ctx, changed));
      // Resultados que dependem de outros elementos (violação/recomendação) são
      // reavaliados; "incomplete" não depende de vizinhos nem da ordem.
      for (const el of reg.elementsForRule(rule.id)) {
        const outcome = reg.get(el, rule.id)?.outcome;
        if (outcome === 'violation' || outcome === 'recommendation') targets.add(el);
      }
      for (const el of targets) {
        if (seen.has(el) || !el.isConnected) continue;
        nodes++;
        rulesRun += this.evaluateElement(el, ctx, new Map(), [rule]);
      }
    }
    if (documentDirty) {
      for (const rule of this.opts.documentRules) {
        try {
          const targets = rule.documentTargets?.(ctx) ?? [];
          const results = [];
          for (const el of targets) {
            rulesRun++;
            if (rule.isApplicable(el, ctx)) results.push(rule.evaluate(el, ctx));
          }
          reg.replaceRuleResults(rule.id, results);
        } catch (err) {
          this.warnOnce(rule.id, err);
        }
      }
    }
    return { nodes, rules: rulesRun };
  }

  private async run(): Promise<void> {
    this.running = true;
    const o = this.opts;
    try {
      while (this.pendingInfo && !this.stopped) {
        const info = this.pendingInfo;
        this.pendingInfo = null;
        const seen = new Set<Element>();
        const triggered = new Map<string, Element[]>();
        const runCache = new Map<string, unknown>();
        const gen = this.iterate(seen);
        const startedAt = performance.now();
        let active = 0;
        let maxSlice = 0;
        let slices = 0;
        let nodes = 0;
        let rulesRun = 0;
        let mutations = info.mutations;
        let done = false;
        while (!done) {
          const t0 = performance.now();
          const ctx = createEvalContext(o.doc, {
            isTopFrame: o.isTopFrame,
            shadowRoots: o.shadowRoots,
            runCache,
          });
          for (;;) {
            const next = gen.next();
            if (next.done) {
              done = true;
              break;
            }
            nodes++;
            rulesRun += this.evaluateElement(next.value, ctx, triggered, o.elementRules);
            if (performance.now() - t0 >= o.sliceBudgetMs) break;
          }
          if (done) {
            // Mutações que chegaram durante a execução entram no fechamento.
            const extra = this.pendingInfo as WorkInfo | null;
            this.pendingInfo = null;
            mutations += extra?.mutations ?? 0;
            const hadRemovals = info.hadRemovals || (extra?.hadRemovals ?? false);
            const documentDirty = info.documentDirty || (extra?.documentDirty ?? false);
            const removed = [...info.removed, ...(extra?.removed ?? [])];
            const fin = this.finishRun(
              ctx,
              seen,
              triggered,
              hadRemovals,
              removed,
              documentDirty,
            );
            nodes += fin.nodes;
            rulesRun += fin.rules;
          }
          const delta = o.registry.commit();
          const dt = performance.now() - t0;
          active += dt;
          maxSlice = Math.max(maxSlice, dt);
          slices++;
          o.onCommit(delta);
          if (!done) {
            await yieldToMain();
            if (this.isStopped()) return;
          }
        }
        o.onRunComplete({
          batchId: ++this.batchSeq,
          kind: info.kind,
          nodesEvaluated: nodes,
          rulesRun,
          durationMs: active,
          wallMs: performance.now() - startedAt,
          slices,
          maxSliceMs: maxSlice,
          mutations,
          startedAt,
        });
      }
    } finally {
      this.running = false;
      if (!this.stopped) o.onIdle();
    }
  }
}
