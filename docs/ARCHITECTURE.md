# Arquitetura

Extensão Chromium (Manifest V3) que verifica continuamente o DOM renderizado e
sinaliza violações da WCAG 2.2 sobre o próprio elemento, no momento em que
surgem — um "corretor ortográfico" de acessibilidade. Este documento descreve a
arquitetura implementada e registra **cada decisão tomada além do documento de
requisitos** (`initial_prompt.md`).

## 1. Visão geral

```
┌──────────────────────── Aba (página do desenvolvedor) ────────────────────────┐
│  Content script (mundo ISOLATED) — src/core/agent.ts                          │
│   ├─ Scanner (scanner.ts): varredura inicial e reavaliações, fatiadas no tempo│
│   ├─ Observer (observer.ts): MutationObservers + fila de nós sujos + debounce │
│   ├─ Motor de regras (src/rules): funções puras sobre (elemento, contexto)    │
│   ├─ Registry (registry.ts): ocorrências (elemento × critério) + deltas       │
│   ├─ Overlay (src/overlay): host <a11y-rt-overlay> com Shadow DOM fechado     │
│   └─ Instrumentação (instrumentation.ts): tempos e log de ocorrências         │
└───────────────▲───────────────────────────────────────────────▲──────────────┘
                │ runtime.sendMessage (badge, frames)            │ Port por aba
┌───────────────┴─────────────┐                ┌─────────────────┴─────────────┐
│ Service worker              │                │ Side panel (Preact)           │
│ src/entrypoints/background  │◄──────────────►│ src/entrypoints/sidepanel     │
└─────────────────────────────┘                └───────────────────────────────┘
```

**Ciclo:** página carrega → `document_idle` → o content script liga o
MutationObserver **antes** da varredura completa (mutações durante a varredura
entram na fila) → varredura fatiada → cada lote de mutações (debounce de 150 ms
com espera máxima de 300 ms) vira uma lista de itens de trabalho → só os nós
afetados e seus dependentes voltam ao motor → o Registry calcula o delta → o
overlay é redesenhado no próximo `requestAnimationFrame` e o painel recebe o
delta pela Port.

### Mapa de arquivos

