/**
 * Baixa os casos de teste oficiais das regras ACT mapeadas (W3C) para
 * `tests/act/www/`, espelhando o caminho `/WAI/content-assets/wcag-act-rules/`
 * para que referências absolutas a assets funcionem no servidor local.
 *
 * Executar uma vez (com rede): pnpm fetch:act
 * Os testes rodam depois sem rede, a partir dos arquivos versionados.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_ACT_RULE_IDS } from '../src/rules/catalog';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.w3.org/WAI/content-assets/wcag-act-rules/';
const WWW = resolve(root, 'tests/act/www/WAI/content-assets/wcag-act-rules');

interface ActTestcase {
  ruleId: string;
  ruleName: string;
  testcaseId: string;
  testcaseTitle: string;
  expected: 'passed' | 'failed' | 'inapplicable';
  relativePath: string;
  url: string;
  rulePage: string;
  approved?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** O w3.org limita a taxa de requisições (HTTP 429): espaça e repete com recuo. */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await sleep(250);
    const res = await fetch(url, {
      headers: { 'user-agent': 'a11y-rt-act-fetch (dev script)' },
    });
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= 6) return res;
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * 2 ** attempt,
    );
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`${res.status} ao baixar ${url}`);
  return res.text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`${res.status} ao baixar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function save(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

const index = JSON.parse(await fetchText(`${BASE}testcases.json`)) as {
  testcases: ActTestcase[];
};
const wanted = new Set(ALL_ACT_RULE_IDS);
const cases = index.testcases.filter((c) => wanted.has(c.ruleId));
console.log(
  `ACT: ${cases.length} casos para ${wanted.size} regras (${[...wanted].join(', ')})`,
);

const assets = new Set<string>();
const available: ActTestcase[] = [];
for (const c of cases) {
  let html: string;
  try {
    html = await fetchText(c.url);
  } catch (err) {
    console.warn(
      `caso indisponível no W3C, ignorado: ${c.ruleId} ${c.testcaseTitle} (${String(err)})`,
    );
    continue;
  }
  available.push(c);
  save(resolve(WWW, c.relativePath), html);
  for (const m of html.matchAll(
    /\/WAI\/content-assets\/wcag-act-rules\/(test-assets\/[^"')\s>]+)/g,
  )) {
    if (m[1]) assets.add(m[1]);
  }
}
for (const a of assets) {
  try {
    save(resolve(WWW, a), await fetchBinary(`${BASE}${a}`));
  } catch (err) {
    console.warn(`asset ignorado: ${a} (${String(err)})`);
  }
}
save(
  resolve(root, 'tests/act/testcases.json'),
  `${JSON.stringify({ source: `${BASE}testcases.json`, fetchedAt: new Date().toISOString(), testcases: available }, null, 2)}\n`,
);
console.log(
  `ACT: ${available.length} casos e ${assets.size} assets gravados em tests/act/`,
);
