/**
 * ContentAgent: integra o FrameController ao restante da extensão.
 *
 * - Ativa/desativa a verificação conforme a origem (chrome.storage).
 * - Frame de topo: agrega as ocorrências dos iframes de mesma origem
 *   (retransmitidas pelo service worker), atende o side panel via Port
 *   (snapshot + deltas), atualiza o badge, executa atalhos e grava o modo
 *   experimento.
 * - Frames filhos: reportam snapshot/deltas ao frame de topo.
 */
import { applyDelta } from './registry';
import { FrameController } from './controller';
import { t } from '../lib/i18n';
import {
  isOriginEnabled,
  loadOriginLists,
  loadSettings,
  saveSettings,
  STORAGE_KEYS,
  type Settings,
} from '../lib/settings';
import {
  EMPTY_DELTA,
  isBackgroundToContent,
  isDebugRequest,
  isEmptyDelta,
  isPanelToContent,
  PANEL_PORT_NAME,
  type BackgroundToContent,
  type CommandName,
  type ContentToBackground,
  type ContentToPanel,
  type DebugState,
  type Delta,
  type ExperimentData,
  type FramePayload,
  type Occurrence,
  type PanelToContent,
  type TabState,
} from '../messaging/protocol';

const SLICE_BUDGET_MS = 8;
const BADGE_THROTTLE_MS = 250;
const EXPERIMENT_SAVE_DELAY_MS = 2000;

interface RemoteFrame {
  readonly occurrences: Map<string, Occurrence>;
  idle: boolean;
}

function rekey(o: Occurrence, frameId: number): Occurrence {
  const local = o.id.slice(o.id.indexOf(':') + 1);
  return { ...o, id: `${frameId}:${local}`, frameId };
}

function rekeyDelta(d: Delta, frameId: number): Delta {
  return {
    added: d.added.map((o) => rekey(o, frameId)),
    updated: d.updated.map((o) => rekey(o, frameId)),
    removed: d.removed.map((id) => `${frameId}:${id.slice(id.indexOf(':') + 1)}`),
  };
}

function send(msg: ContentToBackground): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* service worker reiniciando; o próximo envio recupera o estado */
  });
}

export class ContentAgent {
  private controller: FrameController | null = null;
  private settings: Settings | null = null;
  private enabled = false;
  private readonly ports = new Set<chrome.runtime.Port>();
  private readonly remote = new Map<number, RemoteFrame>();
  private badgeTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private navCursor: string | null = null;
  private readonly sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private readonly startedAt = Date.now();
  private readonly origin: string;

  constructor(
    private readonly doc: Document,
    private readonly isTopFrame: boolean,
  ) {
    this.origin = doc.location.origin;
  }

  async init(): Promise<void> {
    chrome.storage.onChanged.addListener(this.onStorageChanged);
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    if (this.isTopFrame) chrome.runtime.onConnect.addListener(this.onConnect);
    this.doc.defaultView?.addEventListener('pagehide', () => {
      if (!this.isTopFrame) send({ type: 'frame:report', payload: { kind: 'gone' } });
    });
    await this.refresh();
  }

  /** Relê preferências e liga/desliga a verificação. */
  private async refresh(): Promise<void> {
    const [settings, lists] = await Promise.all([loadSettings(), loadOriginLists()]);
    const prevSettings = this.settings;
    this.settings = settings;
    const shouldRun = isOriginEnabled(this.origin, lists);
    if (shouldRun && !this.controller) this.startController(settings);
    else if (!shouldRun && this.controller) this.stopController();
    else if (this.controller && prevSettings) {
      if (prevSettings.overlayVisible !== settings.overlayVisible) {
        this.controller.overlay.setVisible(settings.overlayVisible);
      }
      if (prevSettings.debounceMs !== settings.debounceMs) {
        this.stopController();
        this.startController(settings);
      }
    }
    this.controller?.instrumentation.setLogEnabled(settings.experimentMode);
    this.enabled = shouldRun;
    this.broadcastStatus();
    if (settings.experimentMode) this.scheduleSave();
  }

