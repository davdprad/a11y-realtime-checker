/**
 * Coleta do estudo comparativo (Seção 4 da monografia).
 *
 * Para cada página, numa única carga e no mesmo navegador (Chromium do Playwright):
 *   1. extensão proposta (build de teste, que expõe o estado por mensagens de diagnóstico);
 *   2. referência independente: árvore de acessibilidade do próprio Chromium (CDP), cores
 *      de fundo calculadas pelo Chromium (CSS.getBackgroundColors) e geometria dos alvos;
 *   3. axe-core (motor do axe DevTools), com as tags WCAG 2.x A/AA;
 *   4. WAVE (extensão oficial da WebAIM), disparado como se o ícone fosse clicado.
 * O WAVE roda por último porque insere ícones no DOM. Todos os elementos são identificados
 * por um caminho canônico (posição na árvore, ignorando os nós inseridos pelas ferramentas).
 *
 * Uso:
 *   node coleta.mjs --ext <build da extensão> --wave <WAVE descompactado>
 *                   --act <tests/act/www do repositório> --grupo act|bad|sites [--limite N]
 * Saída: dados/<grupo>/<id>.json (+ .mhtml e .png nas páginas reais)
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const EXT = path.resolve(arg('ext'));
const WAVE = path.resolve(arg('wave'));
const ACT_ROOT = arg('act') ? path.resolve(arg('act')) : null;
const GRUPO = arg('grupo', 'act');
const LIMITE = Number(arg('limite', '0'));
const SO = arg('so', '');
const OUT = path.join(HERE, 'dados', GRUPO);
fs.mkdirSync(OUT, { recursive: true });
const alvos = JSON.parse(fs.readFileSync(path.join(HERE, 'alvos.json'), 'utf8'));
const AXE_SRC = fs.readFileSync(path.join(HERE, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules/axe-core/package.json'), 'utf8')).version;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PULAR = process.argv.includes('--pular-existentes');
/** Rejeita se a promessa não terminar no prazo (páginas que travam uma ferramenta). */
const prazo = (p, ms, oque) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`tempo esgotado: ${oque}`)), ms))]);

