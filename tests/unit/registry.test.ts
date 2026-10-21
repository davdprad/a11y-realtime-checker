import { describe, expect, it } from 'vitest';
import {
  applyDelta,
  diffOccurrences,
  isReported,
  Registry,
  worstOutcome,
} from '../../src/core/registry';
import type { Occurrence } from '../../src/messaging/protocol';
import type { RuleResult } from '../../src/rules/types';
import { mount, q } from './helpers';

function result(
  el: Element,
  ruleId: string,
  wcag: string,
  outcome: RuleResult['outcome'],
  data?: RuleResult['data'],
): RuleResult {
  return {
    ruleId,
    wcag,
    level: 'A',
    outcome,
    element: el,
    messageKey: ruleId.replace(/-/g, '_'),
    ...(data ? { data } : {}),
  };
}

function newRegistry(now = () => 1000): Registry {
  return new Registry({
    selectorOf: (el) => `#${el.id}`,
    now,
    frameUrl: () => 'http://localhost/x',
    documentRuleIds: new Set(['html-lang']),
  });
}

describe('Registry', () => {
  it('cria uma ocorrência por par (elemento, critério)', () => {
    const root = mount('<button id="b"></button><img id="i">');
    const b = q(root, '#b');
    const reg = newRegistry();
    reg.set(b, 'button-name', result(b, 'button-name', '4.1.2', 'violation'));
    reg.set(b, 'aria-role-valid', result(b, 'aria-role-valid', '4.1.2', 'violation'));
    reg.set(b, 'target-size', result(b, 'target-size', '2.5.8', 'incomplete'));
    const d = reg.commit();
    expect(d.added).toHaveLength(2);
    expect(d.updated).toHaveLength(0);
    const occ412 = d.added.find((o) => o.wcag === '4.1.2');
    expect(occ412?.rules.map((r) => r.ruleId)).toEqual([
      'aria-role-valid',
      'button-name',
    ]);
    expect(occ412?.outcome).toBe('violation');
    expect(occ412?.selector).toBe('#b');
    expect(occ412?.frameUrl).toBe('http://localhost/x');
    expect(reg.size).toBe(2);
    expect(reg.countByOutcome('incomplete')).toBe(1);
  });

  it('não guarda pass/inapplicable e não gera delta sem mudança', () => {
    const root = mount('<button id="b">ok</button>');
    const b = q(root, '#b');
    const reg = newRegistry();
    reg.set(b, 'button-name', result(b, 'button-name', '4.1.2', 'pass'));
    expect(reg.commit()).toEqual({ added: [], updated: [], removed: [] });
    reg.set(b, 'button-name', result(b, 'button-name', '4.1.2', 'violation'));
    reg.commit();
    reg.set(b, 'button-name', result(b, 'button-name', '4.1.2', 'violation'));
    expect(reg.hasPendingChanges).toBe(false);
    expect(reg.commit().added).toHaveLength(0);
  });

  it('atualiza quando os dados mudam e remove quando passa', () => {
    const root = mount('<p id="p">x</p>');
    const p = q(root, '#p');
    let t = 1000;
    const reg = newRegistry(() => t);
    reg.set(
      p,
      'text-contrast',
      result(p, 'text-contrast', '1.4.3', 'violation', { ratio: 2 }),
    );
    const first = reg.commit().added[0];
    t = 2000;
    reg.set(
      p,
      'text-contrast',
      result(p, 'text-contrast', '1.4.3', 'violation', { ratio: 3 }),
    );
    const upd = reg.commit();
    expect(upd.updated).toHaveLength(1);
    expect(upd.updated[0]?.firstSeen).toBe(1000);
    expect(upd.updated[0]?.updatedAt).toBe(2000);
    reg.set(p, 'text-contrast', null);
    const rem = reg.commit();
    expect(rem.removed).toEqual([first?.id]);
    expect(reg.snapshot()).toHaveLength(0);
  });

  it('remove ocorrências de elementos desconectados', () => {
    const root = mount('<img id="a"><img id="b">');
    const a = q(root, '#a');
    const b = q(root, '#b');
    const reg = newRegistry();
    reg.set(a, 'image-name', result(a, 'image-name', '1.1.1', 'violation'));
    reg.set(b, 'image-name', result(b, 'image-name', '1.1.1', 'violation'));
    reg.commit();
    a.remove();
    expect(reg.dropDisconnected()).toBe(1);
    const d = reg.commit();
    expect(d.removed).toHaveLength(1);
    expect(reg.occurrenceElements()).toEqual([b]);
  });

  it('substitui resultados de regra de documento e marca pageLevel', () => {
    const root = mount('<span id="x"></span><span id="y"></span>');
    const x = q(root, '#x');
    const y = q(root, '#y');
    const reg = newRegistry();
    reg.replaceRuleResults('html-lang', [result(x, 'html-lang', '3.1.1', 'violation')]);
    const d1 = reg.commit();
    expect(d1.added[0]?.pageLevel).toBe(true);
    reg.replaceRuleResults('html-lang', [result(y, 'html-lang', '3.1.1', 'violation')]);
    const d2 = reg.commit();
    expect(d2.added).toHaveLength(1);
    expect(d2.removed).toHaveLength(1);
    expect(reg.elementsForRule('html-lang')).toEqual([y]);
  });

  it('lookup por id e por elemento, e limpeza total', () => {
    const root = mount('<a id="l" href="#"></a>');
    const l = q(root, '#l');
    const reg = newRegistry();
    reg.set(l, 'link-name', result(l, 'link-name', '2.4.4', 'violation'));
    const id = reg.commit().added[0]?.id ?? '';
    expect(reg.elementFor(id)).toBe(l);
    expect(reg.occurrence(id)?.wcag).toBe('2.4.4');
    expect(reg.occurrenceIdsFor(l)).toEqual([id]);
    expect(reg.get(l, 'link-name')?.outcome).toBe('violation');
    expect(reg.elementId(l)).toBe(reg.elementId(l));
    reg.clearAll();
    expect(reg.commit().removed).toEqual([id]);
  });
});

