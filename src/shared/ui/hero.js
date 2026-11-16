import { html } from '../utils/html.js';
import { formatDateTime } from '../utils/format-date.js';
import { coverMedia } from './cover.js';
import { estadoBadge } from './live-badge.js';

/**
 * Hero a todo el ancho: portada con degradado inferior, insignia, título, meta y un CTA.
 * @param {{evento: object, cta: {href: string, texto: string}}} o
 */
export function hero({ evento, cta }) {
  return html`<section class="hero" aria-labelledby="hero-titulo">
    <div class="hero__media" aria-hidden="true">${coverMedia(evento)}</div>
    <div class="hero__shade" aria-hidden="true"></div>
    <div class="container hero__content">
      <div class="mb-2">${estadoBadge(evento)}</div>
      <h1 id="hero-titulo" class="hero__title">${evento.titulo}</h1>
      <p class="hero__meta">
        ${evento.artista?.nombre_artistico ?? ''} · ${formatDateTime(evento.fecha_inicio)}
      </p>
      <a class="btn btn-primary btn-lg rounded-pill px-4" href="${cta.href}">${cta.texto}</a>
    </div>
  </section>`;
}
