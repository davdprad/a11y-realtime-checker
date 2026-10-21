/**
 * Marcador de um elemento: contorno sobre o retângulo do elemento e um rótulo
 * (botão) com ícone + critérios, para não depender só da cor. Uma violação usa
 * borda contínua vermelha de 3 px; uma recomendação, borda tracejada azul.
 */
import type { Rect } from '../lib/geometry';
import { t } from '../lib/i18n';
import type { Occurrence } from '../messaging/protocol';

export type MarkerSeverity = 'violation' | 'recommendation';

export class Marker {
  readonly outline: HTMLDivElement;
  readonly badge: HTMLButtonElement;
  severity: MarkerSeverity = 'violation';
  occurrenceIds: string[] = [];

  constructor(
    doc: Document,
    readonly target: Element,
  ) {
    this.outline = doc.createElement('div');
    this.outline.className = 'outline';
    this.badge = doc.createElement('button');
    this.badge.type = 'button';
    this.badge.className = 'badge';
    // Fora da ordem de tabulação da página: o acesso por teclado é pelo
    // painel lateral ou pelos atalhos (chrome.commands).
    this.badge.tabIndex = -1;
  }

  setOccurrences(occs: readonly Occurrence[]): void {
    const shown = occs.filter((o) => o.outcome !== 'incomplete');
    this.occurrenceIds = shown.map((o) => o.id);
    this.severity = shown.some((o) => o.outcome === 'violation')
      ? 'violation'
      : 'recommendation';
    this.outline.className = `outline ${this.severity}`;
    this.badge.className = `badge ${this.severity}`;
    const icon = this.severity === 'violation' ? '⚠' : 'ℹ';
    const criteria = [...new Set(shown.map((o) => o.wcag))].sort();
    this.badge.textContent = `${icon} ${criteria.join(' · ')}`;
    this.badge.setAttribute(
      'aria-label',
      t(
        this.severity === 'violation'
          ? 'badge_label_violation'
          : 'badge_label_recommendation',
        {
          criteria: criteria.join(', '),
        },
      ),
    );
  }

  /** Posiciona (escrita apenas no overlay). `rect` em coordenadas de viewport. */
  place(rect: Rect | null, viewport: { width: number; height: number }): void {
    const offscreen =
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.left + rect.width < 0 ||
      rect.top + rect.height < 0 ||
      rect.left > viewport.width ||
      rect.top > viewport.height;
    this.outline.hidden = offscreen;
    this.badge.hidden = offscreen;
    if (offscreen) return;
    const pad = 2;
    const x = rect.left - pad;
    const y = rect.top - pad;
    this.outline.style.transform = `translate(${x}px, ${y}px)`;
    this.outline.style.width = `${rect.width + pad * 2}px`;
    this.outline.style.height = `${rect.height + pad * 2}px`;
    const by = y - 20 >= 0 ? y - 20 : y + rect.height + pad * 2;
    const bx = Math.max(0, Math.min(x, viewport.width - 120));
    this.badge.style.transform = `translate(${bx}px, ${by}px)`;
  }

  /** Destaque temporário ao navegar até o elemento. */
  pulse(reducedMotion: boolean): void {
    if (reducedMotion) {
      this.outline.classList.add('highlight');
      setTimeout(() => {
        this.outline.classList.remove('highlight');
      }, 2000);
      return;
    }
    this.outline.animate(
      [
        { boxShadow: '0 0 0 0 rgba(176,0,32,0)' },
        { boxShadow: '0 0 0 8px rgba(176,0,32,.5)' },
        { boxShadow: '0 0 0 0 rgba(176,0,32,0)' },
      ],
      { duration: 600, iterations: 3 },
    );
  }

  remove(): void {
    this.outline.remove();
    this.badge.remove();
  }
}