  private startController(settings: Settings): void {
    const c = new FrameController({
      doc: this.doc,
      isTopFrame: this.isTopFrame,
      debounceMs: settings.debounceMs,
      maxWaitMs: settings.debounceMs * 2,
      sliceBudgetMs: SLICE_BUDGET_MS,
      overlayVisible: settings.overlayVisible,
      onDelta: (delta) => {
        this.onLocalDelta(delta);
      },
      onIdle: () => {
        this.onLocalIdle();
      },
    });
    c.instrumentation.setLogEnabled(settings.experimentMode);
    this.controller = c;
    this.enabled = true;
    // Anuncia o frame ao topo antes de iniciar: uma varredura curta pode
    // terminar de forma síncrona e reportar "ocioso" dentro de start().
    if (!this.isTopFrame)
      this.reportToTop({
        kind: 'snapshot',
        occurrences: [],
        idle: false,
        url: this.doc.location.href,
      });
    c.start();
  }

  private stopController(): void {
    const c = this.controller;
    this.controller = null;
    this.enabled = false;
    c?.stop();
    if (this.isTopFrame) {
      this.remote.clear();
      this.postAll({ type: 'snapshot', state: this.tabState() });
      this.scheduleBadge();
    } else {
      this.reportToTop({ kind: 'gone' });
    }
  }

  // -------------------------------------------------------------------------
  // Deltas locais e de frames filhos
  // -------------------------------------------------------------------------

  private onLocalDelta(delta: Delta): void {
    if (!this.isTopFrame) {
      this.reportToTop({ kind: 'delta', delta, idle: this.controller?.idle ?? true });
      return;
    }
    this.postAll({ type: 'delta', delta, scanning: !this.isIdle() });
    this.scheduleBadge();
    if (this.settings?.experimentMode) this.scheduleSave();
  }

  private onLocalIdle(): void {
    if (!this.isTopFrame) {
      // Snapshot completo: cobre deltas perdidos se o frame de topo ainda não
      // estava escutando quando este frame começou.
      this.reportToTop({
        kind: 'snapshot',
        occurrences: this.controller?.occurrences() ?? [],
        idle: true,
        url: this.doc.location.href,
      });
      return;
    }
    this.broadcastStatus();
  }

  private reportToTop(payload: FramePayload): void {
    send({ type: 'frame:report', payload });
  }

  private onRemote(frameId: number, payload: FramePayload): void {
    if (!this.isTopFrame) return;
    let frame = this.remote.get(frameId);
    let delta: Delta = EMPTY_DELTA;
    if (payload.kind === 'gone') {
      if (frame)
        delta = { added: [], updated: [], removed: [...frame.occurrences.keys()] };
      this.remote.delete(frameId);
    } else if (payload.kind === 'snapshot') {
      const prev = frame?.occurrences ?? new Map<string, Occurrence>();
      const next = payload.occurrences.map((o) => rekey(o, frameId));
      frame = { occurrences: new Map(next.map((o) => [o.id, o])), idle: payload.idle };
      this.remote.set(frameId, frame);
      delta = {
        added: next.filter((o) => !prev.has(o.id)),
        updated: next.filter((o) => prev.has(o.id)),
        removed: [...prev.keys()].filter((id) => !frame?.occurrences.has(id)),
      };
    } else {
      if (!frame) {
        frame = { occurrences: new Map(), idle: payload.idle };
        this.remote.set(frameId, frame);
      }
      frame.idle = payload.idle;
      delta = rekeyDelta(payload.delta, frameId);
      applyDelta(frame.occurrences, delta);
    }
    if (!isEmptyDelta(delta)) {
      this.postAll({ type: 'delta', delta, scanning: !this.isIdle() });
      this.scheduleBadge();
    } else {
      this.broadcastStatus();
    }
  }

  // -------------------------------------------------------------------------
  // Estado agregado
  // -------------------------------------------------------------------------

  private allOccurrences(): Occurrence[] {
    const own = this.controller?.occurrences() ?? [];
    const out = [...own];
    for (const f of this.remote.values()) out.push(...f.occurrences.values());
    return out;
  }

