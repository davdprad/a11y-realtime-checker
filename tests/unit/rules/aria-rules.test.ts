import { describe, expect, it } from 'vitest';
import {
  ariaAttrDefined,
  ariaAttrValidValue,
  ariaRequiredAttr,
  ariaRoleValid,
  isValidAriaValue,
  requiredAttributes,
} from '../../../src/rules/aria-valid';
import { headingLevel, headingOrder } from '../../../src/rules/heading-order';
import { check, evaluate, mount, newContext, q } from '../helpers';

describe('4.1.2 aria-role-valid', () => {
  it.each([
    ['<span data-t role="lnik">x</span>', 'violation'],
    ['<span data-t role="bibliographic-reference lnik">x</span>', 'violation'],
    ['<span data-t role="widget">x</span>', 'violation'],
    ['<input data-t role="searchbox">', 'pass'],
    ['<span data-t role="doc-biblioref link">x</span>', 'pass'],
    ['<input data-t role="searchfield searchbox">', 'pass'],
    ['<span data-t role="image">x</span>', 'pass'],
    ['<div data-t role>x</div>', 'inapplicable'],
    ['<div data-t role="  ">x</div>', 'inapplicable'],
    ['<div data-t aria-hidden="true" role="banner">x</div>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(ariaRoleValid, html)).toBe(expected);
  });
});

describe('4.1.2 aria-attr-defined', () => {
  it.each([
    ['<div data-t role="checkbox" aria-not-checked="true">x</div>', 'violation'],
    ['<div data-t aria-labelled="l">x</div>', 'violation'],
    ['<article data-t aria-atomic="true">x</article>', 'pass'],
    ['<div data-t aria-description="d" aria-colindextext="c">x</div>', 'pass'],
    ['<canvas data-t></canvas>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(ariaAttrDefined, html)).toBe(expected);
  });

  it('lista os atributos inexistentes nos dados', () => {
    const root = mount('<div data-t aria-foo="1" aria-bar="2">x</div>');
    expect(evaluate(ariaAttrDefined, q(root, '[data-t]'))?.data).toEqual({
      attributes: 'aria-foo, aria-bar',
    });
  });
});

describe('4.1.2 aria-attr-valid-value', () => {
  it.each([
    [
      '<div data-t role="textbox" aria-required="undefined" aria-label="x"></div>',
      'violation',
    ],
    ['<div data-t role="button" aria-expanded="collapsed">x</div>', 'violation'],
    ['<div data-t role="button" aria-pressed="horizontal">x</div>', 'violation'],
    ['<div data-t role="gridcell" aria-rowindex="2.5">x</div>', 'violation'],
    [
      '<div data-t role="spinbutton" aria-valuenow="two" aria-label="x"></div>',
      'violation',
    ],
    ['<div data-t role="main" aria-live="page"></div>', 'violation'],
    ['<div data-t role="alert" aria-relevant="text always"></div>', 'violation'],
    ['<div data-t role="button" aria-expanded="undefined">x</div>', 'pass'],
    ['<div data-t role="button" aria-pressed="mixed">x</div>', 'pass'],
    [
      '<div data-t role="textbox" aria-errormessage="nao-existe" aria-label="x"></div>',
      'pass',
    ],
    [
      '<div data-t role="spinbutton" aria-valuenow="1.5" aria-valuemin="1.0" aria-label="x"></div>',
      'pass',
    ],
    ['<a data-t href="/" aria-current="page">x</a>', 'pass'],
    ['<div data-t role="alert" aria-relevant="text removals"></div>', 'pass'],
    ['<div data-t role="button" aria-expanded="TRUE">x</div>', 'pass'],
    ['<div data-t role="alert" aria-live>x</div>', 'inapplicable'],
    ['<div data-t role="button">x</div>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(ariaAttrValidValue, html)).toBe(expected);
  });

  it.each([
    ['aria-checked', 'mixed', true],
    ['aria-checked', 'undefined', true],
    ['aria-hidden', 'undefined', true],
    ['aria-modal', 'undefined', false],
    ['aria-level', '-2', true],
    ['aria-valuenow', '1e3', true],
    ['aria-valuenow', '.5', true],
    ['aria-valuenow', '1,5', false],
    ['aria-invalid', 'spelling', true],
    ['aria-haspopup', 'dialog', true],
    ['aria-dropeffect', 'copy move', true],
    ['aria-sort', 'up', false],
    ['aria-label', 'qualquer', true],
    ['aria-desconhecido', 'x', true],
  ])('%s="%s" → %s', (name, value, valid) => {
    expect(isValidAriaValue(name, value)).toBe(valid);
  });
});

describe('4.1.2 aria-required-attr', () => {
  it.each([
    ['<div data-t role="heading">Título</div>', 'violation'],
    ['<div data-t role="switch">Alternar</div>', 'violation'],
    [
      '<div data-t role="checkbox" aria-labelledby="l"></div><div id="l">Marque</div>',
      'violation',
    ],
    ['<div data-t role="separator" tabindex="0"></div>', 'violation'],
    ['<input data-t type="text" role="combobox" aria-controls="lb">', 'violation'],
    ['<div data-t role="slider" aria-label="x"></div>', 'violation'],
    ['<div data-t role="heading" aria-level="1">Título</div>', 'pass'],
    ['<div data-t role="checkbox" aria-checked="false">x</div>', 'pass'],
    ['<div data-t role="scrollbar" aria-controls="c" aria-valuenow="0"></div>', 'pass'],
    ['<li data-t role="option">Zebra</li>', 'pass'],
    ['<div data-t role="separator"></div>', 'pass'],
    ['<input data-t type="text" role="combobox" aria-expanded="false">', 'pass'],
    ['<input data-t type="checkbox" role="switch">', 'pass'],
    ['<input data-t type="range" role="slider">', 'inapplicable'],
    ['<div data-t>x</div>', 'inapplicable'],
    ['<input data-t type="checkbox" role="checkbox" aria-label="x">', 'inapplicable'],
    ['<div data-t role="combobox" style="display:none"></div>', 'inapplicable'],
    ['<div data-t role="none">x</div>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(ariaRequiredAttr, html)).toBe(expected);
  });

  it('combobox expandido exige aria-controls', () => {
    const root = mount('<div data-t role="combobox" aria-expanded="true"></div>');
    expect(requiredAttributes('combobox', q(root, '[data-t]'))).toEqual([
      'aria-controls',
      'aria-expanded',
    ]);
  });
});

describe('1.3.1 heading-order (recomendação)', () => {
  it('salto de h2 para h4 é recomendação; sequência correta passa', () => {
    const root = mount(
      '<h1 id="a">A</h1><h2 id="b">B</h2><h4 id="c">C</h4><div role="heading" aria-level="2" id="d">D</div><h3 id="e">E</h3>',
    );
    const ctx = newContext();
    expect(evaluate(headingOrder, q(root, '#a'), ctx)?.outcome).toBe('pass');
    expect(evaluate(headingOrder, q(root, '#b'), ctx)?.outcome).toBe('pass');
    const c = evaluate(headingOrder, q(root, '#c'), ctx);
    expect(c?.outcome).toBe('recommendation');
    expect(c?.data).toEqual({ level: 4, previous: 2 });
    expect(evaluate(headingOrder, q(root, '#d'), ctx)?.outcome).toBe('pass');
    expect(evaluate(headingOrder, q(root, '#e'), ctx)?.outcome).toBe('pass');
  });

  it('cabeçalhos ocultos não contam e o gancho de reavaliação lista todos', () => {
    const root = mount('<h2 id="a">A</h2><h3 hidden>oculto</h3><h5 id="b">B</h5>');
    const ctx = newContext();
    expect(evaluate(headingOrder, q(root, '#b'), ctx)?.outcome).toBe('recommendation');
    const targets = [...(headingOrder.revalidate?.targets(ctx, []) ?? [])];
    expect(targets).toContain(q(root, '#a'));
    expect(targets).toContain(q(root, '#b'));
    expect(headingOrder.revalidate?.trigger(q(root, '#a'), ctx)).toBe(true);
  });

  it('nível: aria-level válido, tag hN ou padrão 2', () => {
    const root = mount(
      '<h3 id="a" aria-level="5">x</h3><h4 id="b" aria-level="x">y</h4><div id="c" role="heading">z</div>',
    );
    expect(headingLevel(q(root, '#a'))).toBe(5);
    expect(headingLevel(q(root, '#b'))).toBe(4);
    expect(headingLevel(q(root, '#c'))).toBe(2);
  });

  it('cabeçalhos em shadow DOM usam a ordem do próprio escopo', () => {
    const root = mount('<div id="h"></div>');
    const shadow = q(root, '#h').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<h2>a</h2><h5 id="s">b</h5>';
    const ctx = newContext([shadow]);
    const s = shadow.getElementById('s');
    if (!s) throw new Error('fixture');
    expect(evaluate(headingOrder, s, ctx)?.outcome).toBe('recommendation');
  });
});
