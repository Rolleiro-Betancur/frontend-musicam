import Modal from 'bootstrap/js/dist/modal.js';
import { escapeHtml, SafeHtml } from '../utils/html.js';

// Solo estos tamaños llegan a la clase CSS (lista permitida: el valor no se interpola sin revisar).
const TAMANOS = new Set(['sm', 'lg', 'xl']);

/**
 * Abre un modal de Bootstrap (atrapa el foco y lo devuelve al cerrar).
 * @param {{titulo: string, cuerpo: SafeHtml|Node, pie?: SafeHtml|Node, tamano?: 'sm'|'lg'|'xl'}} opciones
 * @returns {{el: HTMLElement, cerrar: () => void, cerrado: Promise<void>}}
 */
export function openModal({ titulo, cuerpo, pie, tamano }) {
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  const idTitulo = `modal-titulo-${Math.random().toString(36).slice(2, 8)}`;
  el.setAttribute('aria-labelledby', idTitulo);
  el.innerHTML = `
    <div class="modal-dialog modal-dialog-centered ${TAMANOS.has(tamano) ? `modal-${tamano}` : ''}">
      <div class="modal-content">
        <div class="modal-header border-0">
          <h2 class="modal-title fs-5" id="${idTitulo}">${escapeHtml(titulo)}</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body"></div>
        ${pie ? '<div class="modal-footer border-0"></div>' : ''}
      </div>
    </div>`;
  colocar(el.querySelector('.modal-body'), cuerpo);
  if (pie) colocar(el.querySelector('.modal-footer'), pie);
  document.body.append(el);

  // Bootstrap atrapa el foco, pero solo lo devuelve al cerrar si el modal se abrió con atributos
  // `data-bs-toggle`. Como aquí se abre por código, se recuerda el elemento que lo abrió (§6.5).
  const quienAbrio = document.activeElement;
  const instancia = new Modal(el);
  const cerrado = new Promise((resolver) => {
    el.addEventListener('hidden.bs.modal', () => {
      instancia.dispose();
      el.remove();
      if (quienAbrio instanceof HTMLElement && quienAbrio.isConnected) quienAbrio.focus();
      resolver();
    });
  });
  instancia.show();
  return { el, cerrar: () => instancia.hide(), cerrado };
}

function colocar(destino, contenido) {
  if (contenido instanceof SafeHtml) destino.innerHTML = contenido.toString();
  else destino.append(contenido);
}
