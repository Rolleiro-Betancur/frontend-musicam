import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { debounce } from '../../../shared/utils/debounce.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { categoryChips } from '../../../shared/ui/category-chips.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { eventCardSkeleton } from '../../../shared/ui/event-card.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { activarFavoritos, eventCardConFavorito } from '../components/favorite-button.js';
import { precargarSocial } from '../social.service.js';
import {
  ESTADOS_CATALOGO,
  buscarEventos,
  filtrosAQuery,
  hayFiltros,
  leerFiltros,
  validarRango,
} from '../catalog.service.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

const SIN_FILTROS = { q: '', categoria: '', estado: '', desde: '', hasta: '', page: 1 };

/** Catálogo con búsqueda (debounce 300 ms), filtros sincronizados con la URL y paginación. */
export async function eventsPage(ctx) {
  let filtros = leerFiltros(ctx.query);
  let secuencia = 0;
  let controlador = null;

  const el = fromHtml(
    html`<div class="container py-4">
      <h1 class="mb-3">Descubre conciertos</h1>
      <form class="catalog-filters mb-3" role="search" novalidate data-form>
        <div class="catalog-filters__search">
          <label class="form-label" for="filtro-q">Buscar por título o artista</label>
          <input
            id="filtro-q"
            name="q"
            type="search"
            class="form-control"
            maxlength="100"
            value="${filtros.q}"
            autocomplete="off"
          />
        </div>
        <div>
          <label class="form-label" for="filtro-estado">Estado</label>
          <select id="filtro-estado" name="estado" class="form-select">
            ${ESTADOS_CATALOGO.map(
              ([valor, etiqueta]) =>
                html`<option value="${valor}" ${valor === filtros.estado ? html`selected` : ''}>
                  ${etiqueta}
                </option>`,
            )}
          </select>
        </div>
        <div>
          <label class="form-label" for="filtro-desde">Desde</label>
          <input id="filtro-desde" name="desde" type="date" class="form-control" value="${filtros.desde}" />
        </div>
        <div>
          <label class="form-label" for="filtro-hasta">Hasta</label>
          <input id="filtro-hasta" name="hasta" type="date" class="form-control" value="${filtros.hasta}" />
        </div>
        <div class="d-flex align-items-end">
          <button type="button" class="btn btn-outline-light w-100" data-action="limpiar">
            Limpiar filtros
          </button>
        </div>
      </form>
      <div class="invalid-feedback d-block mb-2" data-rango role="alert"></div>
      <div class="mb-4" data-chips></div>
      <p class="text-muted-2" data-resumen role="status" aria-live="polite"></p>
      <div data-resultados></div>
      <div class="mt-4" data-paginacion></div>
    </div>`,
    'section',
  );
  activarFallbackPortadas(el);
  // Si el router abandona la ruta, se cancela también la petición en curso de esta pantalla.
  ctx.signal.addEventListener('abort', () => controlador?.abort(), { once: true });

  const form = el.querySelector('[data-form]');
  const chips = el.querySelector('[data-chips]');
  const resultados = el.querySelector('[data-resultados]');
  const resumen = el.querySelector('[data-resumen]');
  const paginacion = el.querySelector('[data-paginacion]');
  const rango = el.querySelector('[data-rango]');

  function pintarChips() {
    setHtml(
      chips,
      categoryChips({ modo: 'button', seleccionada: filtros.categoria, incluirTodas: true }),
    );
  }

  /** `push` crea una entrada de historial; `replace` se usa al teclear en la búsqueda. */
  function sincronizarUrl(modo) {
    const destino = `#/eventos${filtrosAQuery(filtros)}`;
    if (destino === location.hash) return;
    history[modo === 'replace' ? 'replaceState' : 'pushState'](null, '', destino);
  }

  function pintarCargando() {
    resumen.textContent = 'Cargando eventos…';
    paginacion.replaceChildren();
    setHtml(
      resultados,
      html`<div class="event-grid" aria-hidden="true">
        ${Array.from({ length: 6 }, () => eventCardSkeleton())}
      </div>`,
    );
  }

  async function cargar() {
    const errorRango = validarRango(filtros);
    rango.textContent = errorRango ?? '';
    if (errorRango) {
      resumen.textContent = '';
      resultados.replaceChildren();
      paginacion.replaceChildren();
      return;
    }

    controlador?.abort();
    controlador = new AbortController();
    const propia = ++secuencia;
    pintarCargando();

    try {
      const [pagina] = await Promise.all([
        buscarEventos(filtros, controlador.signal),
        precargarSocial(controlador.signal),
      ]);
      if (propia !== secuencia) return;
      pintarPagina(pagina);
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      resumen.textContent = '';
      setHtml(resultados, errorState({ mensaje: error.mensaje }));
    }
  }

  function pintarPagina({ items, page, page_size: tamano, total }) {
    paginacion.replaceChildren();
    if (!items.length) {
      resumen.textContent = 'Sin resultados.';
      setHtml(
        resultados,
        hayFiltros(filtros)
          ? html`${emptyState({
              icono: 'bi-search',
              titulo: 'No encontramos eventos con esos filtros',
              mensaje: 'Prueba con otra búsqueda o quita algún filtro.',
            })}
              <div class="text-center">
                <button type="button" class="btn btn-outline-light" data-action="limpiar">
                  Limpiar filtros
                </button>
              </div>`
          : emptyState({
              icono: 'bi-music-note-list',
              titulo: 'Aún no hay conciertos publicados',
              mensaje: 'Vuelve pronto: los artistas están preparando sus próximos eventos.',
            }),
      );
      return;
    }
    resumen.textContent = `${total} ${total === 1 ? 'evento' : 'eventos'}`;
    setHtml(
      resultados,
      html`<div class="event-grid">${items.map((e) => eventCardConFavorito(e))}</div>`,
    );
    setHtml(paginacion, pagination({ page, pageSize: tamano, total }));
  }

  function aplicar(cambios, { modo = 'push', recargar = true } = {}) {
    filtros = { ...filtros, page: 1, ...cambios };
    sincronizarUrl(modo);
    pintarChips();
    if (recargar) cargar();
  }

  const buscarDebounced = debounce(
    (valor) => aplicar({ q: valor.trim() }, { modo: 'replace' }),
    300,
  );

  const quitarClic = delegate(el, 'click', {
    categoria: (_e, boton) => aplicar({ categoria: boton.dataset.valor }),
    'ir-pagina': (_e, boton) => {
      aplicar({ page: Number(boton.dataset.page) });
      irAlInicioDe(el.querySelector('h1'));
    },
    limpiar: () => {
      form.reset();
      form.elements.q.value = '';
      form.elements.estado.value = '';
      form.elements.desde.value = '';
      form.elements.hasta.value = '';
      buscarDebounced.cancel();
      aplicar({ ...SIN_FILTROS });
    },
    reintentar: cargar,
  });
  const alEscribir = (e) => {
    if (e.target.name === 'q') buscarDebounced(e.target.value);
  };
  const alCambiar = (e) => {
    if (['estado', 'desde', 'hasta'].includes(e.target.name)) {
      aplicar({ [e.target.name]: e.target.value });
    }
  };
  form.addEventListener('input', alEscribir);
  form.addEventListener('change', alCambiar);
  form.addEventListener('submit', (e) => e.preventDefault());

  const quitarFavoritos = activarFavoritos(el);
  pintarChips();
  cargar();
  return {
    title: 'Descubre conciertos',
    el,
    destroy() {
      quitarClic();
      quitarFavoritos();
      buscarDebounced.cancel();
      controlador?.abort();
    },
  };
}
