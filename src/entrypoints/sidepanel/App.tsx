import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { applyDelta } from '../../core/registry';
import {
  browserVersionFromUA,
  dynamicCsv,
  experimentJson,
  occurrencesCsv,
  performanceCsv,
  type ExportEnv,
} from '../../lib/export';
import { formatValue, localizeData, t } from '../../lib/i18n';
import {
  isDefaultOrigin,
  loadSettings,
  originPattern,
  saveSettings,
  STORAGE_KEYS,
} from '../../lib/settings';
import {
  isContentToPanel,
  PANEL_PORT_NAME,
  type ContentToPanel,
  type ExperimentData,
  type Occurrence,
  type PanelToBackground,
  type PanelToContent,
} from '../../messaging/protocol';
import { CRITERIA, CRITERIA_ORDER } from '../../rules/catalog';
import type { ReportedOutcome } from '../../rules/types';

type Conn = 'connecting' | 'connected' | 'unavailable';

interface Status {
  origin: string;
  url: string;
  enabled: boolean;
  scanning: boolean;
  overlayVisible: boolean;
  experimentMode: boolean;
}

const OUTCOMES: readonly ReportedOutcome[] = [
  'violation',
  'recommendation',
  'incomplete',
];
const LEVELS = ['A', 'AA'] as const;
const ANNOUNCE_THROTTLE_MS = 2000;

