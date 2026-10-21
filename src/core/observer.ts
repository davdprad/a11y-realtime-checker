/**
 * Observer: MutationObserver no documento e em cada shadow root aberto
 * descoberto, com fila de nós sujos e debounce. Transforma registros de
 * mutação em itens de trabalho para o Scanner, incluindo dependentes
 * (referências por id, rótulos, ancestrais cujo nome vem do conteúdo).
 */
import {
  flatAncestors,
  flatContains,
  getElementByIdInScope,
  idrefs,
  isOverlayNode,
} from '../lib/dom';
import { Debouncer } from './scheduler';
import type { WorkInfo, WorkItem } from './scanner';

/** Atributos ARIA lidos pelas regras (lista explícita, WAI-ARIA 1.2 + 1.3). */
export const ARIA_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-braillelabel',
  'aria-brailleroledescription',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colindextext',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowindextext',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
] as const;

export const OBSERVED_ATTRIBUTES: readonly string[] = [
  'alt',
  'role',
  'lang',
  'title',
  'for',
  'id',
  'class',
  'style',
  'hidden',
  'type',
  'href',
  'tabindex',
  'disabled',
  'src',
  'content',
  'name',
  'value',
  'inert',
  'placeholder',
  'open',
  'usemap',
  'size',
  'multiple',
  'list',
  'contenteditable',
  'appearance',
  ...ARIA_ATTRIBUTES,
];

/**
 * Atributos cuja mudança pode alterar descendentes (estilo herdado,
 * visibilidade, estado desabilitado): a subárvore inteira é reavaliada.
 */
const CASCADING = new Set([
  'class',
  'style',
  'hidden',
  'aria-hidden',
  'inert',
  'disabled',
  'aria-disabled',
  'lang',
  'open',
]);

/** Quantos ancestrais reavaliar quando o conteúdo muda (nome a partir do conteúdo). */
const ANCESTOR_DEPTH = 8;

export interface DirtyBatch {
  readonly items: WorkItem[];
  readonly info: WorkInfo;
  /** `performance.now()` do primeiro registro do lote (instrumentação). */
  readonly firstRecordAt: number;
}

export interface ObserverOptions {
  readonly doc: Document;
  readonly debounceMs: number;
  readonly maxWaitMs: number;
  readonly onFlush: (batch: DirtyBatch) => void;
}

export class DomObserver {
  private readonly mo: MutationObserver;
  private readonly observed = new Set<Node>();
  private subtreeRoots = new Set<Element>();
  private selfs = new Set<Element>();
  private hadRemovals = false;
  private removed: Element[] = [];
  private idChanged = false;
  private labelTargets = new Set<string>();
  private contentChanged = false;
  private mutationCount = 0;
  private firstRecordAt = 0;
  private readonly debouncer: Debouncer;
  private readonly roots = new Set<ShadowRoot>();

  constructor(private readonly opts: ObserverOptions) {
    this.mo = new MutationObserver((records) => {
      this.handle(records);
    });
    this.debouncer = new Debouncer(
      () => {
        this.flush();
      },
      opts.debounceMs,
      opts.maxWaitMs,
    );
  }