| Pasta                       | Conteúdo                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/entrypoints/`          | `content.ts` (bootstrap), `background.ts` (service worker), `sidepanel/` (UI)                                                                                                                 |
| `src/core/`                 | `agent.ts` (integração/mensagens), `controller.ts` (ciclo de vida do frame), `scanner.ts`, `observer.ts`, `registry.ts`, `context.ts` (caches por lote), `scheduler.ts`, `instrumentation.ts` |
| `src/rules/`                | Uma regra por arquivo + `catalog.ts` (metadados e mapeamento ACT, sem DOM) + `index.ts`                                                                                                       |
| `src/lib/`                  | Lógica pura e utilitários: `color`, `accname`, `visibility`, `selector`, `bcp47`, `viewport`, `geometry`, `roles`, `dom`, `export`, `i18n`, `settings` e tabelas geradas (`*.generated.ts`)   |
| `src/overlay/`              | `host.ts` (host, renderização, foco), `outline.ts` (contorno + rótulo), `card.ts` (cartão), `styles.ts`                                                                                       |
| `src/messaging/protocol.ts` | Tipos das mensagens (uniões discriminadas) e validadores de entrada                                                                                                                           |
| `scripts/`                  | Geradores (ARIA, BCP 47, mensagens, fixtures), download dos casos ACT, servidor de testes                                                                                                     |
| `tests/`                    | `unit/` (Vitest no Chromium), `act/`, `dynamic/`, `perf/`, `ui/`, `regression/` (Playwright)                                                                                                  |

## 2. Dúvidas levantadas antes de começar

O documento pede para listar, antes de começar, as dúvidas que bloqueiam
decisões de arquitetura. Nenhuma se mostrou realmente bloqueante; todas foram
resolvidas com um padrão sensato, registrado na seção 3:

1. **Como pedir permissão por origem sem saber a URL da aba?** Sem a permissão
   `tabs`, `chrome.tabs.Tab.url` só existe para origens já permitidas. →
   Acrescentada `activeTab` (D2).
2. **Granularidade das regras vs. unidade de contagem.** O Quadro 3 lista
   critérios; um critério (4.1.2) agrupa cinco regras ACT. → Regras internas
   finas (17), ocorrência agregada por (elemento, critério) (D4).
3. **ACT e086e5 é mapeada pelo W3C para 4.1.2, não 1.3.1.** → Mantido 1.3.1,
   como no documento; a divergência está documentada (D5).
4. **O que é "severidade" no overlay?** Não definido. → Violação (vermelho,
   contínuo, ⚠) e recomendação (azul, tracejado, ℹ); inconclusivo não é
   desenhado (D14).
5. **Como os testes leem o Registry e o sinal de "idle" sem expor uma API à
   página?** → Mensagens de diagnóstico aceitas só do próprio contexto da
   extensão (D16).
6. **Como o frame filho "reporta ao frame de topo"?** → Via service worker, com
   snapshots e deltas (D17).
7. **Como medir o tempo até a sinalização sem saber o critério esperado?** →
   Campo opcional `expected` (e `kind: 'fix'`) no `detail` do evento (D24).
8. **Como os testes de UI inspecionam um Shadow DOM fechado?** → Build de teste
   (`--mode test`) com Shadow DOM aberto; o build de produção é fechado (D22).

## 3. Decisões além do documento

**D1 — Versões fixadas.** TypeScript 5.9.3 (o typescript-eslint 8.71 exige
TypeScript < 6.1), Vitest 4.1.11, Playwright 1.64.1, WXT 0.21.4 (Vite 8),
Preact 10.29.8, ESLint 9.39.5, `dom-accessibility-api` 0.7.1, `@medv/finder`
4.0.2, `aria-query` 5.3.2. Todas exatas no `package.json`.

**D2 — Permissão `activeTab`.** Necessária para ler a URL da aba e pedir
`optional_host_permissions` por origem quando o usuário clica no ícone (ou usa
Alt+Shift+A) numa página fora de `localhost`. Não gera aviso de instalação.
O painel **não** é aberto por `openPanelOnActionClick`: nesse caminho o Chrome
abre o painel sem conceder `activeTab`, e o painel ficava sem a URL da aba
("Nenhuma página selecionada"), sem como pedir a permissão. O clique dispara
`action.onClicked`; o service worker chama `chrome.sidePanel.open` (ainda no
gesto do usuário) e guarda a URL da aba em `chrome.storage.session` (D21), de
onde o painel a lê.
Também foi acrescentado `action` (o clique no ícone abre o painel) e
`minimum_chrome_version: 121` (`chrome.sidePanel.open` e
`Element.checkVisibility({ visibilityProperty })`).

**D3 — Mensagens.** Os textos ficam em `scripts/messages.pt_BR.ts` (fonte) e
são gravados em `public/_locales/pt_BR/messages.json` por `pnpm gen:messages`
(executado antes de todo build). O WXT copia `public/` para a raiz da
extensão. Substituições usam `{nome}` (o `$` é reservado no `chrome.i18n`).

**D4 — Regras e ocorrências.** 17 regras internas, cada uma ligada a no máximo
uma regra ACT (`src/rules/catalog.ts`), agrupadas em 9 critérios. O Registry
guarda resultados por (elemento, regra) e expõe **uma ocorrência por
(elemento, critério)**; o resultado da ocorrência é o pior entre as regras
(violation > incomplete > recommendation) e `regra_id` na exportação junta as
regras com `|`. O harness ACT compara pelas regras mapeadas para a regra ACT
(e não pelo critério), como num relatório de implementação ACT.

**D5 — 1.3.1 e e086e5.** A regra `form-label` usa a ACT e086e5 como referência
de testes e reporta 1.3.1, conforme o documento. Campo cujo único nome vem do
`placeholder` vira `recommendation` (a ACT o aprova; o rótulo some ao
digitar). `title` conta como rótulo (técnica H65).

**D6 — Escopo do 4.1.2.** "Controles sem nome" foi implementado para o papel
`button` (ACT 97a4e1). Outros widgets (`menuitem`, `tab`, `treeitem`) não são
avaliados, para não introduzir regras sem casos de referência; campos de
formulário são cobertos por `form-label` (1.3.1), sem dupla contagem.

**D7 — Tabela ARIA.** Gerada de `aria-query` (`pnpm gen:aria`) e versionada
(`aria-data.generated.ts`). Ajustes calibrados pelos casos ACT e pela prática
dos navegadores: `option`/`treeitem` não exigem `aria-selected`; `combobox` só
exige `aria-controls` quando expandido; `separator` focável exige
`aria-valuenow`; `<input type=checkbox|radio|range|number>` já fornecem o
estado; papéis e atributos do rascunho ARIA 1.3 (`image`, `aria-description`,
`aria-colindextext`…) são aceitos. Referências a ids não são conferidas (a ACT
aceita ids inexistentes).

**D8 — Complemento do nome acessível.** `dom-accessibility-api` devolve nome
vazio para `<area alt>`, papéis DPUB com nome a partir do conteúdo
(`doc-biblioref`) e `title` de imagem dentro de link. `src/lib/accname.ts`
complementa esses casos **apenas quando a biblioteca devolve vazio**.

**D9 — Contraste.** Composição completa com alfa e grupos de `opacity` por toda
a cadeia de ancestrais na árvore plana até a tela branca (tela escura do
navegador → `incomplete`). Gradientes CSS: violação só se nem a cor mais
favorável atinge o mínimo e a luminância é monotônica entre as paradas
("maior contraste possível" da ACT); `text-shadow` idem. Sobreposições são
detectadas de forma determinística (sem `elementsFromPoint`, que dependeria da
rolagem): imagens/mídias que cruzam o texto e camadas absolute/fixed dentro do
ancestral posicionado mais alto. Texto só com símbolos e glifos isolados usados
como ícone (ex.: "X" com `aria-label`) são `incomplete`; texto com a mesma cor
do fundo é `inapplicable` (nota da ACT).

**D10 — Tamanho do alvo.** Alvos: links, botões, campos, `summary` e widgets
ARIA interativos, renderizados, não desabilitados e sem `pointer-events:none`.
Alvo inline cercado de texto e controle com aparência nativa → `incomplete`.
Alvos aninhados não entram no cálculo do espaçamento. O índice de vizinhos é
uma grade espacial calculada uma vez por execução do scanner.

**D11 — Debounce.** 150 ms (configurável em `chrome.storage.local`,
`settings.debounceMs`) com espera máxima de 2× o debounce: sem ela, um contador
que muda a cada 100 ms nunca seria reavaliado.

**D12 — Reavaliação incremental.** Itens de trabalho são subárvores (nós
inseridos; mudança de `class`, `style`, `hidden`, `aria-hidden`, `inert`,
`disabled`, `aria-disabled`, `lang`, `open`) ou elementos isolados (alvo da
mutação e até 8 ancestrais, porque o nome acessível vem do conteúdo).
Dependentes: mudança/inserção/remoção de `id` → reavalia quem usa
`aria-labelledby`/`aria-describedby` e controles de `label[for]`; inserção ou
remoção de `<label for>` → reavalia o controle; texto dentro de um rótulo →
reavalia o controle. Subárvore dentro de outra subárvore suja é descartada. O
limite de nós do documento virou o **orçamento de 8 ms por fatia**: subárvores
grandes (troca de tema no `<body>`) são reavaliadas inteiras, cedendo o thread
entre fatias, em vez de truncadas. Regras com dependências globais
(ordem de cabeçalhos, vizinhos de alvos) declaram um gancho de reavaliação
disparado pelos elementos alterados ou por subárvores removidas que os
continham.

**D13 — Regras de documento.** Título, idioma e viewport rodam a cada lote
(custo desprezível) e só no frame de topo de documentos HTML.

**D14 — Overlay.** Um marcador por elemento (contorno + rótulo com ícone e os
critérios); problemas de página (título, idioma, viewport) num rótulo fixo no
canto superior direito. Inconclusivos não são desenhados (aparecem no painel
com filtro). O host é anexado ao `<html>` só quando há algo a mostrar, com
`all: initial !important`. Reposição em `scroll`/`resize`, `ResizeObserver` e
uma verificação a cada 500 ms (cobre animações e deslocamentos). `Esc` fecha o
cartão mesmo aberto por hover (WCAG 1.4.13); o cartão permanece aberto enquanto
o ponteiro está sobre ele.

**D15 — Atalhos.** `_execute_action` (Alt+Shift+A) abre o painel; próxima e
anterior violação (Alt+Shift+N/P) e alternar overlay (Alt+Shift+O). A
navegação por atalho percorre as violações do frame de topo; ocorrências em
iframes são alcançadas pelo painel.

**D16 — Diagnóstico para testes.** O content script responde a
`debug:state`/`debug:overlay`/`debug:focus` apenas quando o remetente é a
própria extensão (`sender.id === chrome.runtime.id`). Os testes usam uma página
da extensão como controlador (o service worker é efêmero). Nenhuma API é
exposta à página avaliada.

**D17 — Frames.** Cada frame de mesma origem tem seu Registry. O frame filho
anuncia-se (snapshot vazio, "ocupado") antes de começar, envia deltas e, ao
ficar ocioso, um snapshot completo; o service worker retransmite ao frame 0,
que reescreve os ids com o `frameId`. Ações do painel sobre ocorrências de
iframe voltam ao frame filho pelo mesmo caminho.

**D18 — Seletor CSS.** `@medv/finder` restrito ao ancestral mais próximo com id
(prefixando `#id`), porque cada verificação de unicidade é um
`querySelectorAll`: no documento inteiro, milhares de ocorrências tornavam a
varredura de uma página com 12 mil elementos 10× mais lenta. Sem âncora, o
finder só roda no documento inteiro até 3.000 elementos; acima disso, caminho
com `:nth-of-type`. Dentro de shadow DOM, o seletor é composto: `host >>> interno`.

