# Acessibilidade em Tempo Real (WCAG 2.2)

Extensão para navegadores Chromium (Manifest V3) que funciona como um
"corretor ortográfico" de acessibilidade: com a página aberta ao lado do
editor, ela verifica continuamente o DOM renderizado, sinaliza cada violação
**sobre o próprio elemento, no momento em que surge** (inclusive em conteúdo
inserido por JavaScript) e explica a correção em linguagem simples.

Implementação da monografia _"Acessibilidade Web em Tempo Real: uma extensão de
navegador para detecção de violações WCAG no DOM sob a abordagem Shift-Left"_
(Engenharia de Software, UFAM, 2026). A extensão também é o instrumento do
estudo experimental: o motor de regras é próprio e determinístico (sem
axe-core), não usa rede e grava tempos para exportação.

## Critérios verificados

| Critério                     | Nível | O que é verificado                                                                  |
| ---------------------------- | ----- | ----------------------------------------------------------------------------------- |
| 1.1.1 Conteúdo não textual   | A     | imagens, `input type=image` e SVG com papel de imagem sem nome                      |
| 1.3.1 Informações e relações | A     | campos sem rótulo; saltos de cabeçalho (recomendação)                               |
| 1.4.3 Contraste (mínimo)     | AA    | contraste texto/fundo efetivo (4,5:1 e 3:1)                                         |
| 1.4.4 Redimensionar texto    | AA    | meta viewport que bloqueia o zoom                                                   |
| 2.4.2 Página com título      | A     | `<title>` ausente ou vazio                                                          |
| 2.4.4 Finalidade do link     | A     | links sem nome acessível                                                            |
| 2.5.8 Tamanho do alvo        | AA    | alvos < 24 × 24 px sem o espaçamento exigido                                        |
| 3.1.1 Idioma da página       | A     | `lang` ausente ou inválido                                                          |
| 4.1.2 Nome, função, valor    | A     | botões sem nome; papéis, atributos e valores ARIA inválidos; atributos obrigatórios |

Detalhes, justificativas e limitações: [`docs/RULES.md`](docs/RULES.md).

## Instalação para desenvolvimento

Requisitos: Node.js 22+, pnpm 10+, Chrome/Chromium 121+.

```bash
pnpm install
pnpm exec playwright install chromium    # navegador dos testes
pnpm build                               # gera .output/chrome-mv3
```

No Chrome: `chrome://extensions` → ativar **Modo do desenvolvedor** →
**Carregar sem compactação** → selecionar a pasta `.output/chrome-mv3`.

## Uso

1. Abra sua aplicação em `http://localhost:<porta>` (ou `127.0.0.1`): a
   verificação começa sozinha.
2. Clique no ícone da extensão (ou **Alt+Shift+A**) para abrir o painel lateral
   com as ocorrências agrupadas por critério.
3. Passe o mouse sobre um marcador na página para ver o cartão com: o que está
   errado, quem é afetado, como corrigir e onde aprender mais.
4. Para outros sites, abra o painel na aba e use **Ativar a verificação em
   …** (a permissão é pedida por origem).

| Atalho                    | Ação                                                 |
| ------------------------- | ---------------------------------------------------- |
| Alt+Shift+A               | Abrir o painel                                       |
| Alt+Shift+N / Alt+Shift+P | Próxima / anterior violação (abre o cartão com foco) |
| Alt+Shift+O               | Mostrar/ocultar as marcações                         |
| Esc                       | Fechar o cartão (o foco volta à origem)              |

**Modo experimento** (painel): grava ocorrências e tempos da sessão e exporta
JSON completo, CSV de ocorrências (Apêndice A), CSV do teste dinâmico
(Apêndice B) e CSV de desempenho. Nada sai do navegador sem exportação manual.

Para medir o tempo até a sinalização numa página de teste, dispare antes de
alterar o DOM:

```js
document.dispatchEvent(
  new CustomEvent('a11y-rt:mutate', {
    detail: JSON.stringify({ eventId: 'E1', t: performance.now(), expected: '4.1.2' }),
  }),
);
```

## Scripts

| Comando                                                         | O que faz                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm build` / `pnpm build:test`                                | Build de produção / de teste (Shadow DOM aberto)                               |
| `pnpm dev`                                                      | Modo de desenvolvimento do WXT                                                 |
| `pnpm test`                                                     | Lint + tipos + unitários com cobertura + builds + todos os testes em navegador |
| `pnpm test:unit` / `pnpm test:coverage`                         | Vitest (no Chromium real)                                                      |
| `pnpm test:act` / `test:dynamic` / `test:perf` / `test:ui`      | Projetos do Playwright                                                         |
| `pnpm lint` / `pnpm typecheck` / `pnpm format`                  | Qualidade                                                                      |
| `pnpm serve`                                                    | Servidor local das fixtures e dos casos ACT (porta 4173)                       |
| `pnpm fetch:act`                                                | Baixa os casos de teste ACT do W3C (já versionados em `tests/act/`)            |
| `pnpm gen:aria` / `gen:bcp47` / `gen:messages` / `gen:fixtures` | Geradores de dados                                                             |

Relatórios gerados pelos testes ficam em `reports/` (ACT por regra, desempenho
com p50/p95/máximo, CSV do Apêndice B) e a cobertura em `coverage/`.

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura e decisões
- [`docs/RULES.md`](docs/RULES.md) — regras: justificativa, condições, limitações
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — limitações conhecidas
- [`docs/RESULTS.md`](docs/RESULTS.md) — resultados da validação (ACT, dinâmico, desempenho)
- [`docs/a11y-manual-check.md`](docs/a11y-manual-check.md) — roteiro com leitor de tela
- [`comparative-study/`](comparative-study/README.md) — estudo comparativo com axe-core e WAVE (dados e scripts)
