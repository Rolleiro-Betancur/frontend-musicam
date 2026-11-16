import Toast from 'bootstrap/js/dist/toast.js';
import { escapeHtml } from '../utils/html.js';

const ICONOS = {
  success: 'bi-check-circle-fill text-success',
  danger: 'bi-exclamation-octagon-fill text-danger',
  warning: 'bi-exclamation-triangle-fill text-warning',
  info: 'bi-info-circle-fill text-info',
};

function contenedor() {
  let el = document.getElementById('toast-stack');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-stack';
    el.className = 'toast-stack';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.append(el);
  }
  return el;
}

/**
 * Muestra un aviso temporal. El mensaje se escapa siempre.
 * @param {string} mensaje
 * @param {'success'|'danger'|'warning'|'info'} [tipo]
 */
export function showToast(mensaje, tipo = 'info') {
  const el = document.createElement('div');
  el.className = 'toast align-items-center';
  el.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex gap-2 align-items-start">
        <i class="bi ${ICONOS[tipo] ?? ICONOS.info}" aria-hidden="true"></i>
        <span>${escapeHtml(mensaje)}</span>
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  contenedor().append(el);
  el.addEventListener('hidden.bs.toast', () => el.remove());
  new Toast(el, { delay: tipo === 'danger' ? 7000 : 4500 }).show();
}
