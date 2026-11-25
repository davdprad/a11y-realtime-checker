/**
 * Teste dinâmico (QP3, roteiro do Apêndice B) com as três ferramentas.
 *
 * Para cada evento E1–E5 e para cada repetição, numa carga nova de fixtures/dynamic.html:
 *   1. espera a varredura inicial da extensão e executa axe-core e WAVE (relatório inicial);
 *   2. dispara o evento por JavaScript, sem recarregar a página;
 *   3. registra se a extensão sinalizou sem nova execução e em quanto tempo (instrumentação
 *      da própria extensão: do evento `a11y-rt:mutate` ao quadro em que a marcação é desenhada);
 *   4. verifica se o relatório inicial do axe-core e do WAVE contém a violação (não deve conter);
 *   5. executa axe-core e WAVE de novo e verifica se, agora, a violação aparece.
 * Uso: node dinamico.mjs --ext <build> --wave <WAVE> [--repeticoes 5]
 * Saída: dados/dinamico.json
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const EXT = path.resolve(arg('ext')), WAVE = path.resolve(arg('wave'));
const REP = Number(arg('repeticoes', '5'));
const AXE_SRC = fs.readFileSync(path.join(HERE, 'node_modules/axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EVENTOS = [
  { id: 'E1', wcag: '4.1.2', alvo: '#fechar', axe: ['button-name'], wave: ['button_empty'], descricao: 'Abrir um modal com botão de fechar sem nome acessível' },
  { id: 'E2', wcag: '1.4.3', alvo: '#texto-card', axe: ['color-contrast'], wave: ['contrast'], descricao: 'Trocar o tema, reduzindo o contraste de um texto' },
  { id: 'E3', wcag: '1.1.1', alvo: '#grafico', axe: ['image-alt'], wave: ['alt_missing'], descricao: 'Inserir uma imagem informativa sem texto alternativo' },
  { id: 'E4', wcag: '2.4.4', alvo: '#link-carrinho', axe: ['link-name'], wave: ['link_empty'], descricao: 'Inserir um link sem texto' },
  { id: 'E5', wcag: '1.3.1', alvo: '#email', axe: ['label'], wave: ['label_missing'], descricao: 'Remover o rótulo de um campo de formulário' },
];

const PORT = 4181;
const server = http.createServer((req, res) => {
  const f = path.join(HERE, 'fixtures', 'dynamic.html');
  if (new URL(req.url, 'http://x').pathname !== '/dynamic.html') { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${PORT}/dynamic.html`;

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'dinamico-')), {
  channel: 'chromium', headless: true, viewport: { width: 1366, height: 900 },
  args: [`--disable-extensions-except=${EXT},${WAVE}`, `--load-extension=${EXT},${WAVE}`],
});
let sws = ctx.serviceWorkers();
for (let i = 0; i < 40 && sws.length < 2; i++) { await sleep(250); sws = ctx.serviceWorkers(); }
const waveSW = sws.find((s) => /service_worker\.js$/.test(s.url()));
const extId = new URL(sws.find((s) => /background\.js$/.test(s.url())).url()).host;
const ctl = await ctx.newPage();
await ctl.goto(`chrome-extension://${extId}/sidepanel.html?tabId=-1`);
const tabIdOf = (u) => ctl.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id ?? -1, u);
const state = (t) => ctl.evaluate(async (t) => { try { return await chrome.tabs.sendMessage(t, { type: 'debug:state' }, { frameId: 0 }); } catch { return null; } }, t);

async function axe(page) {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(AXE_SRC);
  return page.evaluate(async () => {
    const r = await window.axe.run({ include: [document], exclude: [['a11y-rt-overlay']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.map((v) => ({ id: v.id, alvos: v.nodes.map((n) => n.target.join(' ')) }));
  });
}
async function wave(page, t) {
  await page.evaluate(() => { window.__waveDone = false; });
  // se o WAVE já estiver ativo na aba, a primeira chamada o desliga e a segunda executa de novo
  const ativo = await waveSW.evaluate((t) => !!serviceworker.func.isTabActive(t), t);
  if (ativo) { await waveSW.evaluate(async ([t, u]) => serviceworker.func.runWave(t, u), [t, page.url()]); await sleep(300); }
  await waveSW.evaluate(async ([t, u]) => serviceworker.func.runWave(t, u), [t, page.url()]);
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => window.__waveDone)) break; await sleep(200); }
  return page.evaluate(() => (window.wave?.report?.things?.iconList ?? []).map((ic) => ({ type: ic.type, id: ic.target?.id ?? null })));
}

const registros = [];
for (const ev of EVENTOS) {
  for (let rep = 1; rep <= REP; rep++) {
    const page = await ctx.newPage();
    await page.addInitScript(() => document.addEventListener('waveResults', () => { window.__waveDone = true; }));
    await page.goto(URL_, { waitUntil: 'load' });
    const t = await tabIdOf(page.url());
    for (let i = 0; i < 100; i++) { const s = await state(t); if (s && s.idle) break; await sleep(100); }
    const r = { evento: ev.id, criterio: ev.wcag, descricao: ev.descricao, repeticao: rep };
    const reg = { evento: ev.id, alvo: ev.alvo.slice(1) };
    // relatório inicial das ferramentas sob demanda
    const axe0 = rep === 1 ? await axe(page) : null;
    const wave0 = rep === 1 ? await wave(page, t) : null;
    if (rep === 1) {
      await waveSW.evaluate(async ([t, u]) => serviceworker.func.runWave(t, u), [t, page.url()]); // desliga o WAVE antes do evento
      await sleep(300);
    }
    await page.evaluate((id) => window.a11yRtDynamic.run(id), ev.id);
    let rec = null;
    for (let i = 0; i < 100; i++) {
      const s = await state(t);
      rec = s?.instrumentation?.dynamicEvents?.find((d) => d.eventId === ev.id) ?? null;
      if (rec?.flagged) break;
      await sleep(50);
    }
    r.extensao_sinalizou = !!rec?.flagged;
    r.extensao_tempo_ms = rec?.timeToFlagMs != null ? Math.round(rec.timeToFlagMs * 10) / 10 : null;
    if (rep === 1) {
      r.axe_relatorio_inicial = axe0.some((v) => ev.axe.includes(v.id) && v.alvos.some((a) => a.includes(reg.alvo)));
      r.wave_relatorio_inicial = wave0.some((w) => ev.wave.includes(w.type) && w.id === reg.alvo);
      const axe1 = await axe(page);
      const wave1 = await wave(page, t);
      r.axe_apos_nova_execucao = axe1.some((v) => ev.axe.includes(v.id) && v.alvos.some((a) => a.includes(reg.alvo)));
      r.wave_apos_nova_execucao = wave1.some((w) => ev.wave.includes(w.type) && w.id === reg.alvo);
      r.axe_regras = axe1.filter((v) => v.alvos.some((a) => a.includes(reg.alvo))).map((v) => v.id).join(',');
      r.wave_itens = wave1.filter((w) => w.id === reg.alvo).map((w) => w.type).join(',');
    }
    registros.push(r);
    console.log(JSON.stringify(r));
    await page.close();
  }
}
const versoes = { userAgent: await ctl.evaluate(() => navigator.userAgent), wave: JSON.parse(fs.readFileSync(path.join(WAVE, 'manifest.json'), 'utf8')).version, axeCore: JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules/axe-core/package.json'), 'utf8')).version, maquina: { cpu: os.cpus()[0].model, nucleos: os.cpus().length, memoriaGB: Math.round(os.totalmem() / 2 ** 30), so: `${os.type()} ${os.release()}` } };
fs.writeFileSync(path.join(HERE, 'dados', 'dinamico.json'), JSON.stringify({ coletadoEm: new Date().toISOString(), versoes, registros }, null, 1));
await ctx.close();
server.close();
