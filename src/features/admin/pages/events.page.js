import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { CATEGORIAS, etiquetaCategoria } from '../../../shared/utils/categorias.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import {
  ESTADOS_EVENTO,
  cargarEventos,
  filtrosAQuery,
  leerFiltrosEventos,
  reactivarEvento,
  suspenderEvento,
  validarRango,
} from '../admin.service.js';
import { crearPaginaLista } from '../components/admin-list.js';
import { badge, badgeEstadoEvento } from '../components/admin-ui.js';
import { pedirMotivo } from '../components/dialogs.js';
import { filtroFecha, filtroSelect, filtroTexto } from '../components/filtros-ui.js';

/** Eventos: todos los estados, con filtros; suspender (con motivo) y reactivar. */
export const adminEventsPage = crearPaginaLista({
  titulo: 'Eventos',
  descripcion:
    'Todos los eventos, también borradores, cancelados y suspendidos. Suspender corta la venta y la reproducción, pero no cancela el evento.',
  ruta: '#/admin/eventos',
  leerFiltros: leerFiltrosEventos,
  aQuery: (f) => filtrosAQuery(f),
  formularioFiltros: (f) => html`
    ${filtroTexto({
      name: 'q',
      label: 'Buscar',
      valor: f.q,
      placeholder: 'Título o artista',
      retraso: true,
      maxlength: 100,
    })}
    ${filtroSelect({ name: 'categoria', label: 'Categoría', valor: f.categoria, opciones: CATEGORIAS })}
    ${filtroSelect({ name: 'estado', label: 'Estado', valor: f.estado, opciones: ESTADOS_EVENTO })}
    ${filtroSelect({
      name: 'suspendido',
      label: 'Moderación',
      valor: f.suspendido,
      opciones: [
        ['true', 'Suspendidos'],
        ['false', 'No suspendidos'],
      ],
    })}
    ${filtroFecha({ name: 'desde', label: 'Desde', valor: f.desde })}
    ${filtroFecha({ name: 'hasta', label: 'Hasta', valor: f.hasta })}
  `,
  leerFormulario: (form) => ({
    q: form.elements.q.value.trim(),
    categoria: form.elements.categoria.value,
    estado: form.elements.estado.value,
    suspendido: form.elements.suspendido.value,
    desde: form.elements.desde.value,
    hasta: form.elements.hasta.value,
  }),
  validar: validarRango,
  cargar: cargarEventos,
  columnas: ['Evento', 'Estado', 'Fecha', 'Precio', 'Acciones'],
  fila: (e) => html`<tr data-id="${e.id}">
    <td>
      <a href="#/eventos/${encodeURIComponent(e.id)}">${e.titulo}</a>
      <span class="admin-sub">${e.artista?.nombre_artistico ?? ''} · ${etiquetaCategoria(e.categoria)}</span>
    </td>
    <td>
      ${badgeEstadoEvento(e.estado)}
      ${
        e.suspendido_admin
          ? html`<div class="mt-1">${badge('Suspendido', 'danger')}</div>
            ${
              e.motivo_suspension
                ? html`<span class="admin-sub">Motivo: ${e.motivo_suspension}</span>`
                : ''
            }`
          : ''
      }
    </td>
    <td class="admin-nowrap">${formatDateTime(e.fecha_inicio)}</td>
    <td class="admin-nowrap">${formatCop(e.precio_cop)}</td>
    <td>
      ${
        e.suspendido_admin
          ? html`<button
            type="button"
            class="btn btn-outline-light btn-sm"
            data-action="reactivar"
            data-id="${e.id}"
          >
            Reactivar
          </button>`
          : html`<button
            type="button"
            class="btn btn-outline-danger btn-sm"
            data-action="suspender"
            data-id="${e.id}"
          >
            Suspender
          </button>`
      }
    </td>
  </tr>`,
  vacio: (f) =>
    Object.entries(f).some(([k, v]) => k !== 'page' && v !== '')
      ? {
          icono: 'bi-funnel',
          titulo: 'No hay eventos con esos filtros',
          mensaje: 'Prueba con otra búsqueda o quita algún filtro.',
        }
      : {
          icono: 'bi-calendar-x',
          titulo: 'Aún no hay eventos',
          mensaje: 'Los artistas aún no han creado eventos.',
        },
  acciones: {
    suspender: async ({ item, ejecutar }) => {
      const motivo = await pedirMotivo({
        titulo: 'Suspender evento',
        mensaje: `«${item.titulo}» saldrá del catálogo y no se podrá comprar ni ver. Indica el motivo.`,
        confirmar: 'Suspender evento',
      });
      if (motivo) ejecutar(() => suspenderEvento(item.id, motivo), 'Evento suspendido.');
    },
    reactivar: async ({ item, ejecutar }) => {
      const ok = await confirmDialog({
        titulo: 'Reactivar evento',
        mensaje: `¿Reactivar «${item.titulo}»? Volverá al catálogo y se podrá comprar y ver de nuevo.`,
        confirmar: 'Reactivar',
      });
      if (ok) ejecutar(() => reactivarEvento(item.id), 'Evento reactivado.');
    },
  },
});
