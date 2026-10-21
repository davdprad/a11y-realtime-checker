/**
 * Fonte das mensagens pt_BR. `pnpm gen:messages` grava
 * `public/_locales/pt_BR/messages.json` no formato do chrome.i18n.
 *
 * Convenções: `{nome}` é substituído pelos dados do resultado (ver
 * src/lib/i18n.ts). Cada regra tem `_what` (o que está errado), `_who` (quem é
 * afetado), `_fix` (como corrigir), `_code` (trecho ilustrativo) e, quando
 * útil, `_note`.
 */
export const MESSAGES: Record<string, string> = {
  // Manifest e atalhos
  extName: 'Acessibilidade em Tempo Real (WCAG 2.2)',
  extShortName: 'A11y Tempo Real',
  extDescription:
    'Verifica continuamente a página aberta e sinaliza violações da WCAG 2.2 sobre o próprio elemento, explicando como corrigir.',
  actionTitle: 'Abrir o painel de acessibilidade',
  cmdOpenPanel: 'Abrir o painel de acessibilidade',
  cmdNext: 'Ir para a próxima violação',
  cmdPrev: 'Ir para a violação anterior',
  cmdToggleOverlay: 'Mostrar ou ocultar as marcações na página',

  // Critérios
  wcag_1_1_1: 'Conteúdo não textual',
  wcag_1_3_1: 'Informações e relações',
  wcag_1_4_3: 'Contraste (mínimo)',
  wcag_1_4_4: 'Redimensionar texto',
  wcag_2_4_2: 'Página com título',
  wcag_2_4_4: 'Finalidade do link (em contexto)',
  wcag_2_5_8: 'Tamanho do alvo (mínimo)',
  wcag_3_1_1: 'Idioma da página',
  wcag_4_1_2: 'Nome, função, valor',

  outcome_violation: 'Violação',
  outcome_recommendation: 'Recomendação',
  outcome_incomplete: 'Inconclusivo',

  // Cartão
  card_title_single: 'Problema de acessibilidade: {criterion}',
  card_title_multiple: '{count} problemas de acessibilidade neste elemento',
  card_what: 'O que está errado',
  card_who: 'Quem é afetado',
  card_fix: 'Como corrigir',
  card_learn: 'Saiba mais',
  card_learn_link: 'Entenda o critério {criterion} no site do W3C (abre em nova aba)',
  card_close: 'Fechar',
  badge_label_violation:
    'Violação de acessibilidade: critério {criteria}. Abrir detalhes',
  badge_label_recommendation:
    'Recomendação de acessibilidade: critério {criteria}. Abrir detalhes',
  page_badge: 'Página',
  page_badge_label: 'Problemas da página inteira: critério {criteria}. Abrir detalhes',
  overlay_shown: 'Marcações de acessibilidade visíveis.',
  overlay_hidden: 'Marcações de acessibilidade ocultas.',
  nav_none: 'Nenhuma violação encontrada nesta página.',
  nav_position: 'Violação {index} de {total}.',

  // Motivos de resultado inconclusivo
  reason_background_image: 'há imagem ou gradiente no fundo',
  reason_text_shadow: 'o texto tem sombra',
  reason_text_stroke: 'o texto tem contorno',
  reason_filter: 'há filtro CSS aplicado',
  reason_blend_mode: 'há modo de mesclagem (mix-blend-mode)',
  reason_color_space: 'a cor usa um espaço de cor não suportado',
  reason_canvas: 'o fundo depende do tema escuro do navegador',
  reason_overlap_graphic: 'há uma imagem sobreposta ao texto',
  reason_overlap_layer: 'há outro elemento sobreposto ao texto',
  reason_overlap_unknown: 'o texto está posicionado sobre outros elementos',
  reason_non_text: 'o conteúdo são apenas símbolos',
  reason_icon_glyph: 'o caractere parece ser um ícone',
  reason_inline: 'o alvo está dentro de uma frase',
  reason_user_agent: 'o controle usa o tamanho padrão do navegador',

  // 1.4.3 Contraste
  text_contrast_what:
    'O contraste entre o texto ({foreground}) e o fundo ({background}) é {ratio}:1. O mínimo para este tamanho de texto é {required}:1.',
  text_contrast_who:
    'Pessoas com baixa visão, daltonismo ou usando a tela sob luz forte podem não conseguir ler este texto.',
  text_contrast_fix:
    'Escureça o texto ou clareie o fundo (ou o contrário) até atingir {required}:1 (por exemplo, #4a4a4a sobre branco dá 8,9:1). Texto grande (24 px, ou 18,66 px em negrito) precisa de 3:1.',
  text_contrast_code: '.seletor {\n  color: #4a4a4a;\n  background-color: #ffffff;\n}',
  text_contrast_incomplete_what:
    'Não foi possível medir o contraste deste texto automaticamente: {reason}.',
  text_contrast_incomplete_who:
    'Se o contraste for baixo, pessoas com baixa visão podem não conseguir ler o texto.',
  text_contrast_incomplete_fix:
    'Verifique manualmente o contraste no ponto de menor contraste (mínimo 4,5:1, ou 3:1 para texto grande).',

  // 1.1.1 Imagens
  image_name_what: 'Esta imagem não tem texto alternativo.',
  image_name_who:
    'Usuários de leitor de tela ouvem apenas "imagem" (ou o nome do arquivo) e perdem a informação que ela transmite.',
  image_name_fix:
    'Descreva o conteúdo ou a função da imagem no atributo alt. Se a imagem for só decorativa, use alt vazio (alt="").',
  image_name_code:
    '<img src="grafico-vendas.png" alt="Vendas cresceram 20% em 2025">\n\n<!-- decorativa -->\n<img src="divisor.png" alt="">',
  image_name_note:
    'A verificação confere se existe texto alternativo, não se ele descreve bem a imagem: isso depende do propósito da imagem na página.',
  image_button_name_what:
    'Este botão de imagem (input type="image") não tem nome acessível.',
  image_button_name_who:
    'Usuários de leitor de tela não sabem o que o botão faz; alguns leitores anunciam apenas "botão".',
  image_button_name_fix: 'Informe a ação do botão no atributo alt.',
  image_button_name_code: '<input type="image" src="lupa.svg" alt="Pesquisar">',
  svg_img_name_what: 'Este SVG com papel "{role}" não tem nome acessível.',
  svg_img_name_who:
    'Usuários de leitor de tela não recebem a informação que o gráfico transmite.',
  svg_img_name_fix:
    'Adicione um elemento <title> como primeiro filho do SVG ou o atributo aria-label. Se o SVG for decorativo, use aria-hidden="true" em vez de role="img".',
  svg_img_name_code:
    '<svg role="img" aria-labelledby="t1">\n  <title id="t1">Três círculos amarelos</title>\n  …\n</svg>',

  // 4.1.2 Botões e ARIA
  button_name_what: 'Este botão não tem nome acessível.',
  button_name_who:
    'Usuários de leitor de tela ouvem apenas "botão", sem saber o que ele faz.',
  button_name_fix:
    'Se houver texto visível, coloque-o dentro do botão. Para botões só com ícone, use aria-label descrevendo a ação.',
  button_name_code:
    '<button>Fechar</button>\n\n<!-- só ícone -->\n<button aria-label="Fechar">\n  <svg aria-hidden="true">…</svg>\n</button>',
  button_name_note:
    'O texto certo depende do que o botão faz; a verificação confere apenas se o nome existe.',
  aria_role_valid_what: 'O valor role="{role}" não é um papel ARIA válido.',
  aria_role_valid_who:
    'Tecnologias assistivas ignoram papéis desconhecidos, então o elemento é anunciado com o papel errado ou sem papel.',
  aria_role_valid_fix:
    'Corrija a grafia ou use um papel definido no WAI-ARIA. Melhor ainda: use o elemento HTML nativo (button, a, nav…).',
  aria_role_valid_code:
    '<!-- em vez de role="buton" -->\n<button type="button">Salvar</button>',
  aria_attr_defined_what: 'Atributo ARIA inexistente: {attributes}.',
  aria_attr_defined_who:
    'Leitores de tela ignoram atributos que não existem, então a informação pretendida não chega ao usuário.',
  aria_attr_defined_fix:
    'Corrija o nome do atributo (ex.: aria-labelledby em vez de aria-labeled) ou remova-o.',
  aria_attr_defined_code:
    '<div role="checkbox" aria-checked="true">Aceito os termos</div>',
  aria_attr_valid_value_what: 'Valor inválido para atributo ARIA: {attributes}.',
  aria_attr_valid_value_who:
    'Com um valor inválido, o leitor de tela pode anunciar o estado errado (por exemplo, "não marcado" quando está marcado).',
  aria_attr_valid_value_fix:
    'Use um dos valores permitidos pelo atributo (true/false, um número, ou a lista de tokens definida no WAI-ARIA).',
  aria_attr_valid_value_code:
    '<button aria-expanded="false">Menu</button>\n<div role="spinbutton" aria-valuenow="2">…</div>',
  aria_required_attr_what: 'O papel "{role}" exige o(s) atributo(s): {missing}.',
  aria_required_attr_who:
    'Sem esses atributos, o leitor de tela não informa o estado do componente (por exemplo, se a caixa está marcada).',
  aria_required_attr_fix:
    'Adicione os atributos obrigatórios e mantenha-os atualizados via JavaScript. Se possível, use o controle HTML nativo, que já informa o estado.',
  aria_required_attr_code:
    '<div role="checkbox" aria-checked="false" tabindex="0">Receber novidades</div>\n\n<!-- melhor -->\n<label><input type="checkbox"> Receber novidades</label>',

  // 2.4.4 Links
  link_name_what: 'Este link não tem texto nem nome acessível.',
  link_name_who:
    'Usuários de leitor de tela ouvem apenas "link" e não sabem para onde ele leva; quem navega pela lista de links não consegue identificá-lo.',
  link_name_fix:
    'Coloque texto visível dentro do link. Se o link for só uma imagem ou ícone, dê à imagem um alt que descreva o destino.',
  link_name_code:
    '<a href="/carrinho">Ver carrinho</a>\n\n<!-- link com ícone -->\n<a href="/carrinho"><img src="carrinho.svg" alt="Ver carrinho"></a>',
  link_name_note:
    'A verificação confere se o nome existe; se ele descreve bem o destino depende do contexto.',

  // 1.3.1 Formulários e cabeçalhos
  form_label_what: 'Este campo de formulário não tem rótulo.',
  form_label_who:
    'Usuários de leitor de tela não sabem o que digitar; usuários de reconhecimento de voz não conseguem chamar o campo pelo nome.',
  form_label_fix:
    'Associe um <label> ao campo (pelo atributo for ou envolvendo o campo). Use aria-label apenas quando não houver texto visível.',
  form_label_code: '<label for="email">E-mail</label>\n<input id="email" type="email">',
  form_label_placeholder_what:
    'O único rótulo deste campo é o texto de exemplo (placeholder).',
  form_label_placeholder_who:
    'O placeholder some quando a pessoa começa a digitar, o que prejudica quem tem dificuldade de memória ou atenção, e costuma ter baixo contraste.',
  form_label_placeholder_fix: 'Adicione um <label> visível associado ao campo.',
  form_label_placeholder_code:
    '<label for="busca">Buscar</label>\n<input id="busca" placeholder="Ex.: sapatos">',
  heading_order_what: 'O nível do cabeçalho salta de h{previous} para h{level}.',
  heading_order_who:
    'Usuários de leitor de tela navegam pelos cabeçalhos para entender a estrutura; um salto sugere que falta uma seção.',
  heading_order_fix:
    'Use níveis em sequência (h2 depois de h1, h3 depois de h2). Para mudar o tamanho do texto, use CSS em vez de trocar o nível.',
  heading_order_code: '<h1>Produtos</h1>\n<h2>Calçados</h2>\n<h3>Tênis</h3>',
  heading_order_note:
    'Isto é uma recomendação: um salto de nível, sozinho, não reprova a página na WCAG.',

  // 3.1.1 Idioma
  html_lang_what: 'A página não declara o idioma (atributo lang no elemento <html>).',
  html_lang_who:
    'O leitor de tela pode ler o texto com a pronúncia de outro idioma, tornando-o incompreensível.',
  html_lang_fix: 'Declare o idioma principal da página no elemento <html>.',
  html_lang_code: '<html lang="pt-BR">',
  html_lang_valid_what:
    'O idioma declarado (lang="{lang}") não é um código de idioma válido.',
  html_lang_valid_who:
    'Com um código inválido, o leitor de tela não sabe qual pronúncia usar.',
  html_lang_valid_fix: 'Use um código BCP 47 válido, como "pt-BR", "pt", "en" ou "es".',
  html_lang_valid_code: '<html lang="pt-BR">',

  // 2.4.2 Título
  document_title_missing_what: 'A página não tem elemento <title>.',
  document_title_missing_who:
    'Usuários de leitor de tela e quem alterna entre muitas abas não conseguem identificar a página.',
  document_title_missing_fix:
    'Adicione um <title> no <head> que descreva o assunto ou a finalidade da página.',
  document_title_missing_code:
    '<head>\n  <title>Carrinho de compras – Loja Exemplo</title>\n</head>',
  document_title_empty_what: 'O título da página (<title>) está vazio.',
  document_title_empty_who:
    'Usuários de leitor de tela e quem alterna entre muitas abas não conseguem identificar a página.',
  document_title_empty_fix:
    'Escreva no <title> um texto que descreva o assunto ou a finalidade da página.',
  document_title_empty_code: '<title>Carrinho de compras – Loja Exemplo</title>',

  // 1.4.4 Zoom
  viewport_zoom_what: 'A meta viewport impede ou limita o zoom ({content}).',
  viewport_zoom_who:
    'Pessoas com baixa visão não conseguem ampliar a página no celular para ler o conteúdo.',
  viewport_zoom_fix:
    'Remova user-scalable=no e não use maximum-scale menor que 2 (o ideal é não definir).',
  viewport_zoom_code:
    '<meta name="viewport" content="width=device-width, initial-scale=1">',

  // 2.5.8 Tamanho do alvo
  target_size_what:
    'Este alvo clicável mede {width} × {height} px, menos que 24 × 24 px, e está próximo demais de outros alvos.',
  target_size_who:
    'Pessoas com tremor, mobilidade reduzida ou usando o celular têm dificuldade para acertar o alvo e acabam ativando o vizinho.',
  target_size_fix:
    'Aumente a área clicável para pelo menos 24 × 24 px (com padding, por exemplo) ou afaste-o dos alvos vizinhos.',
  target_size_code:
    '.icone-botao {\n  min-width: 24px;\n  min-height: 24px;\n  padding: 4px;\n}',
  target_size_incomplete_what:
    'Este alvo mede {width} × {height} px, mas pode se enquadrar em uma exceção do critério: {reason}.',
  target_size_incomplete_who:
    'Alvos pequenos são difíceis de acionar para pessoas com tremor ou mobilidade reduzida.',
  target_size_incomplete_fix:
    'Verifique manualmente se a exceção se aplica; na dúvida, aumente a área clicável para 24 × 24 px.',

  // Painel lateral
  panel_title: 'Acessibilidade em tempo real',
  panel_origin: 'Página: {origin}',
  panel_no_page: 'Nenhuma página selecionada.',
  panel_scanning: 'verificando…',
  panel_section_check: 'Verificação nesta página',
  panel_toggle_origin: 'Verificação ativa nesta origem',
  panel_toggle_overlay: 'Marcações na página',
  panel_rescan: 'Verificar a página inteira novamente',
  panel_connecting: 'Conectando à página…',
  panel_inactive: 'A verificação não está ativa em {origin}.',
  panel_no_access:
    'Não há acesso a esta aba. Clique no ícone da extensão (ou use Alt+Shift+A) com a página aberta para ativar a verificação.',
  panel_enable_origin: 'Ativar a verificação em {origin}',
  panel_section_summary: 'Resumo',
  panel_count_violation: 'violações',
  panel_count_recommendation: 'recomendações',
  panel_count_incomplete: 'inconclusivos',
  panel_section_filters: 'Filtros',
  panel_filter_outcome: 'Tipo de resultado',
  panel_filter_level: 'Nível',
  panel_filter_criterion: 'Critério',
  panel_section_results: 'Ocorrências',
  panel_no_results: 'Nenhuma ocorrência com os filtros atuais.',
  panel_group_count: '{count} ocorrência(s)',
  panel_in_iframe: 'em iframe',
  panel_go_to: 'Ir para o elemento',
  panel_copy_selector: 'Copiar seletor',
  panel_section_experiment: 'Modo experimento',
  panel_experiment_hint:
    'Grava ocorrências e tempos desta sessão para exportação. Nada sai do navegador sem você exportar.',
  panel_toggle_experiment: 'Modo experimento',
  panel_export_current: 'Exportar esta página',
  panel_export_json: 'JSON completo',
  panel_export_occ_csv: 'CSV de ocorrências',
  panel_export_dyn_csv: 'CSV do teste dinâmico',
  panel_export_perf_csv: 'CSV de desempenho',
  panel_saved_sessions: 'Sessões gravadas: {count}',
  panel_export_saved: 'Exportar sessões gravadas (JSON)',
  panel_clear_saved: 'Apagar sessões gravadas',
  panel_section_shortcuts: 'Atalhos de teclado',
  panel_shortcut_esc: 'fechar o cartão de detalhes na página',
  panel_counts_announcement:
    '{violations} violações e {recommendations} recomendações nesta página.',
  panel_permission_denied: 'Permissão negada: a verificação não foi ativada.',
  panel_enabled_message: 'Verificação ativada em {origin}.',
  panel_disabled_message: 'Verificação desativada em {origin}.',
  panel_export_done: 'Arquivo exportado.',
  panel_export_failed: 'Não foi possível exportar. Recarregue a página e tente de novo.',
  panel_sessions_cleared: 'Sessões gravadas apagadas.',
  panel_experiment_on: 'Modo experimento ativado.',
  panel_experiment_off: 'Modo experimento desativado.',
  panel_copied: 'Seletor copiado.',
  panel_copy_failed: 'Não foi possível copiar o seletor.',
};
