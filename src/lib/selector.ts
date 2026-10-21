/**
 * Seletor CSS estável e único para cada elemento (coluna `seletor_css` do
 * Apêndice A). Usa `@medv/finder`, evitando classes e ids gerados (hash),
 * com fallback determinístico baseado em `:nth-of-type`.
 *
 * Elementos dentro de shadow roots recebem um caminho composto no formato
 * `host >>> interno` (cada trecho é único no seu próprio escopo).
 */
import { finder } from '@medv/finder';

/** Heurística para nomes gerados por CSS-in-JS, CSS Modules e afins. */
export function looksGenerated(name: string): boolean {
  if (name.length > 40) return true;
  if (/^(css|sc|jsx|emotion|svelte|astro|chakra|mui)-[a-z0-9]+/i.test(name)) return true;
  if (/^_[a-z0-9]{4,}/i.test(name)) return true;
  if (/__[a-z0-9]{5,}$/i.test(name) || /--[a-z0-9]{5,}$/i.test(name)) return true;
  if (/[[\]:/@!%]/.test(name)) return true; // utilitários do Tailwind com variantes
  // Sequências longas misturando letras e dígitos (ex.: "a1b2c3d4").
  const digits = name.replace(/[^0-9]/g, '').length;
  return digits >= 3 && digits / name.length > 0.25;
}

const STABLE_ATTRS = new Set([
  'name',
  'type',
  'role',
  'aria-label',
  'data-testid',
  'data-test',
  'for',
  'href',
]);

function scopeRoot(el: Element): Document | ShadowRoot {
  return el.getRootNode() as Document | ShadowRoot;
}

/**
 * O id identifica o elemento no seu escopo? `getElementById` é O(1); com ids
 * duplicados, `#id` ainda resolve para o mesmo (primeiro) elemento.
 */
function hasAnchorId(el: Element, root: Document | ShadowRoot): boolean {
  const id = el.id;
  return id !== '' && !looksGenerated(id) && root.getElementById(id) === el;
}

/** Caminho com :nth-of-type até um ancestral com id (ou a raiz do escopo). */
export function pathSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element = el;
  const root = scopeRoot(el);
  for (;;) {
    if (hasAnchorId(cur, root)) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const tag = cur.localName;
    const parentEl: Element | null = cur.parentElement;
    if (!parentEl) {
      parts.unshift(tag);
      break;
    }
    let index = 1;
    for (let sib = cur.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.localName === tag) index++;
    }
    let total = index;
    for (let sib = cur.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (sib.localName === tag) total++;
    }
    parts.unshift(total > 1 ? `${tag}:nth-of-type(${index})` : tag);
    cur = parentEl;
  }
  return parts.join(' > ');
}

/**
 * Acima deste tamanho, o finder não roda sobre o documento inteiro: cada
 * verificação de unicidade é um querySelectorAll global, e milhares de
 * ocorrências tornariam a varredura inicial quadrática.
 */
const FULL_DOCUMENT_FINDER_LIMIT = 3000;
const documentSizes = new WeakMap<Document, HTMLCollectionOf<Element>>();

function documentSize(doc: Document): number {
  let all = documentSizes.get(doc);
  if (!all) {
    all = doc.getElementsByTagName('*');
    documentSizes.set(doc, all);
  }
  return all.length;
}

/** Ancestral mais próximo com id utilizável (limita o escopo do finder). */
function idAnchor(el: Element, root: Document | ShadowRoot): Element | null {
  let cur = el.parentElement;
  for (let depth = 0; cur && depth < 32; depth++) {
    if (hasAnchorId(cur, root)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

const FINDER_OPTIONS = {
  idName: (n: string) => !looksGenerated(n),
  className: (n: string) => !looksGenerated(n),
  tagName: () => true,
  attr: (n: string, v: string) =>
    STABLE_ATTRS.has(n) && v.length <= 60 && !looksGenerated(v),
  seedMinLength: 1,
  optimizedMinLength: 2,
  timeoutMs: 40,
  maxNumberOfPathChecks: 200,
};

/** Seletor único dentro do escopo (documento ou shadow root) do elemento. */
function selectorInScope(el: Element): string {
  const root = scopeRoot(el);
  if (root instanceof Document && el === root.documentElement) return 'html';
  if (hasAnchorId(el, root)) return `#${CSS.escape(el.id)}`;
  try {
    const anchor = idAnchor(el, root);
    if (anchor)
      return `#${CSS.escape(anchor.id)} ${finder(el, { ...FINDER_OPTIONS, root: anchor })}`;
    if (root instanceof Document && documentSize(root) <= FULL_DOCUMENT_FINDER_LIMIT) {
      return finder(el, { ...FINDER_OPTIONS, root: root.documentElement });
    }
  } catch {
    /* timeout ou seletor não encontrado: usa o caminho */
  }
  return pathSelector(el);
}

export function uniqueSelector(el: Element): string {
  const chain: string[] = [];
  let cur: Element | null = el;
  while (cur) {
    const root = scopeRoot(cur);
    chain.unshift(selectorInScope(cur));
    cur = root instanceof ShadowRoot ? root.host : null;
  }
  return chain.join(' >>> ');
}

/** Resolve um seletor produzido por `uniqueSelector` (inclusive `>>>`). */
export function resolveSelector(doc: Document, selector: string): Element | null {
  const parts = selector.split(' >>> ');
  let scope: Document | ShadowRoot = doc;
  let found: Element | null = null;
  for (const part of parts) {
    found = scope.querySelector(part);
    if (!found) return null;
    const next: ShadowRoot | null = found.shadowRoot;
    if (next) scope = next;
  }
  return found;
}
