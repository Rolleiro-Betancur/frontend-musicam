import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { debounce } from '../../../shared/utils/debounce.js';
import { activarFallbackAvatares } from '../../../shared/ui/avatar.js';
import { artistCardSkeleton } from '../../../shared/ui/artist-card.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { activarSeguir, artistCardConSeguir } from '../components/follow-button.js';
import { precargarSocial } from '../social.service.js';
import { artistasAQuery, buscarArtistas, leerFiltrosArtistas } from '../catalog.service.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

/** Directorio de artistas con búsqueda por nombre (debounce 300 ms) y paginación. */
export async function artistsPage(ctx) {
  let filtros = leerFiltrosArtistas(ctx.query);
  let secuencia = 0;
  let controlador = null;

  const el = fromHtml(
    html`<div class="container py-4">
      <h1 class="mb-3">Artistas</h1>
      <form role="search" class="mb-3" style="max-width:480px" novalidate data-form>
        <label class="form-label" for="artistas-q">Buscar por nombre artístico</label>
        <input
          id="artistas-q"
          name="q"
          type="search"
          class="form-control"
          maxlength="100"
          value="${filtros.q}"
          autocomplete="off"
        />
      </form>
      <p class="text-muted-2" data-resumen role="status" aria-live="polite"></p>
      <div data-resultados></div>
      <div class="mt-4" data-paginacion></div>
    </div>`,
    'section',
  );
  activarFallbackAvatares(el);
  ctx.signal.addEventListener('abort', () => controlador?.abort(), { once: true });

  const form = el.querySelector('[data-form]');
  const resultados = el.querySelector('[data-resultados]');
  const resumen = el.querySelector('[data-resumen]');
  const paginacion = el.querySelector('[data-paginacion]');

  function sincronizarUrl(modo) {
    const destino = `#/artistas${artistasAQuery(filtros)}`;
    if (destino === location.hash) return;
    history[modo === 'replace' ? 'replaceState' : 'pushState'](null, '', destino);
  }

  function pintarPagina({ items, page, page_size: tamano, total }) {
    paginacion.replaceChildren();
    if (!items.length) {
      resumen.textContent = 'Sin resultados.';
      setHtml(
        resultados,
        filtros.q
          ? html`${emptyState({
              icono: 'bi-search',
              titulo: 'No encontramos artistas con ese nombre',
              mensaje: 'Revisa la ortografía o prueba con otra búsqueda.',
            })}
              <div class="text-center">
                <button type="button" class="btn btn-outline-light" data-action="limpiar">
                  Ver todos los artistas
                </button>
              </div>`
          : emptyState({
              icono: 'bi-mic',
              titulo: 'Aún no hay artistas',
              mensaje: 'Cuando los artistas se registren, aparecerán aquí.',
            }),
      );
      return;
    }
    resumen.textContent = `${total} ${total === 1 ? 'artista' : 'artistas'}`;
    setHtml(
      resultados,
      html`<div class="artist-grid">${items.map((a) => artistCardConSeguir(a))}</div>`,
    );
    setHtml(paginacion, pagination({ page, pageSize: tamano, total }));
  }

  async function cargar() {
    controlador?.abort();
    controlador = new AbortController();
    const propia = ++secuencia;
    resumen.textContent = 'Cargando artistas…';
    paginacion.replaceChildren();
    setHtml(
      resultados,
      html`<div class="artist-grid" aria-hidden="true">
        ${Array.from({ length: 6 }, () => artistCardSkeleton())}
      </div>`,
    );
    try {
      const [pagina] = await Promise.all([
        buscarArtistas(filtros, controlador.signal),
        precargarSocial(controlador.signal),
      ]);
      if (propia === secuencia) pintarPagina(pagina);
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      resumen.textContent = '';
      setHtml(resultados, errorState({ mensaje: error.mensaje }));
    }
  }

  function aplicar(cambios, modo = 'push') {
    filtros = { ...filtros, page: 1, ...cambios };
    sincronizarUrl(modo);
    cargar();
  }

  const buscarDebounced = debounce((valor) => aplicar({ q: valor.trim() }, 'replace'), 300);
  const quitarClic = delegate(el, 'click', {
    'ir-pagina': (_e, boton) => {
      aplicar({ page: Number(boton.dataset.page) });
      irAlInicioDe(el.querySelector('h1'));
    },
    limpiar: () => {
      form.elements.q.value = '';
      buscarDebounced.cancel();
      aplicar({ q: '' });
    },
    reintentar: cargar,
  });
  const alEscribir = (e) => {
    if (e.target.name === 'q') buscarDebounced(e.target.value);
  };
  form.addEventListener('input', alEscribir);
  form.addEventListener('submit', (e) => e.preventDefault());

  const quitarSeguir = activarSeguir(el);
  cargar();
  return {
    title: 'Artistas',
    el,
    destroy() {
      quitarClic();
      quitarSeguir();
      buscarDebounced.cancel();
      controlador?.abort();
    },
  };
}
