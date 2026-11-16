import { html } from '../../../shared/utils/html.js';

/** Selector de filtro con una opción "Todos" inicial. `opciones`: pares [valor, etiqueta]. */
export function filtroSelect({ name, label, valor = '', opciones, todos = 'Todos' }) {
  return html`<div>
    <label class="form-label" for="filtro-${name}">${label}</label>
    <select id="filtro-${name}" name="${name}" class="form-select">
      ${todos === null ? '' : html`<option value="">${todos}</option>`}
      ${opciones.map(
        ([v, etiqueta]) =>
          html`<option value="${v}" ${v === valor ? html`selected` : ''}>${etiqueta}</option>`,
      )}
    </select>
  </div>`;
}

/** Campo de texto de filtro. Con `retraso` busca al teclear (debounce de 300 ms). */
export function filtroTexto({
  name,
  label,
  valor = '',
  placeholder = '',
  retraso = false,
  maxlength,
}) {
  return html`<div>
    <label class="form-label" for="filtro-${name}">${label}</label>
    <input
      id="filtro-${name}"
      name="${name}"
      type="${retraso ? 'search' : 'text'}"
      class="form-control"
      value="${valor}"
      placeholder="${placeholder}"
      autocomplete="off"
      ${maxlength ? html`maxlength="${maxlength}"` : ''}
      ${retraso ? html`data-debounce` : ''}
    />
  </div>`;
}

/** Campo de fecha (día) de filtro. */
export function filtroFecha({ name, label, valor = '' }) {
  return html`<div>
    <label class="form-label" for="filtro-${name}">${label}</label>
    <input id="filtro-${name}" name="${name}" type="date" class="form-control" value="${valor}" />
  </div>`;
}
