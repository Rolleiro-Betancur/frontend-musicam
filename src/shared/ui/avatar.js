import { html } from '../utils/html.js';
import { mediaUrl } from '../utils/media-url.js';

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/**
 * Avatar circular: foto si existe, iniciales si no. Llama a `activarFallbackAvatares`
 * sobre el contenedor para que una foto rota caiga a las iniciales.
 * @param {{nombre: string, fotoUrl?: string|null, tamano?: number}} o
 */
export function avatar({ nombre, fotoUrl, tamano = 40 }) {
  const url = mediaUrl(fotoUrl);
  const estilo = `width:${tamano}px;height:${tamano}px;font-size:${Math.round(tamano * 0.4)}px`;
  const ini = iniciales(nombre);
  return url
    ? html`<img
        class="avatar"
        src="${url}"
        alt=""
        style="${estilo}"
        data-iniciales="${ini}"
        referrerpolicy="no-referrer"
      />`
    : html`<span class="avatar" style="${estilo}" aria-hidden="true">${ini}</span>`;
}

/** Reemplaza por iniciales las fotos que fallen al cargar (el evento `error` no burbujea). */
export function activarFallbackAvatares(raiz) {
  raiz.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('avatar')) return;
      const span = document.createElement('span');
      span.className = 'avatar';
      span.style.cssText = img.style.cssText;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = img.dataset.iniciales || '?';
      img.replaceWith(span);
    },
    true,
  );
}
