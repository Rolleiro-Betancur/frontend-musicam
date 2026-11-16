import { html } from '../utils/html.js';

/**
 * Campo de formulario accesible (etiqueta, ayuda y error asociados).
 * @param {{name: string, label: string, type?: string, value?: string, required?: boolean,
 *   autocomplete?: string, help?: string, maxlength?: number, placeholder?: string, rows?: number,
 *   disabled?: boolean, min?: number|string, max?: number|string, step?: number, inputmode?: string}} o
 */
export function formField({
  name,
  label,
  type = 'text',
  value = '',
  required = false,
  autocomplete = 'off',
  help = '',
  maxlength,
  placeholder = '',
  rows,
  disabled = false,
  min,
  max,
  step,
  inputmode,
}) {
  const id = `campo-${name}`;
  const describe = [help ? `${id}-ayuda` : '', `${id}-error`].filter(Boolean).join(' ');
  const comun = html`id="${id}" name="${name}" class="form-control" aria-describedby="${describe}"
  ${required ? html`required` : ''} ${maxlength ? html`maxlength="${maxlength}"` : ''}
  ${placeholder ? html`placeholder="${placeholder}"` : ''} ${disabled ? html`disabled` : ''}
  ${min !== undefined ? html`min="${min}"` : ''} ${max !== undefined ? html`max="${max}"` : ''}
  ${step !== undefined ? html`step="${step}"` : ''} ${inputmode ? html`inputmode="${inputmode}"` : ''}`;
  const control =
    type === 'textarea'
      ? html`<textarea ${comun} rows="${rows ?? 4}">${value}</textarea>`
      : html`<input ${comun} type="${type}" value="${value}" autocomplete="${autocomplete}" />`;
  return html`<div class="mb-3" data-field="${name}">
    <label for="${id}" class="form-label">${label}</label>
    ${control} ${help ? html`<div class="form-text" id="${id}-ayuda">${help}</div>` : ''}
    <div class="invalid-feedback" id="${id}-error" aria-live="polite"></div>
  </div>`;
}

/** Pinta (o limpia, con mensaje vacío) el error de un campo. */
export function setFieldError(form, name, mensaje) {
  const input = form.elements[name];
  const caja = form.querySelector(`[data-field="${name}"] .invalid-feedback`);
  if (!input || !caja) return;
  caja.textContent = mensaje || '';
  input.classList.toggle('is-invalid', Boolean(mensaje));
  if (mensaje) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

export function clearFieldErrors(form) {
  form.querySelectorAll('[data-field]').forEach((f) => setFieldError(form, f.dataset.field, ''));
}
