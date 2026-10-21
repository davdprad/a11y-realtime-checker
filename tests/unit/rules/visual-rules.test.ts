import { describe, expect, it } from 'vitest';
import { targetSize, TARGET_SELECTOR } from '../../../src/rules/target-size';
import {
  gradientStops,
  isLargeText,
  monotonicStops,
  requiredRatio,
  shadowColors,
  textContrast,
} from '../../../src/rules/text-contrast';
import { check, evaluate, mount, newContext, q } from '../helpers';

const P = (style: string, text = 'Texto em português') =>
  `<p data-t style="${style}">${text}</p>`;

describe('1.4.3 text-contrast', () => {
  it.each([
    [P('color:#AAA;background:white'), 'violation'],
    [P('color:rgba(0,0,0,.3);background:#FFF'), 'violation'],
    [
      '<div style="background:#FFF"><p data-t style="color:#000;opacity:.3">Texto</p></div>',
      'violation',
    ],
    [P('color:#777;background:#EEE'), 'violation'],
    ['<button data-t style="color:#777;background:#EEE">Botão</button>', 'violation'],
    [
      P('color:#AAA;background:linear-gradient(to right,#FFF,#00F);width:300px'),
      'violation',
    ],
    [P('color:#666;background:#fff;text-shadow:#aaa 2px 2px 4px'), 'incomplete'],
    [P('color:#ccc;background:#fff;text-shadow:#ddd 1px 1px 1px'), 'violation'],
    [P('color:#333;background:#FFF'), 'pass'],
    [P('color:#000;font-size:18pt;background:#666'), 'pass'],
    [P('color:#000;font-size:14pt;font-weight:700;background:#666'), 'pass'],
    [P(''), 'pass'],
    ['<a data-t href="/">W3C</a>', 'pass'],
    [P('color:#767676;background:#fff'), 'pass'],
  ])('%s → %s', (html, expected) => {
    expect(check(textContrast, html)).toBe(expected);
  });

  it.each([
    [
      P('color:#333;background:linear-gradient(to right,#FFF,#00F);width:500px'),
      'background-image',
    ],
    [P('color:#555;background:black url(x.png)'), 'background-image'],
    [P('color:#ccc;background:#000;text-shadow:0 0 2px black'), 'text-shadow'],
    [P('color:#000;background:#737373;text-shadow:white 0 0 3px'), 'text-shadow'],
    [P('color:#777;background:#fff;filter:blur(0)'), 'filter'],
    [P('color:#777;background:#fff;mix-blend-mode:multiply'), 'blend-mode'],
    [P('color:#777;background:#fff;-webkit-text-stroke:1px black'), 'text-stroke'],
    [P('color:#000;background:#666', '----====++++@@@@'), 'non-text'],
    [
      '<button data-t aria-label="Fechar" style="color:#666;background:#000">X</button>',
      'icon-glyph',
    ],
    [
      P(
        'color:#777;background:#fff;background-image:linear-gradient(red,blue),linear-gradient(red,blue)',
      ),
      'background-image',
    ],
  ])('%s → incomplete (%s)', (html, reason) => {
    const root = mount(html);
    const r = evaluate(textContrast, q(root, '[data-t]'));
    expect(r?.outcome).toBe('incomplete');
    expect(r?.data?.reason).toBe(reason);
  });

  it.each([
    '<p data-t style="display:none">Texto</p>',
    '<p data-t style="position:absolute;top:-999em">Texto</p>',
    '<p data-t style="color:white;background:white" aria-hidden="true">Texto</p>',
    '<p data-t><img src="x.png" alt="x"></p>',
    '<label data-t style="color:#888;background:white">Nome <input disabled></label>',
    '<label id="lb" data-t style="color:#888;background:white">Pet</label><div role="textbox" aria-labelledby="lb" aria-disabled="true">t</div>',
    '<fieldset disabled style="color:#888;background:white"><label data-t>Nome <input></label></fieldset>',
    '<div role="group" aria-disabled="true" style="color:#888;background:white"><label data-t>Nome <input></label></div>',
    '<button data-t style="color:#777;background:#EEE" disabled>Botão</button>',
    '<p data-t style="color:#fff;background:#fff">Texto invisível</p>',
    '<div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"><span data-t style="color:#eee">Só leitores</span></div>',
    '<p data-t style="width:100px;overflow:hidden;text-indent:-9999px;color:#eee">Logo</p>',
    '<p data-t>   </p>',
  ])('não se aplica: %s', (html) => {
    expect(check(textContrast, html)).toBe('inapplicable');
  });

  it('registra razão, mínimo e cores nos dados', () => {
    const root = mount(P('color:#AAA;background:white'));
    const r = evaluate(textContrast, q(root, '[data-t]'));
    expect(r?.data).toMatchObject({
      ratio: 2.32,
      required: 4.5,
      foreground: '#aaaaaa',
      background: '#ffffff',
    });
  });

  it('compõe fundos semitransparentes pelos ancestrais', () => {
    const root = mount(
      '<div style="background:#000"><div style="background:rgba(255,255,255,0.5)"><p data-t style="color:#777">Texto</p></div></div>',
    );
    const r = evaluate(textContrast, q(root, '[data-t]'));
    expect(r?.data?.background).toBe('#808080');
    expect(r?.outcome).toBe('violation');
  });

  it('texto em shadow DOM herda a cor do host', () => {
    const root = mount('<p id="h" style="color:#aaa;background:#fff"></p>');
    const host = q(root, '#h');
    host.attachShadow({ mode: 'open' }).textContent = 'Texto no shadow';
    const r = evaluate(textContrast, host, newContext());
    expect(r?.outcome).toBe('violation');
  });

  it('sobreposição por imagem ou camada posicionada vira incomplete', () => {
    const root = mount(
      '<div style="position:relative;background:#fff;width:300px;height:80px">' +
        '<div style="position:absolute;inset:0;background:#000"></div>' +
        '<p data-t style="position:relative;color:#eee;margin:0">Título sobre banner</p></div>',
    );
    expect(evaluate(textContrast, q(root, '[data-t]'))?.data?.reason).toBe(
      'overlap-layer',
    );
    const root2 = mount(
      '<div style="background:#fff;width:300px"><img src="x.png" style="display:block;width:300px;height:40px;margin-bottom:-40px">' +
        '<p data-t style="color:#eee;margin:0;height:40px">Sobre imagem</p></div>',
    );
    expect(evaluate(textContrast, q(root2, '[data-t]'))?.data?.reason).toBe(
      'overlap-graphic',
    );
  });

  it('texto grande e mínimos', () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 400)).toBe(false);
    expect(isLargeText(18, 700)).toBe(false);
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(32, 400)).toBe(3);
  });

  it('paradas de gradiente e monotonicidade', () => {
    expect(
      gradientStops('linear-gradient(to right, rgb(255, 255, 255), rgb(0, 0, 255))')
        ?.stops,
    ).toHaveLength(2);
    expect(gradientStops('url("x.png")')).toBeNull();
    expect(
      gradientStops('linear-gradient(red, blue), linear-gradient(red, blue)'),
    ).toBeNull();
    expect(gradientStops('conic-gradient(rgb(0, 0, 0), rgb(255, 255, 255))')?.wrap).toBe(
      true,
    );
    expect(
      gradientStops('linear-gradient(90deg, banana, rgb(0, 0, 0))')?.stops,
    ).toHaveLength(1);
    const w = { r: 1, g: 1, b: 1, a: 1 };
    const b = { r: 0, g: 0, b: 1, a: 1 };
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const green = { r: 0, g: 1, b: 0, a: 1 };
    expect(monotonicStops([w, b], false)).toBe(true);
    expect(monotonicStops([red, green], false)).toBe(false);
    expect(monotonicStops([w, b], true)).toBe(true);
  });

  it('cores de text-shadow', () => {
    expect(
      shadowColors('rgb(170, 170, 170) 2px 2px 4px, rgba(0, 0, 0, 0.5) 0px 0px 1px'),
    ).toHaveLength(2);
    expect(shadowColors('2px 2px 4px')).toBeNull();
  });
});

