# Resultados da validação

Execução completa de `pnpm test` em 2026-10-15 (código de saída 0). Os
relatórios brutos são regenerados em `reports/` a cada execução; os números
abaixo são um retrato desta execução.

**Ambiente:** Windows 11 Pro, Intel Core i5-1135G7 (2,4 GHz), 23,7 GB de RAM,
Chromium 156.0.8078.4 (Playwright 1.64.1, headless), Node.js 22.17.0.
Desempenho é sensível à máquina: repita as medições no ambiente do estudo.

## Resumo

| Suíte                                                               | Resultado                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Lint (ESLint strict + type-checked), tipos (`tsc` strict), Prettier | sem erros                                                                                                    |
| Unitários (Vitest no Chromium)                                      | 374 / 374; cobertura de linhas: 96,8% em `src/rules/**` (meta ≥ 90%), 94,2% no total medido                  |
| Casos ACT do W3C                                                    | 240 / 240 testes aprovados: 238 acertos, **0 falsos positivos**, 2 falsos negativos conhecidos               |
| Detecção dinâmica (Apêndice B)                                      | E1–E5 sinalizados sem execução manual; F1–F5 removem as ocorrências                                          |
| Regressão                                                           | DOM intacto, iframe e shadow DOM avaliados, sem loop de auto-observação, desativar/reativar por origem       |
| UI da extensão                                                      | axe sem violações (painel e cartão), operação por teclado, Esc e retorno de foco, atalhos, hover, exportação |
| Desempenho                                                          | todas as metas de referência atingidas                                                                       |

## Regras ACT

| Regra ACT | Nome                                                           | Acertos / total | Falsos positivos | Falsos negativos conhecidos |
| --------- | -------------------------------------------------------------- | --------------- | ---------------- | --------------------------- |
| 23a2a8    | Image has non-empty accessible name                            | 18 / 18         | 0                | 0                           |
| 2779a5    | HTML page has non-empty title                                  | 13 / 13         | 0                | 0                           |
| 4e8ab6    | Element with role attribute has required states and properties | 16 / 16         | 0                | 0                           |
| 59796f    | Image button has non-empty accessible name                     | 12 / 12         | 0                | 0                           |
| 5f99a7    | ARIA attribute is defined in WAI-ARIA                          | 8 / 8           | 0                | 0                           |
| 674b10    | Role attribute has valid value                                 | 11 / 11         | 0                | 0                           |
| 6a7281    | ARIA state or property has valid value                         | 21 / 21         | 0                | 0                           |
| 7d6734    | SVG element with explicit role has non-empty accessible name   | 10 / 10         | 0                | 0                           |
| 97a4e1    | Button has non-empty accessible name                           | 17 / 17         | 0                | 0                           |
| afw4f7    | Text has minimum contrast                                      | 32 / 34         | 0                | 2                           |
| b4f0c3    | Meta viewport allows for zoom                                  | 16 / 16         | 0                | 0                           |
| b5c3f8    | HTML page has lang attribute                                   | 7 / 7           | 0                | 0                           |
| bf051a    | HTML page `lang` attribute has valid language tag              | 7 / 7           | 0                | 0                           |
| c487ae    | Link has non-empty accessible name                             | 28 / 28         | 0                | 0                           |
| e086e5    | Form field has non-empty accessible name                       | 22 / 22         | 0                | 0                           |

Falsos negativos conhecidos (`tests/act/known-false-negatives.json`):

- **afw4f7, Failed Example 3** — texto sobre imagem de fundo: a extensão não lê
  pixels e devolve `incomplete`.
- **afw4f7, Failed Example 11** — sombras que envolvem o glifo: o contraste com
  o fundo passa (5,7:1); a ACT trata a sombra como fundo efetivo. A extensão
  devolve `incomplete`.

## Detecção dinâmica (Apêndice B)

`fixtures/dynamic.html`, debounce de 150 ms. Tempo medido do evento
`a11y-rt:mutate` (emitido imediatamente antes da alteração) até o
`requestAnimationFrame` que desenha o overlay.

| Evento | Alteração                          | Critério | Sinalizou | Tempo (ms)  |
| ------ | ---------------------------------- | -------- | --------- | ----------- |
| E1     | modal com botão de fechar sem nome | 4.1.2    | sim       | 173,5       |
| E2     | tema reduz o contraste do texto    | 1.4.3    | sim       | 169,2       |
| E3     | imagem informativa sem alt         | 1.1.1    | sim       | 163,1       |
| E4     | link sem texto                     | 2.4.4    | sim       | 153,4       |
| E5     | rótulo removido do campo           | 1.3.1    | sim       | 165,0       |
| F1–F5  | correções (remoção da ocorrência)  | —        | sim       | 153,4–164,6 |

O tempo é dominado pelo debounce (150 ms); a avaliação e a pintura somam
~3–25 ms.

## Desempenho

| Página              | Nós    | Elementos | Varredura inicial (ms) | CPU ativa (ms) | Maior fatia (ms) | Tarefas longas na varredura | Reavaliações | p50 (ms) | p95 (ms) | Máx. (ms) |
| ------------------- | ------ | --------- | ---------------------- | -------------- | ---------------- | --------------------------- | ------------ | -------- | -------- | --------- |
| large-dom-5k        | 5.262  | 3.099     | 329,0                  | 320,0          | 16,6             | 0                           | 30           | 3,3      | 9,4      | 13,0      |
| large-dom-20k       | 21.048 | 12.414    | 1.073,7                | 1.044,3        | 24,7             | 0                           | 30           | 6,3      | 27,0     | 29,9      |
| mutações frequentes | ~170   | 83        | 10,6                   | 10,5           | 10,5             | 0                           | 16           | 1,9      | 6,3      | 6,3       |

- **Mediana da reavaliação incremental < 16 ms:** atingida em todas as páginas.
  Entre execuções repetidas na mesma máquina, a mediana do 20k variou de 6 a
  8 ms e o p95 de 27 a 47 ms (máximo observado: 50 ms de CPU somando todas as
  fatias de um lote; nenhuma fatia isolada passou de 50 ms). Os lotes mais
  caros são os que tocam alvos clicáveis e precisam do índice de vizinhos do
  2.5.8, cuja primeira leitura de geometria após a mutação força o layout da
  página.
- **Nenhuma tarefa longa (> 50 ms) na varredura inicial:** nenhuma tarefa
  longa registrada pelo `PerformanceObserver` durante a varredura; a maior
  fatia da extensão foi 24,7 ms (orçamento de 8 ms por fatia mais o elemento
  em curso e a construção de índices globais).
- **Sem loop de auto-observação:** depois que a página para de mudar, nenhum
  lote novo é gerado (verificado na página estática e na de mutações).

As fixtures "5k" e "20k" têm 5.262 e 21.048 nós (elementos, texto e
comentários), ou 3.099 e 12.414 elementos. Na página de mutações (contador a cada 100 ms e lista que
cresce a cada 250 ms por 6 s), as 16 reavaliações cobriram todas as mutações e
todas as imagens sem `alt` inseridas foram sinalizadas.
