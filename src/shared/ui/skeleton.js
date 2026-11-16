import { html } from '../utils/html.js';

/** Bloque esqueleto. `ancho` y `alto` son CSS (valores propios, no de la API). */
export function skeletonBlock({ ancho = '100%', alto = '16px', radio } = {}) {
  const estilo = `width:${ancho};height:${alto}${radio ? `;border-radius:${radio}` : ''}`;
  return html`<span class="skeleton" style="${estilo}" aria-hidden="true"></span>`;
}

/** Varias líneas de texto esqueleto; se anuncia una sola vez como "Cargando". */
export function skeletonLines(n = 3) {
  const lineas = Array.from({ length: n }, (_, i) =>
    skeletonBlock({ ancho: i === n - 1 ? '60%' : '100%' }),
  );
  return html`<div class="d-grid gap-2" role="status" aria-label="Cargando">${lineas}</div>`;
}

/** Esqueleto de pantalla completa para el arranque de la sesión. */
export function skeletonPage() {
  return html`<div class="container py-5" role="status" aria-label="Cargando">
    <div class="d-grid gap-3" style="max-width:520px">
      ${skeletonBlock({ ancho: '50%', alto: '32px' })} ${skeletonBlock({ alto: '16px' })}
      ${skeletonBlock({ alto: '16px' })} ${skeletonBlock({ ancho: '70%', alto: '16px' })}
    </div>
  </div>`;
}
