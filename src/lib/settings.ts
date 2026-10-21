/**
 * Preferências persistidas em `chrome.storage.local` (lidas por content
 * script, service worker e side panel).
 */

export interface Settings {
  /** Contornos e cartões visíveis na página. */
  readonly overlayVisible: boolean;
  /** Grava ocorrências e tempos para exportação (estudo experimental). */
  readonly experimentMode: boolean;
  /** Debounce do MutationObserver (ms). */
  readonly debounceMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  overlayVisible: true,
  experimentMode: false,
  debounceMs: 150,
};

export const STORAGE_KEYS = {
  settings: 'settings',
  disabledOrigins: 'disabledOrigins',
  enabledOrigins: 'enabledOrigins',
  experimentPrefix: 'experiment:',
  /** `chrome.storage.session`: URL da aba lida no clique do ícone (activeTab). */
  actionTabPrefix: 'actionTab:',
} as const;

/** Origens verificadas por padrão (host_permissions do manifest). */
export function isDefaultOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

/** Padrão de correspondência (match pattern) para uma origem. */
export function originPattern(origin: string): string {
  const u = new URL(origin);
  return `${u.protocol}//${u.hostname}/*`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function normalizeSettings(v: unknown): Settings {
  const r = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  const debounce =
    typeof r.debounceMs === 'number' && r.debounceMs >= 0 && r.debounceMs <= 5000
      ? r.debounceMs
      : DEFAULT_SETTINGS.debounceMs;
  return {
    overlayVisible:
      typeof r.overlayVisible === 'boolean'
        ? r.overlayVisible
        : DEFAULT_SETTINGS.overlayVisible,
    experimentMode:
      typeof r.experimentMode === 'boolean'
        ? r.experimentMode
        : DEFAULT_SETTINGS.experimentMode,
    debounceMs: debounce,
  };
}

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(r[STORAGE_KEYS.settings]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export interface OriginLists {
  readonly disabled: string[];
  readonly enabled: string[];
}

export async function loadOriginLists(): Promise<OriginLists> {
  const r = await chrome.storage.local.get([
    STORAGE_KEYS.disabledOrigins,
    STORAGE_KEYS.enabledOrigins,
  ]);
  return {
    disabled: asStringArray(r[STORAGE_KEYS.disabledOrigins]),
    enabled: asStringArray(r[STORAGE_KEYS.enabledOrigins]),
  };
}

export function isOriginEnabled(origin: string, lists: OriginLists): boolean {
  if (isDefaultOrigin(origin)) return !lists.disabled.includes(origin);
  return lists.enabled.includes(origin);
}

export async function setOriginEnabled(origin: string, enabled: boolean): Promise<void> {
  const lists = await loadOriginLists();
  const disabled = new Set(lists.disabled);
  const en = new Set(lists.enabled);
  if (enabled) {
    disabled.delete(origin);
    if (!isDefaultOrigin(origin)) en.add(origin);
  } else {
    disabled.add(origin);
    en.delete(origin);
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.disabledOrigins]: [...disabled].sort(),
    [STORAGE_KEYS.enabledOrigins]: [...en].sort(),
  });
}
