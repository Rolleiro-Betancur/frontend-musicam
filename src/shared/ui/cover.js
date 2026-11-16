import { html } from '../utils/html.js';
import { categoryGradient } from '../utils/category-gradient.js';
import { esUrlExternaSegura } from '../utils/validators.js';

/**
 * Portada de un evento: degradado por categoría siempre de fondo y, encima, la imagen si la URL
 * es segura. Si la imagen falla, `activarFallbackPortadas` la quita y queda el degradado.
 * @param {{id: string, categoria: string, portada_url?: string|null}} evento
 * @param {string} [alt]
 */
export function coverMedia(evento, alt = '') {
  const url = esUrlExternaSegura(evento.portada_url) ? evento.portada_url : null;
  return html`<span class="cover" style="background:${categoryGradient(evento.categoria, evento.id)}">
    ${
      url
        ? html`<img
          class="cover__img"
          src="${url}"
          alt="${alt}"
          loading="lazy"
          referrerpolicy="no-referrer"
        />`
        : ''
    }
  </span>`;
}

/** Las imágenes rotas se retiran para dejar ver el degradado (el evento `error` no burbujea). */
export function activarFallbackPortadas(raiz) {
  raiz.addEventListener(
    'error',
    (e) => {
      if (e.target instanceof HTMLImageElement && e.target.classList.contains('cover__img')) {
        e.target.remove();
      }
    },
    true,
  );
}
