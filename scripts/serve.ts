/**
 * Servidor HTTP estático para os testes (sem dependências externas).
 *
 *   /fixtures/*  → fixtures/
 *   /WAI/*       → tests/act/www/WAI/   (casos ACT espelhados)
 *
 * Executar: pnpm serve [porta]   (padrão 4173)
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);

const MOUNTS: [string, string][] = [
  ['/fixtures/', resolve(root, 'fixtures')],
  ['/WAI/', resolve(root, 'tests/act/www/WAI')],
];

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  if (path === '/' || path === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  for (const [prefix, dir] of MOUNTS) {
    if (!path.startsWith(prefix)) continue;
    const file = normalize(resolve(dir, `.${sep}${path.slice(prefix.length)}`));
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) break;
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`servidor de testes em http://localhost:${port}`);
});
