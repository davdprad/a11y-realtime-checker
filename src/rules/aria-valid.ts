/**
 * 4.1.2 Nome, função, valor (A) — validade de WAI-ARIA 1.2:
 *
 * - `aria-role-valid` (ACT 674b10): `role` precisa ter ao menos um token que
 *   seja papel concreto (não abstrato) do WAI-ARIA, DPUB-ARIA ou Graphics-ARIA.
 * - `aria-attr-defined` (ACT 5f99a7): todo atributo `aria-*` precisa existir
 *   na especificação.
 * - `aria-attr-valid-value` (ACT 6a7281): valores precisam respeitar o tipo do
 *   atributo (booleano, tristate, token, lista de tokens, inteiro, número).
 *   Referências a ids não são conferidas (a ACT aceita ids inexistentes).
 * - `aria-required-attr` (ACT 4e8ab6): papéis explícitos precisam dos estados
 *   e propriedades obrigatórios (ex.: `checkbox` → `aria-checked`).
 *
 * A tabela vem de `aria-data.generated.ts` (aria-query, versão fixada).
 */
import { ARIA_PROPS, ARIA_ROLES } from '../lib/aria-data.generated';
import { isHtmlElement, localName } from '../lib/dom';
import {
  ARIA_13_PROPS,
  explicitRole,
  implicitRole,
  inputType,
  isFocusable,
  isKnownAriaAttribute,
  isValidConcreteRole,
  roleTokens,
} from '../lib/roles';
import type { Rule } from './types';
import { base, makeResult } from './util';

// ---------------------------------------------------------------------------
// role com valor válido
// ---------------------------------------------------------------------------

const roleMeta = base('aria-role-valid');

export const ariaRoleValid: Rule = {
  ...roleMeta,
  isApplicable(el, ctx) {
    return roleTokens(el).length > 0 && !ctx.hiddenFromAT(el);
  },
  evaluate(el) {
    const tokens = roleTokens(el);
    return tokens.some(isValidConcreteRole)
      ? makeResult(roleMeta, el, 'pass', 'aria_role_valid')
      : makeResult(roleMeta, el, 'violation', 'aria_role_valid', {
          role: (el.getAttribute('role') ?? '').trim(),
        });
  },
};

// ---------------------------------------------------------------------------
// atributo aria-* definido
// ---------------------------------------------------------------------------

function ariaAttributes(el: Element): Attr[] {
  return [...el.attributes].filter((a) => a.name.toLowerCase().startsWith('aria-'));
}

const definedMeta = base('aria-attr-defined');

export const ariaAttrDefined: Rule = {
  ...definedMeta,
  isApplicable(el, ctx) {
    return ariaAttributes(el).length > 0 && !ctx.hiddenFromAT(el);
  },
  evaluate(el) {
    const unknown = ariaAttributes(el)
      .map((a) => a.name.toLowerCase())
      .filter((n) => !isKnownAriaAttribute(n));
    return unknown.length === 0
      ? makeResult(definedMeta, el, 'pass', 'aria_attr_defined')
      : makeResult(definedMeta, el, 'violation', 'aria_attr_defined', {
          attributes: unknown.join(', '),
        });
  },
};

// ---------------------------------------------------------------------------
// valor válido de estado/propriedade
// ---------------------------------------------------------------------------

const INTEGER = /^[-+]?\d+$/;
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

/** O valor (já não vazio) é válido para o tipo do atributo? */
export function isValidAriaValue(name: string, rawValue: string): boolean {
  const n = name.toLowerCase();
  const def = ARIA_PROPS[n] ?? ARIA_13_PROPS[n];
  if (!def) return true; // atributos desconhecidos são tratados por aria-attr-defined
  const v = rawValue.trim().toLowerCase();
  const values = 'values' in def ? (def.values ?? []) : [];
  const allowUndefined = 'allowUndefined' in def && def.allowUndefined;
  switch (def.type) {
    case 'boolean':
      return v === 'true' || v === 'false' || (allowUndefined && v === 'undefined');
    case 'tristate':
      return v === 'true' || v === 'false' || v === 'mixed' || v === 'undefined';
    case 'token':
      return values.includes(v);
    case 'tokenlist':
      return v.split(/\s+/).every((t) => values.includes(t));
    case 'integer':
      return INTEGER.test(v);
    case 'number':
      return NUMBER.test(v);
    default:
      // id, idlist, string: qualquer valor não vazio.
      return true;
  }
}

