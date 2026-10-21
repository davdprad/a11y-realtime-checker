/**
 * Service worker (efêmero). Não guarda estado de avaliação: apenas roteia
 * mensagens, mantém o badge, registra content scripts para origens ativadas
 * pelo usuário e encaminha os atalhos de teclado.
 */
import {
  isDefaultOrigin,
  loadOriginLists,
  originPattern,
  setOriginEnabled,
  STORAGE_KEYS,
} from '../lib/settings';
import {
  isCommandName,
  isContentToBackground,
  isPanelToBackground,
  type BackgroundToContent,
} from '../messaging/protocol';

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

function scriptId(origin: string): string {
  return `a11y-rt:${new URL(origin).host}`;
}

async function sendToFrame(
  tabId: number,
  frameId: number,
  msg: BackgroundToContent,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, msg, { frameId });
  } catch {
    // Frame sem content script (origem desativada ou página recarregando).
  }
}

/** Mantém os content scripts dinâmicos em sincronia com as origens ativadas. */
async function syncDynamicScripts(): Promise<void> {
  const lists = await loadOriginLists();
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const wanted = new Map<string, string>();
  for (const origin of lists.enabled) {
    if (isDefaultOrigin(origin)) continue;
    const granted = await chrome.permissions.contains({
      origins: [originPattern(origin)],
    });
    if (granted) wanted.set(scriptId(origin), origin);
  }
  const stale = registered
    .filter((s) => s.id.startsWith('a11y-rt:') && !wanted.has(s.id))
    .map((s) => s.id);
  if (stale.length > 0) await chrome.scripting.unregisterContentScripts({ ids: stale });
  const have = new Set(registered.map((s) => s.id));
  const toAdd = [...wanted].filter(([id]) => !have.has(id));
  if (toAdd.length > 0) {
    await chrome.scripting.registerContentScripts(
      toAdd.map(([id, origin]) => ({
        id,
        matches: [originPattern(origin)],
        js: [CONTENT_SCRIPT_FILE],
        runAt: 'document_idle' as const,
        allFrames: true,
        persistAcrossSessions: true,
      })),
    );
  }
}

async function enableOrigin(tabId: number, origin: string): Promise<void> {
  await setOriginEnabled(origin, true);
  if (!isDefaultOrigin(origin)) {
    await syncDynamicScripts();
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: [CONTENT_SCRIPT_FILE],
      });
    } catch (err) {
      console.warn('[a11y-rt] não foi possível injetar o content script:', err);
    }
  }
  await sendToFrame(tabId, 0, { type: 'origin:changed' });
}

async function disableOrigin(tabId: number, origin: string): Promise<void> {
  await setOriginEnabled(origin, false);
  if (!isDefaultOrigin(origin)) await syncDynamicScripts();
  await sendToFrame(tabId, 0, { type: 'origin:changed' });
  await chrome.action.setBadgeText({ tabId, text: '' });
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    // O clique no ícone passa por action.onClicked (abaixo), onde a URL da aba
    // é garantida pelo activeTab; com openPanelOnActionClick o Chrome abre o
    // painel sem conceder activeTab e o painel não conseguiria ler a origem.
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    void syncDynamicScripts();
  });

  // Ícone da extensão ou Alt+Shift+A (_execute_action).
  chrome.action.onClicked.addListener((tab) => {
    // sidePanel.open precisa rodar ainda no gesto do usuário, antes de qualquer await.
    void chrome.sidePanel.open({ windowId: tab.windowId });
    if (tab.id === undefined || !tab.url) return;
    void chrome.storage.session.set({
      [`${STORAGE_KEYS.actionTabPrefix}${String(tab.id)}`]: tab.url,
    });
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void chrome.storage.session.remove(`${STORAGE_KEYS.actionTabPrefix}${String(tabId)}`);
  });
  chrome.runtime.onStartup.addListener(() => {
    void syncDynamicScripts();
  });

  chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return undefined;
    if (isPanelToBackground(msg)) {
      const task =
        msg.type === 'origin:enable'
          ? enableOrigin(msg.tabId, msg.origin)
          : disableOrigin(msg.tabId, msg.origin);
      task.then(
        () => {
          sendResponse({ ok: true });
        },
        (err: unknown) => {
          sendResponse({ ok: false, error: String(err) });
        },
      );
      return true; // resposta assíncrona
    }
    if (!isContentToBackground(msg)) return undefined;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return undefined;
    switch (msg.type) {
      case 'badge': {
        const text = msg.count > 0 ? (msg.count > 999 ? '999+' : String(msg.count)) : '';
        void chrome.action.setBadgeText({ tabId, text });
        void chrome.action.setBadgeBackgroundColor({ tabId, color: '#b00020' });
        void chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
        break;
      }
      case 'frame:report':
        if ((sender.frameId ?? 0) > 0) {
          void sendToFrame(tabId, 0, {
            type: 'frame:relay',
            frameId: sender.frameId ?? 0,
            payload: msg.payload,
          });
        }
        break;
      case 'frame:forward':
        if ((sender.frameId ?? 0) === 0) {
          void sendToFrame(tabId, msg.frameId, {
            type: 'frame:command',
            payload: msg.payload,
          });
        }
        break;
    }
    return undefined;
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (!isCommandName(command) || tab?.id === undefined) return;
    void sendToFrame(tab.id, 0, { type: 'command', command });
  });

  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'loading') return;
    void chrome.action.setBadgeText({ tabId, text: '' });
    // Navegação revoga o activeTab: a URL guardada deixa de valer.
    void chrome.storage.session.remove(`${STORAGE_KEYS.actionTabPrefix}${String(tabId)}`);
  });
});
