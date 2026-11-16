import { html } from '../utils/html.js';

export function spinner(etiqueta = 'Cargando…', { pequeno = false } = {}) {
  return html`<span
    class="spinner-border ${pequeno ? 'spinner-border-sm' : ''}"
    role="status"
    aria-label="${etiqueta}"
  ></span>`;
}
