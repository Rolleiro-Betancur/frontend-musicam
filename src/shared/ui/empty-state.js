import { html } from '../utils/html.js';

/**
 * Estado vacío: icono + mensaje + acción opcional (enlace).
 * @param {{icono?: string, titulo: string, mensaje?: string, accion?: {href: string, texto: string}}} o
 */
export function emptyState({ icono = 'bi-inbox', titulo, mensaje = '', accion }) {
  return html`<div class="text-center py-5 px-3">
    <i class="bi ${icono} display-4 text-muted-2" aria-hidden="true"></i>
    <h2 class="fs-5 mt-3">${titulo}</h2>
    ${mensaje ? html`<p class="text-muted-2 mb-3">${mensaje}</p>` : ''}
    ${accion ? html`<a class="btn btn-primary" href="${accion.href}">${accion.texto}</a>` : ''}
  </div>`;
}

/**
 * Estado de error con botón de reintento (`data-action="reintentar"`).
 * @param {{titulo?: string, mensaje: string, reintentar?: boolean}} o
 */
export function errorState({ titulo = 'No pudimos cargar esto', mensaje, reintentar = true }) {
  return html`<div class="text-center py-5 px-3" role="alert">
    <i class="bi bi-exclamation-triangle display-4 text-warning" aria-hidden="true"></i>
    <h2 class="fs-5 mt-3">${titulo}</h2>
    <p class="text-muted-2 mb-3">${mensaje}</p>
    ${
      reintentar
        ? html`<button type="button" class="btn btn-outline-light" data-action="reintentar">
            Reintentar
          </button>`
        : ''
    }
  </div>`;
}
