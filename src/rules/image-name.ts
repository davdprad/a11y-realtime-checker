/**
 * 1.1.1 Conteúdo não textual (A).
 *
 * - `image-name` (ACT 23a2a8): elemento HTML com papel de imagem (`<img>` sem
 *   `alt=""`, `role="img"`) precisa de nome acessível. `alt=""` e
 *   `role="presentation"`/`"none"` marcam a imagem como decorativa e a regra
 *   não se aplica — salvo quando a resolução de conflito ignora o papel de
 *   apresentação (imagem focável, por exemplo).
 * - `image-button-name` (ACT 59796f): `<input type="image">` precisa de nome.
 * - `svg-img-name` (ACT 7d6734): elemento SVG com papel explícito `img`,
 *   `graphics-document` ou `graphics-symbol` precisa de nome.
 */
import { normalizeName } from '../lib/accname';
import { getElementByIdInScope, idrefs, isHtmlElement, isSvgElement } from '../lib/dom';
import { explicitRole, inputType } from '../lib/roles';
import type { EvalContext, Rule } from './types';
import { base, makeResult } from './util';

const imageMeta = base('image-name');

export const imageName: Rule = {
  ...imageMeta,
  isApplicable(el, ctx) {
    if (!isHtmlElement(el)) return false;
    if (el.localName === 'input') return false;
    return ctx.role(el) === 'img' && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    return ctx.name(el) !== ''
      ? makeResult(imageMeta, el, 'pass', 'image_name')
      : makeResult(imageMeta, el, 'violation', 'image_name');
  },
};

const imageButtonMeta = base('image-button-name');

/**
 * Nome de `<input type="image">` apenas de fontes do autor (aria-labelledby,
 * aria-label, alt, title). O valor padrão que alguns navegadores anunciam
 * ("Enviar") não descreve a imagem, e o ACT considera esse caso falha.
 */
function imageButtonAuthorName(el: Element): string {
  const ids = idrefs(el.getAttribute('aria-labelledby'));
  if (ids.length > 0) {
    const parts = ids
      .map((id) => getElementByIdInScope(el, id))
      .filter((n): n is Element => n !== null)
      .map((n) => normalizeName(n.textContent));
    const joined = normalizeName(parts.join(' '));
    if (joined) return joined;
  }
  for (const attr of ['aria-label', 'alt', 'title']) {
    const v = normalizeName(el.getAttribute(attr) ?? '');
    if (v) return v;
  }
  return '';
}

export const imageButtonName: Rule = {
  ...imageButtonMeta,
  isApplicable(el, ctx) {
    return (
      isHtmlElement(el) &&
      el.localName === 'input' &&
      inputType(el) === 'image' &&
      !ctx.hiddenFromAT(el)
    );
  },
  evaluate(el) {
    return imageButtonAuthorName(el) !== ''
      ? makeResult(imageButtonMeta, el, 'pass', 'image_button_name')
      : makeResult(imageButtonMeta, el, 'violation', 'image_button_name');
  },
};

const svgMeta = base('svg-img-name');
const SVG_IMAGE_ROLES = new Set(['img', 'graphics-document', 'graphics-symbol']);

/** Nome de SVG: accname + filho <title> direto (SVG-AAM). */
function svgName(el: Element, ctx: EvalContext): string {
  const name = ctx.name(el);
  if (name) return name;
  for (const child of el.children) {
    if (isSvgElement(child) && child.localName === 'title') {
      const t = normalizeName(child.textContent);
      if (t) return t;
    }
  }
  return '';
}

export const svgImgName: Rule = {
  ...svgMeta,
  isApplicable(el, ctx) {
    if (!isSvgElement(el)) return false;
    const role = explicitRole(el);
    return role !== null && SVG_IMAGE_ROLES.has(role) && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    return svgName(el, ctx) !== ''
      ? makeResult(svgMeta, el, 'pass', 'svg_img_name')
      : makeResult(svgMeta, el, 'violation', 'svg_img_name', {
          role: explicitRole(el) ?? '',
        });
  },
};
