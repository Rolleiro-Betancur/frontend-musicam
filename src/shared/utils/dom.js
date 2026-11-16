import { SafeHtml } from './html.js';

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

/** Vuelca un `SafeHtml` en un elemento. Rechaza cadenas sueltas para no saltarse el escape. */
export function setHtml(el, contenido) {
  if (!(contenido instanceof SafeHtml)) {
    throw new TypeError('setHtml requiere una plantilla html`...` (SafeHtml).');
  }
  el.innerHTML = contenido.toString();
  return el;
}

/** Crea un nodo a partir de un `SafeHtml`. */
export function fromHtml(contenido, tag = 'div') {
  return setHtml(document.createElement(tag), contenido);
}

/**
 * Delegación de eventos por `data-action`.
 * @param {Element} raiz
 * @param {string} tipo
 * @param {Record<string, (e: Event, el: HTMLElement) => void>} acciones
 */
export function delegate(raiz, tipo, acciones) {
  const manejador = (e) => {
    const el = e.target.closest?.('[data-action]');
    if (!el || !raiz.contains(el)) return;
    const accion = acciones[el.dataset.action];
    if (accion) accion(e, el);
  };
  raiz.addEventListener(tipo, manejador);
  return () => raiz.removeEventListener(tipo, manejador);
}

export function clear(el) {
  el.replaceChildren();
  return el;
}
