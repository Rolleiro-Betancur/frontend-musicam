import { html } from '../utils/html.js';
import { comportamientoDeScroll } from '../utils/motion.js';

let contador = 0;

/**
 * Fila horizontal con `scroll-snap`, flechas en escritorio y desplazamiento táctil en móvil.
 * Llama a `activarRails(raiz)` tras insertar el HTML.
 * @param {{titulo: string, verTodoHref?: string, items: import('../utils/html.js').SafeHtml[]}} o
 */
export function rail({ titulo, verTodoHref, items }) {
  const id = `rail-${++contador}`;
  return html`<section class="rail" aria-labelledby="${id}-titulo">
    <div class="rail__head">
      <h2 class="rail__title" id="${id}-titulo">${titulo}</h2>
      <div class="d-flex align-items-center gap-2">
        ${verTodoHref ? html`<a class="rail__all" href="${verTodoHref}">Ver todo</a>` : ''}
        <button type="button" class="rail__arrow" data-rail-dir="-1" aria-label="Anterior: ${titulo}">
          <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="rail__arrow" data-rail-dir="1" aria-label="Siguiente: ${titulo}">
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="rail__track" tabindex="0" role="group" aria-label="${titulo}">
      ${items.map((item) => html`<div class="rail__item">${item}</div>`)}
    </div>
  </section>`;
}

/** Cablea las flechas de cada fila y deshabilita la que no tenga hacia dónde avanzar. */
export function activarRails(raiz) {
  const limpiezas = [];
  raiz.querySelectorAll('.rail').forEach((seccion) => {
    const pista = seccion.querySelector('.rail__track');
    const flechas = seccion.querySelectorAll('[data-rail-dir]');
    const actualizar = () => {
      const max = pista.scrollWidth - pista.clientWidth - 1;
      flechas.forEach((f) => {
        const dir = Number(f.dataset.railDir);
        f.disabled = dir < 0 ? pista.scrollLeft <= 0 : pista.scrollLeft >= max;
      });
    };
    const alClic = (e) => {
      const boton = e.target.closest('[data-rail-dir]');
      if (!boton) return;
      pista.scrollBy({
        left: Number(boton.dataset.railDir) * pista.clientWidth * 0.85,
        behavior: comportamientoDeScroll(),
      });
    };
    seccion.addEventListener('click', alClic);
    pista.addEventListener('scroll', actualizar, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
    limpiezas.push(() => {
      seccion.removeEventListener('click', alClic);
      pista.removeEventListener('scroll', actualizar);
      window.removeEventListener('resize', actualizar);
    });
  });
  return () => limpiezas.forEach((fn) => fn());
}
