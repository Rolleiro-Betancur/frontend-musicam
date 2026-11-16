import { html } from '../utils/html.js';
import { formatCop } from '../utils/format-money.js';
import { formatDateTime } from '../utils/format-date.js';
import { coverMedia } from './cover.js';
import { estadoBadge } from './live-badge.js';

/**
 * Tarjeta de evento (`EventoResumen`): póster 16:9, insignia, título, artista y precio.
 * El corazón de favorito lo aporta quien la usa (`favorito`, un `SafeHtml`): la lógica vive en la
 * feature `catalog` y `shared` no depende de ella.
 * @param {object} evento
 * @param {{favorito?: import('../utils/html.js').SafeHtml}} [opciones]
 */
export function eventCard(evento, { favorito } = {}) {
  const href = `#/eventos/${encodeURIComponent(evento.id)}`;
  return html`<article class="event-card">
    <a class="event-card__link" href="${href}">
      <span class="event-card__poster">
        ${coverMedia(evento)}
        <span class="event-card__badges">${estadoBadge(evento)}</span>
      </span>
      <span class="event-card__body">
        <span class="event-card__title">${evento.titulo}</span>
        <span class="event-card__meta">${evento.artista?.nombre_artistico ?? ''}</span>
        <span class="event-card__meta">${formatDateTime(evento.fecha_inicio)}</span>
        <span class="event-card__price">${formatCop(evento.precio_cop)}</span>
      </span>
    </a>
    ${favorito ?? ''}
  </article>`;
}

/** Esqueleto de tarjeta para los estados de carga. */
export function eventCardSkeleton() {
  return html`<div class="event-card" aria-hidden="true">
    <span class="event-card__poster skeleton" style="border-radius:0"></span>
    <span class="event-card__body">
      <span class="skeleton" style="width:80%;height:16px"></span>
      <span class="skeleton" style="width:50%;height:12px"></span>
      <span class="skeleton" style="width:30%;height:14px"></span>
    </span>
  </div>`;
}
