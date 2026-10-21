# Limitações

Limitações conhecidas da primeira versão, agrupadas por origem. As limitações
específicas de cada regra estão também em `RULES.md`.

## Alcance do DOM

- **Shadow DOM fechado.** Shadow roots criados com `mode: 'closed'` são
  inacessíveis ao content script; seu conteúdo não é avaliado.
- **Shadow root anexado depois da varredura.** `attachShadow()` não gera
  registro de mutação. Um shadow root aberto criado depois da varredura só é
  descoberto quando o host (ou um ancestral) volta a ser reavaliado por outra
  mutação. Shadow roots já existentes são observados com um MutationObserver
  próprio.
- **Iframes de origem cruzada.** Fora do escopo: o content script não roda
  quando o frame não é da mesma origem do frame de topo. Iframes de mesma
  origem têm Registry próprio e reportam ao frame de topo.
- **`<canvas>`, imagens, vídeo e conteúdo desenhado por WebGL** não são
  inspecionados (nem para contraste de texto desenhado, nem para nomes).
- **Pseudo-elementos** (`::before`/`::after`) entram no nome acessível, mas seu
  texto não é avaliado para contraste.
- **Valores de campos e `placeholder`** não são avaliados para contraste.

## Casos `incomplete` (não decididos de forma determinística)

| Regra           | Situação                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraste       | imagem de fundo (`url()`), várias camadas de fundo, gradiente não monotônico ou cuja cor mais favorável atinge o mínimo, `filter`, `backdrop-filter`, `mix-blend-mode`, `text-shadow` que poderia salvar o contraste, contorno de texto, espaço de cor não suportado, tela escura do navegador, imagem ou camada posicionada sobre o texto, texto só com símbolos, glifo-ícone com `aria-label` |
| Tamanho do alvo | alvo inline em frase, controle com aparência nativa do navegador                                                                                                                                                                                                                                                                                                                                |

Inconclusivos são registrados (painel, exportação), não são marcados como erro
na página e não contam como positivos no estudo.

## Sobreposição e geometria

- A detecção de sobreposições no contraste é determinística (independe da
  rolagem) e, por isso, limitada: considera imagens/mídias dentro da fonte do
  fundo e camadas absolute/fixed dentro do ancestral posicionado mais alto até
  essa fonte. Sobreposições fora desse escopo podem gerar falso positivo.
- `overflow: auto|scroll` não é tratado como recorte (o conteúdo é alcançável
  por rolagem); `overflow: hidden|clip` é.
- O índice de vizinhos do 2.5.8 é calculado uma vez por execução do scanner;
  mudanças de layout que ocorram durante as cessões de uma execução longa só
  são consideradas no lote seguinte.
- Elementos na camada superior do navegador (`<dialog>` modal, `popover`)
  ficam acima do overlay. Enquanto um `<dialog>` modal estiver aberto, o
  restante do documento — inclusive o host do overlay — fica inerte: os
  contornos aparecem, mas o rótulo e o cartão não recebem ponteiro.

## Critérios e julgamento humano

- Adequação semântica de textos alternativos, nomes de botões e links,
  títulos de página e idioma declarado exigem julgamento humano e estão fora
  do escopo (as regras verificam existência e validade sintática).
- As exceções "equivalente" e "essencial" do 2.5.8 e as exceções de logotipo
  e texto decorativo do 1.4.3 não são reconhecidas.

## Plataforma e operação

- Apenas navegadores baseados em Chromium (versão 121 ou superior).
- Fora de `localhost`/`127.0.0.1`, a ativação exige clicar no ícone da
  extensão (ou Alt+Shift+A) na aba, para conceder `activeTab` e pedir a
  permissão da origem. Abrir o painel por outro caminho (menu de painéis
  laterais do Chrome) ou trocar de aba com o painel aberto não concede
  `activeTab`: é preciso clicar no ícone na aba desejada.
- Os atalhos de navegação percorrem as violações do frame de topo; ocorrências
  em iframes são alcançadas pelo painel lateral.
- A instrumentação de desempenho e de eventos dinâmicos exportada é a do frame
  de topo; ocorrências de iframes entram na exportação, os tempos não.
- Ids duplicados: o seletor `#id` resolve para o primeiro elemento com aquele id.
- Por isolamento, o host do overlay é um filho de `<html>`: seletores da página
  como `html > :last-child` podem passar a corresponder a ele. O conteúdo do
  `<body>` nunca é alterado.
