/**
 * Cores, composição alfa e contraste segundo a WCAG 2.2.
 *
 * Todos os canais são números reais em [0, 1] (sem arredondar para 8 bits),
 * para que a comparação com os limiares 4,5:1 e 3:1 seja feita sem perdas.
 */

export interface RGBA {
  /** Canais sRGB codificados (gamma), em [0, 1]. */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** Alfa em [0, 1]. */
  readonly a: number;
}

/** Cor com canais pré-multiplicados pelo alfa (usada na composição de grupos). */
export interface PremultipliedRGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export const WHITE: RGBA = { r: 1, g: 1, b: 1, a: 1 };
export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------------------
// Luminância e contraste (WCAG 2.2, definição "relative luminance")
// ---------------------------------------------------------------------------

/** Lineariza um canal sRGB codificado em [0, 1]. */
export function linearizeChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa L = 0,2126 R + 0,7152 G + 0,0722 B (alfa ignorado). */
export function relativeLuminance(color: RGBA): number {
  return (
    0.2126 * linearizeChannel(color.r) +
    0.7152 * linearizeChannel(color.g) +
    0.0722 * linearizeChannel(color.b)
  );
}

/** Razão de contraste (L1 + 0,05) / (L2 + 0,05), com L1 a cor mais clara. */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Composição alfa (operador "source-over")
// ---------------------------------------------------------------------------

/** Compõe `top` sobre `bottom` e devolve a cor resultante (não pré-multiplicada). */
export function compositeOver(top: RGBA, bottom: RGBA): RGBA {
  return unpremultiply(over(premultiply(top), premultiply(bottom)));
}

export function premultiply(c: RGBA): PremultipliedRGBA {
  return { r: c.r * c.a, g: c.g * c.a, b: c.b * c.a, a: c.a };
}

export function unpremultiply(p: PremultipliedRGBA): RGBA {
  if (p.a <= 0) return TRANSPARENT;
  return {
    r: clamp01(p.r / p.a),
    g: clamp01(p.g / p.a),
    b: clamp01(p.b / p.a),
    a: clamp01(p.a),
  };
}

/** "source-over" em espaço pré-multiplicado. */
export function over(
  top: PremultipliedRGBA,
  bottom: PremultipliedRGBA,
): PremultipliedRGBA {
  const k = 1 - top.a;
  return {
    r: top.r + bottom.r * k,
    g: top.g + bottom.g * k,
    b: top.b + bottom.b * k,
    a: top.a + bottom.a * k,
  };
}

/** Aplica a opacidade de grupo (`opacity` CSS) a uma camada já composta. */
export function scaleOpacity(p: PremultipliedRGBA, opacity: number): PremultipliedRGBA {
  const o = clamp01(opacity);
  return { r: p.r * o, g: p.g * o, b: p.b * o, a: p.a * o };
}

export const PREMUL_TRANSPARENT: PremultipliedRGBA = { r: 0, g: 0, b: 0, a: 0 };

// ---------------------------------------------------------------------------
// Parsing de cores computadas
// ---------------------------------------------------------------------------

/**
 * Converte o valor computado de uma cor CSS em RGBA.
 *
 * Suporta o que o Chromium devolve em `getComputedStyle`: `rgb()`/`rgba()`,
 * `color(srgb|srgb-linear|display-p3|xyz|xyz-d50|xyz-d65 …)`, `lab()`, `lch()`,
 * `oklab()`, `oklch()` e `transparent`. Espaços sem conversão implementada
 * (`a98-rgb`, `prophoto-rgb`, `rec2020`) devolvem `null`, e quem chama trata o
 * caso como `incomplete`. Cores fora do gamut sRGB são recortadas ("clip").
 */
export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return TRANSPARENT;
  const m = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!m) return parseHex(s);
  const fn = m[1] ?? '';
  const args = m[2] ?? '';
  switch (fn) {
    case 'rgb':
    case 'rgba':
      return parseRgb(args);
    case 'color':
      return parseColorFunction(args);
    case 'lab':
    case 'lch':
    case 'oklab':
    case 'oklch':
      return parseLabFamily(fn, args);
    default:
      return null;
  }
}

/** Serializa como #rrggbb (para exibição no cartão e na exportação). */
export function toHex(c: RGBA): string {
  const h = (v: number): string =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function parseHex(s: string): RGBA | null {
  const m = /^#([0-9a-f]{3,8})$/.exec(s);
  const hex = m?.[1];
  if (!hex || ![3, 4, 6, 8].includes(hex.length)) return null;
  const full =
    hex.length <= 4
      ? hex
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : hex;
  const n = (i: number): number => parseInt(full.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) : 1 };
}

/** Separa argumentos em notação moderna ("a b c / alpha") ou legada ("a, b, c, alpha"). */
function splitArgs(args: string): { parts: string[]; alpha: string | undefined } {
  const [main = '', alpha] = args.split('/').map((p) => p.trim());
  const parts = main.includes(',')
    ? main.split(',').map((p) => p.trim())
    : main.split(/\s+/).filter(Boolean);
  if (alpha === undefined && parts.length === 4) {
    const last = parts.pop();
    return { parts, alpha: last };
  }
  return { parts, alpha };
}

function parseNumber(token: string | undefined, percentScale = 1): number | null {
  if (token === undefined) return null;
  if (token === 'none') return 0;
  const pct = token.endsWith('%');
  const v = Number(pct ? token.slice(0, -1) : token);
  if (!Number.isFinite(v)) return null;
  return pct ? (v / 100) * percentScale : v;
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const v = parseNumber(token, 1);
  return v === null ? null : clamp01(v);
}