  private isIdle(): boolean {
    if (this.controller && !this.controller.idle) return false;
    for (const f of this.remote.values()) if (!f.idle) return false;
    return true;
  }

  private tabState(): TabState {
    return {
      origin: this.origin,
      url: this.doc.location.href,
      enabled: this.enabled,
      scanning: !this.isIdle(),
      overlayVisible:
        this.controller?.overlay.isVisible ?? this.settings?.overlayVisible ?? true,
      experimentMode: this.settings?.experimentMode ?? false,
      occurrences: this.allOccurrences(),
    };
  }

  private experimentData(): ExperimentData {
    const instr = this.controller?.instrumentation;
    return {
      sessionId: this.sessionId,
      pageUrl: this.doc.location.href,
      startedAt: this.startedAt,
      extensionVersion: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent,
      occurrences: this.allOccurrences(),
      log: instr?.log ?? [],
      initialScan: instr?.initialScan ?? null,
      batches: instr?.batches ?? [],
      dynamicEvents: instr?.dynamicEvents() ?? [],
    };
  }

  private broadcastStatus(): void {
    if (!this.isTopFrame) return;
    this.postAll({
      type: 'status',
      scanning: !this.isIdle(),
      overlayVisible:
        this.controller?.overlay.isVisible ?? this.settings?.overlayVisible ?? true,
      experimentMode: this.settings?.experimentMode ?? false,
      enabled: this.enabled,
    });
  }

  private scheduleBadge(): void {
    if (!this.isTopFrame || this.badgeTimer !== undefined) return;
    this.badgeTimer = setTimeout(() => {
      this.badgeTimer = undefined;
      const count = this.allOccurrences().filter((o) => o.outcome === 'violation').length;
      send({ type: 'badge', count });
    }, BADGE_THROTTLE_MS);
  }

