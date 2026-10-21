/**
 * 2.4.2 Página com título (A) — ACT 2779a5.
 *
 * Avalia o primeiro elemento `<title>` HTML do documento de topo (inclusive
 * um `<title>` no `<body>`, como nos casos ACT). Títulos em SVG, em shadow
 * roots ou em iframes não contam.
 */
import { XHTML_NS } from '../lib/dom';
import type { Rule } from './types';
import { base, isHtmlDocument, makeResult } from './util';

const meta = base('document-title');

export const documentTitle: Rule = {
  ...meta,
  documentTargets(ctx) {
    if (!ctx.isTopFrame || !isHtmlDocument(ctx.doc)) return [];
    const title = ctx.doc.getElementsByTagNameNS(XHTML_NS, 'title')[0];
    return [title ?? ctx.doc.documentElement];
  },
  isApplicable: () => true,
  evaluate(el) {
    if (el.localName !== 'title') {
      return makeResult(meta, el, 'violation', 'document_title_missing');
    }
    const text = el.textContent;
    return /\S/.test(text)
      ? makeResult(meta, el, 'pass', 'document_title')
      : makeResult(meta, el, 'violation', 'document_title_empty');
  },
};
