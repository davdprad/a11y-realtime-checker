import { describe, expect, it } from 'vitest';
import {
  center,
  checkSpacing,
  circleIntersectsRect,
  circlesIntersect,
  distancePointToRect,
  intersectRects,
  isEmptyRect,
  isUndersized,
  overlapArea,
  SpatialGrid,
  unionRects,
} from '../../src/lib/geometry';

const r = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});

describe('retângulos', () => {
  it('união ignora retângulos vazios', () => {
    expect(unionRects([r(0, 0, 10, 10), r(20, 5, 5, 5), r(100, 100, 0, 0)])).toEqual(
      r(0, 0, 25, 10),
    );
    expect(unionRects([r(0, 0, 0, 0)])).toBeNull();
  });

  it('interseção e área', () => {
    expect(intersectRects(r(0, 0, 10, 10), r(5, 5, 10, 10))).toEqual(r(5, 5, 5, 5));
    expect(overlapArea(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(25);
    expect(overlapArea(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(0);
  });

  it('distância ponto–retângulo', () => {
    expect(distancePointToRect({ x: 5, y: 5 }, r(0, 0, 10, 10))).toBe(0);
    expect(distancePointToRect({ x: 13, y: 14 }, r(0, 0, 10, 10))).toBe(5);
  });

  it('centro, vazio e tamanho mínimo', () => {
    expect(center(r(0, 0, 24, 10))).toEqual({ x: 12, y: 5 });
    expect(isEmptyRect(r(0, 0, 0, 5))).toBe(true);
    expect(isUndersized(r(0, 0, 24, 24))).toBe(false);
    expect(isUndersized(r(0, 0, 23.9, 30))).toBe(true);
  });
});

describe('exceção de espaçamento do 2.5.8', () => {
  it('tangência não conta como interseção', () => {
    expect(circleIntersectsRect({ x: 0, y: 0 }, 12, r(12, -5, 10, 10))).toBe(false);
    expect(circleIntersectsRect({ x: 0, y: 0 }, 12, r(11.9, -5, 10, 10))).toBe(true);
    expect(circlesIntersect({ x: 0, y: 0 }, { x: 24, y: 0 }, 12)).toBe(false);
    expect(circlesIntersect({ x: 0, y: 0 }, { x: 23.9, y: 0 }, 12)).toBe(true);
  });

  it('alvos 16×16 encostados falham; afastados passam', () => {
    const a = { id: 1, rect: r(0, 0, 16, 16) };
    // centro de A (8,8) a 8 px da borda de B → o círculo intersecta B
    expect(checkSpacing(a, [{ id: 2, rect: r(16, 0, 16, 16) }]).ok).toBe(false);
    // borda de C a 24 px do centro de A e centros a 32 px → passa
    expect(checkSpacing(a, [{ id: 3, rect: r(32, 0, 16, 16) }]).ok).toBe(true);
  });

  it('falha pelo círculo de outro alvo pequeno', () => {
    const a = { id: 1, rect: r(0, 0, 10, 10) };
    expect(checkSpacing(a, [{ id: 2, rect: r(30, 0, 10, 10) }])).toEqual({ ok: true });
    // borda a 21 px (> 12) mas centros a 23 px (< 24)
    expect(checkSpacing(a, [{ id: 3, rect: r(26, 3, 4, 4) }])).toEqual({
      ok: false,
      conflictWith: 3,
      reason: 'circle',
    });
  });

  it('ignora o próprio alvo', () => {
    const a = { id: 1, rect: r(0, 0, 10, 10) };
    expect(checkSpacing(a, [a]).ok).toBe(true);
  });

  it('alvo grande vizinho conta como alvo', () => {
    const a = { id: 1, rect: r(0, 0, 10, 10) };
    expect(checkSpacing(a, [{ id: 2, rect: r(14, 0, 100, 100) }])).toEqual({
      ok: false,
      conflictWith: 2,
      reason: 'target',
    });
  });
});

describe('SpatialGrid', () => {
  it('encontra vizinhos próximos e ignora distantes', () => {
    const items = [
      { id: 1, rect: r(0, 0, 10, 10) },
      { id: 2, rect: r(30, 0, 10, 10) },
      { id: 3, rect: r(1000, 1000, 10, 10) },
    ];
    const ids = new SpatialGrid(items).query(r(0, 0, 10, 10), 25).map((i) => i.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });

  it('alvos gigantes vão para a célula global', () => {
    const grid = new SpatialGrid([{ id: 9, rect: r(0, 0, 100_000, 100_000) }], 64);
    expect(grid.query(r(5000, 5000, 1, 1), 0).map((i) => i.id)).toEqual([9]);
  });
});
