/**
 * Visibilidade para tecnologias assistivas (árvore de acessibilidade) e
 * visibilidade visual (para contraste e tamanho do alvo).
 */
import { flatAncestors, flatParent, isHtmlElement, localName } from './dom';
import type { Rect } from './geometry';
import { intersectRects } from './geometry';

export type StyleGetter = (el: Element) => CSSStyleDeclaration;

/** O elemento tem caixa renderizada e `visibility` visível? */
export function isRendered(el: Element, style: StyleGetter): boolean {
  if (isHtmlElement(el) && localName(el) === 'area') return isAreaRendered(el, style);
  const s = style(el);
  if (s.display === 'contents') {
    if (s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    const parent = flatParent(el);
    return parent ? isRendered(parent, style) : true;
  }
  return el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: false });
}

/** `<area>` não tem caixa própria: herda a visibilidade da imagem do mapa. */
function isAreaRendered(area: Element, style: StyleGetter): boolean {
  const map = area.closest('map');
  const name = map?.getAttribute('name') ?? map?.id;
  if (!map || !name) return false;
  const root = map.getRootNode() as Document | ShadowRoot;
  const img = root.querySelector(`img[usemap="#${CSS.escape(name)}"]`);
  return img ? isRendered(img, style) : false;
}

/**
 * Excluído da árvore de acessibilidade: não renderizado (`display:none`,
 * `visibility:hidden`, `hidden`, conteúdo de `<details>` fechado), ou com
 * `aria-hidden="true"` / `inert` em si ou em algum ancestral.
 */
export function isHiddenFromAT(el: Element, style: StyleGetter): boolean {
  if (!isRendered(el, style)) return true;
  if (hasAriaHiddenOrInert(el)) return true;
  for (const a of flatAncestors(el)) if (hasAriaHiddenOrInert(a)) return true;
  return false;
}

function hasAriaHiddenOrInert(el: Element): boolean {
  if (el.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') return true;
  return el.hasAttribute('inert');
}

/** Posição em coordenadas do documento (independente da rolagem). */
export function toDocumentRect(
  r: Rect,
  view: { scrollX: number; scrollY: number },
): Rect {
  return {
    left: r.left + view.scrollX,
    top: r.top + view.scrollY,
    width: r.width,
    height: r.height,
  };
}

/**
 * Conteúdo fora da área alcançável do documento (posicionado à esquerda ou
 * acima da origem, ex.: `left:-9999px`), portanto invisível.
 */
export function isOffDocument(docRect: Rect): boolean {
  return docRect.left + docRect.width <= 0 || docRect.top + docRect.height <= 0;
}

const CLIP_ZERO = /^rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)$/;

/**
 * O conteúdo com caixa `rect` (coordenadas de viewport) está recortado até
 * ficar invisível por algum ancestral? Cobre os padrões "sr-only"
 * (1×1 px com overflow oculto, `clip: rect(0 0 0 0)`, `clip-path: inset(50%)`)
 * e "text-indent: -9999px" com overflow oculto.
 */
export function isClippedAway(
  el: Element,
  rect: Rect,
  style: StyleGetter,
  rectOf: (el: Element) => Rect,
): boolean {
  let visible: Rect = rect;
  for (const node of [el, ...flatAncestors(el)]) {
    const s = style(node);
    // `clip` é obsoleto, mas ainda é a base do padrão "sr-only" mais difundido.
    const clip = s.getPropertyValue('clip');
    if (
      clip !== 'auto' &&
      clip !== '' &&
      CLIP_ZERO.test(clip.replace(/\s+/g, ' ').trim())
    ) {
      if (s.position === 'absolute' || s.position === 'fixed') return true;
    }
    const cp = s.clipPath;
    if (
      cp &&
      cp !== 'none' &&
      (/inset\(\s*50%/.test(cp) || /circle\(\s*0(px)?[\s)]/.test(cp))
    ) {
      return true;
    }
    // `overflow` não se aplica a caixas inline; nos demais casos o conteúdo
    // (inclusive o texto do próprio elemento) é recortado pela caixa.
    // `auto`/`scroll` não contam: o conteúdo continua alcançável por rolagem,
    // e considerá-los tornaria o resultado dependente da posição de rolagem.
    const clips = (v: string): boolean => v === 'hidden' || v === 'clip';
    const clipsX = clips(s.overflowX);
    const clipsY = clips(s.overflowY);
    if ((clipsX || clipsY) && s.display !== 'inline') {
      const box = rectOf(node);
      const i = intersectRects(visible, {
        left: clipsX ? box.left : visible.left,
        top: clipsY ? box.top : visible.top,
        width: clipsX ? box.width : visible.width,
        height: clipsY ? box.height : visible.height,
      });
      if (i.width <= 1 || i.height <= 1) return true;
      visible = i;
    }
    if (s.position === 'fixed') break;
  }
  return false;
}