describe('deltas', () => {
  const occ = (id: string, outcome: Occurrence['outcome'] = 'violation'): Occurrence => ({
    id,
    wcag: '1.1.1',
    level: 'A',
    outcome,
    rules: [{ ruleId: 'image-name', outcome, messageKey: 'image_name' }],
    selector: 'img',
    snippet: '<img>',
    tag: 'img',
    pageLevel: false,
    firstSeen: 1,
    updatedAt: 1,
    frameId: 0,
    frameUrl: '',
  });

  it('applyDelta e diffOccurrences são inversos', () => {
    const prev = new Map([
      ['a', occ('a')],
      ['b', occ('b')],
    ]);
    const next = [occ('b', 'incomplete'), occ('c')];
    const d = diffOccurrences(prev, next);
    expect(d.added.map((o) => o.id)).toEqual(['c']);
    expect(d.updated.map((o) => o.id)).toEqual(['b']);
    expect(d.removed).toEqual(['a']);
    applyDelta(prev, d);
    expect([...prev.keys()].sort()).toEqual(['b', 'c']);
    expect(prev.get('b')?.outcome).toBe('incomplete');
  });

  it('serialização: ocorrências atravessam JSON sem perdas', () => {
    const o = occ('z');
    expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  });

  it('pior resultado e resultados reportáveis', () => {
    expect(worstOutcome(['recommendation', 'incomplete'])).toBe('incomplete');
    expect(worstOutcome(['incomplete', 'violation'])).toBe('violation');
    expect(worstOutcome([])).toBeNull();
    expect(isReported('pass')).toBe(false);
    expect(isReported('recommendation')).toBe(true);
  });
});
