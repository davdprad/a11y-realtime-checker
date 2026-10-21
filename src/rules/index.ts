/**
 * Registro das regras da primeira versão (Quadro 3 da monografia).
 */
import {
  ariaAttrDefined,
  ariaAttrValidValue,
  ariaRequiredAttr,
  ariaRoleValid,
} from './aria-valid';
import { buttonName } from './button-name';
import { documentTitle } from './document-title';
import { formLabel } from './form-label';
import { headingOrder } from './heading-order';
import { htmlLang, htmlLangValid } from './html-lang';
import { imageButtonName, imageName, svgImgName } from './image-name';
import { linkName } from './link-name';
import { targetSize } from './target-size';
import { textContrast } from './text-contrast';
import type { Rule } from './types';
import { viewportZoom } from './viewport-zoom';

export const ALL_RULES: readonly Rule[] = [
  textContrast,
  imageName,
  imageButtonName,
  svgImgName,
  buttonName,
  ariaRoleValid,
  ariaAttrDefined,
  ariaAttrValidValue,
  ariaRequiredAttr,
  linkName,
  formLabel,
  headingOrder,
  htmlLang,
  htmlLangValid,
  documentTitle,
  viewportZoom,
  targetSize,
];

export const ELEMENT_RULES: readonly Rule[] = ALL_RULES.filter(
  (r) => r.scope === 'element',
);
export const DOCUMENT_RULES: readonly Rule[] = ALL_RULES.filter(
  (r) => r.scope === 'document',
);

export function getRule(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}

export type { EvalContext, Outcome, Rule, RuleResult } from './types';
