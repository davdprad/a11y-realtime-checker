/**
 * Validação do atributo `lang` (WCAG 3.1.1, regras ACT b5c3f8 e bf051a).
 *
 * A regra ACT bf051a exige apenas que o subtag primário exista no IANA
 * Language Subtag Registry ("known primary language tag"). Subtags seguintes
 * (região, script, variantes) não são validados: `en-US-GB` é aceito.
 */
import { PRIMARY_LANGUAGE_SUBTAGS } from './bcp47-data.generated';

let known: ReadonlySet<string> | undefined;

function knownSubtags(): ReadonlySet<string> {
  known ??= new Set(PRIMARY_LANGUAGE_SUBTAGS.split(' '));
  return known;
}

export interface LangCheck {
  /** `true` quando o subtag primário existe no registro IANA. */
  readonly valid: boolean;
  /** Subtag primário em minúsculas (texto antes do primeiro hífen). */
  readonly primary: string;
}

/** Remove espaços ASCII nas pontas (como o HTML faz com valores de atributo). */
export function trimLang(value: string): string {
  return value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '');
}

export function checkLanguageTag(value: string): LangCheck {
  const tag = trimLang(value);
  const primary = (tag.split('-')[0] ?? '').toLowerCase();
  // Subtags primários têm 2–3 letras (ISO 639) ou 5–8 letras (registrados);
  // o tamanho 4 é reservado. O conjunto do registro já reflete isso.
  const valid = /^[a-z]{2,8}$/.test(primary) && knownSubtags().has(primary);
  return { valid, primary };
}
