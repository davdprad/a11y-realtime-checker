/**
 * Content script (mundo ISOLATED), injetado em `document_idle` em todos os
 * frames das origens permitidas.
 */
import { ContentAgent } from '../core/agent';

declare global {
  interface Window {
    __a11yRtLoaded?: boolean;
  }
}

/** Iframes de origem cruzada ficam fora do escopo (limitação documentada). */
function isSameOriginWithTop(): boolean {
  try {
    return window.top?.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default defineContentScript({
  matches: ['http://localhost/*', 'http://127.0.0.1/*'],
  runAt: 'document_idle',
  allFrames: true,
  main() {
    // Evita instância dupla quando o script é reinjetado via chrome.scripting.
    if (window.__a11yRtLoaded) return;
    window.__a11yRtLoaded = true;
    const isTop = window === window.top;
    if (!isTop && !isSameOriginWithTop()) return;
    if (!(document.documentElement instanceof Element)) return;
    const agent = new ContentAgent(document, isTop);
    agent.init().catch((err: unknown) => {
      console.warn('[a11y-rt] falha ao iniciar:', err);
    });
  },
});
