import { html } from '../utils/html.js';

/**
 * Paginación sobre `{page, page_size, total}`. Los botones llevan
 * `data-action="ir-pagina"` y `data-page`.
 */
export function pagination({ page, pageSize, total }) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (paginas <= 1) return html``;
  const boton = (n, texto, { deshabilitado = false, activo = false, etiqueta } = {}) => html`
    <li class="page-item ${activo ? 'active' : ''} ${deshabilitado ? 'disabled' : ''}">
      <button
        type="button"
        class="page-link"
        data-action="ir-pagina"
        data-page="${n}"
        ${deshabilitado ? html`disabled` : ''}
        ${activo ? html`aria-current="page"` : ''}
        ${etiqueta ? html`aria-label="${etiqueta}"` : ''}
      >
        ${texto}
      </button>
    </li>
  `;
  const numeros = [];
  for (let n = Math.max(1, page - 2); n <= Math.min(paginas, page + 2); n++) {
    numeros.push(boton(n, String(n), { activo: n === page }));
  }
  return html`<nav aria-label="Paginación">
    <ul class="pagination justify-content-center mb-0">
      ${boton(page - 1, '‹', { deshabilitado: page <= 1, etiqueta: 'Anterior' })} ${numeros}
      ${boton(page + 1, '›', { deshabilitado: page >= paginas, etiqueta: 'Siguiente' })}
    </ul>
  </nav>`;
}
