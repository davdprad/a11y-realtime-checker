# Regras

Este documento descreve, para cada regra da primeira versão, a **justificativa
de inclusão**, as **condições verificadas** e as **limitações conhecidas**.
É o insumo da QP1 da monografia.

## Convenções

- **Unidade de contagem:** o par (elemento, critério). Várias regras do mesmo
  critério no mesmo elemento formam uma ocorrência.
- **Resultados:** `violation` (conta no estudo), `incomplete` (não decidível de
  forma determinística: registrado, nunca marcado como erro),
  `recommendation` (fora do cálculo de precisão e revocação), `pass` e
  `inapplicable` (não guardados).
- **Elementos ocultos** (`display:none`, `visibility:hidden`, `hidden`,
  `aria-hidden="true"` ou `inert` na cadeia, conteúdo de `<details>` fechado)
  são `inapplicable`. Elementos fora da tela (`left:-9999px`) **continuam**
  aplicáveis às regras de nome (o leitor de tela os alcança), mas não ao
  contraste nem ao tamanho do alvo.
- **Resolução de conflito de papel:** `role="none|presentation"` é ignorado
  quando o elemento é focável ou tem atributo ARIA global.
- **Validação:** casos de teste oficiais das regras ACT do W3C
  (`tests/act/`), executados num Chromium com a extensão instalada.

### Resultado da validação ACT (240 casos)

| Regra ACT | Regra(s) da extensão  | Critério | Acertos | Falsos positivos | Falsos negativos |
| --------- | --------------------- | -------- | ------- | ---------------- | ---------------- |
| afw4f7    | text-contrast         | 1.4.3    | 32 / 34 | 0                | 2 (conhecidos)   |
| 23a2a8    | image-name            | 1.1.1    | 18 / 18 | 0                | 0                |
| 59796f    | image-button-name     | 1.1.1    | 12 / 12 | 0                | 0                |
| 7d6734    | svg-img-name          | 1.1.1    | 10 / 10 | 0                | 0                |
| 97a4e1    | button-name           | 4.1.2    | 17 / 17 | 0                | 0                |
| 674b10    | aria-role-valid       | 4.1.2    | 11 / 11 | 0                | 0                |
| 5f99a7    | aria-attr-defined     | 4.1.2    | 8 / 8   | 0                | 0                |
| 6a7281    | aria-attr-valid-value | 4.1.2    | 21 / 21 | 0                | 0                |
| 4e8ab6    | aria-required-attr    | 4.1.2    | 16 / 16 | 0                | 0                |
| c487ae    | link-name             | 2.4.4    | 28 / 28 | 0                | 0                |
| e086e5    | form-label            | 1.3.1    | 22 / 22 | 0                | 0                |
| b5c3f8    | html-lang             | 3.1.1    | 7 / 7   | 0                | 0                |
| bf051a    | html-lang-valid       | 3.1.1    | 7 / 7   | 0                | 0                |
| 2779a5    | document-title        | 2.4.2    | 13 / 13 | 0                | 0                |
| b4f0c3    | viewport-zoom         | 1.4.4    | 16 / 16 | 0                | 0                |

Inclui casos aprovados e propostos do `testcases.json` (baixado em 2026-10-14).
O relatório atualizado é gerado em `reports/act-report.md` a cada execução.

---

## 1.4.3 Contraste (mínimo) — `text-contrast` (AA, ACT afw4f7)

**Justificativa.** Baixo contraste é a falha mais frequente em levantamentos
como o WebAIM Million e afeta pessoas com baixa visão e daltonismo; é
verificável a partir de estilos computados, sem julgamento humano, desde que o
fundo seja determinável.

