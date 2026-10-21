/**
 * 1.4.4 Redimensionar texto (AA) — ACT b4f0c3.
 *
 * Falha quando `<meta name="viewport">` impede o zoom: `user-scalable` com
 * |valor| < 1 (inclui `no` e `0`) ou `maximum-scale` entre 0 e 2 (exclusive).
 */
import { checkViewportZoom } from '../lib/viewport';
import type { Rule } from './types';
import { base, isHtmlDocument, makeResult } from './util';

const meta = base('viewport-zoom');

export const viewportZoom: Rule = {
  ...meta,
  documentTargets(ctx) {
    if (!ctx.isTopFrame || !isHtmlDocument(ctx.doc)) return [];
    return [...ctx.doc.querySelectorAll('meta[name]')].filter(
      (m) => m.getAttribute('name')?.trim().toLowerCase() === 'viewport',
    );
  },
  isApplicable(el) {
    const content = el.getAttribute('content');
    return (
      content !== null && content.trim() !== '' && checkViewportZoom(content).applicable
    );
  },
  evaluate(el) {
    const check = checkViewportZoom(el.getAttribute('content') ?? '');
    if (check.problems.length === 0) return makeResult(meta, el, 'pass', 'viewport_zoom');
    return makeResult(meta, el, 'violation', 'viewport_zoom', {
      content: (el.getAttribute('content') ?? '').trim(),
      problems: check.problems.join(', '),
    });
  },
};
