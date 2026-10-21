/**
 * Nome acessível (W3C accname 1.2) via `dom-accessibility-api`, a mesma
 * implementação usada pela Testing Library. Isolado aqui para poder ser
 * trocado ou testado sem tocar nas regras.
 *
 * Complemento (`fallbackName`): a biblioteca não cobre três casos que os
 * navegadores e a ACT tratam como nome válido — `<area alt>`, papéis DPUB
 * que herdam "nome a partir do conteúdo" (ex.: `doc-biblioref`) e `title`
 * de imagem dentro de link/botão. O complemento só é usado quando a
 * biblioteca devolve nome vazio, então nunca remove um nome existente.
 */
import { computeAccessibleName } from 'dom-accessibility-api';
import { isHtmlElement, isSvgElement } from './dom';

export type ComputedStyleFn = (
  el: Element,
  pseudo?: string | null,
) => CSSStyleDeclaration;

export function accessibleName(el: Element, getStyle?: ComputedStyleFn): string {
  const opts = {
    computedStyleSupportsPseudoElements: true,
    ...(getStyle ? { getComputedStyle: getStyle as typeof window.getComputedStyle } : {}),
  };
  return normalizeName(computeAccessibleName(el, opts));
}

/** Colapsa espaços (inclusive U+00A0, coberto por \s) como o navegador faz ao expor o nome. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export interface FallbackDeps {
  /** O elemento está fora da árvore de acessibilidade? */
  readonly hidden: (el: Element) => boolean;
  /** Papel suporta nome a partir do conteúdo? */
  readonly nameFromContents: boolean;
}

function attr(el: Element, name: string): string {
  return normalizeName(el.getAttribute(name) ?? '');
}

const PRESENTATIONAL = /^\s*(none|presentation)(\s|$)/i;

/** Texto alternativo de uma imagem embutida em conteúdo. */
function embeddedImageName(el: Element): string {
  if (PRESENTATIONAL.test(el.getAttribute('role') ?? '')) return '';
  return attr(el, 'aria-label') || attr(el, 'alt') || attr(el, 'title');
}

function contentName(el: Element, deps: FallbackDeps, depth: number): string {
  if (depth > 32) return '';
  const parts: string[] = [];
  const nodes = el.shadowRoot ? el.shadowRoot.childNodes : el.childNodes;
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      continue;
    }
    if (!(node instanceof Element) || deps.hidden(node)) continue;
    const tag = node.localName;
    if (
      isHtmlElement(node) &&
      (tag === 'img' ||
        tag === 'area' ||
        (tag === 'input' && node.getAttribute('type')?.toLowerCase() === 'image'))
    ) {
      parts.push(embeddedImageName(node));
      continue;
    }
    if (isSvgElement(node) && tag === 'svg') {
      const title = [...node.children].find((c) => c.localName === 'title');
      parts.push(attr(node, 'aria-label') || normalizeName(title?.textContent ?? ''));
      continue;
    }
    const label = attr(node, 'aria-label');
    if (label) {
      parts.push(label);
      continue;
    }
    if (tag === 'script' || tag === 'style' || tag === 'template') continue;
    parts.push(contentName(node, deps, depth + 1));
  }
  return normalizeName(parts.join(' '));
}

/** Nome complementar quando a biblioteca devolve vazio (ver comentário do módulo). */
export function fallbackName(el: Element, deps: FallbackDeps): string {
  if (isHtmlElement(el) && el.localName === 'area') {
    return attr(el, 'aria-label') || attr(el, 'alt') || attr(el, 'title');
  }
  if (!deps.nameFromContents) return '';
  return contentName(el, deps, 0);
}
