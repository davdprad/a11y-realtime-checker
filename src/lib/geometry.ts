/**
 * Geometria pura para o critério 2.5.8 (Tamanho do alvo, mínimo) e para
 * testes de interseção de retângulos usados no cálculo de contraste.
 */

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Tamanho mínimo do alvo em px CSS (WCAG 2.2, 2.5.8). */
export const MIN_TARGET_SIZE = 24;
/** Raio do círculo da exceção de espaçamento (24 px de diâmetro). */
export const SPACING_RADIUS = MIN_TARGET_SIZE / 2;

export const right = (r: Rect): number => r.left + r.width;
export const bottom = (r: Rect): number => r.top + r.height;

export function center(r: Rect): Point {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function isEmptyRect(r: Rect): boolean {
  return r.width <= 0 || r.height <= 0;
}

export function rectFrom(dom: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Rect {
  return { left: dom.left, top: dom.top, width: dom.width, height: dom.height };
}

/** União (caixa envolvente) de retângulos não vazios; `null` se todos vazios. */
export function unionRects(rects: Iterable<Rect>): Rect | null {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const rect of rects) {
    if (isEmptyRect(rect)) continue;
    l = Math.min(l, rect.left);
    t = Math.min(t, rect.top);
    r = Math.max(r, right(rect));
    b = Math.max(b, bottom(rect));
  }
  if (l === Infinity) return null;
  return { left: l, top: t, width: r - l, height: b - t };
}

/** Interseção de dois retângulos (largura/altura podem ser ≤ 0 quando disjuntos). */
export function intersectRects(a: Rect, b: Rect): Rect {
  const l = Math.max(a.left, b.left);
  const t = Math.max(a.top, b.top);
  return {
    left: l,
    top: t,
    width: Math.min(right(a), right(b)) - l,
    height: Math.min(bottom(a), bottom(b)) - t,
  };
}

/** Área de sobreposição positiva entre dois retângulos. */
export function overlapArea(a: Rect, b: Rect): number {
  const i = intersectRects(a, b);
  return i.width > 0 && i.height > 0 ? i.width * i.height : 0;
}

/** Distância do ponto ao retângulo (0 se estiver dentro ou na borda). */
export function distancePointToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - right(r));
  const dy = Math.max(r.top - p.y, 0, p.y - bottom(r));
  return Math.hypot(dx, dy);
}

/**
 * O círculo de raio `radius` centrado em `c` intersecta o retângulo?
 * Tangência (distância exatamente igual ao raio) não conta como interseção.
 */
export function circleIntersectsRect(c: Point, radius: number, r: Rect): boolean {
  return distancePointToRect(c, r) < radius;
}

/** Dois círculos de mesmo raio se intersectam (tangência não conta)? */
export function circlesIntersect(a: Point, b: Point, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < radius * 2;
}

export function isUndersized(r: Rect, min = MIN_TARGET_SIZE): boolean {
  return r.width < min || r.height < min;
}

export interface SpacingTarget {
  readonly id: number;
  readonly rect: Rect;
}

export type SpacingVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly conflictWith: number;
      readonly reason: 'target' | 'circle';
    };

/**
 * Exceção de espaçamento da WCAG 2.5.8: um alvo pequeno passa se o círculo de
 * 24 px de diâmetro centrado na sua caixa não intersecta (a) nenhum outro alvo
 * nem (b) o círculo de outro alvo pequeno.
 *
 * `others` já deve excluir o próprio alvo e alvos aninhados (ancestrais ou
 * descendentes), cuja relação é ambígua.
 */
export function checkSpacing(
  target: SpacingTarget,
  others: Iterable<SpacingTarget>,
  radius = SPACING_RADIUS,
): SpacingVerdict {
  const c = center(target.rect);
  for (const other of others) {
    if (other.id === target.id) continue;
    if (circleIntersectsRect(c, radius, other.rect)) {
      return { ok: false, conflictWith: other.id, reason: 'target' };
    }
    if (isUndersized(other.rect) && circlesIntersect(c, center(other.rect), radius)) {
      return { ok: false, conflictWith: other.id, reason: 'circle' };
    }
  }
  return { ok: true };
}

/**
 * Índice espacial simples (grade uniforme) para consultar vizinhos próximos em
 * O(1) amortizado, evitando O(n²) em páginas com muitos alvos.
 */
export class SpatialGrid<T extends { readonly rect: Rect }> {
  private readonly cells = new Map<string, T[]>();

  constructor(
    items: Iterable<T>,
    private readonly cellSize = 64,
  ) {
    for (const item of items) this.insert(item);
  }

  private keysFor(r: Rect, pad: number): string[] {
    const cs = this.cellSize;
    const x0 = Math.floor((r.left - pad) / cs);
    const x1 = Math.floor((right(r) + pad) / cs);
    const y0 = Math.floor((r.top - pad) / cs);
    const y1 = Math.floor((bottom(r) + pad) / cs);
    const keys: string[] = [];
    // Alvos gigantes (ex.: cartões clicáveis) ocupariam muitas células; o
    // limite mantém o custo previsível sem perder vizinhos (fallback abaixo).
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) return ['*'];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x},${y}`);
    return keys;
  }

  insert(item: T): void {
    for (const k of this.keysFor(item.rect, 0)) {
      const cell = this.cells.get(k);
      if (cell) cell.push(item);
      else this.cells.set(k, [item]);
    }
  }

  /** Itens cujas células cobrem `r` expandido de `pad` px (sem duplicatas). */
  query(r: Rect, pad: number): T[] {
    const seen = new Set<T>();
    for (const k of [...this.keysFor(r, pad), '*']) {
      for (const item of this.cells.get(k) ?? []) seen.add(item);
    }
    return [...seen];
  }
}