const valueMeta = base('aria-attr-valid-value');

function nonEmptyKnownAriaAttrs(el: Element): Attr[] {
  return ariaAttributes(el).filter(
    (a) => isKnownAriaAttribute(a.name) && a.value.trim() !== '',
  );
}

export const ariaAttrValidValue: Rule = {
  ...valueMeta,
  isApplicable(el, ctx) {
    return nonEmptyKnownAriaAttrs(el).length > 0 && !ctx.hiddenFromAT(el);
  },
  evaluate(el) {
    const invalid = nonEmptyKnownAriaAttrs(el).filter(
      (a) => !isValidAriaValue(a.name, a.value),
    );
    return invalid.length === 0
      ? makeResult(valueMeta, el, 'pass', 'aria_attr_valid_value')
      : makeResult(valueMeta, el, 'violation', 'aria_attr_valid_value', {
          attributes: invalid
            .map((a) => `${a.name.toLowerCase()}="${a.value.trim()}"`)
            .join(', '),
        });
  },
};

// ---------------------------------------------------------------------------
// estados e propriedades obrigatórios
// ---------------------------------------------------------------------------

/**
 * Estados/propriedades obrigatórios efetivos para `role` em `el`. Ajustes
 * sobre a tabela do aria-query, alinhados aos casos ACT e à prática dos
 * navegadores:
 * - `option` e `treeitem`: `aria-selected` tem valor implícito (`false`);
 * - `combobox`: `aria-controls` só é exigido quando expandido (WAI-ARIA 1.3);
 * - `separator` focável é um widget e exige `aria-valuenow`;
 * - controles nativos fornecem o estado: `<input type=checkbox|radio>` →
 *   `aria-checked`; `<input type=range|number>` → `aria-valuenow`.
 */
export function requiredAttributes(role: string, el: Element): string[] {
  const def = ARIA_ROLES[role];
  const req = new Set(def ? Object.keys(def.requiredProps) : []);
  if (role === 'option' || role === 'treeitem') req.delete('aria-selected');
  if (
    role === 'combobox' &&
    el.getAttribute('aria-expanded')?.trim().toLowerCase() !== 'true'
  ) {
    req.delete('aria-controls');
  }
  if (role === 'separator' && isFocusable(el)) req.add('aria-valuenow');
  if (isHtmlElement(el) && localName(el) === 'input') {
    const type = inputType(el);
    if (type === 'checkbox' || type === 'radio') req.delete('aria-checked');
    if (type === 'range' || type === 'number') req.delete('aria-valuenow');
  }
  return [...req].sort();
}

const requiredMeta = base('aria-required-attr');

export const ariaRequiredAttr: Rule = {
  ...requiredMeta,
  isApplicable(el, ctx) {
    const explicit = explicitRole(el);
    if (!explicit || explicit === 'none' || explicit === 'presentation') return false;
    // Papel explícito igual ao implícito: o elemento nativo já fornece a semântica.
    if (implicitRole(el) === explicit) return false;
    // Resolução de conflito pode ter descartado o papel explícito.
    if (ctx.role(el) !== explicit) return false;
    return !ctx.hiddenFromAT(el);
  },
  evaluate(el) {
    const role = explicitRole(el) ?? '';
    const missing = requiredAttributes(role, el).filter(
      (attr) => (el.getAttribute(attr) ?? '').trim() === '',
    );
    return missing.length === 0
      ? makeResult(requiredMeta, el, 'pass', 'aria_required_attr')
      : makeResult(requiredMeta, el, 'violation', 'aria_required_attr', {
          role,
          missing: missing.join(', '),
        });
  },
};