// ---------------------------------------------------------------- servidor local dos casos ACT
const PORT = 4180;
let server = null;
if (GRUPO === 'act') {
  const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml' };
  server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.normalize(path.join(ACT_ROOT, p));
    if (!f.startsWith(ACT_ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
}

// ---------------------------------------------------------------- funções injetadas na página
const HELPER = `(() => {
  if (window.__cp) return;
  const injected = (el) => {
    const t = el.tagName ? el.tagName.toLowerCase() : '';
    if (t === 'a11y-rt-overlay') return true;
    const id = el.id || '';
    if (/^wave/i.test(id)) return true;
    const c = el.classList;
    return !!c && (c.contains('wave5icon') || c.contains('wave5text'));
  };
  window.__injected = injected;
  window.__cp = (el) => {
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let e = el;
    while (e) {
      const p = e.parentElement;
      if (!p) {
        const root = e.getRootNode();
        if (root instanceof ShadowRoot) {
          parts.unshift(e.tagName.toLowerCase() + ':' + (Array.from(root.children).filter((c) => !injected(c)).indexOf(e) + 1));
          parts.unshift('#shadow');
          e = root.host;
          continue;
        }
        parts.unshift(e.tagName.toLowerCase());
        break;
      }
      let i = 0;
      for (const c of p.children) {
        if (injected(c)) continue;
        i++;
        if (c === e) break;
      }
      parts.unshift(e.tagName.toLowerCase() + ':' + i);
      e = p;
    }
    return parts.join('>');
  };
  window.__byPath = (cp) => {
    const parts = cp.split('>');
    let node = document.documentElement;
    if (parts[0] !== 'html') return null;
    for (let k = 1; k < parts.length; k++) {
      if (parts[k] === '#shadow') { node = node.shadowRoot; k++; if (!node) return null;
        const [tg, ix] = parts[k].split(':'); node = Array.from(node.children).filter((c) => !injected(c))[Number(ix) - 1] || null; if (!node) return null; continue; }
      const [tg, ix] = parts[k].split(':');
      const kids = Array.from(node.children).filter((c) => !injected(c));
      node = kids[Number(ix) - 1];
      if (!node || node.tagName.toLowerCase() !== tg) return null;
    }
    return node;
  };
  const zeroClip = (s) => s.clip.split(' ').join('').split(',').join('') === 'rect(0px0px0px0px)' || s.clipPath === 'inset(50%)';
  window.__info = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim();
    return {
      tag: el.tagName.toLowerCase(),
      snippet: el.outerHTML.slice(0, 300),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200),
      ownText: own.slice(0, 200),
      rect: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100),
      pageRect: [r.x + scrollX, r.y + scrollY, r.width, r.height].map((v) => Math.round(v)),
      visible: (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : r.width > 0)
        && r.width > 1 && r.height > 1
        && !zeroClip(cs) && !(cs.color.startsWith('rgba(') && cs.color.endsWith(', 0)')) && cs.color !== 'transparent'
        && (() => { let a = el.parentElement; for (let k = 0; a && k < 6; k++, a = a.parentElement) { const s = getComputedStyle(a); const q = a.getBoundingClientRect();
          if (zeroClip(s)) return false;
          if ((q.width <= 1 || q.height <= 1) && s.overflow !== 'visible') return false; } return true; })(),
      color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, textShadow: cs.textShadow,
      display: cs.display,
      bgChain: (() => { const ch = []; let a = el; while (a && a.nodeType === 1) { const s = getComputedStyle(a);
        ch.push({ tag: a.tagName.toLowerCase(), bg: s.backgroundColor, img: s.backgroundImage !== 'none', opacity: s.opacity, filter: s.filter !== 'none', blend: s.mixBlendMode !== 'normal' });
        const bc = s.backgroundColor; if (bc.startsWith('rgb')) { const p = bc.slice(bc.indexOf('(') + 1, -1).split(',').map(Number); if ((p.length < 4 || p[3] === 1) && s.backgroundImage === 'none') break; }
        a = a.parentElement; } return ch; })(),
    };
  };
})();`;

/** Geometria dos alvos (2.5.8), calculada antes de o WAVE alterar o layout. */
const TARGETS_FN = `(paths) => {
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=switch], [role=option], [tabindex]:not([tabindex="-1"])';
  const all = Array.from(document.querySelectorAll(SEL)).filter((e) => !window.__injected(e) && e.closest('a11y-rt-overlay') == null);
  const rects = all.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0);
  const out = {};
  for (const cp of paths) {
    const el = window.__byPath(cp);
    if (!el) { out[cp] = { status: 'missing' }; continue; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) { out[cp] = { status: 'not-rendered' }; continue; }
    const w = r.width, h = r.height;
    if (w >= 24 && h >= 24) { out[cp] = { status: 'pass-size', w, h }; continue; }
    const cs = getComputedStyle(el);
    let inline = false;
    if (cs.display.startsWith('inline') && !cs.display.includes('block') && !cs.display.includes('flex') && !cs.display.includes('grid')) {
      let b = el.parentElement;
      while (b && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement;
      if (b) {
        const total = (b.textContent || '').replace(/\\s+/g, '').length;
        const own = (el.textContent || '').replace(/\\s+/g, '').length;
        const targetsText = Array.from(b.querySelectorAll('a, button')).reduce((s, t) => s + (t.textContent || '').replace(/\\s+/g, '').length, 0);
        inline = total - targetsText > 0 && total > own;
      }
    }
    const cx = r.x + w / 2, cy = r.y + h / 2;
    let conflict = null;
    for (const o of rects) {
      if (o.e === el || o.e.contains(el) || el.contains(o.e)) continue;
      const q = o.r;
      const nx = Math.max(q.x, Math.min(cx, q.x + q.width)), ny = Math.max(q.y, Math.min(cy, q.y + q.height));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < 144) { conflict = window.__cp(o.e); break; }
      if (q.width < 24 || q.height < 24) {
        const ox = q.x + q.width / 2, oy = q.y + q.height / 2;
        if ((ox - cx) ** 2 + (oy - cy) ** 2 < 576) { conflict = window.__cp(o.e); break; }
      }
    }
    out[cp] = { status: conflict ? (inline ? 'exception-inline' : 'fail') : 'pass-spacing', w, h, inline, conflict };
  }
  return out;
}`;

// ---------------------------------------------------------------- navegador com as duas extensões
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudo-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1366, height: 900 },
  locale: 'pt-BR',
  args: [`--disable-extensions-except=${EXT},${WAVE}`, `--load-extension=${EXT},${WAVE}`],
});
let sws = ctx.serviceWorkers();
for (let i = 0; i < 40 && sws.length < 2; i++) { await sleep(250); sws = ctx.serviceWorkers(); }
const waveSW = sws.find((s) => /service_worker\.js$/.test(s.url()));
const extSW = sws.find((s) => /background\.js$/.test(s.url()));
const extId = new URL(extSW.url()).host;
const ctl = await ctx.newPage();
await ctl.goto(`chrome-extension://${extId}/sidepanel.html?tabId=-1`);
const versions = {
  chromium: ctx.browser()?.version() ?? (await ctl.evaluate(() => navigator.userAgent)),
  userAgent: await ctl.evaluate(() => navigator.userAgent),
  axeCore: AXE_VERSION,
  wave: JSON.parse(fs.readFileSync(path.join(WAVE, 'manifest.json'), 'utf8')).version,
  extensao: JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version,
};

