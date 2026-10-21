/**
 * 4.1.2 Nome, função, valor (A) — ACT 97a4e1.
 *
 * Todo elemento com papel `button` (nativo ou ARIA) incluído na árvore de
 * acessibilidade precisa de nome acessível não vazio. Botões fora da tela
 * continuam aplicáveis (o leitor de tela os alcança). `<input type="image">`
 * é tratado por `image-button-name` (1.1.1).
 *
 * A regra verifica se o nome existe, não se ele descreve a função.
 */
import { isHtmlElement } from '../lib/dom';
import { inputType } from '../lib/roles';
import type { Rule } from './types';
import { base, makeResult } from './util';

const meta = base('button-name');

export const buttonName: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    if (isHtmlElement(el) && el.localName === 'input' && inputType(el) === 'image')
      return false;
    return ctx.role(el) === 'button' && !ctx.hiddenFromAT(el);
  },
  evaluate(el, ctx) {
    return ctx.name(el) !== ''
      ? makeResult(meta, el, 'pass', 'button_name')
      : makeResult(meta, el, 'violation', 'button_name');
  },
};