**Aplicabilidade.** Elemento HTML com nós de texto diretos não vazios
(inclusive texto em shadow root e texto atribuído a slot), na árvore de
acessibilidade, com caixa de texto não vazia, dentro do documento (não à
esquerda/acima da origem), não recortado por ancestral com `overflow:hidden|clip`
(padrão "sr-only", `clip: rect(0 0 0 0)`, `clip-path: inset(50%)`,
`text-indent` negativo) e fora de contexto desabilitado (`:disabled`,
`aria-disabled="true"`, `<fieldset disabled>`, rótulo — `label` ou
`aria-labelledby` — de controle desabilitado). Ignora `title`, `script`,
`style`, `option`, `textarea`, `select` e texto em SVG.

**Condições verificadas.**

1. Cor do texto: `-webkit-text-fill-color` ou `color` (com alfa).
2. Fundo efetivo: composição das cores de fundo de toda a cadeia de ancestrais
   na árvore plana, com alfa e grupos de `opacity`, sobre a tela branca.
3. Razão `(L1 + 0,05) / (L2 + 0,05)` com luminância WCAG 2.2 (limiar 0,04045),
   comparada **sem arredondar** a 4,5:1 (normal) ou 3:1 (grande: ≥ 24 px, ou
   ≥ 18,66 px com peso ≥ 700).
4. Gradiente CSS único: violação se a cor mais favorável do gradiente não
   atinge o mínimo e todos os canais variam no mesmo sentido entre paradas
   consecutivas (os extremos de luminância estão nas paradas). Caso
   contrário, `incomplete`.
5. `text-shadow`: violação se nem o fundo nem nenhuma sombra atingem o mínimo;
   senão, `incomplete`.

**`incomplete`.** Imagem de fundo (`url()`), várias camadas de fundo,
gradiente não monotônico, `filter`, `backdrop-filter`, `mix-blend-mode`,
contorno de texto, cor em espaço não suportado (`rec2020`, `a98-rgb`,
`prophoto-rgb`), tela escura do navegador (`color-scheme: dark`), imagem ou
mídia que cruza o texto, camada absolute/fixed com pintura que cruza o texto,
texto só com símbolos e glifos de até 2 caracteres usados como ícone em
elemento com `aria-label`/`aria-labelledby`.

**`inapplicable`.** Além das exceções acima, texto com a mesma cor do fundo
(1:1), que não é "apresentação visual de texto" segundo a ACT.

**Limitações conhecidas.** Não lê pixels: texto sobre imagens é sempre
`incomplete` (falso negativo conhecido na ACT, Failed Example 3). Sombras que
envolvem o glifo e mudam o fundo efetivo não são modeladas (Failed Example 11).
Sobreposição por elementos posicionados é detectada no ancestral posicionado
mais alto até a fonte do fundo; sobreposições fora desse escopo (ou escopos com
mais de 1.500 elementos sem posicionamento absoluto) não são detectadas.
Texto de pseudo-elementos (`::before`), `placeholder` e valor de campos não é
avaliado. Logotipos em texto (exceção do critério) não são reconhecidos.

## 1.1.1 Conteúdo não textual

### `image-name` (A, ACT 23a2a8)

**Justificativa.** Imagem informativa sem alternativa é invisível para quem usa
leitor de tela; a ausência do nome é verificável.

**Aplicabilidade.** Elemento HTML com papel `img` (inclusive `<img>` sem
`alt=""` e `role="img"`/`"image"`), na árvore de acessibilidade. `alt=""` e
`role="presentation|none"` tornam a imagem decorativa (não se aplica), exceto
quando a resolução de conflito ignora o papel de apresentação (imagem focável).

**Condição.** Nome acessível não vazio (aria-labelledby, aria-label, alt, title).

**Limitações.** Não avalia se o texto alternativo descreve a imagem (julgamento
humano) nem se uma imagem marcada como decorativa é de fato decorativa. Imagens
de fundo CSS e `<canvas>` não são avaliadas.

### `image-button-name` (A, ACT 59796f)

**Condição.** `<input type="image">` com nome vindo de fontes do autor
(aria-labelledby, aria-label, alt, title). O rótulo padrão do navegador
("Enviar") não conta.

### `svg-img-name` (A, ACT 7d6734)

