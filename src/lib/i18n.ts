/**
 * Mensagens via `chrome.i18n` (arquivo `_locales/pt_BR/messages.json`), com
 * substituição nomeada `{chave}` a partir dos dados do resultado.
 */

export type MessageData = Readonly<Record<string, string | number>>;

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatValue(v: string | number): string {
  return typeof v === 'number' ? numberFormat.format(v) : v;
}

export function t(key: string, data?: MessageData): string {
  let msg = '';
  try {
    msg = chrome.i18n.getMessage(key);
  } catch {
    msg = '';
  }
  if (!msg) return key;
  if (!data) return msg;
  return msg.replace(/\{(\w+)\}/g, (match, k: string) => {
    const v = data[k];
    return v === undefined ? match : formatValue(v);
  });
}

/** Existe mensagem para a chave? (permite variações opcionais, ex.: `_fix`). */
export function hasMessage(key: string): boolean {
  try {
    return chrome.i18n.getMessage(key) !== '';
  } catch {
    return false;
  }
}

/** Traduz códigos de motivo (`reason`) dos resultados inconclusivos. */
export function localizeData(data: MessageData | undefined): MessageData {
  if (!data) return {};
  const reason = data.reason;
  if (typeof reason !== 'string') return data;
  const key = `reason_${reason.replace(/[^a-z0-9]/gi, '_')}`;
  return hasMessage(key) ? { ...data, reason: t(key) } : data;
}
