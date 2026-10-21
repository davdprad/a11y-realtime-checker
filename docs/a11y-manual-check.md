# Verificação manual com leitor de tela

Roteiro para verificar a interface da própria extensão (side panel e cartão de
feedback) com leitor de tela, complementando os testes automáticos de teclado e
a auditoria com axe (`tests/ui/ui.spec.ts`).

> **Status:** roteiro preparado; **a execução com leitor de tela ainda não foi
> feita** (os testes automáticos não substituem esta verificação). Preencha a
> coluna "Resultado" e a seção de registro ao executar.

## Ambiente

| Item             | Valor                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Leitor de tela   | NVDA 2024.x+ (Windows) **ou** ChromeVox (ChromeOS / extensão)         |
| Navegador        | Chrome/Chromium ≥ 121, extensão carregada de `.output/chrome-mv3`     |
| Página de teste  | `pnpm serve` e abrir `http://localhost:4173/fixtures/regression.html` |
| Data / avaliador | _(preencher)_                                                         |

## Roteiro

### A. Side panel

| #   | Ação                                                                                                  | Resultado esperado                                                          | Resultado |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| A1  | Abrir o painel com Alt+Shift+A                                                                        | Foco no painel; título "Acessibilidade em tempo real" anunciado             |           |
| A2  | Navegar por cabeçalhos (NVDA: H; ChromeVox: Search+H)                                                 | h1 → h2 de cada seção → h3 por critério, em ordem                           |           |
| A3  | Navegar por regiões (NVDA: D)                                                                         | "banner" e "principal" anunciados                                           |           |
| A4  | Tab até "Verificação ativa nesta origem"                                                              | Anunciado como botão de alternância, "pressionado"                          |           |
| A5  | Tab pelos filtros                                                                                     | Cada caixa anunciada com o grupo ("Tipo de resultado", "Nível", "Critério") |           |
| A6  | Desmarcar "Violação" com Espaço                                                                       | Estado "não marcado" anunciado; contagem da lista atualizada                |           |
| A7  | Provocar uma nova violação na página (console: `document.body.append(document.createElement('img'))`) | Em até ~2 s, anúncio educado da nova contagem ("N violações…")              |           |
| A8  | Tab até "Ir para o elemento"                                                                          | Nome do botão + descrição com critério e seletor                            |           |
| A9  | Ativar "Copiar seletor"                                                                               | Mensagem "Seletor copiado." anunciada                                       |           |
| A10 | Ativar "Modo experimento"                                                                             | Estado "pressionado" e mensagem "Modo experimento ativado."                 |           |

### B. Cartão de feedback na página

| #   | Ação                                  | Resultado esperado                                                                          | Resultado |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------- | --------- |
| B1  | Focar a página e usar Alt+Shift+N     | Foco vai para o cartão; anunciado como diálogo com o título "Problema de acessibilidade: …" |           |
| B2  | Ler o cartão (setas)                  | Quatro seções: o que está errado, quem é afetado, como corrigir (com código), saiba mais    |           |
| B3  | Tab dentro do cartão                  | Botão "Fechar" e link "Entenda o critério … (abre em nova aba)"                             |           |
| B4  | Esc                                   | Cartão fecha; foco volta ao elemento que estava focado antes                                |           |
| B5  | Alt+Shift+N repetido                  | "Violação 2 de N" anunciado; cartão do próximo elemento                                     |           |
| B6  | Alt+Shift+O                           | "Marcações de acessibilidade ocultas." anunciado                                            |           |
| B7  | Tab pela página com o overlay visível | Os rótulos dos marcadores **não** entram na ordem de tabulação                              |           |

### C. Visual (sem leitor de tela)

| #   | Verificação                      | Resultado esperado                                                         | Resultado |
| --- | -------------------------------- | -------------------------------------------------------------------------- | --------- |
| C1  | Zoom do navegador em 200%        | Painel e cartão legíveis, sem corte de conteúdo                            |           |
| C2  | Tema escuro do sistema           | Painel com cores do tema escuro e contraste adequado                       |           |
| C3  | `prefers-reduced-motion: reduce` | "Ir para o elemento" destaca sem animação                                  |           |
| C4  | Marcadores sem depender de cor   | Ícone (⚠/ℹ), critério e estilo de borda distinguem violação e recomendação |           |

## Registro

- Problemas encontrados: _(preencher)_
- Correções aplicadas: _(preencher)_
