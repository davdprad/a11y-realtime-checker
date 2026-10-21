/**
 * Utilitários de travessia do DOM na "árvore plana" (flat tree): inclui shadow
 * roots abertos e respeita a distribuição de slots.
 */

export const XHTML_NS = 'http://www.w3.org/1999/xhtml';
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Nome da tag do host do overlay (nunca avaliado nem observado). */
export const OVERLAY_TAG = 'a11y-rt-overlay';

export function isHtmlElement(el: Element): el is HTMLElement {
  return el.namespaceURI === XHTML_NS;
}

export function isSvgElement(el: Element): el is SVGElement {
  return el.namespaceURI === SVG_NS;
}

export function localName(el: Element): string {
  return el.localName.toLowerCase();
}

/** Pai na árvore plana: slot atribuído > pai > host do shadow root. */
export function flatParent(node: Node): Element | null {
  if (node instanceof Element || node instanceof Text) {
    const slot = node.assignedSlot;
    if (slot) return slot;
  }
  const parent = node.parentNode;
  if (!parent) return null;
  if (parent instanceof ShadowRoot) return parent.host;
  return parent instanceof Element ? parent : null;
}

/** Ancestrais na árvore plana, do pai até a raiz. */
export function* flatAncestors(node: Node): Generator<Element> {
  let cur = flatParent(node);
  while (cur) {
    yield cur;
    cur = flatParent(cur);
  }
}

/** `node` contém `other` na árvore plana (inclusive)? */
export function flatContains(node: Element, other: Node): boolean {
  if (node === other) return true;
  for (const a of flatAncestors(other)) if (a === node) return true;
  return false;
}

/** O elemento pertence ao host do overlay da própria extensão? */
export function isOverlayNode(node: Node): boolean {
  let cur: Node | null = node;
  while (cur) {
    if (cur instanceof Element && cur.localName === OVERLAY_TAG) return true;
    const parent: Node | null = cur.parentNode;
    cur = parent instanceof ShadowRoot ? parent.host : parent;
  }
  return false;
}

/** Elementos que nunca carregam conteúdo avaliável. */
const SKIP_SUBTREE = new Set(['script', 'style', 'template', 'noscript']);

export interface WalkOptions {
  /** Chamado para cada shadow root aberto encontrado (para observá-lo). */
  readonly onShadowRoot?: (root: ShadowRoot) => void;
}

/**
 * Percorre `root` e descendentes (em ordem de documento), entrando em shadow
 * roots abertos. Não entra no overlay da extensão nem em <script>/<style>.
 */
export function* walkElements(root: Element, opts: WalkOptions = {}): Generator<Element> {
  const stack: Element[] = [root];
  while (stack.length > 0) {
    const el = stack.pop();
    if (!el) break;
    if (el.localName === OVERLAY_TAG) continue;
    yield el;
    if (SKIP_SUBTREE.has(el.localName)) continue;
    const children: Element[] = [];
    const shadow = el.shadowRoot;
    if (shadow) {
      opts.onShadowRoot?.(shadow);
      for (const c of shadow.children) children.push(c);
    }
    for (const c of el.children) children.push(c);
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      if (c) stack.push(c);
    }
  }
}

/** Conta até `limit` elementos na subárvore (para decidir estratégias). */
export function countElements(root: Element, limit: number): number {
  let n = 0;
  for (const _ of walkElements(root)) {
    n++;
    if (n >= limit) break;
  }
  return n;
}

/** Nós de texto diretamente renderizados como filhos de `el` na árvore plana. */
export function directTextNodes(el: Element): Text[] {
  const out: Text[] = [];
  const pushFrom = (parent: ParentNode): void => {
    for (const n of parent.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) out.push(n as Text);
    }
  };
  if (el instanceof HTMLSlotElement) {
    // Texto atribuído ao slot é renderizado com o estilo do slot.
    for (const n of el.assignedNodes())
      if (n.nodeType === Node.TEXT_NODE) out.push(n as Text);
    if (el.assignedNodes().length === 0) pushFrom(el);
    return out;
  }
  if (el.shadowRoot) {
    pushFrom(el.shadowRoot);
    return out;
  }
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE && !(n as Text).assignedSlot) out.push(n as Text);
  }
  return out;
}

export function hasNonWhitespace(s: string): boolean {
  return /\S/.test(s);
}

/** Resumo legível de um elemento (tag de abertura truncada) para a UI. */
export function elementSnippet(el: Element, max = 160): string {
  const html = el.outerHTML;
  const close = html.indexOf('>');
  const open = close >= 0 ? html.slice(0, close + 1) : html;
  return open.length > max ? `${open.slice(0, max - 1)}…` : open;
}

/** Busca por id no mesmo escopo (documento ou shadow root) do elemento. */
export function getElementByIdInScope(el: Element, id: string): Element | null {
  const root = el.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot)
    return root.getElementById(id);
  return null;
}

/** Lista de ids (separados por espaço) de um atributo IDREFS. */
export function idrefs(value: string | null): string[] {
  return value ? value.trim().split(/\s+/).filter(Boolean) : [];
}
