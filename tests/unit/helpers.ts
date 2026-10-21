import { afterEach } from 'vitest';
import { createEvalContext } from '../../src/core/context';
import type { EvalContext, Outcome, Rule, RuleResult } from '../../src/rules/types';

let roots: HTMLElement[] = [];

afterEach(() => {
  for (const r of roots) r.remove();
  roots = [];
});

/** Insere HTML no documento de teste e devolve o contêiner. */
export function mount(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.append(div);
  roots.push(div);
  return div;
}

export function q(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`seletor sem correspondência: ${selector}`);
  return el;
}

export function newContext(shadowRoots: ShadowRoot[] = []): EvalContext {
  return createEvalContext(document, {
    isTopFrame: true,
    shadowRoots: () => shadowRoots,
  });
}

export function evaluate(
  rule: Rule,
  el: Element,
  ctx: EvalContext = newContext(),
): RuleResult | null {
  return rule.isApplicable(el, ctx) ? rule.evaluate(el, ctx) : null;
}

/** Resultado da regra para o elemento (`inapplicable` se não se aplica). */
export function outcome(rule: Rule, el: Element, ctx?: EvalContext): Outcome {
  return evaluate(rule, el, ctx)?.outcome ?? 'inapplicable';
}

/** Atalho: monta o HTML e avalia o elemento marcado com `data-t`. */
export function check(rule: Rule, html: string, selector = '[data-t]'): Outcome {
  const root = mount(html);
  return outcome(rule, q(root, selector));
}
