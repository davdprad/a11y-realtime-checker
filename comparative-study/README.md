# Estudo comparativo: extensão proposta x axe-core (axe DevTools) x WAVE

Material suplementar da monografia *Acessibilidade Web em tempo real: uma extensão de navegador
para detecção de violações WCAG no DOM sob a abordagem shift-left* (UFAM, 2026), Seções 4 e 5.
Tudo o que está nas tabelas do texto sai dos arquivos desta pasta e pode ser recalculado com
`python analise.py`.

A versão avaliada da extensão é a do commit `7681e6d`. A tag `tcc-2026` aponta para o commit que
acrescenta esta pasta sem alterar o código da extensão; o código nessa tag é, portanto, o mesmo
que foi avaliado. Mudanças posteriores na extensão não se refletem nestes números.

## Conteúdo

| Caminho | O que é |
|---|---|
| `alvos.json` | Páginas avaliadas: 240 casos de teste ACT, 4 páginas BAD e 10 sites reais |
| `coleta.mjs` | Coleta: executa as três ferramentas e a referência independente em cada página |
| `dinamico.mjs` | Teste dinâmico (roteiro do Apêndice B) com as três ferramentas |
| `analise.py` | Análise: monta as unidades, aplica o gabarito e calcula as métricas |
| `recortes.py` | Recorta a captura de tela de cada unidade enviada para decisão manual |
| `decisoes_manuais.csv` | Decisões manuais, com justificativa, das unidades que a referência não decide |
| `dados/act/*.json` | Saída bruta de cada caso ACT |
| `dados/bad/`, `dados/sites/` | Saída bruta de cada página (`.json`) |
| `dados/descartados/` | Saída bruta do IBGE e do Mercado Livre, que bloquearam o navegador automatizado e foram substituídos |
| `dados/desempenho/` | Relatório de desempenho da extensão no ambiente do estudo |
| `log-*.txt` | Registro da execução da coleta |
| `dados/dinamico.json` | Saída bruta do teste dinâmico |
| `resultados/` | Planilhas e métricas usadas no texto (CSV separado por ponto e vírgula, UTF-8) |
| `resultados/recortes/` | Recortes da captura de tela das unidades decididas manualmente (as da UFAM não aparecem na área renderizada e não têm recorte) |
| `wave_itens.json` | Itens do WAVE e critérios WCAG associados, extraídos da própria extensão |
| `iana_primary_subtags.json` | Subtags primários de idioma da IANA (para o critério 3.1.1) |

Durante a coleta também foram gravadas uma cópia de cada página (`.mhtml`) e uma captura de tela
(`.png`). Por serem cópias de conteúdo de terceiros, não foram publicadas; estão com o autor e
podem ser solicitadas. A análise não depende delas (só `recortes.py` usa as capturas, e os recortes já gerados estão em `resultados/recortes/`). Os sites
mudam com o tempo; uma nova coleta não reproduz os mesmos números.

## Como reproduzir

Requisitos: Node.js 22, Python 3 com `pymupdf` (só para `recortes.py`), a extensão proposta
compilada no modo de teste (`pnpm build:test` no repositório da extensão; o build de teste expõe o
estado do registro por mensagens de diagnóstico) e a extensão WAVE descompactada.

```sh
cd comparative-study
npm install
npx playwright install chromium
node coleta.mjs --ext ../.output/chrome-mv3-test --wave <pasta do WAVE> --act ../tests/act/www --grupo act
node coleta.mjs --ext <...> --wave <...> --grupo bad
node coleta.mjs --ext <...> --wave <...> --grupo sites
node dinamico.mjs --ext <...> --wave <...> --repeticoes 5
python analise.py
```

No build de teste, o manifesto recebeu `<all_urls>` em `host_permissions`, para que a verificação
possa ser ativada nos sites sem o diálogo de permissão do navegador. É a mesma ativação que o
usuário faz pelo painel lateral.

## Protocolo, em resumo

- Cada página é carregada uma vez. Nessa carga rodam, nesta ordem: a extensão proposta, a
  referência independente, o axe-core e o WAVE. O WAVE fica por último porque insere ícones na
  página; esses ícones são removidos antes das leituras finais da referência.
- Os elementos são identificados por um caminho canônico na árvore do DOM, que ignora os nós
  inseridos pelas ferramentas.
- Unidade de contagem: par (tipo de problema, elemento). A correspondência entre as regras de cada
  ferramenta e os tipos de problema está em `analise.py` e no Apêndice C da monografia.
- Contam apenas violações (extensão e axe-core) e erros/erros de contraste (WAVE). Resultados que
  pedem revisão humana (inconclusivos, incompletos e alertas) não entram nas métricas.
- Gabarito dos casos ACT: o resultado esperado publicado pelo W3C.
- Gabarito das páginas BAD e dos sites: árvore de acessibilidade do Chromium (nomes acessíveis),
  cores de fundo calculadas pelo Chromium via Chrome DevTools Protocol (contraste), geometria dos
  alvos (2.5.8) e atributos do documento (título, idioma e viewport). O que essa referência não
  decide vai para `revisao_manual.csv` e é decidido em `decisoes_manuais.csv`.

## Decisões manuais

As unidades que a referência não decide foram decididas pelo autor, uma a uma, com a justificativa
registrada em `decisoes_manuais.csv` e, quando o elemento aparece na captura de tela, o recorte
correspondente em `resultados/recortes/`.

## Defeitos da extensão encontrados no estudo

- Links com `role="presentation"` cujo nome vem do atributo `title` (Mastodon) foram apontados
  como sem nome.
- Nomes formados só por caracteres de fontes de ícones (área de uso privado do Unicode) foram
  aceitos como nomes válidos (UFAM, gov.br).

Os números deste estudo correspondem à versão avaliada, com esses defeitos.
