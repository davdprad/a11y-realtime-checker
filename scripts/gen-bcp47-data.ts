/**
 * Gera `src/lib/bcp47-data.generated.ts` com todos os subtags primários de
 * idioma (`Type: language`) do IANA Language Subtag Registry.
 *
 * Executar: pnpm gen:bcp47 [caminho-do-registro-local]
 *
 * Sem argumento, baixa o registro de iana.org (rede usada apenas em tempo de
 * desenvolvimento; a extensão nunca acessa a rede). Faixas de uso privado
 * (`qaa..qtz`) e tags "grandfathered" ficam de fora: a regra ACT bf051a
 * considera `i-lux` inválida, por exemplo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_URL =
  'https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry';

async function loadRegistry(): Promise<string> {
  const local = process.argv[2];
  if (local) return readFileSync(local, 'utf8');
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Falha ao baixar o registro IANA: ${res.status}`);
  return res.text();
}

const text = await loadRegistry();
const fileDate = /^File-Date:\s*(\S+)/m.exec(text)?.[1] ?? 'desconhecida';
const subtags: string[] = [];
for (const record of text.split(/^%%\s*$/m)) {
  const type = /^Type:\s*(\S+)/m.exec(record)?.[1];
  const subtag = /^Subtag:\s*(\S+)/m.exec(record)?.[1];
  if (type !== 'language' || !subtag || subtag.includes('..')) continue;
  subtags.push(subtag.toLowerCase());
}
subtags.sort();

const out = `/* eslint-disable */
// ARQUIVO GERADO por scripts/gen-bcp47-data.ts — não editar à mão.
// Fonte: IANA Language Subtag Registry, File-Date ${fileDate}.
// ${subtags.length} subtags primários de idioma, separados por espaço.

export const IANA_REGISTRY_DATE = ${JSON.stringify(fileDate)};

export const PRIMARY_LANGUAGE_SUBTAGS = ${JSON.stringify(subtags.join(' '))};
`;

const target = resolve(root, 'src/lib/bcp47-data.generated.ts');
writeFileSync(target, out);
console.log(
  `bcp47-data: ${subtags.length} subtags (registro de ${fileDate}) → ${target}`,
);
