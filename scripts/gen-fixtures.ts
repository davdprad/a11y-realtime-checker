/**
 * Gera as fixtures de desempenho com DOM grande (determinísticas):
 *   fixtures/large-dom-5k.html  (~5.000 nós: ~3.100 elementos + texto)
 *   fixtures/large-dom-20k.html (~20.000 nós: ~12.400 elementos + texto)
 *
 * O conteúdo imita uma página real (cabeçalhos, parágrafos, links, botões,
 * imagens, formulários, tabelas) com ~1% de violações intencionais.
 * Executar: pnpm gen:fixtures
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** PRNG determinístico (mulberry32) para que as fixtures sejam reproduzíveis. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS =
  'acessibilidade web navegador leitor tela contraste rótulo botão link imagem formulário página conteúdo usuário teclado foco'.split(
    ' ',
  );

function sentence(r: () => number, n: number): string {
  return Array.from(
    { length: n },
    () => WORDS[Math.floor(r() * WORDS.length)] ?? 'texto',
  ).join(' ');
}

/** Um bloco "card" com ~25 elementos. `bad` insere uma violação. */
function card(i: number, r: () => number): string {
  const bad = i % 20 === 7;
  const kind = i % 5;
  const head = `<h3>Item ${i}</h3>`;
  const para = `<p>${sentence(r, 12)} <a href="#item-${i}">${sentence(r, 2)}</a> ${sentence(r, 6)}.</p>`;
  let body: string;
  switch (kind) {
    case 0:
      body = `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="64" height="48" ${bad ? '' : `alt="Imagem ${i}"`}>`;
      break;
    case 1:
      body = `<form onsubmit="return false"><label for="f${i}">Campo ${i}</label><input id="f${i}" type="text"><button type="submit" style="min-height:32px">${bad ? '' : 'Enviar'}</button></form>`;
      break;
    case 2:
      body = `<ul>${Array.from({ length: 5 }, (_, k) => `<li><a href="#l${i}-${k}">${sentence(r, 2)}</a></li>`).join('')}</ul>`;
      break;
    case 3:
      body = `<table><thead><tr><th>Nome</th><th>Valor</th></tr></thead><tbody>${Array.from({ length: 3 }, (_, k) => `<tr><td>${sentence(r, 1)}</td><td>${k * i}</td></tr>`).join('')}</tbody></table>`;
      break;
    default:
      body = `<p style="color:${bad ? '#aaa' : '#333'}">${sentence(r, 10)}</p><span>${sentence(r, 3)}</span>`;
  }
  return `<article class="card" id="item-${i}"><div class="card-body">${head}${para}${body}</div><footer><small>${sentence(r, 4)}</small></footer></article>`;
}

function page(targetElements: number, seed: number): string {
  const r = rng(seed);
  const cards: string[] = [];
  // ~22 nós de referência por card (≈ 13 elementos + texto), em média.
  const n = Math.round(targetElements / 22);
  for (let i = 0; i < n; i++) {
    if (i % 25 === 0) cards.push(`<h2>Seção ${i / 25 + 1}</h2>`);
    cards.push(card(i, r));
  }
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOM grande (${targetElements} elementos)</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;margin:16px;color:#1b1b1b;background:#fff}
.card{border:1px solid #ccc;margin:8px 0;padding:8px}
a{color:#0b57d0}
button{padding:4px 12px}
</style>
</head>
<body>
<header><h1>Página de desempenho (${targetElements} elementos)</h1></header>
<main>
${cards.join('\n')}
</main>
</body>
</html>
`;
}

for (const [name, size, seed] of [
  ['large-dom-5k.html', 5000, 5],
  ['large-dom-20k.html', 20000, 20],
] as const) {
  const html = page(size, seed);
  writeFileSync(resolve(root, 'fixtures', name), html);
  console.log(`fixtures/${name}: ${(html.length / 1024).toFixed(0)} KiB`);
}
