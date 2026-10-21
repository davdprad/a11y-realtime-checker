/**
 * 1.4.3 Contraste (mínimo) (AA) — ACT afw4f7.
 *
 * Unidade avaliada: o elemento que contém diretamente nós de texto visíveis.
 * A cor do texto é composta sobre o fundo efetivo, obtido compondo (alfa e
 * `opacity` de grupo) as cores de fundo computadas de toda a cadeia de
 * ancestrais na árvore plana até a tela branca do documento.
 *
 * Mínimos: 4,5:1 (texto normal) e 3:1 (texto grande: ≥ 24 px, ou ≥ 18,66 px
 * com peso ≥ 700). A comparação usa a razão sem arredondamento.
 *
 * Resultado `incomplete` (não decidível de forma determinística):
 * imagem/gradiente de fundo, `filter`, `backdrop-filter`, `mix-blend-mode`,
 * `text-shadow`, contorno de texto, sobreposição de outros elementos, cor em
 * espaço não suportado, tela escura do navegador, texto sem linguagem humana
 * (só símbolos) e glifos isolados usados como ícone (ex.: "X" com
 * `aria-label="Fechar"`).
 *
 * Não se aplica (exceções do critério e da ACT): texto oculto, fora do
 * documento, recortado (padrão "sr-only"), em SVG, em controles desabilitados
 * ou em rótulos de controles desabilitados, e texto com a mesma cor do fundo.
 */
import {
  compositeOver,
  contrastRatio,
  over,
  parseColor,
  premultiply,
  scaleOpacity,
  toHex,
  unpremultiply,
  WHITE,
  type PremultipliedRGBA,
  type RGBA,
} from '../lib/color';
import {
  directTextNodes,
  flatAncestors,
  flatContains,
  getElementByIdInScope,
  hasNonWhitespace,
  idrefs,
  isHtmlElement,
} from '../lib/dom';
import {
  overlapArea,
  rectFrom,
  SpatialGrid,
  unionRects,
  type Rect,
} from '../lib/geometry';
import { isClippedAway, isOffDocument, toDocumentRect } from '../lib/visibility';
import type { EvalContext, ResultData, Rule, RuleResult } from './types';
import { base, makeResult } from './util';

const meta = base('text-contrast');

export const NORMAL_TEXT_MIN = 4.5;
export const LARGE_TEXT_MIN = 3;

/** Texto grande segundo a WCAG: 18 pt (24 px) ou 14 pt (≈18,66 px) em negrito. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
}

export function requiredRatio(fontSizePx: number, fontWeight: number): number {
  return isLargeText(fontSizePx, fontWeight) ? LARGE_TEXT_MIN : NORMAL_TEXT_MIN;
}

const SKIP_TAGS = new Set([
  'title',
  'script',
  'style',
  'noscript',
  'template',
  'option',
  'optgroup',
  'textarea',
  'select',
]);

interface TextInfo {
  readonly text: string;
  /** União dos retângulos dos glifos (coordenadas de viewport). */
  readonly rect: Rect;
}

function textInfo(el: Element, ctx: EvalContext): TextInfo | null {
  return ctx.memoFor('text-info', el, () => {
    const nodes = directTextNodes(el).filter((t) => hasNonWhitespace(t.data));
    if (nodes.length === 0) return null;
    const range = ctx.doc.createRange();
    const rects: Rect[] = [];
    for (const node of nodes) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) rects.push(rectFrom(r));
    }
    range.detach();
    const rect = unionRects(rects);
    if (!rect) return null;
    return {
      text: nodes
        .map((n) => n.data)
        .join(' ')
        .trim(),
      rect,
    };
  });
}

