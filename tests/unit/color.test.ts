import { describe, expect, it } from 'vitest';
import {
  BLACK,
  compositeOver,
  contrastRatio,
  linearizeChannel,
  over,
  parseColor,
  premultiply,
  relativeLuminance,
  scaleOpacity,
  toHex,
  unpremultiply,
  WHITE,
} from '../../src/lib/color';

const rgb = (r: number, g: number, b: number, a = 1) => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
  a,
});

describe('luminância e contraste (WCAG 2.2)', () => {
  it('preto e branco = 21:1', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 10);
  });

  it('#767676 sobre branco ≈ 4,54:1 (menor cinza que passa em 4,5:1)', () => {
    const r = contrastRatio(rgb(0x76, 0x76, 0x76), WHITE);
    expect(r).toBeGreaterThan(4.5);
    expect(r).toBeCloseTo(4.54, 2);
  });

  it('#777777 sobre branco fica abaixo de 4,5:1 (sem arredondar)', () => {
    expect(contrastRatio(rgb(0x77, 0x77, 0x77), WHITE)).toBeLessThan(4.5);
  });

  it('cores iguais = 1:1', () => {
    expect(contrastRatio(rgb(10, 20, 30), rgb(10, 20, 30))).toBe(1);
  });

  it('linearização usa o limiar 0,04045', () => {
    expect(linearizeChannel(0.04045)).toBeCloseTo(0.04045 / 12.92, 12);
    expect(linearizeChannel(1)).toBeCloseTo(1, 12);
    expect(linearizeChannel(0.5)).toBeCloseTo(0.214041, 6);
  });

  it('luminância relativa de cores primárias', () => {
    expect(relativeLuminance(rgb(255, 0, 0))).toBeCloseTo(0.2126, 6);
    expect(relativeLuminance(rgb(0, 255, 0))).toBeCloseTo(0.7152, 6);
    expect(relativeLuminance(rgb(0, 0, 255))).toBeCloseTo(0.0722, 6);
  });
});

describe('composição alfa', () => {
  it('preto 30% sobre branco = cinza claro (#b3b3b3)', () => {
    expect(toHex(compositeOver(rgb(0, 0, 0, 0.3), WHITE))).toBe('#b3b3b3');
  });

  it('cor opaca cobre o fundo', () => {
    const c = compositeOver(rgb(10, 20, 30), WHITE);
    expect(toHex(c)).toBe('#0a141e');
    expect(c.a).toBe(1);
  });

  it('transparente não altera o fundo', () => {
    expect(toHex(compositeOver(rgb(0, 0, 0, 0), rgb(1, 2, 3)))).toBe('#010203');
  });

  it('camadas semitransparentes se acumulam', () => {
    const two = compositeOver(rgb(0, 0, 0, 0.5), compositeOver(rgb(0, 0, 0, 0.5), WHITE));
    expect(two.r).toBeCloseTo(0.25, 10);
  });

  it('opacidade de grupo escala a camada pré-multiplicada', () => {
    const g = scaleOpacity(premultiply(BLACK), 0.3);
    expect(toHex(unpremultiply(over(g, premultiply(WHITE))))).toBe('#b3b3b3');
  });

  it('despremultiplicar alfa 0 devolve transparente', () => {
    expect(unpremultiply({ r: 0, g: 0, b: 0, a: 0 }).a).toBe(0);
  });
});

describe('parseColor', () => {
  it.each([
    ['rgb(255, 0, 0)', rgb(255, 0, 0)],
    ['rgba(0, 0, 0, 0.3)', rgb(0, 0, 0, 0.3)],
    ['rgb(10 20 30 / 50%)', rgb(10, 20, 30, 0.5)],
    ['rgb(100%, 0%, 0%)', rgb(255, 0, 0)],
    ['transparent', rgb(0, 0, 0, 0)],
    ['#fff', rgb(255, 255, 255)],
    ['#00000080', rgb(0, 0, 0, 128 / 255)],
    ['color(srgb 1 0 0)', rgb(255, 0, 0)],
    ['color(srgb 0 0 1 / 0.5)', rgb(0, 0, 255, 0.5)],
  ])('%s', (input, expected) => {
    const c = parseColor(input);
    expect(c).not.toBeNull();
    expect(c?.r).toBeCloseTo(expected.r, 6);
    expect(c?.g).toBeCloseTo(expected.g, 6);
    expect(c?.b).toBeCloseTo(expected.b, 6);
    expect(c?.a).toBeCloseTo(expected.a, 6);
  });

  it.each([
    ['oklch(0.628 0.2577 29.23)', '#ff0000'],
    ['oklab(1 0 0)', '#ffffff'],
    ['lab(0 0 0)', '#000000'],
    ['lab(100 0 0)', '#ffffff'],
    ['lch(54.29 106.84 40.85)', '#ff0000'],
    ['color(srgb-linear 1 1 1)', '#ffffff'],
    ['color(display-p3 1 1 1)', '#ffffff'],
    ['color(xyz-d65 0.9505 1 1.089)', '#ffffff'],
    ['color(xyz-d50 0.9642 1 0.8249)', '#ffffff'],
  ])('converte %s para sRGB', (input, hex) => {
    const c = parseColor(input);
    expect(c).not.toBeNull();
    if (c) expect(toHex(c)).toBe(hex);
  });

  it('unidades de matiz (turn, rad, grad) com croma zero dão cinza', () => {
    for (const v of ['oklch(0.5 0 0.5turn)', 'lch(50 0 1rad)', 'lch(50 0 100grad)']) {
      const c = parseColor(v);
      expect(c).not.toBeNull();
      if (c) {
        expect(c.r).toBeCloseTo(c.g, 4);
        expect(c.g).toBeCloseTo(c.b, 4);
      }
    }
  });

  it('confere a cor computada pelo próprio Chromium para oklch()', () => {
    const el = document.createElement('div');
    el.style.color = 'oklch(0.7 0.1 200)';
    document.body.append(el);
    const computed = getComputedStyle(el).color;
    el.remove();
    const c = parseColor(computed);
    expect(c).not.toBeNull();
  });

  it.each([
    'color(rec2020 1 0 0)',
    'hsl(0 100% 50%)',
    'rgb(1, 2)',
    'banana',
    '#12',
    'rgb(a, b, c)',
    'lch(50 0 xyz)',
  ])('não interpreta %s (vira incomplete)', (input) => {
    expect(parseColor(input)).toBeNull();
  });

  it('aceita "none" como 0', () => {
    expect(toHex(parseColor('rgb(none 0 0)') ?? WHITE)).toBe('#000000');
  });
});
