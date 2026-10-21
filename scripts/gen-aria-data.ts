/**
 * Gera `src/lib/aria-data.generated.ts` a partir do pacote `aria-query`
 * (versão fixada em package.json), que codifica a especificação WAI-ARIA 1.2
 * com os módulos DPUB-ARIA e Graphics-ARIA.
 *
 * Executar: pnpm gen:aria
 *
 * A tabela é gerada (e versionada) em vez de importar `aria-query` em tempo de
 * execução: o content script fica menor e o motor de regras não depende de
 * código de terceiros para decidir resultados.
 */
import { aria, roles } from 'aria-query';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(
  readFileSync(resolve(root, 'node_modules/aria-query/package.json'), 'utf8'),
) as { version: string };

interface RoleOut {
  abstract: boolean;
  superClass: string[];
  requiredProps: Record<string, string | null>;
  nameFrom: string[];
  childrenPresentational: boolean;
}

interface PropOut {
  type: string;
  values?: string[];
  allowUndefined?: boolean;
}

const rolesOut: Record<string, RoleOut> = {};
for (const [name, def] of [...roles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const ancestors = new Set<string>();
  for (const chain of def.superClass) for (const r of chain) ancestors.add(r);
  const required: Record<string, string | null> = {};
  for (const [prop, value] of Object.entries(def.requiredProps)) {
    required[prop] = value === null ? null : String(value);
  }
  rolesOut[name] = {
    abstract: def.abstract,
    superClass: [...ancestors].sort(),
    requiredProps: required,
    nameFrom: [...((def as { nameFrom?: readonly string[] }).nameFrom ?? [])].map(String),
    childrenPresentational: def.childrenPresentational,
  };
}

const globalProps = Object.keys(roles.get('roletype')?.props ?? {}).sort();

const propsOut: Record<string, PropOut> = {};
for (const [name, def] of [...aria.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const out: PropOut = { type: def.type };
  if ('values' in def && Array.isArray(def.values)) {
    out.values = def.values.map((v: unknown) => String(v));
  }
  if ('allowundefined' in def && def.allowundefined === true) out.allowUndefined = true;
  propsOut[name] = out;
}

const banner = `/* eslint-disable */
// ARQUIVO GERADO por scripts/gen-aria-data.ts — não editar à mão.
// Fonte: aria-query@${pkg.version} (WAI-ARIA 1.2 + DPUB-ARIA 1.0 + Graphics-ARIA 1.0).
`;

const body = `
export const ARIA_QUERY_VERSION = ${JSON.stringify(pkg.version)};

export interface AriaRoleDef {
  readonly abstract: boolean;
  readonly superClass: readonly string[];
  readonly requiredProps: Readonly<Record<string, string | null>>;
  readonly nameFrom: readonly string[];
  readonly childrenPresentational: boolean;
}

export interface AriaPropDef {
  readonly type: string;
  readonly values?: readonly string[];
  readonly allowUndefined?: boolean;
}

export const ARIA_ROLES: Readonly<Record<string, AriaRoleDef>> = ${JSON.stringify(rolesOut, null, 2)};

/** Estados e propriedades globais (suportados pelo papel abstrato roletype). */
export const ARIA_GLOBAL_PROPS: readonly string[] = ${JSON.stringify(globalProps)};

export const ARIA_PROPS: Readonly<Record<string, AriaPropDef>> = ${JSON.stringify(propsOut, null, 2)};
`;

const target = resolve(root, 'src/lib/aria-data.generated.ts');
writeFileSync(target, banner + body);
console.log(
  `aria-data: ${Object.keys(rolesOut).length} papéis, ${Object.keys(propsOut).length} atributos → ${target}`,
);
