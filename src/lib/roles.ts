/**
 * Papel (role) efetivo de um elemento: papel explícito válido, papel implícito
 * (subconjunto do HTML-AAM necessário às regras) e resolução de conflito de
 * papel de apresentação (WAI-ARIA 1.2, seção 9.3).
 */
import { ARIA_GLOBAL_PROPS, ARIA_PROPS, ARIA_ROLES } from './aria-data.generated';
import { isHtmlElement, localName } from './dom';

/**
 * Papéis do rascunho WAI-ARIA 1.3 ausentes do aria-query 5.3.2. São aceitos
 * como válidos para não gerar falsos positivos em código que já os adota.
 */
const ARIA_13_ROLES = [
  'image',
  'comment',
  'suggestion',
  'sectionheader',
  'sectionfooter',
];

/** Atributos do rascunho WAI-ARIA 1.3 ausentes do aria-query 5.3.2. */
export const ARIA_13_PROPS: Readonly<Record<string, { type: string }>> = {
  'aria-colindextext': { type: 'string' },
  'aria-rowindextext': { type: 'string' },
};

const concreteRoles = new Set<string>([
  ...Object.entries(ARIA_ROLES)
    .filter(([, d]) => !d.abstract)
    .map(([r]) => r),
  ...ARIA_13_ROLES,
]);

export function isValidConcreteRole(token: string): boolean {
  return concreteRoles.has(token.toLowerCase());
}

export function isAbstractRole(token: string): boolean {
  return ARIA_ROLES[token.toLowerCase()]?.abstract === true;
}

export function isKnownAriaAttribute(name: string): boolean {
  const n = name.toLowerCase();
  return n in ARIA_PROPS || n in ARIA_13_PROPS;
}

/** O papel é `base` ou herda de `base` (ex.: doc-biblioref → link)? */
export function roleIs(role: string | null, base: string): boolean {
  if (!role) return false;
  if (role === base) return true;
  if (role === 'image' && base === 'img') return true;
  return ARIA_ROLES[role]?.superClass.includes(base) === true;
}

export function roleTokens(el: Element): string[] {
  const raw = el.getAttribute('role');
  return raw ? raw.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
}

/** Primeiro token de `role` que é um papel concreto conhecido. */
export function explicitRole(el: Element): string | null {
  for (const t of roleTokens(el))
    if (isValidConcreteRole(t)) return t === 'image' ? 'img' : t;
  return null;
}

const NATIVELY_FOCUSABLE_INPUT_EXCLUDED = new Set(['hidden']);

/** Elemento é focável (nativamente ou via `tabindex`) e não está desabilitado. */
export function isFocusable(el: Element): boolean {
  if (isDisabled(el)) return false;
  if (
    el.hasAttribute('tabindex') &&
    !Number.isNaN(parseInt(el.getAttribute('tabindex') ?? '', 10))
  ) {
    return true;
  }
  if (!isHtmlElement(el)) return false;
  const tag = localName(el);
  switch (tag) {
    case 'a':
    case 'area':
      return el.hasAttribute('href');
    case 'button':
    case 'select':
    case 'textarea':
    case 'iframe':
      return true;
    case 'input':
      return !NATIVELY_FOCUSABLE_INPUT_EXCLUDED.has(inputType(el));
    case 'summary':
      return (
        el.parentElement?.localName === 'details' &&
        el.parentElement.querySelector('summary') === el
      );
    case 'audio':
    case 'video':
      return el.hasAttribute('controls');
    default:
      return el.isContentEditable;
  }
}

/** Desabilitado nativamente (`disabled`, inclusive via `<fieldset disabled>`). */
export function isDisabled(el: Element): boolean {
  return el.matches(':disabled');
}

export function inputType(el: Element): string {
  return (el.getAttribute('type') ?? 'text').trim().toLowerCase() || 'text';
}

function hasGlobalAriaAttribute(el: Element): boolean {
  for (const name of ARIA_GLOBAL_PROPS) {
    if (el.hasAttribute(name)) return true;
  }
  return false;
}

const TEXTBOX_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url']);
const KNOWN_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'image',
  'month',
  'number',
  'password',
  'radio',
  'range',
  'reset',
  'search',
  'submit',
  'tel',
  'text',
  'time',
  'url',
  'week',
]);

/** Papel implícito (HTML-AAM) para os elementos relevantes às regras. */
export function implicitRole(el: Element): string | null {
  if (!isHtmlElement(el)) {
    return localName(el) === 'svg' ? 'graphics-document' : null;
  }
  const tag = localName(el);
  switch (tag) {
    case 'a':
    case 'area':
      return el.hasAttribute('href') ? 'link' : null;
    case 'button':
      return 'button';
    case 'input': {
      let type = inputType(el);
      if (!KNOWN_INPUT_TYPES.has(type)) type = 'text';
      const hasList = el.hasAttribute('list');
      switch (type) {
        case 'button':
        case 'submit':
        case 'reset':
        case 'image':
          return 'button';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'range':
          return 'slider';
        case 'number':
          return 'spinbutton';
        case 'search':
          return hasList ? 'combobox' : 'searchbox';
        default:
          if (TEXTBOX_INPUT_TYPES.has(type)) return hasList ? 'combobox' : 'textbox';
          return null;
      }
    }
    case 'select': {
      const size = parseInt(el.getAttribute('size') ?? '', 10);
      return el.hasAttribute('multiple') || size > 1 ? 'listbox' : 'combobox';
    }
    case 'textarea':
      return 'textbox';
    case 'img': {
      const alt = el.getAttribute('alt');
      return alt === '' ? 'presentation' : 'img';
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'option':
      return 'option';
    case 'hr':
      return 'separator';
    default:
      return null;
  }
}

const PRESENTATIONAL = new Set(['none', 'presentation']);

/**
 * Papel efetivo. Se o papel (explícito ou implícito) for de apresentação mas o
 * elemento for focável ou tiver atributo ARIA global, o papel de apresentação
 * é ignorado (resolução de conflito) e vale o papel implícito.
 */
export function computedRole(el: Element): string | null {
  const explicit = explicitRole(el);
  const implicit = implicitRole(el);
  const role = explicit ?? implicit;
  if (role && PRESENTATIONAL.has(role)) {
    if (isFocusable(el) || hasGlobalAriaAttribute(el)) {
      if (implicit && !PRESENTATIONAL.has(implicit)) return implicit;
      // <img alt=""> focável: o navegador o expõe como imagem.
      if (isHtmlElement(el) && localName(el) === 'img') return 'img';
      return null;
    }
    return 'presentation';
  }
  return role;
}

export function isPresentational(role: string | null): boolean {
  return role !== null && PRESENTATIONAL.has(role);
}

/** Papel suporta nome a partir do conteúdo (nameFrom: contents)? */
export function nameFromContents(role: string | null): boolean {
  if (!role) return false;
  return ARIA_ROLES[role]?.nameFrom.includes('contents') === true;
}