/** Conjunto de elementos usados como rótulo de widgets desabilitados (por lote). */
function disabledLabels(ctx: EvalContext): ReadonlySet<Element> {
  return ctx.memo('run:disabled-labels', () => {
    const set = new Set<Element>();
    const isDisabledWidget = (w: Element): boolean =>
      w.matches(':disabled') || w.closest('[aria-disabled="true" i]') !== null;
    for (const w of ctx.doc.querySelectorAll('[aria-labelledby]')) {
      if (!isDisabledWidget(w)) continue;
      for (const id of idrefs(w.getAttribute('aria-labelledby'))) {
        const ref = getElementByIdInScope(w, id);
        if (ref) set.add(ref);
      }
    }
    for (const label of ctx.doc.querySelectorAll('label')) {
      const control = label.control;
      if (control && isDisabledWidget(control)) set.add(label);
    }
    return set;
  });
}

/** Texto em widget/grupo desabilitado ou em rótulo de widget desabilitado (exceção ACT). */
function inDisabledContext(el: Element, ctx: EvalContext): boolean {
  const labels = disabledLabels(ctx);
  for (const node of [el, ...flatAncestors(el)]) {
    if (node.matches(':disabled')) return true;
    if (node.getAttribute('aria-disabled')?.trim().toLowerCase() === 'true') return true;
    if (labels.has(node)) return true;
  }
  return false;
}

export const textContrast: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    if (!isHtmlElement(el) || SKIP_TAGS.has(el.localName)) return false;
    if (directTextNodes(el).every((t) => !hasNonWhitespace(t.data))) return false;
    if (ctx.hiddenFromAT(el)) return false;
    const info = textInfo(el, ctx);
    if (!info) return false;
    if (isOffDocument(toDocumentRect(info.rect, ctx.scroll))) return false;
    if (
      isClippedAway(
        el,
        info.rect,
        (e) => ctx.style(e),
        (e) => ctx.rect(e),
      )
    )
      return false;
    return !inDisabledContext(el, ctx);
  },
  evaluate(el, ctx) {
    const info = textInfo(el, ctx);
    if (!info) return makeResult(meta, el, 'inapplicable', 'text_contrast');
    return evaluateContrast(el, info, ctx);
  },
};

function incomplete(el: Element, reason: string, extra: ResultData = {}): RuleResult {
  return makeResult(meta, el, 'incomplete', 'text_contrast_incomplete', {
    reason,
    ...extra,
  });
}

const GRAPHIC_SELECTOR =
  'img, svg, video, canvas, picture, iframe, object, embed, input[type="image" i]';
const SUBTREE_SCAN_LIMIT = 1500;

interface GraphicEntry {
  readonly el: Element;
  readonly rect: Rect;
}

function isPositioned(pos: string): boolean {
  return pos === 'absolute' || pos === 'fixed';
}

function hasPaint(s: CSSStyleDeclaration): boolean {
  if (s.backgroundImage !== 'none') return true;
  const bg = parseColor(s.backgroundColor);
  return bg === null || bg.a > 0;
}

