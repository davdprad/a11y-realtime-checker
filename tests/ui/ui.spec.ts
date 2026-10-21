/**
 * Acessibilidade da própria extensão (seção 7.5), com o build de teste
 * (Shadow DOM do overlay aberto, para inspeção):
 * - auditoria automática (axe) do side panel e do cartão de feedback;
 * - operação só por teclado: ordem de foco, Enter/Espaço, Esc e retorno de foco;
 * - atalhos (próxima/anterior violação, alternar overlay) e hover do marcador.
 *
 * Aqui é permitido usar @axe-core/playwright: avalia a UI da extensão, não o
 * motor de regras do estudo.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  BASE_URL,
  expect,
  overlayState,
  sendCommand,
  tabIdOf,
  testWithTestBuild as test,
  waitForIdle,
  type ExtensionHandle,
} from '../e2e-support/extension';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function openFixture(ext: ExtensionHandle): Promise<{ page: Page; tabId: number }> {
  const page = await ext.context.newPage();
  await page.goto(`${BASE_URL}/fixtures/regression.html`);
  const tabId = await tabIdOf(ext, page);
  await waitForIdle(ext, tabId);
  return { page, tabId };
}

async function openPanel(ext: ExtensionHandle, tabId: number): Promise<Page> {
  const panel = await ext.context.newPage();
  await panel.goto(`chrome-extension://${ext.extensionId}/sidepanel.html?tabId=${tabId}`);
  await expect(
    panel.getByRole('heading', { level: 2, name: /Ocorrências/ }),
  ).toBeVisible();
  return panel;
}

function formatViolations(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string {
  return results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    .join('\n');
}

test.describe('side panel', () => {
  test('passa na auditoria automática (axe, WCAG 2.2 AA), inclusive com o modo experimento', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    const panel = await openPanel(ext, tabId);
    let results = await new AxeBuilder({ page: panel }).withTags(WCAG_TAGS).analyze();
    expect(results.violations, formatViolations(results)).toEqual([]);

    await panel.getByRole('button', { name: 'Modo experimento' }).click();
    await expect(panel.getByRole('button', { name: 'JSON completo' })).toBeVisible();
    // Todos os filtros marcados (inclui "Inconclusivo").
    await panel.getByRole('checkbox', { name: 'Inconclusivo' }).check();
    results = await new AxeBuilder({ page: panel }).withTags(WCAG_TAGS).analyze();
    expect(results.violations, formatViolations(results)).toEqual([]);
    await panel.getByRole('button', { name: 'Modo experimento' }).click();
    await panel.close();
    await page.close();
  });

  test('estrutura: landmarks, títulos hierárquicos e região aria-live', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    const panel = await openPanel(ext, tabId);
    await expect(panel.getByRole('banner')).toHaveCount(1);
    await expect(panel.getByRole('main')).toHaveCount(1);
    await expect(panel.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await panel.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(
      4,
    );
    expect(await panel.getByRole('heading', { level: 3 }).count()).toBeGreaterThanOrEqual(
      3,
    );
    await expect(panel.locator('[aria-live="polite"]').first()).toBeAttached();
    await expect(panel.getByRole('status').first()).toBeAttached();
    // Os botões de alternância expõem o estado.
    await expect(
      panel.getByRole('button', { name: 'Verificação ativa nesta origem' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      panel.getByRole('button', { name: 'Marcações na página' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await panel.close();
    await page.close();
  });

  test('operável só por teclado: Tab percorre os controles e Enter leva ao elemento', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    const panel = await openPanel(ext, tabId);
    await panel.keyboard.press('Tab');
    await expect(
      panel.getByRole('button', { name: 'Verificação ativa nesta origem' }),
    ).toBeFocused();
    await panel.keyboard.press('Tab');
    await expect(
      panel.getByRole('button', { name: 'Marcações na página' }),
    ).toBeFocused();

    // Percorre só com Tab até um "Ir para o elemento" do frame de topo (o
    // cartão de ocorrências em iframe abre dentro do próprio iframe).
    const visited: string[] = [];
    for (let i = 0; i < 120; i++) {
      await panel.keyboard.press('Tab');
      const name = await panel.evaluate(() => {
        const a = document.activeElement;
        if (!a) return '';
        if (a.closest('li')?.textContent.includes('em iframe')) return 'iframe';
        return `${a.tagName}:${a.textContent.trim()}`;
      });
      visited.push(name);
      if (name === 'BUTTON:Ir para o elemento') break;
    }
    expect(visited.at(-1)).toBe('BUTTON:Ir para o elemento');
    // Filtros (checkbox) entram na ordem de foco antes da lista.
    expect(visited.some((v) => v.startsWith('INPUT'))).toBe(true);

    await panel.keyboard.press('Enter');
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(true);

    // Espaço no filtro alterna a caixa de seleção.
    const filtro = panel.getByRole('checkbox', { name: 'Recomendação' });
    await filtro.focus();
    await panel.keyboard.press('Space');
    await expect(filtro).not.toBeChecked();
    await panel.keyboard.press('Space');
    await expect(filtro).toBeChecked();
    await panel.close();
    await page.close();
  });
});

test.describe('cartão de feedback na página', () => {
  test('atalho abre o cartão com foco; Esc fecha e devolve o foco à origem', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    await page.locator('h1').click(); // foca a página
    await page.evaluate(() => {
      const b = document.querySelector<HTMLButtonElement>('.mini');
      b?.focus();
    });
    await sendCommand(ext, tabId, 'next-violation');
    await expect
      .poll(async () => (await overlayState(ext, tabId))?.focusInCard)
      .toBe(true);
    const card = page.locator('a11y-rt-overlay').locator('[role="dialog"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-modal', 'false');
    await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
    // As quatro perguntas.
    for (const h of [
      'O que está errado',
      'Quem é afetado',
      'Como corrigir',
      'Saiba mais',
    ]) {
      await expect(card.getByRole('heading', { name: h }).first()).toBeVisible();
    }
    await expect(
      card.getByRole('link', { name: /Entenda o critério/ }).first(),
    ).toHaveAttribute('href', /w3\.org\/WAI\/WCAG22\/Understanding\//);

    // Tab percorre os controles do cartão (botão fechar primeiro).
    await page.keyboard.press('Tab');
    await expect(card.getByRole('button', { name: 'Fechar' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.className)).toBe('mini');
    await page.close();
  });

  test('cartão e marcadores passam na auditoria automática (axe)', async ({ ext }) => {
    const { page, tabId } = await openFixture(ext);
    await sendCommand(ext, tabId, 'next-violation');
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(true);
    const results = await new AxeBuilder({ page })
      .include('a11y-rt-overlay')
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations, formatViolations(results)).toEqual([]);
    await page.close();
  });

  test('marcadores fora da ordem de tabulação; anterior/próxima navegam pelas violações', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    const badges = page.locator('a11y-rt-overlay .badge');
    expect(await badges.count()).toBeGreaterThan(3);
    for (const t of await badges.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).tabIndex),
    ))
      expect(t).toBe(-1);

    await sendCommand(ext, tabId, 'next-violation');
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(true);
    const first = (await overlayState(ext, tabId))?.cardOccurrenceIds.join();
    await sendCommand(ext, tabId, 'next-violation');
    await expect
      .poll(async () => (await overlayState(ext, tabId))?.cardOccurrenceIds.join())
      .not.toBe(first);
    await sendCommand(ext, tabId, 'prev-violation');
    await expect
      .poll(async () => (await overlayState(ext, tabId))?.cardOccurrenceIds.join())
      .toBe(first);
    await page.close();
  });

  test('alternar overlay pelo atalho; hover abre e afastar fecha o cartão', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    await sendCommand(ext, tabId, 'toggle-overlay');
    await expect.poll(async () => (await overlayState(ext, tabId))?.visible).toBe(false);
    await expect(page.locator('a11y-rt-overlay')).toBeHidden();
    await sendCommand(ext, tabId, 'toggle-overlay');
    await expect.poll(async () => (await overlayState(ext, tabId))?.visible).toBe(true);

    const badge = page.locator('a11y-rt-overlay .badge:not(.page-badge)').first();
    await badge.hover();
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(true);
    // Conteúdo em hover é dispensável (1.4.13): Esc fecha sem mover o foco.
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(false);
    await page.mouse.move(5, 790);
    await badge.hover();
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(true);
    await page.mouse.move(5, 790);
    await expect.poll(async () => (await overlayState(ext, tabId))?.cardOpen).toBe(false);
    await page.close();
  });
});

test.describe('painel ↔ página', () => {
  test('"Ir para o elemento" de uma ocorrência em iframe abre o cartão dentro do iframe', async ({
    ext,
  }) => {
    const { page, tabId } = await openFixture(ext);
    const panel = await openPanel(ext, tabId);
    const item = panel.getByRole('listitem').filter({ hasText: 'em iframe' }).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await item.getByRole('button', { name: 'Ir para o elemento' }).click();
    await expect(
      page.frameLocator('#frame').locator('a11y-rt-overlay [role="dialog"]'),
    ).toBeVisible();
    await panel.close();
    await page.close();
  });

  test('modo experimento exporta CSV e JSON nos formatos dos Apêndices A e B', async ({
    ext,
  }) => {
    const page = await ext.context.newPage();
    await page.goto(`${BASE_URL}/fixtures/dynamic.html`);
    const tabId = await tabIdOf(ext, page);
    await waitForIdle(ext, tabId);
    const panel = await openPanel(ext, tabId);
    await panel.getByRole('button', { name: 'Modo experimento' }).click();
    await expect(panel.getByRole('button', { name: 'JSON completo' })).toBeVisible();

    await page.evaluate(() => {
      (
        window as unknown as { a11yRtDynamic: { run(id: string): void } }
      ).a11yRtDynamic.run('E3');
    });
    await expect
      .poll(async () => (await overlayState(ext, tabId))?.outlines ?? 0)
      .toBeGreaterThan(0);

    const read = async (name: string): Promise<string> => {
      const [download] = await Promise.all([
        panel.waitForEvent('download'),
        panel.getByRole('button', { name }).click(),
      ]);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c as Buffer);
      return Buffer.concat(chunks).toString('utf8');
    };
    const occ = await read('CSV de ocorrências');
    expect(occ.split('\r\n')[0]).toBe(
      'pagina_url,criterio_wcag,regra_id,seletor_css,resultado,timestamp,versao_extensao,versao_navegador',
    );
    expect(occ).toContain(',1.1.1,image-name,');
    const dyn = await read('CSV do teste dinâmico');
    expect(dyn.split('\r\n')[0]).toBe(
      'evento_id,criterio_esperado,sinalizou,tempo_ate_sinalizacao_ms',
    );
    expect(dyn).toMatch(/E3,1\.1\.1,true,\d+(\.\d+)?/);
    const perf = await read('CSV de desempenho');
    expect(perf.split('\r\n')[1]).toMatch(/^varredura_inicial,/);
    const json = JSON.parse(await read('JSON completo')) as {
      formato: string;
      ocorrencias: unknown[];
      desempenho: { varredura_inicial_ms: number };
    };
    expect(json.formato).toBe('a11y-rt/1');
    expect(json.ocorrencias.length).toBeGreaterThan(0);
    expect(json.desempenho.varredura_inicial_ms).toBeGreaterThan(0);

    await panel.getByRole('button', { name: 'Modo experimento' }).click();
    await panel.close();
    await page.close();
  });

  test('origem fora de localhost: o clique no ícone passa pelo service worker e o painel oferece a ativação', async ({
    ext,
  }) => {
    // Sem openPanelOnActionClick o clique dispara action.onClicked, onde o
    // activeTab garante a URL da aba (o Chrome não concede activeTab quando
    // abre o painel sozinho).
    const behavior = await ext.controller.evaluate(() =>
      chrome.sidePanel.getPanelBehavior(),
    );
    expect(behavior.openPanelOnActionClick).toBe(false);

    const SITE = 'http://site.example';
    const page = await ext.context.newPage();
    await page.route(`${SITE}/**`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><title>Externo</title><img src="x.png">',
      }),
    );
    await page.goto(`${SITE}/pagina.html`);
    // Sem permissão de host a URL da aba é invisível: a aba nova tem o maior id.
    const tabId = await ext.controller.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return Math.max(...tabs.map((t) => t.id ?? -1));
    });
    const panel = await ext.context.newPage();
    await panel.goto(
      `chrome-extension://${ext.extensionId}/sidepanel.html?tabId=${tabId}`,
    );
    await expect(panel.getByText(/Não há acesso a esta aba/)).toBeVisible();

    // O que action.onClicked grava (a URL lida com activeTab) chega ao painel aberto.
    await ext.controller.evaluate(async (id) => {
      await chrome.storage.session.set({
        [`actionTab:${String(id)}`]: 'http://site.example/pagina.html',
      });
    }, tabId);
    await expect(
      panel.getByRole('button', { name: `Ativar a verificação em ${SITE}` }),
    ).toBeVisible();
    await expect(panel.getByText(`Página: ${SITE}`)).toBeVisible();

    // Reabrir o painel na mesma aba também recupera a URL.
    await panel.reload();
    await expect(
      panel.getByRole('button', { name: `Ativar a verificação em ${SITE}` }),
    ).toBeVisible();
    await panel.close();
    await page.close();
  });
});
