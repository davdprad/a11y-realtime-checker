/**
 * Cartão de feedback: responde a quatro perguntas para cada ocorrência —
 * o que está errado, quem é afetado, como corrigir (trecho ilustrativo) e
 * onde aprender mais (documento "Understanding" do W3C).
 *
 * Todo texto vindo da página (seletores, trechos) entra via `textContent`.
 */
import { hasMessage, localizeData, t } from '../lib/i18n';
import type { Occurrence } from '../messaging/protocol';
import { CRITERIA } from '../rules/catalog';

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: { className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  return node;
}

export function outcomeLabel(outcome: string): string {
  return t(`outcome_${outcome}`);
}

export function criterionTitle(wcag: string): string {
  const c = CRITERIA[wcag];
  if (!c) return wcag;
  return `${wcag} ${t(c.nameKey)} (${c.level})`;
}

/** Monta o conteúdo do cartão (título + uma seção por ocorrência). */
export function buildCardContent(
  doc: Document,
  occs: readonly Occurrence[],
  titleId: string,
): DocumentFragment {
  const frag = doc.createDocumentFragment();
  // Inconclusivos só aparecem quando pedidos explicitamente (ex.: pelo painel).
  const reported = occs.filter((o) => o.outcome !== 'incomplete');
  const visible = reported.length > 0 ? reported : [...occs];
  const title = el(doc, 'h2', {
    text:
      visible.length === 1 && visible[0]
        ? t('card_title_single', { criterion: criterionTitle(visible[0].wcag) })
        : t('card_title_multiple', { count: visible.length }),
  });
  title.id = titleId;
  frag.append(title);

  for (const occ of visible) {
    const section = el(doc, 'section', { className: 'occ' });
    const crit = el(doc, 'p');
    crit.append(el(doc, 'span', { className: 'crit', text: criterionTitle(occ.wcag) }));
    crit.append(
      el(doc, 'span', {
        className: `tag ${occ.outcome}`,
        text: outcomeLabel(occ.outcome),
      }),
    );
    section.append(crit);
    for (const rule of occ.rules) {
      if (rule.outcome === 'incomplete' && occ.outcome !== 'incomplete') continue;
      const key = rule.messageKey;
      const data = localizeData(rule.data);
      section.append(el(doc, 'h3', { text: t('card_what') }));
      section.append(el(doc, 'p', { text: t(`${key}_what`, data) }));
      section.append(el(doc, 'h3', { text: t('card_who') }));
      section.append(el(doc, 'p', { text: t(`${key}_who`, data) }));
      section.append(el(doc, 'h3', { text: t('card_fix') }));
      section.append(el(doc, 'p', { text: t(`${key}_fix`, data) }));
      if (hasMessage(`${key}_code`)) {
        const pre = el(doc, 'pre');
        pre.append(el(doc, 'code', { text: t(`${key}_code`, data) }));
        section.append(pre);
      }
      if (hasMessage(`${key}_note`)) {
        section.append(el(doc, 'p', { className: 'note', text: t(`${key}_note`, data) }));
      }
    }
    const info = CRITERIA[occ.wcag];
    if (info) {
      section.append(el(doc, 'h3', { text: t('card_learn') }));
      const p = el(doc, 'p');
      const a = el(doc, 'a', { text: t('card_learn_link', { criterion: occ.wcag }) });
      a.href = info.understandingUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      p.append(a);
      section.append(p);
    }
    frag.append(section);
  }
  return frag;
}