function evaluateContrast(el: Element, info: TextInfo, ctx: EvalContext): RuleResult {
  const s = ctx.style(el);

  // Texto sem linguagem humana ou glifo isolado usado como ícone.
  if (!/[\p{L}\p{N}]/u.test(info.text)) return incomplete(el, 'non-text');
  if (graphemeCount(info.text) <= 2 && hasAuthorName(el))
    return incomplete(el, 'icon-glyph');

  const shadows = s.textShadow === 'none' ? [] : shadowColors(s.textShadow);
  if (shadows === null) return incomplete(el, 'text-shadow');
  const strokeWidth = parseFloat(s.getPropertyValue('-webkit-text-stroke-width'));
  if (strokeWidth > 0) return incomplete(el, 'text-stroke');

  const fill = s.getPropertyValue('-webkit-text-fill-color');
  const fg = parseColor(fill && fill !== 'currentcolor' ? fill : s.color);
  if (!fg) return incomplete(el, 'color-space');

  // Cadeia do elemento do texto até a raiz (árvore plana).
  const chain = [el, ...flatAncestors(el)];
  const styles = chain.map((e) => ctx.style(e));
  const bgs: RGBA[] = [];
  for (const st of styles) {
    if (st.filter !== 'none' || (st.backdropFilter && st.backdropFilter !== 'none')) {
      return incomplete(el, 'filter');
    }
    if (st.mixBlendMode !== 'normal') return incomplete(el, 'blend-mode');
    const bg = parseColor(st.backgroundColor);
    if (!bg) return incomplete(el, 'color-space');
    bgs.push(bg);
  }

  // Primeiro elemento com fundo opaco ("fonte do fundo"). Um único gradiente
  // CSS (sem url()) é aceito e tratado como um conjunto de cores candidatas.
  let sourceIdx = chain.length - 1;
  let opacityBelow = false;
  let gradient: { index: number; stops: RGBA[]; wrap: boolean } | null = null;
  for (let i = 0; i < chain.length; i++) {
    const st = styles[i];
    const bg = bgs[i];
    if (!st || !bg) continue;
    if (st.backgroundImage !== 'none') {
      const parsed: { stops: RGBA[]; wrap: boolean } | null =
        gradient === null ? gradientStops(st.backgroundImage) : null;
      if (!parsed) return incomplete(el, 'background-image');
      gradient = { index: i, ...parsed };
      if (bg.a >= 1 || parsed.stops.every((c) => c.a >= 1)) {
        sourceIdx = i;
        break;
      }
    } else if (bg.a >= 1) {
      sourceIdx = i;
      break;
    }
    if (parseFloat(st.opacity) < 1) opacityBelow = true;
  }
  // Acima da fonte do fundo, imagens só importam se houver opacidade no caminho.
  for (let i = sourceIdx + 1; i < chain.length; i++) {
    const st = styles[i];
    if (!st) continue;
    if (parseFloat(st.opacity) < 1) opacityBelow = true;
    if (opacityBelow && st.backgroundImage !== 'none')
      return incomplete(el, 'background-image');
  }

  const overlap = findOverlap(el, chain, styles, sourceIdx, info.rect, ctx);
  if (overlap) return incomplete(el, overlap);

  const dark = darkCanvas(ctx);
  const canvas = premultiply(WHITE);
  /** Compõe texto e fundo; `stop` substitui a camada do gradiente por uma de suas cores. */
  const compose = (stop: RGBA | null): { fg: RGBA; bg: RGBA; canvasUsed: boolean } => {
    const bgAt = (i: number): RGBA => {
      const bg = bgs[i] ?? { r: 0, g: 0, b: 0, a: 0 };
      return stop && gradient?.index === i ? compositeOver(stop, bg) : bg;
    };
    const layer = (i: number, withText: boolean): PremultipliedRGBA => {
      let acc = premultiply(bgAt(i));
      if (i > 0) acc = over(group(i - 1, withText), acc);
      else if (withText) acc = over(premultiply(fg), acc);
      return acc;
    };
    const group = (i: number, withText: boolean): PremultipliedRGBA => {
      const st = styles[i];
      const opacity = st ? parseFloat(st.opacity) : 1;
      return scaleOpacity(layer(i, withText), Number.isFinite(opacity) ? opacity : 1);
    };
    const top = chain.length - 1;
    const withText = group(top, true);
    const noText = group(top, false);
    return {
      fg: unpremultiply(over(withText, canvas)),
      bg: unpremultiply(over(noText, canvas)),
      canvasUsed: withText.a < 1 || noText.a < 1,
    };
  };

  const fontSize = parseFloat(s.fontSize);
  const fontWeight = parseInt(s.fontWeight, 10) || 400;
  const required = requiredRatio(fontSize, fontWeight);
  const describe = (
    c: { fg: RGBA; bg: RGBA },
    ratio: number,
    extra: ResultData = {},
  ): ResultData => ({
    ratio: Math.round(ratio * 100) / 100,
    required,
    foreground: toHex(c.fg),
    background: toHex(c.bg),
    fontSize: Math.round(fontSize * 100) / 100,
    fontWeight,
    ...extra,
  });

  if (gradient) {
    // "Maior contraste possível" (ACT): se nem a cor mais favorável do
    // gradiente atinge o mínimo, é violação. Só é seguro quando, entre cada par
    // de paradas, todos os canais variam no mesmo sentido (luminância monotônica,
    // logo os extremos estão nas paradas).
    if (shadows.length > 0) return incomplete(el, 'background-image');
    const stopsComposed = gradient.stops.map((c) => compose(c));
    const candidates = [compose(null), ...stopsComposed];
    if (dark && candidates.some((c) => c.canvasUsed)) return incomplete(el, 'canvas');
    if (
      !monotonicStops(
        stopsComposed.map((c) => c.bg),
        gradient.wrap,
      )
    )
      return incomplete(el, 'background-image');
    let best = candidates[0];
    let bestRatio = 0;
    for (const c of candidates) {
      const r = contrastRatio(c.fg, c.bg);
      if (r > bestRatio) {
        bestRatio = r;
        best = c;
      }
    }
    if (best && bestRatio < required) {
      return makeResult(
        meta,
        el,
        'violation',
        'text_contrast',
        describe(best, bestRatio, { gradient: 1 }),
      );
    }
    return incomplete(el, 'background-image');
  }

  const plain = compose(null);
  if (plain.canvasUsed && dark) return incomplete(el, 'canvas');
  const ratio = contrastRatio(plain.fg, plain.bg);
  // Mesma cor do fundo (1:1) não é "apresentação visual de texto" (nota da ACT).
  if (ratio <= 1.000001) return makeResult(meta, el, 'inapplicable', 'text_contrast');
  const data = describe(plain, ratio);
  if (shadows.length > 0) {
    // Com sombra, a ACT usa o maior contraste possível entre o texto e as cores
    // de fundo (inclusive a sombra). Só há decisão se nem a sombra bastaria.
    const best = Math.max(
      ratio,
      ...shadows.map((c) => contrastRatio(plain.fg, compositeOver(c, plain.bg))),
    );
    return best < required
      ? makeResult(meta, el, 'violation', 'text_contrast', { ...data, shadow: 1 })
      : incomplete(el, 'text-shadow');
  }
  return ratio < required
    ? makeResult(meta, el, 'violation', 'text_contrast', data)
    : makeResult(meta, el, 'pass', 'text_contrast', data);
}

