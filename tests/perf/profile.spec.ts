/**
 * Perfil de CPU (CDP) das reavaliações incrementais no DOM de 20k elementos.
 * Diagnóstico opcional: só roda com PROFILE=1 (pnpm exec playwright test --project=perf profile).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_URL,
  tabIdOf,
  testWithTestBuild as test,
  waitForIdle,
} from '../e2e-support/extension';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
}

test.skip(process.env.PROFILE !== '1', 'diagnóstico opcional (PROFILE=1)');

test('perfil das reavaliações incrementais (20k)', async ({ ext }) => {
  const page = await ext.context.newPage();
  await page.goto(`${BASE_URL}/fixtures/large-dom-20k.html`);
  const tabId = await tabIdOf(ext, page);
  await waitForIdle(ext, tabId, { timeoutMs: 120_000 });
  const cdp = await ext.context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  for (let i = 0; i < 20; i++) {
    await page.evaluate((k) => {
      const cards = document.querySelectorAll('article.card');
      const card = cards[(k * 37) % cards.length];
      if (!card) return;
      if (k % 2 === 0) card.classList.toggle('destaque');
      else card.querySelector('footer')?.remove();
    }, i);
    await sleep(220);
  }
  await waitForIdle(ext, tabId);
  const { profile } = (await cdp.send('Profiler.stop')) as {
    profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
  };
  const self = new Map<string, number>();
  const total = profile.samples.length;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  for (const id of profile.samples) {
    const n = byId.get(id);
    if (!n) continue;
    const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop() ?? ''}:${n.callFrame.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + 1);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(
    resolve(root, 'reports/profile-20k.txt'),
    top.map(([k, v]) => `${((v / total) * 100).toFixed(1)}%  ${k}`).join('\n'),
  );
  console.log(
    top
      .slice(0, 25)
      .map(([k, v]) => `${((v / total) * 100).toFixed(1)}%  ${k}`)
      .join('\n'),
  );
  await page.close();
});
