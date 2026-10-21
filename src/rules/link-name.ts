/**
 * 2.4.4 Finalidade do link (A) — ACT c487ae.
 *
 * Elementos com papel `link` (ou papéis derivados, como `doc-biblioref`)
 * incluídos na árvore de acessibilidade precisam de nome acessível não vazio:
 * `a[href]`, `area[href]` e `role="link"`. Avaliar se o nome descreve o
 * destino exige julgamento humano e está fora do escopo.
 */
import { roleIs } from '../lib/roles';
import type { Rule } from './types';
import { base, makeResult } from './util';

const meta = base('link-name');

export const linkName: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    return roleIs(ctx.role(el), 'link') && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    return ctx.name(el) !== ''
      ? makeResult(meta, el, 'pass', 'link_name')
      : makeResult(meta, el, 'violation', 'link_name');
  },
};
