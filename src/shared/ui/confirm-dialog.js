import { html } from '../utils/html.js';
import { openModal } from './modal.js';

/**
 * Diálogo de confirmación. Resuelve `true` solo si la persona confirma.
 * @param {{titulo: string, mensaje: string, confirmar?: string, cancelar?: string, peligro?: boolean}} o
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  titulo,
  mensaje,
  confirmar = 'Confirmar',
  cancelar = 'Cancelar',
  peligro = false,
}) {
  return new Promise((resolver) => {
    let decision = false;
    const { el, cerrar, cerrado } = openModal({
      titulo,
      tamano: 'sm',
      cuerpo: html`<p class="mb-0">${mensaje}</p>`,
      pie: html`
        <button type="button" class="btn btn-outline-secondary" data-action="cancelar">
          ${cancelar}
        </button>
        <button
          type="button"
          class="btn ${peligro ? 'btn-danger' : 'btn-primary'}"
          data-action="confirmar"
        >
          ${confirmar}
        </button>
      `,
    });
    el.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-action]')?.dataset.action;
      if (!accion) return;
      decision = accion === 'confirmar';
      cerrar();
    });
    cerrado.then(() => resolver(decision));
  });
}
