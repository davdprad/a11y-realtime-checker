/**
 * Metadados das regras e dos critérios (sem dependência de DOM), usados pelo
 * motor, pela UI, pela exportação e pelos scripts de teste ACT.
 */
import type { Level } from './types';

export interface CriterionInfo {
  readonly wcag: string;
  readonly level: Level;
  /** Chave i18n do nome do critério. */
  readonly nameKey: string;
  /** Documento "Understanding" do W3C. */
  readonly understandingUrl: string;
}

const understanding = (slug: string): string =>
  `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;

export const CRITERIA: Readonly<Record<string, CriterionInfo>> = {
  '1.1.1': {
    wcag: '1.1.1',
    level: 'A',
    nameKey: 'wcag_1_1_1',
    understandingUrl: understanding('non-text-content'),
  },
  '1.3.1': {
    wcag: '1.3.1',
    level: 'A',
    nameKey: 'wcag_1_3_1',
    understandingUrl: understanding('info-and-relationships'),
  },
  '1.4.3': {
    wcag: '1.4.3',
    level: 'AA',
    nameKey: 'wcag_1_4_3',
    understandingUrl: understanding('contrast-minimum'),
  },
  '1.4.4': {
    wcag: '1.4.4',
    level: 'AA',
    nameKey: 'wcag_1_4_4',
    understandingUrl: understanding('resize-text'),
  },
  '2.4.2': {
    wcag: '2.4.2',
    level: 'A',
    nameKey: 'wcag_2_4_2',
    understandingUrl: understanding('page-titled'),
  },
  '2.4.4': {
    wcag: '2.4.4',
    level: 'A',
    nameKey: 'wcag_2_4_4',
    understandingUrl: understanding('link-purpose-in-context'),
  },
  '2.5.8': {
    wcag: '2.5.8',
    level: 'AA',
    nameKey: 'wcag_2_5_8',
    understandingUrl: understanding('target-size-minimum'),
  },
  '3.1.1': {
    wcag: '3.1.1',
    level: 'A',
    nameKey: 'wcag_3_1_1',
    understandingUrl: understanding('language-of-page'),
  },
  '4.1.2': {
    wcag: '4.1.2',
    level: 'A',
    nameKey: 'wcag_4_1_2',
    understandingUrl: understanding('name-role-value'),
  },
};

/** Ordem de exibição dos critérios (numérica). */
export const CRITERIA_ORDER: readonly string[] = Object.keys(CRITERIA).sort((a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
});

export interface RuleMeta {
  readonly id: string;
  readonly wcag: string;
  readonly level: Level;
  readonly actRuleIds: readonly string[];
  readonly scope: 'element' | 'document';
}

/** Fonte única dos mapeamentos regra → critério → ACT (IDs conferidos no W3C). */
export const RULE_META: readonly RuleMeta[] = [
  {
    id: 'text-contrast',
    wcag: '1.4.3',
    level: 'AA',
    actRuleIds: ['afw4f7'],
    scope: 'element',
  },
  {
    id: 'image-name',
    wcag: '1.1.1',
    level: 'A',
    actRuleIds: ['23a2a8'],
    scope: 'element',
  },
  {
    id: 'image-button-name',
    wcag: '1.1.1',
    level: 'A',
    actRuleIds: ['59796f'],
    scope: 'element',
  },
  {
    id: 'svg-img-name',
    wcag: '1.1.1',
    level: 'A',
    actRuleIds: ['7d6734'],
    scope: 'element',
  },
  {
    id: 'button-name',
    wcag: '4.1.2',
    level: 'A',
    actRuleIds: ['97a4e1'],
    scope: 'element',
  },
  {
    id: 'aria-role-valid',
    wcag: '4.1.2',
    level: 'A',
    actRuleIds: ['674b10'],
    scope: 'element',
  },
  {
    id: 'aria-attr-defined',
    wcag: '4.1.2',
    level: 'A',
    actRuleIds: ['5f99a7'],
    scope: 'element',
  },
  {
    id: 'aria-attr-valid-value',
    wcag: '4.1.2',
    level: 'A',
    actRuleIds: ['6a7281'],
    scope: 'element',
  },
  {
    id: 'aria-required-attr',
    wcag: '4.1.2',
    level: 'A',
    actRuleIds: ['4e8ab6'],
    scope: 'element',
  },
  {
    id: 'link-name',
    wcag: '2.4.4',
    level: 'A',
    actRuleIds: ['c487ae'],
    scope: 'element',
  },
  {
    id: 'form-label',
    wcag: '1.3.1',
    level: 'A',
    actRuleIds: ['e086e5'],
    scope: 'element',
  },
  { id: 'heading-order', wcag: '1.3.1', level: 'A', actRuleIds: [], scope: 'element' },
  {
    id: 'html-lang',
    wcag: '3.1.1',
    level: 'A',
    actRuleIds: ['b5c3f8'],
    scope: 'document',
  },
  {
    id: 'html-lang-valid',
    wcag: '3.1.1',
    level: 'A',
    actRuleIds: ['bf051a'],
    scope: 'document',
  },
  {
    id: 'document-title',
    wcag: '2.4.2',
    level: 'A',
    actRuleIds: ['2779a5'],
    scope: 'document',
  },
  {
    id: 'viewport-zoom',
    wcag: '1.4.4',
    level: 'AA',
    actRuleIds: ['b4f0c3'],
    scope: 'document',
  },
  { id: 'target-size', wcag: '2.5.8', level: 'AA', actRuleIds: [], scope: 'element' },
];

export function ruleMeta(id: string): RuleMeta {
  const m = RULE_META.find((r) => r.id === id);
  if (!m) throw new Error(`Regra desconhecida: ${id}`);
  return m;
}

/** Todos os IDs ACT mapeados (usado pelo script que baixa os casos de teste). */
export const ALL_ACT_RULE_IDS: readonly string[] = [
  ...new Set(RULE_META.flatMap((r) => r.actRuleIds)),
].sort();

/** Converte um id com hífens em prefixo de chave i18n (só [a-z0-9_]). */
export function i18nKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}
