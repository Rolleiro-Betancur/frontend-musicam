import Offcanvas from 'bootstrap/js/dist/offcanvas.js';
import { html } from '../../shared/utils/html.js';
import { fromHtml } from '../../shared/utils/dom.js';

/**
 * Barra lateral de navegación para los paneles (estudio y administración).
 * Con `offcanvas: true` es fija en escritorio y un panel deslizable en móvil, con un botón
 * (`boton`) que debe colocarse fuera de la barra para abrirla.
 * @param {{titulo: string, enlaces: {href: string, texto: string, icono: string}[], offcanvas?: boolean}} o
 */
export function createPanelNav({ titulo, enlaces, offcanvas = false }) {
  const nav = fromHtml(
    html`<p class="eyebrow mb-2 px-2">${titulo}</p>
      <ul class="nav flex-column gap-1">
        ${enlaces.map(
          (e) =>
            html`<li class="nav-item">
              <a
                class="nav-link d-flex align-items-center gap-2"
                href="${e.href}"
                data-nav="${e.href}"
              >
                <i class="bi ${e.icono}" aria-hidden="true"></i>${e.texto}
              </a>
            </li>`,
        )}
      </ul>`,
    'nav',
  );
  nav.className = 'panel-nav';
  nav.setAttribute('aria-label', titulo);

  let contenedor = nav;
  let boton = null;
  if (offcanvas) {
    const idPanel = `panel-offcanvas-${titulo.toLowerCase().replace(/\W+/g, '-')}`;
    contenedor = fromHtml(
      html`<div class="offcanvas-header d-lg-none">
          <h2 class="offcanvas-title fs-5" id="${idPanel}-titulo">${titulo}</h2>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="offcanvas"
            data-bs-target="#${idPanel}"
            aria-label="Cerrar menú"
          ></button>
        </div>
        <div class="offcanvas-body p-lg-0"></div>`,
      'div',
    );
    contenedor.id = idPanel;
    contenedor.className = 'offcanvas-lg offcanvas-start panel-sidebar';
    contenedor.tabIndex = -1;
    contenedor.setAttribute('aria-labelledby', `${idPanel}-titulo`);
    contenedor.querySelector('.offcanvas-body').append(nav);

    boton = fromHtml(
      html`<button
        type="button"
        class="btn btn-outline-light d-lg-none"
        data-bs-toggle="offcanvas"
        data-bs-target="#${idPanel}"
        aria-controls="${idPanel}"
      >
        <i class="bi bi-list me-1" aria-hidden="true"></i>Menú de ${titulo}
      </button>`,
      'div',
    );
    boton.className = 'd-lg-none mb-3';
  }

  const cerrarMovil = () => Offcanvas.getInstance(contenedor)?.hide();
  const marcar = () => {
    const actual = location.hash.split('?')[0] || '#/';
    nav.querySelectorAll('[data-nav]').forEach((a) => {
      const href = a.dataset.nav;
      // La raíz del panel solo es activa en coincidencia exacta.
      const raiz = enlaces[0].href === href;
      const activo = raiz ? actual === href : actual === href || actual.startsWith(`${href}/`);
      a.classList.toggle('active', activo);
      if (activo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };
  const alCambiarHash = () => {
    marcar();
    if (offcanvas) cerrarMovil();
  };
  marcar();
  window.addEventListener('hashchange', alCambiarHash);
  return {
    el: contenedor,
    boton,
    destroy() {
      window.removeEventListener('hashchange', alCambiarHash);
      if (offcanvas) Offcanvas.getInstance(contenedor)?.dispose();
    },
  };
}