function parseRgb(args: string): RGBA | null {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 3) return null;
  const ch = parts.map((p) => parseNumber(p, 255));
  const a = parseAlpha(alpha);
  if (ch.some((v) => v === null) || a === null) return null;
  const [r, g, b] = ch as [number, number, number];
  return { r: clamp01(r / 255), g: clamp01(g / 255), b: clamp01(b / 255), a };
}

type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];

const mul = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

// Matrizes do CSS Color 4 (seção 18, "Sample code for color conversions").
const XYZ_D65_TO_LINEAR_SRGB: Mat3 = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const D50_TO_D65: Mat3 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const LINEAR_P3_TO_XYZ_D65: Mat3 = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const OKLAB_TO_LMS: Mat3 = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_LINEAR_SRGB: Mat3 = [
  [4.0767416360759583, -3.3077115392580629, 0.2309699031821043],
  [-1.2684379732850315, 2.6097573492876882, -0.3413193760026573],
  [-0.0041960761386756, -0.7034186179359362, 1.7076146940746117],
];
const D50_WHITE: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const gammaEncode = (c: number): number => {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs > 0.0031308 ? sign * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * c;
};

function fromLinearSrgb(v: Vec3, a: number): RGBA {
  return {
    r: clamp01(gammaEncode(v[0])),
    g: clamp01(gammaEncode(v[1])),
    b: clamp01(gammaEncode(v[2])),
    a,
  };
}

function parseColorFunction(args: string): RGBA | null {
  const tokens = args.split('/');
  const head = (tokens[0] ?? '').trim().split(/\s+/);
  const space = head.shift();
  const values = head.map((t) => parseNumber(t, 1));
  const a = parseAlpha(tokens[1]?.trim());
  if (values.length !== 3 || values.some((v) => v === null) || a === null) return null;
  const v = values as unknown as Vec3;
  switch (space) {
    case 'srgb':
      return { r: clamp01(v[0]), g: clamp01(v[1]), b: clamp01(v[2]), a };
    case 'srgb-linear':
      return fromLinearSrgb(v, a);
    case 'display-p3': {
      const lin: Vec3 = [
        linearizeSigned(v[0]),
        linearizeSigned(v[1]),
        linearizeSigned(v[2]),
      ];
      return fromLinearSrgb(
        mul(XYZ_D65_TO_LINEAR_SRGB, mul(LINEAR_P3_TO_XYZ_D65, lin)),
        a,
      );
    }
    case 'xyz':
    case 'xyz-d65':
      return fromLinearSrgb(mul(XYZ_D65_TO_LINEAR_SRGB, v), a);
    case 'xyz-d50':
      return fromLinearSrgb(mul(XYZ_D65_TO_LINEAR_SRGB, mul(D50_TO_D65, v)), a);
    default:
      return null;
  }
}

function linearizeSigned(c: number): number {
  const sign = c < 0 ? -1 : 1;
  return sign * linearizeChannel(Math.abs(c));
}

function parseLabFamily(fn: string, args: string): RGBA | null {
  const { parts, alpha } = splitArgs(args);
  if (parts.length !== 3) return null;
  const a = parseAlpha(alpha);
  if (a === null) return null;
  const isOk = fn.startsWith('ok');
  // Escalas de porcentagem do CSS Color 4.
  const lScale = isOk ? 1 : 100;
  const cScale = fn === 'lab' ? 125 : fn === 'lch' ? 150 : fn === 'oklab' ? 0.4 : 0.4;
  const l = parseNumber(parts[0], lScale);
  const x = parseNumber(parts[1], cScale);
  const yRaw = parts[2];
  if (l === null || x === null || yRaw === undefined) return null;
  let labA: number;
  let labB: number;
  if (fn === 'lch' || fn === 'oklch') {
    const h = parseHue(yRaw);
    if (h === null) return null;
    labA = x * Math.cos((h * Math.PI) / 180);
    labB = x * Math.sin((h * Math.PI) / 180);
  } else {
    const y = parseNumber(yRaw, cScale);
    if (y === null) return null;
    labA = x;
    labB = y;
  }
  if (isOk) {
    const lms = mul(OKLAB_TO_LMS, [l, labA, labB]);
    const cubed: Vec3 = [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3];
    return fromLinearSrgb(mul(LMS_TO_LINEAR_SRGB, cubed), a);
  }
  // CIE Lab (D50) → XYZ D50 → XYZ D65 → sRGB linear.
  const kappa = 24389 / 27;
  const eps = 216 / 24389;
  const f1 = (l + 16) / 116;
  const f0 = labA / 500 + f1;
  const f2 = f1 - labB / 200;
  const xyz: Vec3 = [
    (f0 ** 3 > eps ? f0 ** 3 : (116 * f0 - 16) / kappa) * D50_WHITE[0],
    (l > kappa * eps ? ((l + 16) / 116) ** 3 : l / kappa) * D50_WHITE[1],
    (f2 ** 3 > eps ? f2 ** 3 : (116 * f2 - 16) / kappa) * D50_WHITE[2],
  ];
  return fromLinearSrgb(mul(XYZ_D65_TO_LINEAR_SRGB, mul(D50_TO_D65, xyz)), a);
}

function parseHue(token: string): number | null {
  if (token === 'none') return 0;
  const m = /^(-?[\d.]+(?:e[-+]?\d+)?)(deg|rad|grad|turn)?$/.exec(token);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  switch (m[2]) {
    case 'rad':
      return (v * 180) / Math.PI;
    case 'grad':
      return v * 0.9;
    case 'turn':
      return v * 360;
    default:
      return v;
  }
}
