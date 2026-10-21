/**
 * 3.1.1 Idioma da página (A) — ACT b5c3f8 (existe `lang`) e bf051a (`lang`
 * com subtag primário conhecido no registro IANA).
 *
 * `xml:lang` sozinho não satisfaz a regra em documentos HTML.
 */
import { checkLanguageTag, trimLang } from '../lib/bcp47';
import type { EvalContext, Rule } from './types';
import { base, isHtmlDocument, makeResult } from './util';

function rootTargets(ctx: EvalContext): Element[] {
  if (!ctx.isTopFrame || !isHtmlDocument(ctx.doc)) return [];
  return [ctx.doc.documentElement];
}

const langMeta = base('html-lang');

export const htmlLang: Rule = {
  ...langMeta,
  documentTargets: rootTargets,
  isApplicable: () => true,
  evaluate(el) {
    const lang = el.getAttribute('lang');
    return lang !== null && trimLang(lang) !== ''
      ? makeResult(langMeta, el, 'pass', 'html_lang')
      : makeResult(langMeta, el, 'violation', 'html_lang');
  },
};

const validMeta = base('html-lang-valid');

export const htmlLangValid: Rule = {
  ...validMeta,
  documentTargets: rootTargets,
  isApplicable(el) {
    const lang = el.getAttribute('lang');
    return lang !== null && trimLang(lang) !== '';
  },
  evaluate(el) {
    const lang = el.getAttribute('lang') ?? '';
    const check = checkLanguageTag(lang);
    return check.valid
      ? makeResult(validMeta, el, 'pass', 'html_lang_valid')
      : makeResult(validMeta, el, 'violation', 'html_lang_valid', {
          lang: trimLang(lang),
        });
  },
};
