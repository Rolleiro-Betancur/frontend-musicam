import { html } from '../../../shared/utils/html.js';
import { setHtml } from '../../../shared/utils/dom.js';
import { coverMedia } from '../../../shared/ui/cover.js';
import { liveBadge, replayBadge } from '../../../shared/ui/live-badge.js';

/** Segundos → `MM:SS` (o `H:MM:SS` desde la hora). */
export function formatDuracion(segundos) {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Reproductor simulado: póster del evento, ecualizador animado, insignia EN VIVO/REPLAY y
 * contador de tiempo. Se usa mientras el backend entregue URLs ficticias (§5.3).
 * @implements {import('./player-adapter.js').PlayerAdapter}
 */
export class SimulatedPlayer {
  constructor() {
    this.temporizador = null;
  }

  async mount(el, { tipo, evento }) {
    this.destroy();
    setHtml(
      el,
      html`<div
        class="player-sim"
        role="img"
        aria-label="Reproductor simulado de ${evento.titulo}"
      >
        ${coverMedia(evento)}
        <div class="player-sim__shade" aria-hidden="true"></div>
        <div class="player-sim__top">
          ${tipo === 'VIVO' ? liveBadge() : replayBadge()}
          <span class="soft-badge">Reproducción simulada</span>
        </div>
        <div class="player-sim__bottom" aria-hidden="true">
          <span class="eq"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="player-sim__time" data-tiempo>00:00</span>
        </div>
      </div>`,
    );
    const tiempo = el.querySelector('[data-tiempo]');
    const inicio = Date.now();
    this.temporizador = setInterval(() => {
      tiempo.textContent = formatDuracion((Date.now() - inicio) / 1000);
    }, 1000);
  }

  destroy() {
    clearInterval(this.temporizador);
    this.temporizador = null;
  }
}
