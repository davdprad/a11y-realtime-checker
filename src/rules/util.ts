import { ruleMeta } from './catalog';
import type { Outcome, ResultData, Rule, RuleResult } from './types';

type RuleBase = Pick<Rule, 'id' | 'wcag' | 'level' | 'actRuleIds' | 'scope'>;

/** Metadados da regra a partir do catálogo (fonte única dos mapeamentos). */
export function base(id: string): RuleBase {
  const m = ruleMeta(id);
  return {
    id: m.id,
    wcag: m.wcag,
    level: m.level,
    actRuleIds: m.actRuleIds,
    scope: m.scope,
  };
}

export function makeResult(
  rule: RuleBase,
  element: Element,
  outcome: Outcome,
  messageKey: string,
  data?: ResultData,
): RuleResult {
  return {
    ruleId: rule.id,
    wcag: rule.wcag,
    level: rule.level,
    outcome,
    element,
    messageKey,
    ...(data ? { data } : {}),
  };
}

/** Documento HTML (não SVG/MathML/XML puro). */
export function isHtmlDocument(doc: Document): boolean {
  return doc.documentElement instanceof HTMLHtmlElement;
}
