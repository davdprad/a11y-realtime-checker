/**
 * Parsing do atributo `content` de `<meta name="viewport">` (WCAG 1.4.4,
 * regra ACT b4f0c3).
 *
 * Segue o algoritmo do CSS Device Adaptation e os valores especiais do
 * Chromium: `yes` → 1, `no` → 0, `device-width`/`device-height` → 10 e texto
 * não numérico → 0. Os casos ACT confirmam esse comportamento
 * (`user-scalable=invalid` e `maximum-scale=yes` falham).
 */

export type ViewportProperties = Readonly<Record<string, string>>;

/** Separa pares `chave=valor`; separadores: espaço, vírgula e ponto e vírgula. */
export function parseViewportContent(content: string): ViewportProperties {
  const out: Record<string, string> = {};
  const isSep = (ch: string): boolean => /[\s,;]/.test(ch);
  const isWs = (ch: string): boolean => /\s/.test(ch);
  let i = 0;
  const n = content.length;
  while (i < n) {
    while (i < n && isSep(content.charAt(i))) i++;
    let key = '';
    while (i < n && !isSep(content.charAt(i)) && content.charAt(i) !== '=') {
      key += content.charAt(i);
      i++;
    }
    while (i < n && isWs(content.charAt(i))) i++;
    let value = '';
    if (content.charAt(i) === '=') {
      i++;
      while (i < n && isWs(content.charAt(i))) i++;
      while (i < n && !isSep(content.charAt(i)) && content.charAt(i) !== '=') {
        value += content.charAt(i);
        i++;
      }
    }
    if (key) out[key.toLowerCase()] = value;
    // Avança caso tenha parado em um "=" solto, evitando laço infinito.
    if (content.charAt(i) === '=') i++;
  }
  return out;
}

/** Valor numérico de uma propriedade, com os valores especiais do Chromium. */
export function viewportNumber(raw: string): number {
  const v = raw.trim().toLowerCase();
  if (v === 'yes') return 1;
  if (v === 'no') return 0;
  if (v === 'device-width' || v === 'device-height') return 10;
  const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(v);
  return m ? Number(m[0]) : 0;
}

export type ViewportZoomProblem = 'user-scalable' | 'maximum-scale';

export interface ViewportZoomCheck {
  /** A meta é aplicável (tem `user-scalable` ou `maximum-scale`). */
  readonly applicable: boolean;
  readonly problems: readonly ViewportZoomProblem[];
  readonly maximumScale?: number;
  readonly userScalable?: number;
}

export function checkViewportZoom(content: string): ViewportZoomCheck {
  const props = parseViewportContent(content);
  const hasScalable = 'user-scalable' in props;
  const hasMax = 'maximum-scale' in props;
  if (!hasScalable && !hasMax) return { applicable: false, problems: [] };
  const problems: ViewportZoomProblem[] = [];
  let userScalable: number | undefined;
  let maximumScale: number | undefined;
  if (hasScalable) {
    userScalable = viewportNumber(props['user-scalable'] ?? '');
    // O zoom só é permitido quando |valor| ≥ 1.
    if (Math.abs(userScalable) < 1) problems.push('user-scalable');
  }
  if (hasMax) {
    maximumScale = viewportNumber(props['maximum-scale'] ?? '');
    // Valores negativos são ignorados pelo navegador ("auto").
    if (maximumScale >= 0 && maximumScale < 2) problems.push('maximum-scale');
  }
  return {
    applicable: true,
    problems,
    ...(maximumScale !== undefined ? { maximumScale } : {}),
    ...(userScalable !== undefined ? { userScalable } : {}),
  };
}
