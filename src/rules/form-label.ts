/**
 * 1.3.1 Informações e relações (A) — campos de formulário sem rótulo.
 * Mapeada para a ACT e086e5 ("Form field has non-empty accessible name"),
 * que o W3C associa ao 4.1.2; o documento do estudo a classifica em 1.3.1.
 *
 * - Sem nome acessível → `violation`.
 * - Nome vindo só de `placeholder` (sem `<label>`, `aria-label`,
 *   `aria-labelledby` ou `title`) → `recommendation`: a ACT considera o campo
 *   aprovado, mas o texto some quando o usuário digita.
 */
import { normalizeName } from '../lib/accname';
import { getElementByIdInScope, idrefs, isHtmlElement, localName } from '../lib/dom';
import { inputType, isPresentational, nameFromContents } from '../lib/roles';
import type { EvalContext, Rule } from './types';
import { base, makeResult } from './util';

const meta = base('form-label');

/** Papéis de campo de formulário (lista da ACT e086e5). */
export const FORM_FIELD_ROLES = new Set([
  'checkbox',
  'combobox',
  'listbox',
  'menuitemcheckbox',
  'menuitemradio',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'textbox',
]);

const NON_FIELD_INPUTS = new Set(['hidden', 'button', 'submit', 'reset', 'image']);

/** Campo nativo sem papel ARIA correspondente (password, date, color, file…). */
function isNativeFieldWithoutRole(el: Element): boolean {
  if (!isHtmlElement(el)) return false;
  const tag = localName(el);
  if (tag === 'input') return !NON_FIELD_INPUTS.has(inputType(el));
  return tag === 'select' || tag === 'textarea';
}

export function isFormField(el: Element, ctx: EvalContext): boolean {
  const role = ctx.role(el);
  if (role !== null && FORM_FIELD_ROLES.has(role)) return true;
  if (role !== null) return false; // papel explícito de outra natureza (ou apresentação)
  return isNativeFieldWithoutRole(el);
}

/** O nome vem de uma fonte de rótulo programática (não só do placeholder)? */
function hasLabelSource(el: Element, ctx: EvalContext): boolean {
  for (const id of idrefs(el.getAttribute('aria-labelledby'))) {
    const ref = getElementByIdInScope(el, id);
    if (ref && normalizeName(ref.textContent) !== '') return true;
  }
  if (normalizeName(el.getAttribute('aria-label') ?? '') !== '') return true;
  if (normalizeName(el.getAttribute('title') ?? '') !== '') return true;
  const labels = (el as HTMLInputElement).labels as
    NodeListOf<HTMLLabelElement> | null | undefined;
  if (labels) {
    for (const label of labels)
      if (ctx.name(label) !== '' || normalizeName(label.textContent) !== '') return true;
  }
  return nameFromContents(ctx.role(el)) && normalizeName(el.textContent) !== '';
}

function placeholderOf(el: Element): string {
  return normalizeName(
    el.getAttribute('placeholder') ?? el.getAttribute('aria-placeholder') ?? '',
  );
}

export const formLabel: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    if (isPresentational(ctx.role(el))) return false;
    return isFormField(el, ctx) && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    if (ctx.name(el) === '') {
      // O navegador usa placeholder/aria-placeholder como último recurso para o
      // nome (HTML-AAM); a ACT e086e5 aceita o campo, mas o rótulo some ao digitar.
      return placeholderOf(el) !== ''
        ? makeResult(meta, el, 'recommendation', 'form_label_placeholder')
        : makeResult(meta, el, 'violation', 'form_label');
    }
    if (!hasLabelSource(el, ctx)) {
      return makeResult(meta, el, 'recommendation', 'form_label_placeholder');
    }
    return makeResult(meta, el, 'pass', 'form_label');
  },
};
