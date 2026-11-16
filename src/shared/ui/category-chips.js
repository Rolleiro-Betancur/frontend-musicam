import { html } from '../utils/html.js';
import { CATEGORIAS } from '../utils/categorias.js';

/**
 * Chips de categoría. Con `modo: 'link'` son enlaces a `#/eventos?categoria=X` (inicio);
 * con `modo: 'button'` son botones seleccionables (`data-action="categoria"`, `data-valor`).
 * @param {{modo?: 'link'|'button', seleccionada?: string, incluirTodas?: boolean}} [o]
 */
export function categoryChips({ modo = 'link', seleccionada = '', incluirTodas = false } = {}) {
  const lista = incluirTodas ? [['', 'Todas'], ...CATEGORIAS] : CATEGORIAS;
  return html`<div class="chips" role="group" aria-label="Categorías">
    ${lista.map(([valor, etiqueta]) => {
      const activo = valor === seleccionada;
      return modo === 'link'
        ? html`<a class="chip" href="#/eventos?categoria=${encodeURIComponent(valor)}">${etiqueta}</a>`
        : html`<button
            type="button"
            class="chip ${activo ? 'chip--active' : ''}"
            data-action="categoria"
            data-valor="${valor}"
            aria-pressed="${String(activo)}"
          >
            ${etiqueta}
          </button>`;
    })}
  </div>`;
}
