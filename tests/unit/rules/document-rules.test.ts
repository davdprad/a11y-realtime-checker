import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEvalContext } from '../../../src/core/context';
import { documentTitle } from '../../../src/rules/document-title';
import { htmlLang, htmlLangValid } from '../../../src/rules/html-lang';
import { ALL_RULES, DOCUMENT_RULES, ELEMENT_RULES, getRule } from '../../../src/rules';
import {
  RULE_META,
  ALL_ACT_RULE_IDS,
  CRITERIA_ORDER,
  i18nKey,
  ruleMeta,
} from '../../../src/rules/catalog';
import type { Rule } from '../../../src/rules/types';
import { viewportZoom } from '../../../src/rules/viewport-zoom';

/** Avalia uma regra de documento sobre um documento HTML independente. */
function runDocRule(rule: Rule, html: string, isTopFrame = true) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ctx = createEvalContext(doc, { isTopFrame, shadowRoots: () => [] });
  return (rule.documentTargets?.(ctx) ?? []).map((el) =>
    rule.isApplicable(el, ctx)
      ? rule.evaluate(el, ctx)
      : { outcome: 'inapplicable', element: el, data: undefined },
  );
}

const outcomes = (rule: Rule, html: string, top = true) =>
  runDocRule(rule, html, top).map((r) => r.outcome);

describe('2.4.2 document-title', () => {
  it.each([
    ['<html><title>Página</title></html>', ['pass']],
    ['<html><body><title>No body</title></body></html>', ['pass']],
    ['<html><h1>sem título</h1></html>', ['violation']],
    ['<html><title></title></html>', ['violation']],
    ['<html><title> </title></html>', ['violation']],
    [
      '<html><head><title></title></head><body><title>x</title></body></html>',
      ['violation'],
    ],
  ])('%s → %j', (html, expected) => {
    expect(outcomes(documentTitle, html)).toEqual(expected);
  });

  it('só avalia o frame de topo', () => {
    expect(outcomes(documentTitle, '<title></title>', false)).toEqual([]);
  });

  it('mensagens distintas para ausente e vazio', () => {
    expect(runDocRule(documentTitle, '<p>x</p>')[0]).toMatchObject({
      messageKey: 'document_title_missing',
    });
    expect(runDocRule(documentTitle, '<title></title>')[0]).toMatchObject({
      messageKey: 'document_title_empty',
    });
  });

  it('ignora <title> de SVG', () => {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>x</title></svg>',
      'image/svg+xml',
    );
    const ctx = createEvalContext(doc, { isTopFrame: true, shadowRoots: () => [] });
    expect(documentTitle.documentTargets?.(ctx)).toEqual([]);
  });
});

describe('3.1.1 html-lang e html-lang-valid', () => {
  it.each([
    ['<html lang="pt-BR"></html>', ['pass'], ['pass']],
    ['<html></html>', ['violation'], ['inapplicable']],
    ['<html lang=""></html>', ['violation'], ['inapplicable']],
    ['<html lang=" "></html>', ['violation'], ['inapplicable']],
    ['<html xml:lang="en"></html>', ['violation'], ['inapplicable']],
    ['<html lang="em-US"></html>', ['pass'], ['violation']],
    ['<html lang="eng"></html>', ['pass'], ['violation']],
    ['<html lang="FR"></html>', ['pass'], ['pass']],
  ])('%s', (html, lang, valid) => {
    expect(outcomes(htmlLang, html)).toEqual(lang);
    expect(outcomes(htmlLangValid, html)).toEqual(valid);
  });

  it('registra o lang inválido', () => {
    expect(runDocRule(htmlLangValid, '<html lang="#1"></html>')[0]?.data).toEqual({
      lang: '#1',
    });
  });
});

describe('1.4.4 viewport-zoom', () => {
  const page = (content: string | null) =>
    `<html><head>${content === null ? '<meta name="viewport">' : `<meta name="viewport" content="${content}">`}</head></html>`;

  it.each([
    [page('user-scalable=no'), ['violation']],
    [page('maximum-scale=1.0'), ['violation']],
    [page('width=device-width, initial-scale=1'), ['inapplicable']],
    [page('maximum-scale=2'), ['pass']],
    [page(''), ['inapplicable']],
    [page(null), ['inapplicable']],
    ['<html><head><meta charset="utf-8"></head></html>', []],
    [
      '<html><head><meta name="VIEWPORT" content="user-scalable=0"><meta name="viewport" content="maximum-scale=5"></head></html>',
      ['violation', 'pass'],
    ],
  ])('%s → %j', (html, expected) => {
    expect(outcomes(viewportZoom, html)).toEqual(expected);
  });
});

describe('catálogo e registro de regras', () => {
  let saved: string;
  beforeEach(() => {
    saved = document.title;
  });
  afterEach(() => {
    document.title = saved;
  });

  it('toda regra do catálogo está registrada com os mesmos metadados', () => {
    expect(ALL_RULES.map((r) => r.id).sort()).toEqual(RULE_META.map((m) => m.id).sort());
    for (const rule of ALL_RULES) {
      const m = ruleMeta(rule.id);
      expect(rule.wcag).toBe(m.wcag);
      expect(rule.level).toBe(m.level);
      expect(rule.scope).toBe(m.scope);
      expect(getRule(rule.id)).toBe(rule);
    }
    expect(ELEMENT_RULES.length + DOCUMENT_RULES.length).toBe(ALL_RULES.length);
    expect(DOCUMENT_RULES.every((r) => typeof r.documentTargets === 'function')).toBe(
      true,
    );
  });

  it('IDs ACT conferidos no repositório do W3C', () => {
    expect(ALL_ACT_RULE_IDS).toEqual([
      '23a2a8',
      '2779a5',
      '4e8ab6',
      '59796f',
      '5f99a7',
      '674b10',
      '6a7281',
      '7d6734',
      '97a4e1',
      'afw4f7',
      'b4f0c3',
      'b5c3f8',
      'bf051a',
      'c487ae',
      'e086e5',
    ]);
  });

  it('critérios em ordem numérica e chaves i18n válidas', () => {
    expect(CRITERIA_ORDER).toEqual([
      '1.1.1',
      '1.3.1',
      '1.4.3',
      '1.4.4',
      '2.4.2',
      '2.4.4',
      '2.5.8',
      '3.1.1',
      '4.1.2',
    ]);
    expect(i18nKey('aria-role-valid')).toBe('aria_role_valid');
    expect(() => ruleMeta('nao-existe')).toThrow();
    expect(getRule('nao-existe')).toBeUndefined();
  });
});
