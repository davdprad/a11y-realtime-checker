/**
 * Cessão do thread principal e debounce com espera máxima.
 */

interface SchedulerLike {
  yield?: () => Promise<void>;
}

/**
 * Cede o thread principal para a página. Usa `scheduler.yield()` quando
 * disponível (mantém a prioridade da continuação); senão, `setTimeout(0)`.
 */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: SchedulerLike }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Debounce "de janela": o primeiro evento agenda a execução para `delayMs`
 * depois; eventos seguintes adiam até `delayMs` de silêncio, mas nunca além de
 * `maxWaitMs` desde o primeiro evento. Sem a espera máxima, uma página que
 * muda a cada 100 ms (contador) nunca seria reavaliada com debounce de 150 ms.
 */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private firstAt: number | undefined;

  constructor(
    private readonly fn: () => void,
    private readonly delayMs: number,
    private readonly maxWaitMs: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  trigger(): void {
    const t = this.now();
    this.firstAt ??= t;
    const remainingMax = this.firstAt + this.maxWaitMs - t;
    const wait = Math.max(0, Math.min(this.delayMs, remainingMax));
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush();
    }, wait);
  }

  flush(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.firstAt = undefined;
    this.fn();
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.firstAt = undefined;
  }

  get pending(): boolean {
    return this.timer !== undefined;
  }
}
