/**
 * Overlay: host próprio `<a11y-rt-overlay>` anexado a `<html>`, com Shadow
 * DOM fechado (aberto apenas no build de teste), `position: fixed`,
 * `pointer-events: none` e z-index máximo. Nenhum estilo, classe ou atributo
 * é escrito nos elementos da página.
 *
 * Renderização em `requestAnimationFrame`: primeiro todas as leituras de
 * geometria, depois todas as escritas (apenas dentro do host).
 */
import { OVERLAY_TAG } from '../lib/dom';
import { rectFrom, type Rect } from '../lib/geometry';
import { t } from '../lib/i18n';
import type { DebugOverlayState, Occurrence } from '../messaging/protocol';
import { buildCardContent } from './card';
import { Marker } from './outline';
import { OVERLAY_CSS } from './styles';

export interface OverlayOptions {
  readonly doc: Document;
  readonly elementFor: (id: string) => Element | undefined;
  readonly onPainted: (now: number) => void;
}

interface CardState {
  ids: string[];
  anchor: HTMLElement;
  origin: Element | null;
}

const HOST_STYLE = [
  'all: initial !important',
  'position: fixed !important',
  'left: 0 !important',
  'top: 0 !important',
  'width: 0 !important',
  'height: 0 !important',
  'overflow: visible !important',
  'z-index: 2147483647 !important',
  'pointer-events: none !important',
  'display: block !important',
].join('; ');

const REPOSITION_INTERVAL_MS = 500;
const HOVER_CLOSE_DELAY_MS = 300;

export class Overlay {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private readonly layer: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly pageBadge: HTMLButtonElement;
  private readonly live: HTMLDivElement;
  private readonly markers = new Map<Element, Marker>();
  private pageOccurrences: Occurrence[] = [];
  private occurrencesById = new Map<string, Occurrence>();
  private cardState: CardState | null = null;
  private visible = true;
  private rafId: number | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly ro: ResizeObserver;
  private destroyed = false;
  private cardSeq = 0;

  constructor(private readonly opts: OverlayOptions) {
    this.doc = opts.doc;
    this.win = opts.doc.defaultView ?? window;
    this.host = this.doc.createElement(OVERLAY_TAG);
    this.host.setAttribute('style', HOST_STYLE);
    this.shadow = this.host.attachShadow({ mode: __A11Y_RT_TEST__ ? 'open' : 'closed' });
    const style = this.doc.createElement('style');
    style.textContent = OVERLAY_CSS;
    this.layer = this.doc.createElement('div');
    this.layer.className = 'layer';
    this.card = this.doc.createElement('div');
    this.card.className = 'card';
    this.card.hidden = true;
    this.card.tabIndex = -1;
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'false');
    this.pageBadge = this.doc.createElement('button');
    this.pageBadge.type = 'button';
    this.pageBadge.className = 'badge page-badge';
    this.pageBadge.tabIndex = -1;
    this.pageBadge.hidden = true;
    this.live = this.doc.createElement('div');
    this.live.className = 'sr-only';
    this.live.setAttribute('aria-live', 'polite');
    this.layer.append(this.pageBadge, this.card, this.live);
    this.shadow.append(style, this.layer);

    this.wireBadge(this.pageBadge, () => this.pageOccurrences.map((o) => o.id));
    this.card.addEventListener('keydown', this.onCardKeydown);
    this.card.addEventListener('mouseenter', this.cancelClose);
    this.card.addEventListener('mouseleave', this.scheduleClose);

