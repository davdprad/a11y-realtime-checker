/**
 * 1.3.1 — Saltos na hierarquia de cabeçalhos (ex.: h2 → h4).
 *
 * Resultado sempre `recommendation`: um salto de nível não constitui, por si
 * só, falha da WCAG, por isso fica fora do cálculo de precisão e revocação.
 * A ordem considera os cabeçalhos do mesmo escopo (documento ou shadow root).
 */
import type { EvalContext, Rule } from './types';
import { base, makeResult } from './util';

const meta = base('heading-order');

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role~="heading" i]';

export function headingLevel(el: Element): number {
  const aria = el.getAttribute('aria-level');
  if (aria !== null && /^\s*\d+\s*$/.test(aria)) {
    const n = parseInt(aria, 10);
    if (n >= 1) return n;
  }
  const m = /^h([1-6])$/.exec(el.localName);
  return m ? Number(m[1]) : 2;
}

/** Cabeçalhos visíveis do escopo, em ordem de documento (cache por lote). */
function headingsInScope(scope: Document | ShadowRoot, ctx: EvalContext): Element[] {
  // Cache por execução: a lista só muda com mutações, que geram nova execução.
  const key =
    scope instanceof Document ? 'run:headings:doc' : `run:headings:${shadowKey(scope)}`;
  return ctx.memo(key, () =>
    [...scope.querySelectorAll(HEADING_SELECTOR)].filter(
      (h) => ctx.role(h) === 'heading' && !ctx.hiddenFromAT(h),
    ),
  );
}

/** Posição de cada cabeçalho na lista (O(1) por avaliação). */
function headingIndex(
  scope: Document | ShadowRoot,
  list: readonly Element[],
  ctx: EvalContext,
): Map<Element, number> {
  const key =
    scope instanceof Document
      ? 'run:heading-index:doc'
      : `run:heading-index:${shadowKey(scope)}`;
  return ctx.memo(key, () => new Map(list.map((h, i) => [h, i])));
}

const shadowIds = new WeakMap<ShadowRoot, number>();
let nextShadowId = 1;
function shadowKey(root: ShadowRoot): number {
  let id = shadowIds.get(root);
  if (id === undefined) {
    id = nextShadowId++;
    shadowIds.set(root, id);
  }
  return id;
}

export const headingOrder: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    return ctx.role(el) === 'heading' && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    const scope = el.getRootNode() as Document | ShadowRoot;
    const list = headingsInScope(scope, ctx);
    const idx = headingIndex(scope, list, ctx).get(el) ?? -1;
    const prev = idx > 0 ? list[idx - 1] : undefined;
    const level = headingLevel(el);
    if (prev) {
      const prevLevel = headingLevel(prev);
      if (level > prevLevel + 1) {
        return makeResult(meta, el, 'recommendation', 'heading_order', {
          level,
          previous: prevLevel,
        });
      }
    }
    return makeResult(meta, el, 'pass', 'heading_order');
  },
  revalidate: {
    selector: HEADING_SELECTOR,
    trigger: (el) => /^h[1-6]$/.test(el.localName) || el.hasAttribute('role'),
    targets(ctx) {
      // A ordem é global no escopo: reavalia todos os cabeçalhos (são poucos).
      const all = [...headingsInScope(ctx.doc, ctx)];
      for (const root of ctx.shadowRoots()) all.push(...headingsInScope(root, ctx));
      return all;
    },
  },
};