  private scheduleSave(): void {
    if (!this.isTopFrame) return;
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      if (!this.settings?.experimentMode) return;
      const key = `${STORAGE_KEYS.experimentPrefix}${this.sessionId}`;
      chrome.storage.local.set({ [key]: this.experimentData() }).catch((err: unknown) => {
        console.warn('[a11y-rt] falha ao gravar dados do experimento:', err);
      });
    }, EXPERIMENT_SAVE_DELAY_MS);
  }

  // -------------------------------------------------------------------------
  // Side panel (Port)
  // -------------------------------------------------------------------------

  private readonly onConnect = (port: chrome.runtime.Port): void => {
    if (port.name !== PANEL_PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
    this.ports.add(port);
    port.onDisconnect.addListener(() => {
      this.ports.delete(port);
    });
    port.onMessage.addListener((msg: unknown) => {
      if (isPanelToContent(msg)) this.onPanelMessage(port, msg);
    });
    this.post(port, { type: 'snapshot', state: this.tabState() });
  };

  private post(port: chrome.runtime.Port, msg: ContentToPanel): void {
    try {
      port.postMessage(msg);
    } catch {
      this.ports.delete(port);
    }
  }

  private postAll(msg: ContentToPanel): void {
    for (const p of this.ports) this.post(p, msg);
  }

  private onPanelMessage(port: chrome.runtime.Port, msg: PanelToContent): void {
    switch (msg.type) {
      case 'panel:hello':
        this.post(port, { type: 'snapshot', state: this.tabState() });
        break;
      case 'panel:focus':
        this.focusOccurrence(msg.id, { focusCard: false, focusElement: true });
        break;
      case 'panel:set-overlay':
        this.controller?.overlay.setVisible(msg.visible);
        void saveSettings({ overlayVisible: msg.visible });
        break;
      case 'panel:export':
        this.post(port, {
          type: 'export',
          requestId: msg.requestId,
          data: this.experimentData(),
        });
        break;
      case 'panel:rescan':
        this.controller?.rescan();
        break;
    }
  }

  private focusOccurrence(
    id: string,
    opts: { focusCard: boolean; focusElement: boolean },
  ): boolean {
    const frameId = Number(id.slice(0, id.indexOf(':')));
    if (frameId === 0 || Number.isNaN(frameId)) {
      return this.controller?.overlay.focusOccurrence(id, opts) ?? false;
    }
    // Ocorrência de um iframe: o frame filho rola e abre o cartão.
    const local = `0:${id.slice(id.indexOf(':') + 1)}`;
    send({ type: 'frame:forward', frameId, payload: { kind: 'focus', localId: local } });
    return true;
  }

  // -------------------------------------------------------------------------
  // Mensagens do service worker (atalhos, retransmissões, diagnóstico)
  // -------------------------------------------------------------------------

  private readonly onRuntimeMessage = (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ): boolean | undefined => {
    if (sender.id !== chrome.runtime.id) return undefined;
    if (isDebugRequest(msg)) {
      if (!this.isTopFrame) return undefined;
      if (msg.type === 'debug:state') sendResponse(this.debugState());
      else if (msg.type === 'debug:overlay')
        sendResponse(this.controller?.overlay.debugState() ?? null);
      else
        sendResponse(
          this.focusOccurrence(msg.id, { focusCard: true, focusElement: false }),
        );
      return undefined;
    }
    if (!isBackgroundToContent(msg)) return undefined;
    this.onBackgroundMessage(msg);
    return undefined;
  };

  private onBackgroundMessage(msg: BackgroundToContent): void {
    switch (msg.type) {
      case 'command':
        this.runCommand(msg.command);
        break;
      case 'frame:relay':
        this.onRemote(msg.frameId, msg.payload);
        break;
      case 'frame:command':
        this.controller?.overlay.focusOccurrence(msg.payload.localId, {
          focusCard: false,
          focusElement: true,
        });
        break;
      case 'origin:changed':
        void this.refresh();
        break;
    }
  }

  private runCommand(command: CommandName): void {
    const c = this.controller;
    if (!c) return;
    if (command === 'toggle-overlay') {
      const visible = !c.overlay.isVisible;
      c.overlay.setVisible(visible);
      c.overlay.announce(t(visible ? 'overlay_shown' : 'overlay_hidden'));
      void saveSettings({ overlayVisible: visible });
      this.broadcastStatus();
      return;
    }
    const list = this.navigationOrder(c);
    if (list.length === 0) {
      c.overlay.announce(t('nav_none'));
      return;
    }
    const idx = this.navCursor ? list.findIndex((o) => o.id === this.navCursor) : -1;
    const step = command === 'next-violation' ? 1 : -1;
    const nextIdx =
      idx < 0
        ? step > 0
          ? 0
          : list.length - 1
        : (idx + step + list.length) % list.length;
    const target = list[nextIdx];
    if (!target) return;
    this.navCursor = target.id;
    c.overlay.focusOccurrence(target.id, { focusCard: true, focusElement: false });
    c.overlay.announce(t('nav_position', { index: nextIdx + 1, total: list.length }));
  }

  /** Violações deste frame em ordem de documento (as de página primeiro). */
  private navigationOrder(c: FrameController): Occurrence[] {
    const occs = c.occurrences().filter((o) => o.outcome === 'violation');
    const page = occs.filter((o) => o.pageLevel);
    const withEl = occs
      .filter((o) => !o.pageLevel)
      .map((o) => ({ o, el: c.registry.elementFor(o.id) }))
      .filter((x): x is { o: Occurrence; el: Element } => x.el !== undefined);
    withEl.sort((a, b) => {
      if (a.el === b.el) return a.o.wcag.localeCompare(b.o.wcag);
      return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    return [...page, ...withEl.map((x) => x.o)];
  }

  private debugState(): DebugState {
    let framesPending = 0;
    for (const f of this.remote.values()) if (!f.idle) framesPending++;
    return {
      idle: this.isIdle(),
      enabled: this.enabled,
      batches: this.controller?.batchCount ?? 0,
      framesPending,
      occurrences: this.allOccurrences(),
      instrumentation: this.experimentData(),
    };
  }

  private readonly onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== 'local') return;
    if (
      STORAGE_KEYS.settings in changes ||
      STORAGE_KEYS.disabledOrigins in changes ||
      STORAGE_KEYS.enabledOrigins in changes
    ) {
      void this.refresh();
    }
  };
}
