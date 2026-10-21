/**
 * 2.5.8 Tamanho do alvo (mínimo) (AA). Sem regra ACT correspondente.
 *
 * Alvos clicáveis (links, botões, campos e widgets ARIA interativos) com
 * menos de 24 × 24 px CSS são violação, exceto:
 * - espaçamento: o círculo de 24 px de diâmetro centrado no alvo não
 *   intersecta outro alvo nem o círculo de outro alvo pequeno → `pass`;
 * - alvo inline em frase (limitado pela altura da linha) → `incomplete`;
 * - controle padrão do navegador sem estilização (`appearance: auto` em
 *   checkbox, radio, etc.) → `incomplete`;
 * - alvos aninhados (um dentro do outro) não entram no cálculo do espaçamento.
 * As exceções "equivalente" e "essencial" exigem julgamento humano.
 */
import { flatContains, isHtmlElement, walkElements } from '../lib/dom';
import {
  checkSpacing,
  isEmptyRect,
  isUndersized,
  SPACING_RADIUS,
  SpatialGrid,
  unionRects,
  type Rect,
} from '../lib/geometry';
import { inputType, isPresentational } from '../lib/roles';
import { isClippedAway } from '../lib/visibility';
import type { EvalContext, Rule } from './types';
import { base, makeResult } from './util';

const meta = base('target-size');

const INTERACTIVE_ROLES = [
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'slider',
  'spinbutton',
  'combobox',
  'treeitem',
];

export const TARGET_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden" i])',
  'select',
  'textarea',
  'summary',
  ...INTERACTIVE_ROLES.map((r) => `[role~="${r}" i]`),
].join(', ');

/** Controles cujo tamanho padrão é definido pelo navegador. */
const UA_SIZED_INPUTS = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
]);

function isDisabledTarget(el: Element): boolean {
  return el.matches(':disabled') || el.closest('[aria-disabled="true" i]') !== null;
}

/** Área clicável: a caixa do elemento; para alvos inline, unida à dos descendentes. */
export function targetRect(el: Element, ctx: EvalContext): Rect {
  return ctx.memoFor('target-rect', el, () => {
    const own = ctx.rect(el);
    if (ctx.style(el).display !== 'inline') return own;
    const rects: Rect[] = [own];
    let n = 0;
    for (const d of walkElements(el)) {
      if (d === el) continue;
      if (++n > 50) break;
      if (ctx.rendered(d)) rects.push(ctx.rect(d));
    }
    return unionRects(rects) ?? own;
  });
}

function isTarget(el: Element, ctx: EvalContext): boolean {
  if (!isHtmlElement(el) || !el.matches(TARGET_SELECTOR)) return false;
  if (isPresentational(ctx.role(el))) return false;
  if (isDisabledTarget(el)) return false;
  if (!ctx.rendered(el)) return false;
  const s = ctx.style(el);
  if (s.pointerEvents === 'none') return false;
  const r = targetRect(el, ctx);
  if (isEmptyRect(r)) return false;
  return !isClippedAway(
    el,
    r,
    (e) => ctx.style(e),
    (e) => ctx.rect(e),
  );
}

interface TargetEntry {
  readonly id: number;
  readonly el: Element;
  readonly rect: Rect;
}

/**
 * Índice espacial de todos os alvos do documento e dos shadow roots abertos,
 * usado só para achar vizinhos no cálculo do espaçamento. Usa um filtro
 * barato (caixa renderizada, não desabilitado, sem pointer-events) para caber
 * numa fatia mesmo com milhares de alvos, e é calculado uma vez por execução
 * do scanner (prefixo "run:"), não a cada fatia.
 */
function allTargets(ctx: EvalContext): {
  list: TargetEntry[];
  grid: SpatialGrid<TargetEntry>;
} {
  return ctx.memo('run:targets', () => {
    const list: TargetEntry[] = [];
    let id = 0;
    const collect = (root: Document | ShadowRoot): void => {
      for (const el of root.querySelectorAll(TARGET_SELECTOR)) {
        // Caixa vazia cobre display:none e alvos fora do layout.
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        list.push({
          id: id++,
          el,
          rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        });
      }
    };
    collect(ctx.doc);
    for (const root of ctx.shadowRoots()) collect(root);
    return { list, grid: new SpatialGrid(list) };
  });
}

/** Alvo inline cercado por texto no mesmo bloco ("em uma frase"). */
function isInlineInSentence(el: Element, ctx: EvalContext): boolean {
  if (ctx.style(el).display !== 'inline') return false;
  let block: Element | null = el.parentElement;
  while (block && ctx.style(block).display.startsWith('inline'))
    block = block.parentElement;
  if (!block) return false;
  const own = el.textContent.replace(/\s+/g, '');
  const all = block.textContent.replace(/\s+/g, '');
  return all.length > own.length;
}

function isUserAgentControl(el: Element, ctx: EvalContext): boolean {
  if (!isHtmlElement(el)) return false;
  const appearance = ctx.style(el).appearance;
  if (appearance === 'none') return false;
  if (el.localName === 'input') return UA_SIZED_INPUTS.has(inputType(el));
  return false;
}

export const targetSize: Rule = {
  ...meta,
  isApplicable(el, ctx) {
    return isTarget(el, ctx);
  },
  evaluate(el, ctx) {
    const rect = targetRect(el, ctx);
    const size = {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    };
    if (!isUndersized(rect)) return makeResult(meta, el, 'pass', 'target_size', size);
    if (isInlineInSentence(el, ctx)) {
      return makeResult(meta, el, 'incomplete', 'target_size_incomplete', {
        reason: 'inline',
        ...size,
      });
    }
    if (isUserAgentControl(el, ctx)) {
      return makeResult(meta, el, 'incomplete', 'target_size_incomplete', {
        reason: 'user-agent',
        ...size,
      });
    }
    const { grid } = allTargets(ctx);
    const self: TargetEntry = { id: -1, el, rect };
    const neighbours = grid
      .query(rect, SPACING_RADIUS * 2 + 1)
      .filter(
        (t) =>
          t.el !== el &&
          !flatContains(t.el, el) &&
          !flatContains(el, t.el) &&
          !isDisabledTarget(t.el) &&
          ctx.rendered(t.el) &&
          ctx.style(t.el).pointerEvents !== 'none',
      )
      .map((t) => ({ id: t.id, rect: t.rect }));
    const verdict = checkSpacing({ id: self.id, rect }, neighbours);
    return verdict.ok
      ? makeResult(meta, el, 'pass', 'target_size_spacing', size)
      : makeResult(meta, el, 'violation', 'target_size', size);
  },
  revalidate: {
    selector: TARGET_SELECTOR,
    trigger: (el) => isHtmlElement(el) && el.matches(TARGET_SELECTOR),
    // Só os vizinhos dos alvos alterados podem mudar de resultado; violações já
    // registradas são reavaliadas pelo scanner (cobre a remoção de um vizinho).
    targets(ctx, changed) {
      const { grid } = allTargets(ctx);
      const out = new Set<Element>();
      for (const c of changed) {
        if (!c.isConnected) continue;
        for (const t of grid.query(ctx.rect(c), SPACING_RADIUS * 3)) out.add(t.el);
      }
      return out;
    },
  },
};