**Aplicabilidade.** Elemento SVG com papel **explícito** `img`,
`graphics-document` ou `graphics-symbol`. SVG sem papel explícito não se aplica.

**Condição.** Nome acessível: aria-labelledby, aria-label ou `<title>` filho direto.

**Limitações.** `<text>` dentro do SVG não nomeia o gráfico (comportamento ACT).

## 4.1.2 Nome, função, valor

### `button-name` (A, ACT 97a4e1)

**Justificativa.** Botão sem nome é anunciado apenas como "botão".

**Aplicabilidade.** Papel `button` (nativo ou ARIA), na árvore de
acessibilidade, exceto `<input type="image">` (coberto por 1.1.1). Botões fora
da tela e desabilitados são aplicáveis.

**Condição.** Nome acessível não vazio (conteúdo, aria-label, aria-labelledby,
`value` de `input` submit/reset/button e rótulos padrão do navegador).

**Limitações.** Verifica a existência do nome, não se descreve a função.
Outros widgets ARIA (`menuitem`, `tab`, `treeitem`) não são avaliados.

### `aria-role-valid` (A, ACT 674b10)

**Condição.** `role` com ao menos um token que seja papel concreto (não
abstrato) do WAI-ARIA 1.2, DPUB-ARIA ou Graphics-ARIA (rascunho 1.3 aceito).
Elementos com `aria-hidden` não se aplicam.

### `aria-attr-defined` (A, ACT 5f99a7)

**Condição.** Todo atributo `aria-*` existe na especificação (lista gerada do
`aria-query`, mais `aria-colindextext`/`aria-rowindextext` do ARIA 1.3).

**Nota.** A ACT não mapeia esta regra a um critério de conformidade estrito; o
documento do estudo a classifica em 4.1.2.

### `aria-attr-valid-value` (A, ACT 6a7281)

**Condição.** Valores não vazios respeitam o tipo: booleano (`true`/`false`, e
`undefined` onde permitido), tristate, token, lista de tokens, inteiro,
número. Valores comparados sem diferenciar maiúsculas. Referências a ids não
são verificadas.

### `aria-required-attr` (A, ACT 4e8ab6)

**Aplicabilidade.** Papel explícito válido, diferente do papel implícito do
elemento e efetivamente aplicado (não descartado por conflito).

**Condição.** Estados/propriedades obrigatórios do papel presentes e não vazios
(ex.: `checkbox`/`switch`/`radio` → `aria-checked`; `heading` →
`aria-level`; `slider` → `aria-valuenow`). Ajustes: `option`/`treeitem` sem
`aria-selected` obrigatório; `combobox` exige `aria-expanded` e, quando
expandido, `aria-controls`; `separator` focável exige `aria-valuenow`;
controles nativos fornecem o próprio estado.

**Limitações.** Não verifica se o valor reflete o estado real do componente.

## 2.4.4 Finalidade do link — `link-name` (A, ACT c487ae)

**Justificativa.** Link sem nome é anunciado só como "link" e não pode ser
identificado na lista de links do leitor de tela.

**Aplicabilidade.** Papel `link` ou derivado (`a[href]`, `area[href]`,
`role="link"`, `doc-biblioref`…), na árvore de acessibilidade (inclusive fora
da tela). `<area>` herda a visibilidade da imagem do mapa.

**Condição.** Nome acessível não vazio.

**Limitações.** A finalidade "em contexto" (se o texto descreve o destino)
exige julgamento humano.

## 1.3.1 Informações e relações

### `form-label` (A, ACT e086e5)

**Justificativa.** Campo sem rótulo programático impede que leitor de tela e
reconhecimento de voz identifiquem o campo.

**Aplicabilidade.** Papéis de campo da ACT (`checkbox`, `combobox`, `listbox`,
`menuitemcheckbox`, `menuitemradio`, `radio`, `searchbox`, `slider`,
`spinbutton`, `switch`, `textbox`) e campos nativos sem papel ARIA
(`password`, `date`, `color`, `file`…), na árvore de acessibilidade, inclusive
desabilitados.