describe('2.5.8 target-size', () => {
  it.each([
    [
      '<div><button data-t style="width:16px;height:16px;padding:0;border:0"></button><button style="width:16px;height:16px;padding:0;border:0;margin-left:2px"></button></div>',
      'violation',
    ],
    [
      '<button data-t style="width:24px;height:24px;padding:0;border:0">a</button>',
      'pass',
    ],
    [
      '<button data-t style="width:16px;height:16px;padding:0;border:0">a</button>',
      'pass',
    ],
    ['<p>Leia o <a data-t href="/">artigo</a> completo.</p>', 'incomplete'],
    ['<input data-t type="checkbox">', 'incomplete'],
    ['<button data-t style="width:10px;height:10px" disabled></button>', 'inapplicable'],
    [
      '<button data-t style="width:10px;height:10px;display:none"></button>',
      'inapplicable',
    ],
    [
      '<button data-t style="width:10px;height:10px;pointer-events:none"></button>',
      'inapplicable',
    ],
    ['<div data-t>não é alvo</div>', 'inapplicable'],
  ])('%s → %s', (html, expected) => {
    expect(check(targetSize, html)).toBe(expected);
  });

  it('link inline pequeno dentro de frase é inconclusivo', () => {
    const root = mount(
      '<p style="font-size:10px;line-height:12px">Veja <a data-t href="/">aqui</a> e <a href="/b">ali</a>.</p>',
    );
    const r = evaluate(targetSize, q(root, '[data-t]'));
    expect(['incomplete', 'pass']).toContain(r?.outcome);
    if (r?.outcome === 'incomplete') expect(r.data?.reason).toBe('inline');
  });

  it('alvos aninhados não contam no espaçamento', () => {
    const root = mount(
      '<a href="/card" style="display:block;width:200px;height:200px"><button data-t style="width:16px;height:16px;padding:0;border:0"></button></a>',
    );
    expect(evaluate(targetSize, q(root, '[data-t]'))?.outcome).toBe('pass');
  });

  it('alvos em shadow DOM entram no cálculo e o gancho de reavaliação os lista', () => {
    const root = mount('<div id="h"></div>');
    const shadow = q(root, '#h').attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<button id="s1" style="width:16px;height:16px;padding:0;border:0"></button><button style="width:16px;height:16px;padding:0;border:0"></button>';
    const ctx = newContext([shadow]);
    const s1 = shadow.getElementById('s1');
    if (!s1) throw new Error('fixture');
    expect(evaluate(targetSize, s1, ctx)?.outcome).toBe('violation');
    expect([...(targetSize.revalidate?.targets(ctx, [s1]) ?? [])]).toContain(s1);
    expect(targetSize.revalidate?.trigger(s1, ctx)).toBe(true);
    expect(s1.matches(TARGET_SELECTOR)).toBe(true);
  });
});
