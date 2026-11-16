import { html } from '../utils/html.js';
import { formatDate } from '../utils/format-date.js';

/** Insignia EN VIVO: lleva texto, el color no es la única señal. */
export function liveBadge() {
  return html`<span class="live-badge"
    ><span class="live-badge__dot" aria-hidden="true"></span>EN VIVO</span
  >`;
}

export function replayBadge() {
  return html`<span class="soft-badge"><i class="bi bi-play-circle" aria-hidden="true"></i>REPLAY</span>`;
}

export function dateBadge(iso) {
  return html`<span class="soft-badge">${formatDate(iso)}</span>`;
}

/** Insignia principal según el estado del evento (EN VIVO, REPLAY o fecha). */
export function estadoBadge(evento) {
  if (evento.estado === 'EN_VIVO') return liveBadge();
  if (evento.estado === 'FINALIZADO' && evento.replay_disponible) return replayBadge();
  if (evento.estado === 'PROGRAMADO') return dateBadge(evento.fecha_inicio);
  return html``;
}