const tabIdOf = (u) => ctl.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id ?? -1, u);
const send = (t, m) => ctl.evaluate(async ([i, m]) => { try { return await chrome.tabs.sendMessage(i, m, { frameId: 0 }); } catch { return null; } }, [t, m]);
async function waitIdle(t, ms = 30000) {
  const s = Date.now();
  let last = -1, since = 0, d = null;
  for (;;) {
    d = await send(t, { type: 'debug:state' });
    if (d && d.idle && d.framesPending === 0) {
      if (d.batches === last) { if (Date.now() - since > 600) return d; } else { last = d.batches; since = Date.now(); }
    }
    if (Date.now() - s > ms) return d;
    await sleep(120);
  }
}

const AX_ROLES = new Set(['link', 'button', 'image', 'img', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'listbox', 'spinbutton', 'slider', 'switch', 'menuitemcheckbox', 'menuitemradio']);

async function axSnapshot(cdp, onlyPaths = null) {
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const out = {};
  for (const n of nodes) {
    if (!n.backendDOMNodeId) continue;
    const role = n.role?.value ?? '';
    if (!onlyPaths && (n.ignored || !AX_ROLES.has(role))) continue;
    let cp = null;
    try {
      const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: n.backendDOMNodeId });
      if (!object?.objectId) continue;
      const r = await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: 'function(){return this.nodeType===1 ? {cp: window.__cp(this), tag: this.tagName.toLowerCase(), alt: this.getAttribute("alt"), role: this.getAttribute("role")} : null}', returnByValue: true });
      const v = r.result.value; cp = v && v.cp; var attrs = v;
      await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
    } catch { continue; }
    if (!cp || (onlyPaths && !onlyPaths.has(cp))) continue;
    out[cp] = { role, name: n.name?.value ?? '', ignored: !!n.ignored, ignoredReasons: (n.ignoredReasons ?? []).map((r) => r.name), tag: attrs.tag, alt: attrs.alt, roleAttr: attrs.role };
  }
  return out;
}

async function contrastOracle(cdp, page, paths) {
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await cdp.send('DOM.getDocument', { depth: 0 });
  const out = {};
  for (const cp of paths) {
    try {
      const h = await page.evaluateHandle((cp) => window.__byPath(cp), cp);
      const el = h.asElement();
      if (!el) { out[cp] = { status: 'missing' }; continue; }
      const info = await el.evaluate((e) => window.__info(e));
      const { result } = await cdp.send('Runtime.evaluate', { expression: `window.__byPath(${JSON.stringify(cp)})` });
      const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId });
      const bg = await cdp.send('CSS.getBackgroundColors', { nodeId });
      out[cp] = { info, backgroundColors: bg.backgroundColors ?? null, computedFontSize: bg.computedFontSize, computedFontWeight: bg.computedFontWeight };
      await h.dispose();
    } catch (e) {
      out[cp] = { status: 'error', error: String(e).slice(0, 160) };
    }
  }
  return out;
}

async function runWave(page) {
  const t = await tabIdOf(page.url());
  await prazo(waveSW.evaluate(async ([t, u]) => { await serviceworker.func.runWave(t, u); }, [t, page.url()]), 20000, 'WAVE');
  for (let i = 0; i < 80; i++) {
    if (await prazo(page.evaluate(() => !!(window.wave && window.wave.report && window.wave.report.things && window.__waveDone)), 5000, 'WAVE')) break;
    await sleep(250);
  }
  return page.evaluate(() => {
    const list = (window.wave?.report?.things?.iconList ?? []).map((ic) => ({
      type: ic.type,
      pageWide: !!ic.pageWide,
      path: ic.target && ic.target.nodeType === 1 ? window.__cp(ic.target) : null,
      tag: ic.target && ic.target.tagName ? ic.target.tagName.toLowerCase() : null,
    }));
    return { stats: window.__waveData?.statistics ?? null, icons: list };
  });
}