  observe(target: Document | ShadowRoot): void {
    if (this.observed.has(target)) return;
    this.observed.add(target);
    if (target instanceof ShadowRoot) this.roots.add(target);
    this.mo.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeOldValue: false,
      attributeFilter: [...OBSERVED_ATTRIBUTES],
    });
  }

  /** Shadow roots abertos conhecidos e ainda conectados. */
  shadowRoots(): ShadowRoot[] {
    for (const r of this.roots) {
      if (!r.host.isConnected) this.roots.delete(r);
    }
    return [...this.roots];
  }

  disconnect(): void {
    this.mo.disconnect();
    this.debouncer.cancel();
    this.observed.clear();
    this.roots.clear();
    this.reset();
  }

  /** Processa imediatamente os registros pendentes (útil em testes e ao parar). */
  takePending(): void {
    const records = this.mo.takeRecords();
    if (records.length > 0) this.handle(records);
  }

  get pending(): boolean {
    return this.debouncer.pending;
  }

  private reset(): void {
    this.subtreeRoots = new Set();
    this.selfs = new Set();
    this.hadRemovals = false;
    this.removed = [];
    this.idChanged = false;
    this.labelTargets = new Set();
    this.contentChanged = false;
    this.mutationCount = 0;
  }

  private addSelfWithAncestors(el: Element): void {
    this.selfs.add(el);
    let depth = 0;
    for (const a of flatAncestors(el)) {
      if (++depth > ANCESTOR_DEPTH) break;
      this.selfs.add(a);
    }
  }

  handle(records: readonly MutationRecord[]): void {
    let relevant = 0;
    for (const rec of records) {
      const target = rec.target;
      if (isOverlayNode(target)) continue;
      if (rec.type === 'childList') {
        let ownOnly = true;
        for (const n of rec.addedNodes) {
          if (isOverlayNode(n)) continue;
          ownOnly = false;
          if (n instanceof Element) {
            this.subtreeRoots.add(n);
            this.noteLabelsAndIds(n);
          }
        }
        for (const n of rec.removedNodes) {
          if (n instanceof Element && n.localName === 'a11y-rt-overlay') continue;
          ownOnly = false;
          this.hadRemovals = true;
          if (n instanceof Element) {
            this.noteLabelsAndIds(n);
            if (this.removed.length < 1000) this.removed.push(n);
          }
        }
        if (ownOnly && (rec.addedNodes.length > 0 || rec.removedNodes.length > 0))
          continue;
        this.contentChanged = true;
        const host = target instanceof ShadowRoot ? target.host : target;
        if (host instanceof Element) this.addSelfWithAncestors(host);
      } else if (rec.type === 'attributes') {
        if (!(target instanceof Element)) continue;
        const name = rec.attributeName ?? '';
        if (CASCADING.has(name)) this.subtreeRoots.add(target);
        this.addSelfWithAncestors(target);
        if (name === 'id') this.idChanged = true;
        if (name === 'for' && target instanceof HTMLLabelElement && target.control) {
          this.selfs.add(target.control);
        }
      } else {
        // characterData
        const parent = target.parentNode;
        const el = parent instanceof ShadowRoot ? parent.host : parent;
        if (el instanceof Element) this.addSelfWithAncestors(el);
        this.contentChanged = true;
      }
      relevant++;
    }
    if (relevant === 0) return;
    if (this.mutationCount === 0) this.firstRecordAt = performance.now();
    this.mutationCount += relevant;
    this.debouncer.trigger();
  }

  /**
   * Um `<label>` (ou um elemento com id) inserido ou removido muda o nome de
   * outro elemento fora da subárvore alterada: o controle rotulado ou quem o
   * referencia por aria-labelledby/describedby.
   */
  private noteLabelsAndIds(n: Element): void {
    const labels = n.localName === 'label' ? [n] : [...n.querySelectorAll('label')];
    for (const label of labels) {
      const forId = label.getAttribute('for');
      if (forId) this.labelTargets.add(forId);
    }
    if (n.id || n.querySelector('[id]')) this.idChanged = true;
  }

  /** Dependentes: quem referencia por id (aria-labelledby/describedby, label[for]). */
  private collectDependents(): void {
    for (const id of this.labelTargets) {
      const c = this.opts.doc.getElementById(id);
      if (c) this.selfs.add(c);
    }
    const doc = this.opts.doc;
    const dirty = [...this.subtreeRoots, ...this.selfs];
    const referencers = [
      ...doc.querySelectorAll('[aria-labelledby], [aria-describedby]'),
      ...this.shadowRoots().flatMap((r) => [
        ...r.querySelectorAll('[aria-labelledby], [aria-describedby]'),
      ]),
    ];
    if (this.idChanged) {
      for (const r of referencers) this.selfs.add(r);
      for (const label of doc.querySelectorAll('label[for]')) {
        const c = (label as HTMLLabelElement).control;
        if (c) this.selfs.add(c);
      }
    } else if (this.contentChanged || dirty.length > 0) {
      const many = dirty.length > 200;
      for (const r of referencers) {
        if (many) {
          this.selfs.add(r);
          continue;
        }
        const ids = [
          ...idrefs(r.getAttribute('aria-labelledby')),
          ...idrefs(r.getAttribute('aria-describedby')),
        ];
        for (const id of ids) {
          const ref = getElementByIdInScope(r, id);
          if (ref && dirty.some((d) => flatContains(ref, d) || flatContains(d, ref))) {
            this.selfs.add(r);
            break;
          }
        }
      }
    }
    // Texto de rótulo alterado → o controle rotulado muda de nome.
    for (const d of dirty) {
      const label = d.closest('label');
      if (label?.control) this.selfs.add(label.control);
    }
  }

  private flush(): void {
    if (this.mutationCount === 0) return;
    this.collectDependents();
    // Dedupe: subárvore contida em outra subárvore suja é descartada.
    const roots = [...this.subtreeRoots].filter((r) => r.isConnected);
    const rootSet = new Set(roots);
    const keptRoots = roots.filter((r) => {
      for (const a of flatAncestors(r)) if (rootSet.has(a)) return false;
      return true;
    });
    const keptSet = new Set(keptRoots);
    const items: WorkItem[] = keptRoots.map((root) => ({ kind: 'subtree', root }));
    for (const el of this.selfs) {
      if (!el.isConnected || keptSet.has(el)) continue;
      let covered = false;
      for (const a of flatAncestors(el)) {
        if (keptSet.has(a)) {
          covered = true;
          break;
        }
      }
      if (!covered) items.push({ kind: 'self', el });
    }
    const batch: DirtyBatch = {
      items,
      info: {
        kind: 'incremental',
        mutations: this.mutationCount,
        hadRemovals: this.hadRemovals,
        removed: this.removed,
        // Regras de documento são baratas (poucos elementos) e um <title> pode
        // estar no <body>; reavaliá-las a cada lote é mais simples e seguro.
        documentDirty: true,
      },
      firstRecordAt: this.firstRecordAt,
    };
    this.reset();
    this.opts.onFlush(batch);
  }
}
