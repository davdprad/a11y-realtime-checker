/**
 * EvalContext: caches de leitura (estilo, geometria, papel, nome acessível,
 * visibilidade) válidos durante um único lote e descartados ao final.
 *
 * O contexto só lê do DOM. Nenhuma escrita acontece enquanto um lote está
 * aberto, o que evita "layout thrashing" (leitura e escrita intercaladas).
 */
import { accessibleName, fallbackName } from '../lib/accname';
import { rectFrom, type Rect } from '../lib/geometry';
import { computedRole, nameFromContents } from '../lib/roles';
import { isHiddenFromAT, isRendered } from '../lib/visibility';
import type { EvalContext } from '../rules/types';

export interface ContextOptions {
  readonly isTopFrame: boolean;
  readonly shadowRoots: () => Iterable<ShadowRoot>;
  /** Cache compartilhado entre as fatias de uma mesma execução (chaves "run:"). */
  readonly runCache?: Map<string, unknown>;
}

export interface BatchContext extends EvalContext {
  /** Estatísticas para instrumentação. */
  readonly stats: { styleReads: number; rectReads: number; nameComputations: number };
}

export function createEvalContext(doc: Document, opts: ContextOptions): BatchContext {
  const win = doc.defaultView ?? window;
  const styles = new WeakMap<Element, CSSStyleDeclaration>();
  const rects = new WeakMap<Element, Rect>();
  const roles = new WeakMap<Element, string | null>();
  const names = new WeakMap<Element, string>();
  const hidden = new WeakMap<Element, boolean>();
  const rendered = new WeakMap<Element, boolean>();
  const memo = new Map<string, unknown>();
  const memoFor = new Map<string, WeakMap<object, unknown>>();
  const stats = { styleReads: 0, rectReads: 0, nameComputations: 0 };

  const style = (el: Element): CSSStyleDeclaration => {
    let s = styles.get(el);
    if (!s) {
      s = win.getComputedStyle(el);
      styles.set(el, s);
      stats.styleReads++;
    }
    return s;
  };

  // Para o accname: pseudo-elementos não são cacheados (raros e baratos).
  const styleForAccname = (el: Element, pseudo?: string | null): CSSStyleDeclaration =>
    pseudo ? win.getComputedStyle(el, pseudo) : style(el);

  const ctx: BatchContext = {
    doc,
    win,
    isTopFrame: opts.isTopFrame,
    stats,
    scroll: { scrollX: win.scrollX, scrollY: win.scrollY },
    style,
    rect(el) {
      let r = rects.get(el);
      if (!r) {
        r = rectFrom(el.getBoundingClientRect());
        rects.set(el, r);
        stats.rectReads++;
      }
      return r;
    },
    role(el) {
      if (roles.has(el)) return roles.get(el) ?? null;
      const r = computedRole(el);
      roles.set(el, r);
      return r;
    },
    name(el) {
      let n = names.get(el);
      if (n === undefined) {
        n = accessibleName(el, styleForAccname);
        if (n === '') {
          n = fallbackName(el, {
            hidden: (e) => ctx.hiddenFromAT(e),
            nameFromContents: nameFromContents(ctx.role(el)),
          });
        }
        names.set(el, n);
        stats.nameComputations++;
      }
      return n;
    },
    rendered(el) {
      let v = rendered.get(el);
      if (v === undefined) {
        v = isRendered(el, style);
        rendered.set(el, v);
      }
      return v;
    },
    hiddenFromAT(el) {
      let v = hidden.get(el);
      if (v === undefined) {
        v = isHiddenFromAT(el, style);
        hidden.set(el, v);
      }
      return v;
    },
    memo<T>(key: string, compute: () => T): T {
      const store = key.startsWith('run:') && opts.runCache ? opts.runCache : memo;
      if (store.has(key)) return store.get(key) as T;
      const v = compute();
      store.set(key, v);
      return v;
    },
    memoFor<T>(namespace: string, key: object, compute: () => T): T {
      let map = memoFor.get(namespace);
      if (!map) {
        map = new WeakMap();
        memoFor.set(namespace, map);
      }
      if (map.has(key)) return map.get(key) as T;
      const v = compute();
      map.set(key, v);
      return v;
    },
    shadowRoots: opts.shadowRoots,
  };
  return ctx;
}