async function coletar(alvo) {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    document.addEventListener('waveResults', (e) => { window.__waveData = e.detail && e.detail.data; window.__waveDone = true; });
  });
  const reg = { id: alvo.id, grupo: GRUPO, url: alvo.url, meta: alvo.meta ?? null, coletadoEm: new Date().toISOString(), versoes: versions };
  try {
    await page.goto(alvo.url, { waitUntil: 'load', timeout: 60000 });
    await sleep(GRUPO === 'act' ? 300 : 4000);
    reg.urlFinal = page.url();
    await page.evaluate(HELPER);
    const t = await tabIdOf(page.url());
    const origin = new URL(page.url()).origin;
    if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(origin)) {
      await ctl.evaluate(async ([tabId, origin]) => chrome.runtime.sendMessage({ type: 'origin:enable', tabId, origin }), [t, origin]);
      await sleep(1000);
    }
    // 1. extensão
    const t0 = Date.now();
    const st = await waitIdle(t, GRUPO === 'act' ? 15000 : 45000);
    reg.extensao = {
      ativa: !!st?.enabled,
      esperaMs: Date.now() - t0,
      varreduraInicial: st?.instrumentation?.initialScan ?? null,
      lotes: st?.batches ?? null,
      ocorrencias: [],
    };
    for (const o of st?.occurrences ?? []) {
      let cp = 'document';
      if (!o.pageLevel) {
        cp = o.frameId === 0 ? await page.evaluate((s) => { try { return window.__cp(document.querySelector(s)); } catch { return null; } }, o.selector) : null;
      }
      reg.extensao.ocorrencias.push({ wcag: o.wcag, outcome: o.outcome, regras: o.rules.map((r) => r.ruleId + ':' + r.outcome), dados: o.rules.map((r) => r.data ?? null), seletor: o.selector, path: cp, frameId: o.frameId, snippet: o.snippet?.slice(0, 300) });
    }
    await send(t, { type: 'command', command: 'toggle-overlay' }); // oculta as marcações antes das outras ferramentas
    await sleep(200);
    const cdp = await ctx.newCDPSession(page);
    // 2. referência independente (antes do WAVE alterar o DOM)
    if (GRUPO !== 'act') {
      reg.arvoreAcessibilidade = await axSnapshot(cdp);
      reg.pagina = await page.evaluate(() => ({
        lang: document.documentElement.getAttribute('lang'),
        xmlLang: document.documentElement.getAttribute('xml:lang'),
        title: document.title,
        viewport: Array.from(document.querySelectorAll('meta[name=viewport]')).map((m) => m.getAttribute('content')),
        nos: document.querySelectorAll('*').length,
      }));
      const mh = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
      fs.writeFileSync(path.join(OUT, `${alvo.id}.mhtml`), mh.data);
    }
    // 3. axe-core
    await page.evaluate(AXE_SRC);
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run({ include: [document], exclude: [['a11y-rt-overlay']] }, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
        resultTypes: ['violations', 'incomplete'],
      });
      const conv = (arr) => arr.map((v) => ({
        id: v.id, impact: v.impact, tags: v.tags.filter((t) => /^wcag\d{3,4}$/.test(t)),
        nos: v.nodes.map((n) => {
          let cp = null;
          if (n.target.length === 1 && typeof n.target[0] === 'string') {
            try { cp = window.__cp(document.querySelector(n.target[0])); } catch { cp = null; }
          }
          return { alvo: n.target, path: cp, html: n.html.slice(0, 300), resumo: (n.failureSummary || '').slice(0, 300), dados: n.any?.[0]?.data ?? null };
        }),
      }));
      return { violacoes: conv(r.violations), incompletas: conv(r.incomplete), testEngine: r.testEngine };
    });
    reg.axe = axe;
    // geometria dos alvos apontados para 2.5.8 (antes do WAVE)
    if (GRUPO !== 'act') {
      const p258 = new Set();
      for (const o of reg.extensao.ocorrencias) if (o.wcag === '2.5.8' && o.path) p258.add(o.path);
      for (const v of axe.violacoes.concat(axe.incompletas)) if (v.id === 'target-size') for (const n of v.nos) if (n.path) p258.add(n.path);
      reg.alvos258 = await page.evaluate(`(${TARGETS_FN})(${JSON.stringify([...p258])})`);
    }
    // 4. WAVE
    try {
      reg.wave = await runWave(page);
    } catch (e) {
      reg.wave = { stats: null, icons: [], erro: String(e).slice(0, 200) };
    }
    await page.evaluate(() => {
      for (const e of Array.from(document.querySelectorAll('img.wave5icon, span.wave5text, [id^="wave5"], [id^="wave_"], #wavescript, #wavestyle'))) e.remove();
    });
    await sleep(300);
    // contraste: cores de fundo pelo Chromium para todo elemento apontado em 1.4.3
    if (GRUPO !== 'act') {
      const pc = new Set();
      for (const o of reg.extensao.ocorrencias) if (o.wcag === '1.4.3' && o.path) pc.add(o.path);
      for (const v of axe.violacoes.concat(axe.incompletas)) if (v.id === 'color-contrast') for (const n of v.nos) if (n.path) pc.add(n.path);
      for (const ic of reg.wave.icons) if (ic.type === 'contrast' && ic.path) pc.add(ic.path);
      reg.contraste = await contrastOracle(cdp, page, [...pc]);
      // nomes acessíveis de elementos apontados pelo WAVE que não estavam na primeira leitura
      const faltam = new Set(reg.wave.icons.map((i) => i.path).filter((p) => p && !(p in reg.arvoreAcessibilidade)));
      for (const o of reg.extensao.ocorrencias) if (o.path && o.path !== 'document' && !(o.path in reg.arvoreAcessibilidade)) faltam.add(o.path);
      for (const v of axe.violacoes) for (const n of v.nos) if (n.path && !(n.path in reg.arvoreAcessibilidade)) faltam.add(n.path);
      reg.arvoreComplementar = faltam.size ? await axSnapshot(cdp, faltam) : {};
      reg.infoElementos = await page.evaluate((ps) => Object.fromEntries(ps.map((p) => { const e = window.__byPath(p); return [p, e ? window.__info(e) : null]; })), [...new Set([...faltam, ...Object.keys(reg.contraste), ...reg.extensao.ocorrencias.map((o) => o.path).filter((p) => p && p !== 'document'), ...axe.violacoes.flatMap((v) => v.nos.map((n) => n.path)).filter(Boolean), ...reg.wave.icons.map((i) => i.path).filter(Boolean)])]);
    }
    if (GRUPO !== 'act') {
        await page.screenshot({ path: path.join(OUT, `${alvo.id}.png`), fullPage: true }).catch(() => page.screenshot({ path: path.join(OUT, `${alvo.id}.png`) }));
    }
    await cdp.detach();
  } catch (e) {
    reg.erro = String(e).slice(0, 500);
  }
  fs.writeFileSync(path.join(OUT, `${alvo.id}.json`), JSON.stringify(reg, null, 1));
  await page.close();
  return reg;
}