**Condições.** Sem nome acessível → `violation`. Nome vindo só de
`placeholder`/`aria-placeholder` → `recommendation`. Fontes aceitas como
rótulo: `<label for>`, `<label>` envolvente, `aria-labelledby`, `aria-label`,
`title` e, para papéis com nome a partir do conteúdo, o próprio conteúdo.

**Divergência documentada.** O W3C mapeia a e086e5 para 4.1.2; o estudo a
classifica em 1.3.1.

### `heading-order` (recomendação)

**Condição.** O nível do cabeçalho (`aria-level` válido, `hN` ou 2 para
`role="heading"`) não pode saltar mais de um nível em relação ao cabeçalho
visível anterior do mesmo escopo (documento ou shadow root).

**Por que recomendação.** Um salto de nível, sozinho, não reprova a WCAG; fica
fora do cálculo de precisão e revocação.

## 3.1.1 Idioma da página

### `html-lang` (A, ACT b5c3f8)

**Condição.** O `<html>` do documento HTML de topo tem `lang` não vazio (após
remover espaços). `xml:lang` sozinho não basta. Documentos SVG/MathML não se
aplicam.

### `html-lang-valid` (A, ACT bf051a)

**Condição.** O subtag primário (texto antes do primeiro hífen, sem diferenciar
maiúsculas) existe no IANA Language Subtag Registry (8.275 subtags, registro de
2026-09-17, `pnpm gen:bcp47`). Tags "grandfathered" (`i-lux`) e códigos de 3
letras que têm equivalente de 2 letras (`eng`) são inválidos.

**Limitações.** Não verifica se o idioma declarado corresponde ao conteúdo nem
as mudanças de idioma em trechos (3.1.2).

## 2.4.2 Página com título — `document-title` (A, ACT 2779a5)

**Condição.** O primeiro elemento `<title>` HTML do documento de topo (mesmo no
`<body>`) existe e tem texto não vazio. `<title>` de SVG, de shadow DOM ou de
iframe não conta.

**Limitações.** Não avalia se o título descreve a página.

## 1.4.4 Redimensionar texto — `viewport-zoom` (AA, ACT b4f0c3)

**Condição.** Cada `<meta name="viewport">` com `content`: `user-scalable` com
|valor| < 1 (`no`, `0`, `0.5`, texto inválido) ou `maximum-scale` entre 0 e 2
(exclusive) → violação. Valores especiais do Chromium: `yes`=1, `no`=0,
`device-width`/`device-height`=10; `maximum-scale` negativo é ignorado.

**Limitações.** Cobre só o bloqueio de zoom por meta tag; texto que não se
adapta a 200% (layout) exige teste manual.

## 2.5.8 Tamanho do alvo (mínimo) — `target-size` (AA, sem ACT)

**Justificativa.** Critério novo da WCAG 2.2, verificável por geometria.

**Aplicabilidade.** `a[href]`, `button`, `input` (exceto hidden), `select`,
`textarea`, `summary` e papéis interativos ARIA, renderizados, não
desabilitados, sem `pointer-events:none`, não recortados.

**Condições.** Caixa (para alvos inline, unida à dos descendentes) com menos de
24 × 24 px CSS → aplica a exceção de espaçamento: passa se o círculo de 24 px
de diâmetro centrado no alvo não intersecta outro alvo nem o círculo de outro
alvo pequeno (tangência não conta). Alvos aninhados (um dentro do outro) não
entram no cálculo.

**`incomplete`.** Alvo inline cercado de texto no mesmo bloco ("em uma
frase") e controle nativo com aparência padrão do navegador (checkbox, radio,
range, color, file, data/hora).

**Limitações.** As exceções "equivalente" (outro alvo com a mesma função) e
"essencial" exigem julgamento humano e não são aplicadas — possível fonte de
falso positivo. Não há casos ACT para esta regra; a validação é feita pelos
testes unitários e pela página `fixtures/regression.html`.