    this.ro = new ResizeObserver(() => {
      this.scheduleRender();
    });
    this.win.addEventListener('scroll', this.scheduleRender, {
      capture: true,
      passive: true,
    });
    this.win.addEventListener('resize', this.scheduleRender, { passive: true });
    this.doc.addEventListener('keydown', this.onDocumentKeydown, { capture: true });
  }

  /** Anexa o host ao documento (apenas quando há algo a mostrar). */
  private ensureAttached(): void {
    if (this.host.isConnected || this.destroyed) return;
    this.doc.documentElement.append(this.host);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** O nó pertence ao host do overlay? */
  owns(node: Node): boolean {
    return node === this.host;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.host.style.setProperty('display', visible ? 'block' : 'none', 'important');
    if (!visible) this.closeCard(false);
    this.scheduleRender();
  }

  /** Sincroniza os marcadores com o conjunto atual de ocorrências do frame. */
  sync(occurrences: readonly Occurrence[]): void {
    if (this.destroyed) return;
    this.occurrencesById = new Map(occurrences.map((o) => [o.id, o]));
    const byElement = new Map<Element, Occurrence[]>();
    const page: Occurrence[] = [];
    for (const occ of occurrences) {
      if (occ.outcome === 'incomplete') continue;
      if (occ.pageLevel) {
        page.push(occ);
        continue;
      }
      const target = this.opts.elementFor(occ.id);
      if (!target) continue;
      const list = byElement.get(target);
      if (list) list.push(occ);
      else byElement.set(target, [occ]);
    }
    for (const [target, marker] of this.markers) {
      if (byElement.has(target)) continue;
      marker.remove();
      this.ro.unobserve(target);
      this.markers.delete(target);
    }
    for (const [target, occs] of byElement) {
      let marker = this.markers.get(target);
      if (!marker) {
        marker = new Marker(this.doc, target);
        const m = marker;
        this.wireBadge(m.badge, () => m.occurrenceIds);
        this.layer.insertBefore(m.outline, this.pageBadge);
        this.layer.insertBefore(m.badge, this.pageBadge);
        this.markers.set(target, m);
        this.ro.observe(target);
      }
      marker.setOccurrences(occs);
    }
    this.pageOccurrences = page;
    this.updatePageBadge();
    if (this.cardState) {
      const ids = this.cardState.ids.filter((id) => this.occurrencesById.has(id));
      if (ids.length === 0) this.closeCard(false);
      else this.renderCard(ids);
    }
    if (this.markers.size > 0 || page.length > 0) this.ensureAttached();
    this.updateInterval();
    this.scheduleRender();
  }

  private updatePageBadge(): void {
    const page = this.pageOccurrences;
    this.pageBadge.hidden = page.length === 0;
    if (page.length === 0) return;
    const criteria = [...new Set(page.map((o) => o.wcag))].sort();
    const violation = page.some((o) => o.outcome === 'violation');
    this.pageBadge.className = `badge page-badge ${violation ? 'violation' : 'recommendation'}`;
    this.pageBadge.textContent = `${violation ? '⚠' : 'ℹ'} ${t('page_badge')}: ${criteria.join(' · ')}`;
    this.pageBadge.setAttribute(
      'aria-label',
      t('page_badge_label', { criteria: criteria.join(', ') }),
    );
  }

  private updateInterval(): void {
    const needed = this.markers.size > 0;
    if (needed && this.interval === undefined) {
      this.interval = setInterval(() => {
        if (this.doc.visibilityState === 'visible') this.scheduleRender();
      }, REPOSITION_INTERVAL_MS);
    } else if (!needed && this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private wireBadge(badge: HTMLButtonElement, ids: () => string[]): void {
    badge.addEventListener('mouseenter', () => {
      this.cancelClose();
      this.openCard(ids(), { focus: false, anchor: badge });
    });
    badge.addEventListener('mouseleave', this.scheduleClose);
    badge.addEventListener('focus', () => {
      if (this.cardState?.anchor !== badge)
        this.openCard(ids(), { focus: false, anchor: badge });
    });
    badge.addEventListener('click', () => {
      this.openCard(ids(), { focus: true, anchor: badge });
    });
  }

  private readonly cancelClose = (): void => {
    if (this.closeTimer !== undefined) clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
  };

  private readonly scheduleClose = (): void => {
    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      const active = this.shadow.activeElement;
      if (active && this.card.contains(active)) return; // usuário está no cartão via teclado
      this.closeCard(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  /** Abre o cartão para as ocorrências; `focus` move o foco para o cartão. */
  openCard(
    ids: readonly string[],
    opts: { focus: boolean; anchor?: HTMLElement; origin?: Element | null },
  ): void {
    const valid = ids.filter((id) => this.occurrencesById.has(id));
    if (valid.length === 0 || this.destroyed) return;
    if (!this.visible) this.setVisible(true);
    this.ensureAttached();
    const anchor = opts.anchor ?? this.anchorFor(valid[0] ?? '') ?? this.pageBadge;
    let origin = opts.origin ?? null;
    if (opts.focus && origin === null) {
      const active = this.doc.activeElement;
      origin = active && active !== this.host && active !== this.doc.body ? active : null;
    }
    const keepOrigin = this.cardState?.origin ?? null;
    this.cardState = { ids: valid, anchor, origin: origin ?? keepOrigin };
    this.renderCard(valid);
    this.card.hidden = false;
    this.scheduleRender();
    if (opts.focus) this.card.focus({ preventScroll: true });
  }

  private anchorFor(id: string): HTMLElement | null {
    const occ = this.occurrencesById.get(id);
    if (!occ) return null;
    if (occ.pageLevel) return this.pageBadge;
    const target = this.opts.elementFor(id);
    return target ? (this.markers.get(target)?.badge ?? null) : null;
  }

  private renderCard(ids: readonly string[]): void {
    const occs = ids
      .map((id) => this.occurrencesById.get(id))
      .filter((o): o is Occurrence => !!o);
    const titleId = `a11yrt-card-title-${++this.cardSeq}`;
    const close = this.doc.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '×';
    close.setAttribute('aria-label', t('card_close'));
    close.addEventListener('click', () => {
      this.closeCard(true);
    });
    this.card.replaceChildren(close, buildCardContent(this.doc, occs, titleId));
    this.card.setAttribute('aria-labelledby', titleId);
  }

  closeCard(restoreFocus: boolean): void {
    const state = this.cardState;
    if (!state) return;
    const hadFocus =
      this.shadow.activeElement !== null && this.card.contains(this.shadow.activeElement);
    this.cardState = null;
    this.card.hidden = true;
    this.card.replaceChildren();
    if (
      (restoreFocus || hadFocus) &&
      state.origin instanceof HTMLElement &&
      state.origin.isConnected
    ) {
      state.origin.focus({ preventScroll: true });
    } else if (hadFocus) {
      this.card.blur();
    }
  }

  get cardOpen(): boolean {
    return this.cardState !== null;
  }

  private readonly onCardKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      ev.preventDefault();
      this.closeCard(true);
    }
  };

  /** Esc fecha o cartão mesmo com o foco na página (conteúdo em hover deve ser dispensável). */
  private readonly onDocumentKeydown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' || !this.cardState) return;
    const inCard =
      this.shadow.activeElement !== null && this.card.contains(this.shadow.activeElement);
    if (inCard) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    this.closeCard(true);
  };

  /** Rola até o elemento da ocorrência, destaca e abre o cartão. */
  focusOccurrence(
    id: string,
    opts: { focusCard: boolean; focusElement: boolean },
  ): boolean {
    const occ = this.occurrencesById.get(id);
    if (!occ) return false;
    const target = occ.pageLevel ? null : this.opts.elementFor(id);
    const reduced = this.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let origin: Element | null = null;
    if (target) {
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reduced ? 'auto' : 'auto',
      });
      if (opts.focusElement && isFocusableNow(target)) {
        (target as HTMLElement).focus({ preventScroll: true });
        origin = target;
      }
      this.markers.get(target)?.pulse(reduced);
    }
    const ids = target
      ? (this.markers.get(target)?.occurrenceIds ?? [id])
      : this.pageOccurrences.map((o) => o.id);
    this.openCard(ids.includes(id) ? ids : [id], { focus: opts.focusCard, origin });
    return true;
  }

  announce(message: string): void {
    this.live.textContent = message;
  }

  readonly scheduleRender = (): void => {
    if (this.rafId !== undefined || this.destroyed) return;
    this.rafId = this.win.requestAnimationFrame(() => {
      this.rafId = undefined;
      this.render();
    });
  };

  private render(): void {
    if (this.destroyed) return;
    // 1) Leituras (geometria da página e do viewport).
    const viewport = { width: this.win.innerWidth, height: this.win.innerHeight };
    const rects = new Map<Marker, Rect | null>();
    if (this.visible) {
      for (const [target, marker] of this.markers) {
        rects.set(
          marker,
          target.isConnected ? rectFrom(target.getBoundingClientRect()) : null,
        );
      }
    }
    const anchor = this.cardState?.anchor;
    // 2) Escritas (somente dentro do host).
    for (const [marker, rect] of rects) marker.place(rect, viewport);
    if (this.cardState && anchor) {
      // A âncora foi posicionada acima; calcula a posição pelo transform recém-escrito.
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(anchor.style.transform);
      const ax = m ? Number(m[1]) : viewport.width - 200;
      const ay = m ? Number(m[2]) : 8;
      const cardWidth = Math.min(380, viewport.width - 16);
      const left = Math.max(8, Math.min(ax, viewport.width - cardWidth - 8));
      this.card.style.left = '0';
      this.card.style.transform = `translate(${left}px, 0)`;
      if (ay + 28 + 220 <= viewport.height) {
        this.card.style.top = `${ay + 26}px`;
        this.card.style.bottom = 'auto';
      } else {
        this.card.style.top = 'auto';
        this.card.style.bottom = `${Math.max(8, viewport.height - ay + 4)}px`;
      }
    }
    this.opts.onPainted(performance.now());
  }

  /** Número de marcadores e estado do cartão (diagnóstico para testes). */
  debugState(): DebugOverlayState {
    const active = this.shadow.activeElement;
    return {
      visible: this.visible,
      outlines: this.markers.size + (this.pageOccurrences.length > 0 ? 1 : 0),
      cardOpen: this.cardState !== null,
      cardOccurrenceIds: this.cardState?.ids ?? [],
      focusInCard:
        active !== null && (active === this.card || this.card.contains(active)),
      activeElementTag:
        (this.doc.activeElement?.localName ?? '') +
        (active ? `>${active.localName}` : ''),
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== undefined) this.win.cancelAnimationFrame(this.rafId);
    if (this.interval !== undefined) clearInterval(this.interval);
    this.cancelClose();
    this.ro.disconnect();
    this.win.removeEventListener('scroll', this.scheduleRender, { capture: true });
    this.win.removeEventListener('resize', this.scheduleRender);
    this.doc.removeEventListener('keydown', this.onDocumentKeydown, { capture: true });
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();
    this.host.remove();
  }
}

function isFocusableNow(el: Element): boolean {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return false;
  if (el.matches(':disabled')) return false;
  return (el as HTMLElement).tabIndex >= 0 || el.hasAttribute('tabindex');
}