let lista = alvos[GRUPO];
if (GRUPO === 'act') lista = lista.map((c) => ({ ...c, url: `http://127.0.0.1:${PORT}/WAI/content-assets/wcag-act-rules/${c.relativePath}` }));
if (SO) lista = lista.filter((a) => SO.split(',').includes(a.id));
if (LIMITE) lista = lista.slice(0, LIMITE);
let n = 0;
for (const alvo of lista) {
  if (PULAR && fs.existsSync(path.join(OUT, `${alvo.id}.json`))) { n++; continue; }
  let r;
  try {
    r = await prazo(coletar(alvo), 150000, 'página');
  } catch (e) {
    r = { id: alvo.id, grupo: GRUPO, url: alvo.url, meta: alvo.meta ?? null, erro: String(e).slice(0, 300) };
    fs.writeFileSync(path.join(OUT, `${alvo.id}.json`), JSON.stringify(r, null, 1));
    for (const p of ctx.pages()) if (p !== ctl) await p.close().catch(() => {});
  }
  n++;
  const resumo = r.erro ? `ERRO ${r.erro.slice(0, 120)}` : `ext=${r.extensao?.ocorrencias.filter((o) => o.outcome === 'violation').length} axe=${r.axe?.violacoes.reduce((s, v) => s + v.nos.length, 0)} wave=${r.wave?.icons.length}`;
  console.log(`[${n}/${lista.length}] ${alvo.id} ${resumo}`);
}
fs.writeFileSync(path.join(OUT, '_versoes.json'), JSON.stringify(versions, null, 1));
await ctx.close();
server?.close();