/** `?tabId=` permite abrir o painel como página comum (testes de UI). */
function fixedTabId(): number | null {
  const v = new URLSearchParams(location.search).get('tabId');
  const n = v === null ? NaN : Number(v);
  return Number.isInteger(n) ? n : null;
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

/** URL guardada pelo service worker quando o usuário clicou no ícone nesta aba. */
async function actionTabUrl(tabId: number): Promise<string | null> {
  const key = `${STORAGE_KEYS.actionTabPrefix}${String(tabId)}`;
  try {
    const v = (await chrome.storage.session.get(key))[key];
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

async function exportEnv(): Promise<ExportEnv> {
  let browserVersion = browserVersionFromUA(navigator.userAgent);
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues(
          h: string[],
        ): Promise<{ fullVersionList?: { brand: string; version: string }[] }>;
      };
    }
  ).userAgentData;
  try {
    const hv = await uaData?.getHighEntropyValues(['fullVersionList']);
    const brand = hv?.fullVersionList?.find(
      (b) => /Chrome|Chromium|Edge|Opera/i.test(b.brand) && !/Not/i.test(b.brand),
    );
    if (brand) browserVersion = `${brand.brand} ${brand.version}`;
  } catch {
    /* mantém o valor do user agent */
  }
  return { extensionVersion: chrome.runtime.getManifest().version, browserVersion };
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function fileStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Primeira mensagem "o que está errado" da ocorrência. */
function summaryOf(o: Occurrence): string {
  const rule = o.rules.find((r) => r.outcome === o.outcome) ?? o.rules[0];
  if (!rule) return '';
  return t(`${rule.messageKey}_what`, localizeData(rule.data));
}

export function App(): JSX.Element {
  const [tabId, setTabId] = useState<number | null>(fixedTabId());
  const [conn, setConn] = useState<Conn>('connecting');
  const [status, setStatus] = useState<Status | null>(null);
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const occMap = useRef(new Map<string, Occurrence>());
  const [version, setVersion] = useState(0);
  const [outcomes, setOutcomes] = useState<Set<ReportedOutcome>>(
    new Set(['violation', 'recommendation']),
  );
  const [levels, setLevels] = useState<Set<string>>(new Set(LEVELS));
  const [criteria, setCriteria] = useState<Set<string>>(new Set(CRITERIA_ORDER));
  const [message, setMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [savedSessions, setSavedSessions] = useState(0);
  const [experimentMode, setExperimentMode] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const exportWaiters = useRef(new Map<number, (d: ExperimentData) => void>());
  const exportSeq = useRef(0);
  const lastAnnounce = useRef(0);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Aba acompanhada: a ativa da janela (ou a fixada por ?tabId=).
  useEffect(() => {
    if (fixedTabId() !== null) return undefined;
    void activeTabId().then(setTabId);
    const onActivated = (info: { tabId: number }): void => {
      setTabId(info.tabId);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  const refreshSaved = useCallback(async () => {
    const all = await chrome.storage.local.get(null);
    setSavedSessions(
      Object.keys(all).filter((k) => k.startsWith(STORAGE_KEYS.experimentPrefix)).length,
    );
  }, []);

  useEffect(() => {
    void loadSettings().then((s) => {
      setExperimentMode(s.experimentMode);
    });
    void refreshSaved();
  }, [refreshSaved]);

  const onMessage = useCallback((msg: ContentToPanel) => {
    switch (msg.type) {
      case 'snapshot': {
        const s = msg.state;
        occMap.current = new Map(s.occurrences.map((o) => [o.id, o]));
        setStatus({
          origin: s.origin,
          url: s.url,
          enabled: s.enabled,
          scanning: s.scanning,
          overlayVisible: s.overlayVisible,
          experimentMode: s.experimentMode,
        });
        setVersion((v) => v + 1);
        break;
      }
      case 'delta':
        applyDelta(occMap.current, msg.delta);
        setStatus((s) => (s ? { ...s, scanning: msg.scanning } : s));
        setVersion((v) => v + 1);
        break;
      case 'status':
        setStatus((s) =>
          s
            ? {
                ...s,
                scanning: msg.scanning,
                overlayVisible: msg.overlayVisible,
                experimentMode: msg.experimentMode,
                enabled: msg.enabled,
              }
            : s,
        );
        break;
      case 'export': {
        const waiter = exportWaiters.current.get(msg.requestId);
        exportWaiters.current.delete(msg.requestId);
        waiter?.(msg.data);
        break;
      }
    }
  }, []);

  // Conexão (Port) com o content script do frame de topo da aba.
  const connect = useCallback(
    (id: number) => {
      portRef.current?.disconnect();
      setConn('connecting');
      setStatus(null);
      occMap.current = new Map();
      setVersion((v) => v + 1);
      let port: chrome.runtime.Port;
      try {
        port = chrome.tabs.connect(id, { name: PANEL_PORT_NAME, frameId: 0 });
      } catch {
        setConn('unavailable');
        return;
      }
      portRef.current = port;
      port.onMessage.addListener((msg: unknown) => {
        if (!isContentToPanel(msg)) return;
        setConn('connected');
        onMessage(msg);
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          // Conexão recusada: não há content script nesta aba (lido para não gerar aviso).
        }
        if (portRef.current === port) {
          portRef.current = null;
          setConn('unavailable');
          setStatus(null);
        }
      });
      // tab.url só vem com permissão de host na origem; senão, a URL lida no
      // clique do ícone (activeTab), guardada pelo service worker.
      void chrome.tabs.get(id).then(
        async (tab) => {
          setTabUrl(tab.url ?? (await actionTabUrl(id)));
        },
        () => {
          setTabUrl(null);
        },
      );
    },
    [onMessage],
  );

  // Clique no ícone com o painel já aberto: a URL chega pelo storage.session.
  useEffect(() => {
    if (tabId === null) return undefined;
    const key = `${STORAGE_KEYS.actionTabPrefix}${String(tabId)}`;
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>): void => {
      const change = changes[key];
      if (change === undefined) return;
      const v: unknown = change.newValue;
      if (typeof v === 'string') setTabUrl(v);
    };
    chrome.storage.session.onChanged.addListener(onChanged);
    return () => {
      chrome.storage.session.onChanged.removeListener(onChanged);
    };
  }, [tabId]);

  useEffect(() => {
    if (tabId === null) return undefined;
    connect(tabId);
    const onUpdated = (id: number, info: { status?: string }): void => {
      if (id === tabId && info.status === 'complete') connect(id);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, [tabId, connect]);

  const post = (msg: PanelToContent): void => {
    try {
      portRef.current?.postMessage(msg);
    } catch {
      setConn('unavailable');
    }
  };

  const all = useMemo(() => [...occMap.current.values()], [version]);
  const counts = useMemo(() => {
    const c: Record<ReportedOutcome, number> = {
      violation: 0,
      recommendation: 0,
      incomplete: 0,
    };
    for (const o of all) c[o.outcome]++;
    return c;
  }, [all]);

  // Anúncio das contagens (aria-live="polite", com throttle).
  useEffect(() => {
    if (!status) return;
    const text = t('panel_counts_announcement', {
      violations: counts.violation,
      recommendations: counts.recommendation,
    });
    const now = Date.now();
    const wait = Math.max(0, lastAnnounce.current + ANNOUNCE_THROTTLE_MS - now);
    if (announceTimer.current !== undefined) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => {
      lastAnnounce.current = Date.now();
      setAnnouncement(text);
    }, wait);
  }, [counts.violation, counts.recommendation, status !== null]);

  const filtered = useMemo(
    () =>
      all.filter(
        (o) => outcomes.has(o.outcome) && levels.has(o.level) && criteria.has(o.wcag),
      ),
    [all, outcomes, levels, criteria],
  );
  const groups = useMemo(() => {
    const by = new Map<string, Occurrence[]>();
    for (const o of filtered) {
      const list = by.get(o.wcag);
      if (list) list.push(o);
      else by.set(o.wcag, [o]);
    }
    return CRITERIA_ORDER.filter((c) => by.has(c)).map((c) => ({
      wcag: c,
      items: (by.get(c) ?? []).sort((a, b) => a.selector.localeCompare(b.selector)),
    }));
  }, [filtered]);

  const toggleIn = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void): void => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const setOrigin = async (enable: boolean): Promise<void> => {
    if (tabId === null) return;
    const origin = status?.origin ?? (tabUrl ? new URL(tabUrl).origin : null);
    if (!origin) return;
    if (enable && !isDefaultOrigin(origin)) {
      // Pedido de permissão por origem, no gesto do usuário.
      const granted = await chrome.permissions.request({
        origins: [originPattern(origin)],
      });
      if (!granted) {
        setMessage(t('panel_permission_denied'));
        return;
      }
    }
    const msg: PanelToBackground = {
      type: enable ? 'origin:enable' : 'origin:disable',
      tabId,
      origin,
    };
    await chrome.runtime.sendMessage(msg);
    setMessage(
      t(enable ? 'panel_enabled_message' : 'panel_disabled_message', { origin }),
    );
    setTimeout(() => {
      connect(tabId);
    }, 300);
  };

  const requestExport = (): Promise<ExperimentData> =>
    new Promise((resolve, reject) => {
      const id = ++exportSeq.current;
      exportWaiters.current.set(id, resolve);
      post({ type: 'panel:export', requestId: id });
      setTimeout(() => {
        if (exportWaiters.current.delete(id)) reject(new Error('timeout'));
      }, 5000);
    });

  const doExport = async (kind: 'json' | 'occ' | 'dyn' | 'perf'): Promise<void> => {
    try {
      const [data, env] = await Promise.all([requestExport(), exportEnv()]);
      const stamp = fileStamp();
      if (kind === 'json')
        download(`a11y-rt-${stamp}.json`, experimentJson(data, env), 'application/json');
      if (kind === 'occ')
        download(
          `a11y-rt-ocorrencias-${stamp}.csv`,
          occurrencesCsv(data, env),
          'text/csv',
        );
      if (kind === 'dyn')
        download(`a11y-rt-teste-dinamico-${stamp}.csv`, dynamicCsv(data), 'text/csv');
      if (kind === 'perf')
        download(`a11y-rt-desempenho-${stamp}.csv`, performanceCsv(data), 'text/csv');
      setMessage(t('panel_export_done'));
    } catch {
      setMessage(t('panel_export_failed'));
    }
  };

  const exportSaved = async (): Promise<void> => {
    const all = await chrome.storage.local.get(null);
    const env = await exportEnv();
    const sessions = Object.entries(all)
      .filter(([k]) => k.startsWith(STORAGE_KEYS.experimentPrefix))
      .map(([, v]) => JSON.parse(experimentJson(v as ExperimentData, env)) as unknown);
    download(
      `a11y-rt-sessoes-${fileStamp()}.json`,
      JSON.stringify(sessions, null, 2),
      'application/json',
    );
    setMessage(t('panel_export_done'));
  };

  const clearSaved = async (): Promise<void> => {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(
      Object.keys(all).filter((k) => k.startsWith(STORAGE_KEYS.experimentPrefix)),
    );
    await refreshSaved();
    setMessage(t('panel_sessions_cleared'));
  };

  const toggleExperiment = async (): Promise<void> => {
    const s = await saveSettings({ experimentMode: !experimentMode });
    setExperimentMode(s.experimentMode);
    setMessage(t(s.experimentMode ? 'panel_experiment_on' : 'panel_experiment_off'));
    setTimeout(() => void refreshSaved(), 2500);
  };

  const copySelector = async (selector: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(selector);
      setMessage(t('panel_copied'));
    } catch {
      setMessage(t('panel_copy_failed'));
    }
  };

  const origin = status?.origin ?? (tabUrl ? safeOrigin(tabUrl) : null);

  return (
    <>
      <header class="top">
        <h1>{t('panel_title')}</h1>
        <p class="origin">
          {origin ? t('panel_origin', { origin }) : t('panel_no_page')}
          {status?.scanning ? (
            <span class="scanning"> · {t('panel_scanning')}</span>
          ) : null}
        </p>
      </header>
      <main>
        <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <p class="message" role="status" aria-live="polite">
          {message}
        </p>

        <section aria-labelledby="sec-check">
          <h2 id="sec-check">{t('panel_section_check')}</h2>
          {conn === 'connected' && status ? (
            <div class="row">
              <button
                type="button"
                aria-pressed={status.enabled}
                onClick={() => void setOrigin(!status.enabled)}
              >
                {t('panel_toggle_origin')}
              </button>
              <button
                type="button"
                aria-pressed={status.overlayVisible}
                disabled={!status.enabled}
                onClick={() => {
                  post({ type: 'panel:set-overlay', visible: !status.overlayVisible });
                  setStatus({ ...status, overlayVisible: !status.overlayVisible });
                }}
              >
                {t('panel_toggle_overlay')}
              </button>
              <button
                type="button"
                disabled={!status.enabled}
                onClick={() => {
                  post({ type: 'panel:rescan' });
                }}
              >
                {t('panel_rescan')}
              </button>
            </div>
          ) : conn === 'connecting' ? (
            <p>{t('panel_connecting')}</p>
          ) : (
            <div>
              <p>{origin ? t('panel_inactive', { origin }) : t('panel_no_access')}</p>
              {origin && /^https?:/.test(origin) ? (
                <button type="button" onClick={() => void setOrigin(true)}>
                  {t('panel_enable_origin', { origin })}
                </button>
              ) : null}
            </div>
          )}
        </section>

        {conn === 'connected' && status?.enabled ? (
          <>
            <section aria-labelledby="sec-summary">
              <h2 id="sec-summary">{t('panel_section_summary')}</h2>
              <ul class="counts">
                {OUTCOMES.map((o) => (
                  <li key={o} class={`count ${o}`}>
                    <span class="num">{formatValue(counts[o])}</span>{' '}
                    {t(`panel_count_${o}`)}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sec-filters">
              <h2 id="sec-filters">{t('panel_section_filters')}</h2>
              <div class="filters">
                <fieldset>
                  <legend>{t('panel_filter_outcome')}</legend>
                  {OUTCOMES.map((o) => (
                    <label key={o}>
                      <input
                        type="checkbox"
                        checked={outcomes.has(o)}
                        onChange={() => {
                          toggleIn(outcomes, o, setOutcomes);
                        }}
                      />{' '}
                      {t(`outcome_${o}`)}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>{t('panel_filter_level')}</legend>
                  {LEVELS.map((l) => (
                    <label key={l}>
                      <input
                        type="checkbox"
                        checked={levels.has(l)}
                        onChange={() => {
                          toggleIn(levels, l, setLevels);
                        }}
                      />{' '}
                      {l}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>{t('panel_filter_criterion')}</legend>
                  {CRITERIA_ORDER.map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox"
                        checked={criteria.has(c)}
                        onChange={() => {
                          toggleIn(criteria, c, setCriteria);
                        }}
                      />{' '}
                      {c} {t(CRITERIA[c]?.nameKey ?? c)}
                    </label>
                  ))}
                </fieldset>
              </div>
            </section>

            <section aria-labelledby="sec-results">
              <h2 id="sec-results">
                {t('panel_section_results')} ({formatValue(filtered.length)})
              </h2>
              {groups.length === 0 ? <p>{t('panel_no_results')}</p> : null}
              {groups.map((g) => (
                <section key={g.wcag} class="group" aria-labelledby={`grp-${g.wcag}`}>
                  <h3 id={`grp-${g.wcag}`}>
                    {g.wcag} {t(CRITERIA[g.wcag]?.nameKey ?? g.wcag)} (
                    {CRITERIA[g.wcag]?.level}) —{' '}
                    {t('panel_group_count', { count: g.items.length })}
                  </h3>
                  <ul class="items">
                    {g.items.map((o) => (
                      <li key={o.id} class={`item ${o.outcome}`}>
                        <p class="summary">
                          <span class={`tag ${o.outcome}`}>
                            {t(`outcome_${o.outcome}`)}
                          </span>{' '}
                          {summaryOf(o)}
                        </p>
                        <p class="selector">
                          <code>{o.selector}</code>
                          {o.frameId !== 0 ? (
                            <span class="frame"> ({t('panel_in_iframe')})</span>
                          ) : null}
                        </p>
                        <div class="row">
                          <button
                            type="button"
                            onClick={() => {
                              post({ type: 'panel:focus', id: o.id });
                            }}
                            aria-describedby={`sel-${o.id}`}
                          >
                            {t('panel_go_to')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copySelector(o.selector)}
                            aria-describedby={`sel-${o.id}`}
                          >
                            {t('panel_copy_selector')}
                          </button>
                          <span id={`sel-${o.id}`} class="sr-only">
                            {`${g.wcag}: ${o.selector}`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          </>
        ) : null}

        <section aria-labelledby="sec-exp">
          <h2 id="sec-exp">{t('panel_section_experiment')}</h2>
          <p class="hint">{t('panel_experiment_hint')}</p>
          <button
            type="button"
            aria-pressed={experimentMode}
            onClick={() => void toggleExperiment()}
          >
            {t('panel_toggle_experiment')}
          </button>
          {experimentMode ? (
            <div class="exports">
              <h3>{t('panel_export_current')}</h3>
              <div class="row">
                <button
                  type="button"
                  disabled={conn !== 'connected'}
                  onClick={() => void doExport('json')}
                >
                  {t('panel_export_json')}
                </button>
                <button
                  type="button"
                  disabled={conn !== 'connected'}
                  onClick={() => void doExport('occ')}
                >
                  {t('panel_export_occ_csv')}
                </button>
                <button
                  type="button"
                  disabled={conn !== 'connected'}
                  onClick={() => void doExport('dyn')}
                >
                  {t('panel_export_dyn_csv')}
                </button>
                <button
                  type="button"
                  disabled={conn !== 'connected'}
                  onClick={() => void doExport('perf')}
                >
                  {t('panel_export_perf_csv')}
                </button>
              </div>
              <h3>{t('panel_saved_sessions', { count: savedSessions })}</h3>
              <div class="row">
                <button
                  type="button"
                  disabled={savedSessions === 0}
                  onClick={() => void exportSaved()}
                >
                  {t('panel_export_saved')}
                </button>
                <button
                  type="button"
                  disabled={savedSessions === 0}
                  onClick={() => void clearSaved()}
                >
                  {t('panel_clear_saved')}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="sec-keys">
          <h2 id="sec-keys">{t('panel_section_shortcuts')}</h2>
          <ul class="keys">
            <li>
              <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> — {t('cmdNext')}
            </li>
            <li>
              <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> — {t('cmdPrev')}
            </li>
            <li>
              <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> — {t('cmdToggleOverlay')}
            </li>
            <li>
              <kbd>Esc</kbd> — {t('panel_shortcut_esc')}
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}

function safeOrigin(url: string): string | null {
  try {
    const o = new URL(url).origin;
    return o === 'null' ? null : o;
  } catch {
    return null;
  }
}
