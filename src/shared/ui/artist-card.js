import { html } from '../utils/html.js';
import { avatar } from './avatar.js';

/**
 * Tarjeta de artista: avatar circular, nombre y bio breve. El botón Seguir lo aporta quien la usa
 * (`accion`, un `SafeHtml`): la lógica vive en la feature `catalog`.
 * @param {{id: string, nombre_artistico: string, foto_url: string|null, biografia?: string|null}} artista
 * @param {{accion?: import('../utils/html.js').SafeHtml}} [opciones]
 */
export function artistCard(artista, { accion } = {}) {
  const href = `#/artistas/${encodeURIComponent(artista.id)}`;
  return html`<article class="artist-card">
    <a class="artist-card__link" href="${href}">
      ${avatar({ nombre: artista.nombre_artistico, fotoUrl: artista.foto_url, tamano: 88 })}
      <span class="artist-card__name">${artista.nombre_artistico}</span>
      ${artista.biografia ? html`<span class="artist-card__bio">${artista.biografia}</span>` : ''}
    </a>
    ${accion ?? ''}
  </article>`;
}

export function artistCardSkeleton() {
  return html`<div class="artist-card" aria-hidden="true">
    <span class="skeleton" style="width:88px;height:88px;border-radius:50%"></span>
    <span class="skeleton" style="width:60%;height:16px"></span>
    <span class="skeleton" style="width:80%;height:12px"></span>
  </div>`;
}
