import 'bootstrap/js/dist/collapse.js';
import 'bootstrap/js/dist/dropdown.js';
import { config } from '../../core/config.js';
import { on } from '../../core/event-bus.js';
import { sessionState, cerrarSesion } from '../../core/session/session.js';
import { html } from '../utils/html.js';
import { setHtml } from '../utils/dom.js';
import { avatar, activarFallbackAvatares } from './avatar.js';
import { enlacesPorRol } from './navbar-links.js';

function zonaDerecha({ estado, usuario }) {
  if (estado === 'cargando') {
    return html`<span class="skeleton" style="width:120px;height:36px" aria-hidden="true"></span>`;
  }
  if (!usuario) {
    return html`<a class="btn btn-outline-light" href="#/login">Iniciar sesión</a>
      <a class="btn btn-primary" href="#/registro">Registrarme</a>`;
  }
  const nombre = usuario.nombre_artistico || usuario.nombre;
  return html`<div class="dropdown">
    <button
      class="btn btn-link p-0 d-flex align-items-center gap-2 text-decoration-none"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      aria-label="Menú de ${nombre}"
    >
      ${avatar({ nombre, fotoUrl: usuario.foto_url, tamano: 40 })}
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li><h6 class="dropdown-header">${nombre}</h6></li>
      <li><a class="dropdown-item py-2" href="#/perfil">Perfil</a></li>
      ${
        usuario.rol === 'ADMIN'
          ? ''
          : html`<li><a class="dropdown-item py-2" href="#/siguiendo">Siguiendo</a></li>`
      }
      <li><hr class="dropdown-divider" /></li>
      <li>
        <button class="dropdown-item py-2" type="button" data-action="salir">Salir</button>
      </li>
    </ul>
  </div>`;
}

function plantilla(sesion) {
  const enlaces = enlacesPorRol(sesion.usuario?.rol);
  return html`<nav class="navbar navbar-expand-lg border-bottom" aria-label="Principal">
    <div class="container">
      <a class="navbar-brand brand fs-4" href="#/">${config.appName}</a>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbar-contenido"
        aria-controls="navbar-contenido"
        aria-expanded="false"
        aria-label="Abrir menú"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbar-contenido">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          ${enlaces.map(
            (e) =>
              html`<li class="nav-item">
                <a class="nav-link py-2" href="${e.href}" data-nav="${e.href}">${e.texto}</a>
              </li>`,
          )}
        </ul>
        <form class="d-flex me-lg-3 mb-2 mb-lg-0" role="search" data-action-form="buscar">
          <label class="visually-hidden" for="navbar-buscar">Buscar eventos o artistas</label>
          <input
            id="navbar-buscar"
            name="q"
            type="search"
            class="form-control"
            placeholder="Buscar eventos o artistas"
            maxlength="100"
          />
        </form>
        <div class="d-flex align-items-center gap-2">${zonaDerecha(sesion)}</div>
      </div>
    </div>
  </nav>`;
}

/** Barra de navegación que se redibuja al cambiar la sesión. */
export function createNavbar() {
  const header = document.createElement('header');
  const marcarActivo = () => {
    const actual = location.hash.split('?')[0] || '#/';
    header.querySelectorAll('[data-nav]').forEach((a) => {
      const href = a.dataset.nav;
      const activo = actual === href || actual.startsWith(`${href}/`);
      a.classList.toggle('active', activo);
      if (activo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };
  const pintar = () => {
    setHtml(header, plantilla(sessionState.get()));
    marcarActivo();
  };

  header.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="salir"]')) {
      cerrarSesion();
      location.hash = '#/';
    }
  });
  header.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-action-form="buscar"]');
    if (!form) return;
    e.preventDefault();
    const q = new FormData(form).get('q')?.toString().trim();
    location.hash = `#/eventos${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  });
  activarFallbackAvatares(header);

  pintar();
  const quitar = [on('session:cambio', pintar)];
  window.addEventListener('hashchange', marcarActivo);
  return {
    el: header,
    destroy() {
      quitar.forEach((fn) => fn());
      window.removeEventListener('hashchange', marcarActivo);
    },
  };
}
