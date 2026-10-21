/**
 * Contrato do motor de regras (seção 4.1 do documento de requisitos).
 */
import type { Rect } from '../lib/geometry';

export type Outcome =
  'violation' | 'pass' | 'incomplete' | 'recommendation' | 'inapplicable';

/** Resultados que viram ocorrência (os demais não são guardados). */
export type ReportedOutcome = Extract<
  Outcome,
  'violation' | 'incomplete' | 'recommendation'
>;

export type Level = 'A' | 'AA';

export type ResultData = Record<string, string | number>;

export interface RuleResult {
  ruleId: string;
  /** Critério de sucesso, ex.: '1.4.3'. */
  wcag: string;
  level: Level;
  outcome: Outcome;
  element: Element;
  data?: ResultData;
  /** Chave-base i18n do cartão (sufixos _what/_who/_fix). */
  messageKey: string;
}

export interface EvalContext {
  readonly doc: Document;
  readonly win: Window;
  /** O frame avaliado é o documento de topo (regras de documento só rodam nele). */
  readonly isTopFrame: boolean;
  /** Estilo computado (cache por lote). */
  style(el: Element): CSSStyleDeclaration;
  /** `getBoundingClientRect` (cache por lote). */
  rect(el: Element): Rect;
  /** Papel efetivo (cache por lote). */
  role(el: Element): string | null;
  /** Nome acessível normalizado (cache por lote). */
  name(el: Element): string;
  /** Fora da árvore de acessibilidade (cache por lote). */
  hiddenFromAT(el: Element): boolean;
  /** Renderizado com `visibility` visível (cache por lote). */
  rendered(el: Element): boolean;
  /** Rolagem atual, para converter retângulos para coordenadas do documento. */
  readonly scroll: { readonly scrollX: number; readonly scrollY: number };
  /**
   * Valor preguiçoso, calculado no máximo uma vez por lote (fatia). Chaves com
   * prefixo "run:" valem para a execução inteira do scanner (várias fatias).
   */
  memo<T>(key: string, compute: () => T): T;
  /** Como `memo`, mas indexado por objeto (ex.: um elemento) dentro de um espaço de nomes. */
  memoFor<T>(namespace: string, key: object, compute: () => T): T;
  /** Shadow roots abertos conhecidos (para consultas globais). */
  shadowRoots(): Iterable<ShadowRoot>;
}

export interface RevalidationHook {
  /** Seletor CSS dos elementos que disparam o gancho (usado em subárvores removidas). */
  readonly selector: string;
  /** O elemento alterado pode afetar o resultado de outros alvos da regra? */
  trigger(el: Element, ctx: EvalContext): boolean;
  /**
   * Alvos a reavaliar quando disparado (ou quando houver remoções). `changed`
   * são os elementos do lote que dispararam o gancho.
   */
  targets(ctx: EvalContext, changed: readonly Element[]): Iterable<Element>;
}

export interface Rule {
  readonly id: string;
  readonly wcag: string;
  readonly level: Level;
  /** Regras ACT correspondentes (para o harness de testes). */
  readonly actRuleIds: readonly string[];
  readonly scope: 'element' | 'document';
  /** Para regras de documento: os elementos a avaliar (ex.: todas as meta viewport). */
  documentTargets?(ctx: EvalContext): Element[];
  isApplicable(el: Element, ctx: EvalContext): boolean;
  evaluate(el: Element, ctx: EvalContext): RuleResult;
  /** Dependências não locais (ex.: ordem de cabeçalhos, vizinhos de alvos). */
  readonly revalidate?: RevalidationHook;
}