const COLOR_FN = /(?:rgba?|color|lab|lch|oklab|oklch)\([^)]*\)/gi;

/** Divide uma lista CSS por vírgulas de nível superior. */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.map((p) => p.trim());
}

/**
 * Paradas de cor de um único gradiente CSS (valor computado de
 * `background-image`). `null` para imagens (url), múltiplas camadas ou
 * valores não interpretáveis.
 */
export function gradientStops(value: string): { stops: RGBA[]; wrap: boolean } | null {
  if (/url\(/i.test(value)) return null;
  const layers = splitTopLevel(value);
  if (layers.length !== 1) return null;
  const layer = layers[0] ?? '';
  const m = /^(repeating-)?(linear|radial|conic)-gradient\(/i.exec(layer);
  if (!m) return null;
  const colors = (layer.match(COLOR_FN) ?? []).map((c) => parseColor(c));
  if (colors.length === 0 || colors.some((c) => c === null)) return null;
  return {
    stops: colors as RGBA[],
    wrap: m[2]?.toLowerCase() === 'conic' || m[1] !== undefined,
  };
}

/** Entre paradas consecutivas, R, G e B variam todos no mesmo sentido? */
export function monotonicStops(colors: readonly RGBA[], wrap: boolean): boolean {
  const pairs: [RGBA, RGBA][] = [];
  for (let i = 1; i < colors.length; i++) {
    const a = colors[i - 1];
    const b = colors[i];
    if (a && b) pairs.push([a, b]);
  }
  const first = colors[0];
  const last = colors[colors.length - 1];
  if (wrap && first && last && colors.length > 1) pairs.push([last, first]);
  const eps = 1e-9;
  return pairs.every(([a, b]) => {
    const d = [b.r - a.r, b.g - a.g, b.b - a.b];
    return d.every((x) => x >= -eps) || d.every((x) => x <= eps);
  });
}

/** Cores das sombras de `text-shadow` (valor computado); `null` se não interpretável. */
export function shadowColors(value: string): RGBA[] | null {
  const out: RGBA[] = [];
  for (const layer of splitTopLevel(value)) {
    const m = /(?:rgba?|color|lab|lch|oklab|oklch)\([^)]*\)/i.exec(layer);
    const c = m ? parseColor(m[0]) : null;
    if (!c) return null;
    out.push(c);
  }
  return out;
}

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

/** Número de grafemas (caracteres percebidos), para reconhecer glifos-ícone. */
function graphemeCount(text: string): number {
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

/** O próprio elemento (ou um ancestral próximo) define nome por aria-label/labelledby? */
function hasAuthorName(el: Element): boolean {
  let cur: Element | null = el;
  for (let depth = 0; cur && depth < 4; depth++) {
    if ((cur.getAttribute('aria-label') ?? '').trim() !== '') return true;
    if ((cur.getAttribute('aria-labelledby') ?? '').trim() !== '') return true;
    cur = cur.parentElement;
  }
  return false;
}

function darkCanvas(ctx: EvalContext): boolean {
  const scheme = ctx.style(ctx.doc.documentElement).colorScheme;
  if (!scheme.includes('dark')) return false;
  if (!scheme.includes('light')) return true;
  return ctx.win.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Procura elementos que se sobrepõem ao texto sem estarem na cadeia de
 * ancestrais (o fundo calculado pela cadeia estaria errado):
 * 1. imagens/mídias dentro da fonte do fundo que cruzam o texto;
 * 2. camadas posicionadas (absolute/fixed) com pintura dentro do escopo do
 *    ancestral posicionado mais próximo (ex.: banner com fundo absoluto).
 */
function findOverlap(
  el: Element,
  chain: readonly Element[],
  styles: readonly CSSStyleDeclaration[],
  sourceIdx: number,
  textRect: Rect,
  ctx: EvalContext,
): string | null {
  const source = chain[sourceIdx] ?? ctx.doc.documentElement;
  const chainSet = new Set(chain);
  const isForeign = (x: Element): boolean => !chainSet.has(x) && !flatContains(el, x);

  // Índice espacial das imagens/mídias da fonte do fundo (uma vez por execução).
  const index = ctx.memo(
    'run:graphics',
    () => new WeakMap<Element, SpatialGrid<GraphicEntry>>(),
  );
  let grid = index.get(source);
  if (!grid) {
    const entries: GraphicEntry[] = [];
    for (const g of source.querySelectorAll(GRAPHIC_SELECTOR)) {
      const r = g.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) entries.push({ el: g, rect: rectFrom(r) });
    }
    grid = new SpatialGrid(entries);
    index.set(source, grid);
  }
  for (const g of grid.query(textRect, 0)) {
    if (!isForeign(g.el) || !ctx.rendered(g.el)) continue;
    if (overlapArea(g.rect, textRect) >= 1) return 'overlap-graphic';
  }

  // Escopo para camadas posicionadas: se o texto (ou um ancestral abaixo da
  // fonte do fundo) é absolute/fixed, a fonte inteira; senão, o ancestral
  // posicionado mais alto até a fonte (ex.: <section position:relative> de um
  // banner, que contém o fundo absoluto e o título).
  let strict = false;
  let highest = -1;
  for (let i = 0; i <= sourceIdx; i++) {
    const pos = styles[i]?.position ?? 'static';
    if (i < sourceIdx && isPositioned(pos)) strict = true;
    if (pos !== 'static') highest = i;
  }
  const scope: Element | null = strict
    ? source
    : highest >= 0
      ? (chain[highest] ?? null)
      : null;
  if (!scope) return null;
  const layers = ctx.memoFor('positioned-layers', scope, () => {
    const all = scope.querySelectorAll('*');
    if (all.length > SUBTREE_SCAN_LIMIT) return null;
    const out: Element[] = [];
    for (const x of all) {
      const st = ctx.style(x);
      if (isPositioned(st.position) && hasPaint(st)) out.push(x);
    }
    return out;
  });
  if (layers === null) return strict ? 'overlap-unknown' : null;
  for (const x of layers) {
    if (!isForeign(x) || !ctx.rendered(x)) continue;
    if (overlapArea(ctx.rect(x), textRect) >= 1) return 'overlap-layer';
  }
  return null;
}
