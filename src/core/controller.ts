/**
 * FrameController: ciclo de vida da verificação em um frame.
 *
 * página carrega → varredura completa (fatiada) → MutationObserver escuta →
 * lotes de mutações (debounce) → só os nós afetados voltam ao motor →
 * Registry atualizado → Overlay e side panel recebem o delta.
 */
import { uniqueSelector } from '../lib/selector';
import type { BatchRecord, Delta, Occurrence } from '../messaging/protocol';
import { isEmptyDelta, parseMutateDetail } from '../messaging/protocol';
import { DOCUMENT_RULES, ELEMENT_RULES } from '../rules';
import { Instrumentation } from './instrumentation';
import { DomObserver } from './observer';
import { Registry } from './registry';
import { Scanner } from './scanner';
import { Overlay } from '../overlay/host';

export interface ControllerOptions {
  readonly doc: Document;
  readonly isTopFrame: boolean;
  readonly debounceMs: number;
  readonly maxWaitMs: number;
  readonly sliceBudgetMs: number;
  readonly overlayVisible: boolean;
  readonly onDelta: (delta: Delta) => void;
  readonly onIdle: () => void;
}

export const MUTATE_EVENT = 'a11y-rt:mutate';

export class FrameController {
  readonly registry: Registry;
  readonly instrumentation = new Instrumentation();
  readonly overlay: Overlay;
  private readonly scanner: Scanner;
  private readonly observer: DomObserver;
  private started = false;
  private stopped = false;

  constructor(private readonly opts: ControllerOptions) {
    const doc = opts.doc;
    this.registry = new Registry({
      selectorOf: (el) => safeSelector(el),
      frameUrl: () => doc.location.href,
      documentRuleIds: new Set(DOCUMENT_RULES.map((r) => r.id)),
    });
    this.observer = new DomObserver({
      doc,
      debounceMs: opts.debounceMs,
      maxWaitMs: Math.max(opts.debounceMs * 2, opts.debounceMs + 100),
      onFlush: (batch) => {
        this.scanner.enqueue(batch.items, batch.info);
      },
    });
    this.scanner = new Scanner({
      doc,
      isTopFrame: opts.isTopFrame,
      registry: this.registry,
      elementRules: ELEMENT_RULES,
      documentRules: DOCUMENT_RULES,
      sliceBudgetMs: opts.sliceBudgetMs,
      onShadowRoot: (root) => {
        this.observer.observe(root);
      },
      shadowRoots: () => this.observer.shadowRoots(),
      onCommit: (delta) => {
        this.handleDelta(delta);
      },
      onRunComplete: (record: BatchRecord) => {
        this.instrumentation.recordBatch(record);
      },
      onIdle: () => {
        opts.onIdle();
      },
    });
    this.overlay = new Overlay({
      doc,
      elementFor: (id) => this.registry.elementFor(id),
      onPainted: (now) => {
        this.instrumentation.markPainted(now);
      },
    });
    this.overlay.setVisible(opts.overlayVisible);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const doc = this.opts.doc;
    doc.addEventListener(MUTATE_EVENT, this.onMutateEvent);
    // O observer é ligado antes da varredura: mutações durante a varredura
    // inicial entram na fila e são processadas em seguida.
    this.observer.observe(doc);
    this.scanner.enqueue([{ kind: 'subtree', root: doc.documentElement }], {
      kind: 'initial',
      mutations: 0,
      hadRemovals: false,
      removed: [],
      documentDirty: true,
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.opts.doc.removeEventListener(MUTATE_EVENT, this.onMutateEvent);
    this.observer.disconnect();
    this.scanner.stop();
    this.overlay.destroy();
    this.registry.clearAll();
    const delta = this.registry.commit();
    if (!isEmptyDelta(delta)) this.opts.onDelta(delta);
  }

  /** Reavalia o documento inteiro (ex.: botão "Verificar novamente"). */
  rescan(): void {
    if (this.stopped) return;
    this.scanner.enqueue([{ kind: 'subtree', root: this.opts.doc.documentElement }], {
      kind: 'incremental',
      mutations: 0,
      hadRemovals: true,
      removed: [],
      documentDirty: true,
    });
  }

  get idle(): boolean {
    return (
      this.scanner.idle &&
      !this.observer.pending &&
      !this.instrumentation.hasUnpaintedMatches
    );
  }

  get batchCount(): number {
    return this.scanner.batchCount;
  }

  occurrences(): Occurrence[] {
    return this.registry.snapshot();
  }

  private handleDelta(delta: Delta): void {
    if (isEmptyDelta(delta)) return;
    this.instrumentation.onDelta(delta, performance.now());
    this.overlay.sync(this.registry.snapshot());
    this.opts.onDelta(delta);
  }

  private readonly onMutateEvent = (ev: Event): void => {
    const detail = parseMutateDetail((ev as CustomEvent<unknown>).detail);
    if (detail) this.instrumentation.onMutateEvent(detail, performance.now());
  };
}

function safeSelector(el: Element): string {
  try {
    return uniqueSelector(el);
  } catch {
    return el.localName;
  }
}