**D19 — Modo experimento.** Liga o log de ocorrências e grava os dados da
sessão em `chrome.storage.local` (`experiment:<sessão>`, a cada 2 s). A
exportação é feita pelo painel (Blob + `<a download>`), sem permissão
`downloads`. Os dados de instrumentação ficam sempre em memória, mas só saem
do content script no modo experimento ou por pedido explícito de exportação.

**D20 — Ativação por origem.** `localhost` e `127.0.0.1` (qualquer porta) são
verificados por padrão (`disabledOrigins` desliga). Outras origens: o painel
pede a permissão opcional da origem; o service worker registra o content
script com `chrome.scripting.registerContentScripts` (`persistAcrossSessions`)
e injeta na aba atual. Uma flag no mundo isolado evita instância dupla.

**D21 — `chrome.storage.session`.** Usado só para a URL da aba lida no clique
do ícone (`actionTab:<tabId>`, D2), apagada quando a aba navega ou fecha (a
navegação revoga o `activeTab`). Fora isso, o service worker não mantém estado
por aba (o texto do badge é guardado pelo próprio Chrome por aba).

**D22 — Testes.** Unitários no Chromium real (Vitest em modo navegador),
porque as regras dependem de layout; cobertura v8 com limite de 90% de linhas
em `src/rules/**`. Playwright com projetos `act`, `dynamic`, `regression`,
`ui` e `perf`; rede externa bloqueada; build de teste (`.output/chrome-mv3-test`)
só para a UI. Falsos negativos ACT aceitos ficam em
`tests/act/known-false-negatives.json`, com justificativa.

**D23 — Desempenho.** Caches por lote (estilo, retângulo, papel, nome,
visibilidade) e por execução (`run:` — índices de alvos, cabeçalhos, imagens),
para que índices globais não sejam recalculados a cada fatia.

**D24 — Instrumentação.** O evento `a11y-rt:mutate` aceita, além de `eventId` e
`t`, os campos opcionais `expected` (critério) e `kind` (`flag`/`fix`). O
evento é associado ao primeiro delta que adiciona uma violação do critério
esperado (ou remove a ocorrência, para `fix`) e `flaggedAt` é marcado no
`requestAnimationFrame` que desenha o overlay. Eventos sem sinalização em 10 s
contam como "não sinalizou".
