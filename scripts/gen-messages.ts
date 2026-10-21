/**
 * Gera public/_locales/pt_BR/messages.json a partir de scripts/messages.pt_BR.ts.
 * Executar: pnpm gen:messages
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from './messages.pt_BR';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out: Record<string, { message: string }> = {};
for (const [key, message] of Object.entries(MESSAGES)) {
  if (!/^[A-Za-z0-9_]+$/.test(key)) throw new Error(`Chave i18n inválida: ${key}`);
  if (message.includes('$')) throw new Error(`"$" é reservado no chrome.i18n: ${key}`);
  // O WXT gera tipos com a mensagem em JSDoc; "*/" quebraria o arquivo.
  if (message.includes('*/'))
    throw new Error(`"*/" não é permitido (tipos gerados pelo WXT): ${key}`);
  out[key] = { message };
}
const target = resolve(root, 'public/_locales/pt_BR/messages.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`messages: ${Object.keys(out).length} chaves → ${target}`);
