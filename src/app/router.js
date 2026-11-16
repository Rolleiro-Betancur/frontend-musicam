import { config } from '../core/config.js';
import { on } from '../core/event-bus.js';
import { parseHash } from '../shared/utils/query-string.js';
import { setHtml } from '../shared/utils/dom.js';
import { errorState } from '../shared/ui/empty-state.js';
import { skeletonPage } from '../shared/ui/skeleton.js';
import { soloInvitados } from './guards.js';
import { notFoundRoute } from './routes.js';
import { encontrarRuta } from './route-match.js';
import { createPublicLayout } from './layouts/public.layout.js';
import { createStudioLayout } from './layouts/studio.layout.js';
import { createAdminLayout } from './layouts/admin.layout.js';

const LAYOUTS = {
  public: createPublicLayout,
  studio: createStudioLayout,
  admin: createAdminLayout,
};

/**
 * Mueve el foco al `<h1>` de la pantalla al navegar (§6.5). En la carga inicial no se mueve: así el
 * primer Tab llega al enlace "Saltar al contenido". Esto también asegura que haya un `<h1>`.
 * Si el estado actual no tiene (un error, p. ej.),
 * se añade uno solo para lectores de pantalla: cada pantalla tiene siempre un único `<h1>`.
 */
export function enfocarTitulo(outlet, titulo, { enfocar = true } = {}) {
  let h1 = outlet.querySelector('h1');
  if (!h1) {
    h1 = document.createElement('h1');
    h1.className = 'visually-hidden';
    h1.textContent = titulo;
    outlet.prepend(h1);
  }
  h1.tabIndex = -1;
  if (enfocar) h1.focus({ preventScroll: true });
}

/** @param {HTMLElement} appEl */
export function createRouter(appEl) {
  let layoutActual = null; // {nombre, instancia}
  let paginaActual = null;
  let controlador = null;
  let rutaActual = null;
  let idNavegacion = 0;
  let esPrimeraCarga = true;

  function asegurarLayout(nombre) {
    if (layoutActual?.nombre === nombre) return layoutActual.instancia;
    layoutActual?.instancia.destroy();
    const instancia = LAYOUTS[nombre]();
    appEl.replaceChildren(instancia.el);
    layoutActual = { nombre, instancia };
    return instancia;
  }

  function evaluar(route, hash) {
    if (route.guestOnly) {
      const r = soloInvitados();
      if (r !== true) return r;
    }
    return route.guard ? route.guard({ hash }) : true;
  }

  function irA(hash) {
    if (location.hash === hash) resolver();
    else location.replace(hash);
  }

  async function resolver() {
    const id = ++idNavegacion;
    controlador?.abort();
    paginaActual?.destroy?.();
    paginaActual = null;
    controlador = new AbortController();

    const hash = location.hash || '#/';
    const { path, query } = parseHash(hash);
    const encontrada = encontrarRuta(path);
    const route = encontrada?.route ?? notFoundRoute;
    rutaActual = route;

    const decision = evaluar(route, hash);
    if (decision !== true) return irA(decision.redirect);

    const { outlet } = asegurarLayout(route.layout ?? 'public');
    setHtml(outlet, skeletonPage());

    try {
      const paginaFn = await route.load();
      if (id !== idNavegacion) return;
      const pagina = await paginaFn({
        params: encontrada?.params ?? {},
        query,
        signal: controlador.signal,
        hash,
      });
      if (id !== idNavegacion) {
        pagina.destroy?.();
        return;
      }
      paginaActual = pagina;
      outlet.replaceChildren(pagina.el);
      document.title = `${pagina.title} · ${config.appName}`;
      window.scrollTo(0, 0);
      enfocarTitulo(outlet, pagina.title, { enfocar: !esPrimeraCarga });
      esPrimeraCarga = false;
    } catch (error) {
      if (id !== idNavegacion || error?.cancelada) return;
      setHtml(
        outlet,
        errorState({ mensaje: 'No pudimos mostrar esta pantalla.', reintentar: true }),
      );
      outlet.querySelector('[data-action="reintentar"]')?.addEventListener('click', resolver);
      enfocarTitulo(outlet, 'Error al cargar la pantalla', { enfocar: !esPrimeraCarga });
      esPrimeraCarga = false;
      if (config.isDev) console.error(error);
    }
  }

  return {
    /** Muestra el layout público con un esqueleto mientras se restaura la sesión. */
    mostrarCarga() {
      const { outlet } = asegurarLayout('public');
      setHtml(outlet, skeletonPage());
    },
    start() {
      window.addEventListener('hashchange', resolver);
      // Si la sesión cambia estando en una ruta protegida (salir, expirar), se vuelve a evaluar.
      on('session:cambio', () => {
        if (rutaActual?.guard && evaluar({ guard: rutaActual.guard }, location.hash) !== true) {
          resolver();
        }
      });
      return resolver();
    },
  };
}
