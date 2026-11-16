import '../studio.css';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { showToast } from '../../../shared/ui/toast.js';
import { esqueletoLista, filaEvento } from '../components/studio-views.js';
import {
  ESTADOS_FILTRO,
  PAGE_SIZE,
  cancelar,
  eliminar,
  listarEventos,
  publicar,
} from '../studio.service.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

const TEXTO_CANCELAR =
  'Si cancelas este evento dejará de estar a la venta y las entradas ya vendidas se reembolsarán. Esta acción no se puede deshacer.';

/** Lista de mis eventos con filtro por estado y acciones según el estado (§5.5). */
export async function myEventsPage(ctx) {
  const filtros = { estado: ctx.query.get('estado') ?? '', page: 1 };
  if (!ESTADOS_FILTRO.some(([valor]) => valor === filtros.estado)) filtros.estado = '';
  let secuencia = 0;
  let ocupado = false;
  const eventos = new Map(); // id → evento de la página visible (para los diálogos)

  const el = fromHtml(
    html`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="mb-0">Mis eventos</h1>
        <a class="btn btn-primary" href="#/estudio/eventos/nuevo">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Crear evento
        </a>
      </div>
      <div class="mb-3" style="max-width:260px">
        <label class="form-label" for="filtro-estado">Estado</label>
        <select id="filtro-estado" class="form-select" data-filtro>
          ${ESTADOS_FILTRO.map(
            ([valor, etiqueta]) =>
              html`<option value="${valor}" ${valor === filtros.estado ? html`selected` : ''}>
                ${etiqueta}
              </option>`,
          )}
        </select>
      </div>
      <p class="text-muted-2" role="status" aria-live="polite" data-resumen></p>
      <div data-lista></div>
      <div class="mt-4" data-paginacion></div>`,
    'section',
  );
  activarFallbackPortadas(el);
  const lista = el.querySelector('[data-lista]');
  const resumen = el.querySelector('[data-resumen]');
  const paginacion = el.querySelector('[data-paginacion]');

  function pintar({ items, page, page_size: tamano, total }) {
    eventos.clear();
    items.forEach((e) => eventos.set(e.id, e));
    paginacion.replaceChildren();
    if (!items.length) {
      resumen.textContent = 'Sin resultados.';
      setHtml(
        lista,
        filtros.estado
          ? emptyState({
              icono: 'bi-funnel',
              titulo: 'No tienes eventos con ese estado',
              mensaje: 'Prueba con otro filtro.',
            })
          : emptyState({
              icono: 'bi-calendar-plus',
              titulo: 'Aún no has creado eventos',
              mensaje: 'Crea tu primer evento y publícalo: no necesitas ninguna aprobación.',
              accion: { href: '#/estudio/eventos/nuevo', texto: 'Crear evento' },
            }),
      );
      return;
    }
    resumen.textContent = `${total} ${total === 1 ? 'evento' : 'eventos'}`;
    setHtml(
      lista,
      html`<ul class="studio-list">
        ${items.map((e) => filaEvento(e))}
      </ul>`,
    );
    setHtml(paginacion, pagination({ page, pageSize: tamano, total }));
  }

  async function cargar() {
    const propia = ++secuencia;
    resumen.textContent = 'Cargando eventos…';
    paginacion.replaceChildren();
    setHtml(lista, esqueletoLista());
    try {
      const pagina = await listarEventos({ ...filtros, pageSize: PAGE_SIZE }, ctx.signal);
      if (propia !== secuencia) return;
      // Si se eliminó el último evento de la última página, se retrocede una.
      if (!pagina.items.length && filtros.page > 1) {
        filtros.page -= 1;
        return cargar();
      }
      pintar(pagina);
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      resumen.textContent = '';
      setHtml(lista, errorState({ mensaje: error.mensaje }));
    }
  }

  /** Ejecuta una acción sobre una fila con sus botones bloqueados (evita el doble envío). */
  async function sobreFila(id, trabajo, textoExito) {
    if (ocupado) return;
    ocupado = true;
    const botones = el.querySelectorAll(`[data-evento="${CSS.escape(id)}"] button`);
    botones.forEach((b) => (b.disabled = true));
    try {
      await trabajo();
      showToast(textoExito, 'success');
      await cargar();
    } catch (error) {
      if (!error.cancelada) showToast(error.mensaje, 'danger');
      botones.forEach((b) => (b.disabled = false));
    } finally {
      ocupado = false;
    }
  }

  const accion = (fn) => (_e, boton) => fn(boton.dataset.id);
  const quitarClic = delegate(el, 'click', {
    publicar: accion((id) =>
      sobreFila(id, () => publicar(id, ctx.signal), 'Evento publicado. Ya aparece en el catálogo.'),
    ),
    eliminar: accion(async (id) => {
      const titulo = eventos.get(id)?.titulo ?? 'este borrador';
      const ok = await confirmDialog({
        titulo: 'Eliminar borrador',
        mensaje: `¿Eliminar «${titulo}»? Esta acción no se puede deshacer.`,
        confirmar: 'Eliminar',
        peligro: true,
      });
      if (ok) sobreFila(id, () => eliminar(id, ctx.signal), 'Borrador eliminado.');
    }),
    cancelar: accion(async (id) => {
      const titulo = eventos.get(id)?.titulo ?? 'este evento';
      const ok = await confirmDialog({
        titulo: `Cancelar «${titulo}»`,
        mensaje: TEXTO_CANCELAR,
        confirmar: 'Cancelar evento',
        cancelar: 'Volver',
        peligro: true,
      });
      if (ok) {
        sobreFila(
          id,
          () => cancelar(id, ctx.signal),
          'Evento cancelado. Se reembolsarán las entradas.',
        );
      }
    }),
    'ir-pagina': (_e, boton) => {
      filtros.page = Number(boton.dataset.page);
      cargar();
      irAlInicioDe(el.querySelector('h1'));
    },
    reintentar: cargar,
  });
  const alFiltrar = (e) => {
    if (e.target.matches('[data-filtro]')) {
      filtros.estado = e.target.value;
      filtros.page = 1;
      cargar();
    }
  };
  el.addEventListener('change', alFiltrar);

  cargar();
  return {
    title: 'Mis eventos',
    el,
    destroy() {
      quitarClic();
      el.removeEventListener('change', alFiltrar);
    },
  };
}
