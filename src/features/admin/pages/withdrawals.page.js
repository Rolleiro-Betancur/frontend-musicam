import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import {
  ESTADOS_RETIRO,
  ETIQUETA_TIPO_CUENTA,
  aprobarRetiro,
  cargarRetiros,
  filtrosRetirosAQuery,
  leerFiltrosRetiros,
  rechazarRetiro,
} from '../admin.service.js';
import { crearPaginaLista } from '../components/admin-list.js';
import { badgeEstadoRetiro } from '../components/admin-ui.js';
import { pedirMotivo } from '../components/dialogs.js';
import { filtroSelect } from '../components/filtros-ui.js';

function detalle(r) {
  if (r.estado === 'RECHAZADO') {
    return html`<span class="text-danger">${r.motivo_rechazo || 'Sin motivo indicado.'}</span>
      <span class="admin-sub">Resuelto: ${formatDateTime(r.resuelto_en)}</span>`;
  }
  if (r.estado === 'PAGADO') {
    return html`<span class="admin-ref">${r.referencia_pago}</span>
      <span class="admin-sub">Resuelto: ${formatDateTime(r.resuelto_en)}</span>`;
  }
  return html`<span class="text-muted-2">Pendiente de aprobación</span>`;
}

/** Cola de retiros: aprobar (con confirmación) o rechazar (con motivo obligatorio). */
export const withdrawalsPage = crearPaginaLista({
  titulo: 'Retiros',
  descripcion:
    'Cola de retiros de los artistas. Aprobar marca el retiro como pagado (simulado); rechazar exige un motivo y devuelve el dinero al saldo disponible.',
  ruta: '#/admin/retiros',
  leerFiltros: leerFiltrosRetiros,
  aQuery: filtrosRetirosAQuery,
  formularioFiltros: (f) =>
    filtroSelect({ name: 'estado', label: 'Estado', valor: f.estado, opciones: ESTADOS_RETIRO }),
  leerFormulario: (form) => ({ estado: form.elements.estado.value }),
  cargar: cargarRetiros,
  columnas: ['Solicitado', 'Artista', 'Monto', 'Cuenta', 'Estado', 'Detalle', 'Acciones'],
  fila: (r) => html`<tr data-id="${r.id}">
    <td class="admin-nowrap">${formatDateTime(r.solicitado_en)}</td>
    <td>${r.artista?.nombre_artistico}</td>
    <td class="admin-nowrap fw-semibold">${formatCop(r.monto_cop)}</td>
    <td>
      ${r.banco}
      <span class="admin-sub">
        ${ETIQUETA_TIPO_CUENTA[r.tipo_cuenta] ?? r.tipo_cuenta} ••••${r.cuenta_ultimos4}
      </span>
    </td>
    <td>${badgeEstadoRetiro(r.estado)}</td>
    <td>${detalle(r)}</td>
    <td class="admin-nowrap">
      ${
        r.estado === 'PENDIENTE'
          ? html`<button
              type="button"
              class="btn btn-primary btn-sm"
              data-action="aprobar"
              data-id="${r.id}"
            >
              Aprobar
            </button>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm"
              data-action="rechazar"
              data-id="${r.id}"
            >
              Rechazar
            </button>`
          : ''
      }
    </td>
  </tr>`,
  vacio: (f) =>
    f.estado === 'PENDIENTE'
      ? {
          icono: 'bi-check2-all',
          titulo: 'No hay retiros pendientes',
          mensaje: 'La cola está al día. Cambia el filtro para ver los ya resueltos.',
        }
      : f.estado
        ? {
            icono: 'bi-funnel',
            titulo: 'No hay retiros con ese estado',
            mensaje: 'Prueba con otro filtro.',
          }
        : {
            icono: 'bi-cash-coin',
            titulo: 'Aún no hay retiros',
            mensaje: 'Los retiros que soliciten los artistas aparecerán aquí.',
          },
  acciones: {
    aprobar: async ({ item, ejecutar }) => {
      const ok = await confirmDialog({
        titulo: 'Aprobar retiro',
        mensaje: `¿Aprobar el retiro de ${formatCop(item.monto_cop)} para ${item.artista?.nombre_artistico} (${item.banco} ••••${item.cuenta_ultimos4})? Se marcará como pagado (simulado).`,
        confirmar: 'Aprobar retiro',
      });
      if (ok) ejecutar(() => aprobarRetiro(item.id), 'Retiro aprobado y pagado.');
    },
    rechazar: async ({ item, ejecutar }) => {
      const motivo = await pedirMotivo({
        titulo: 'Rechazar retiro',
        mensaje: `Vas a rechazar el retiro de ${formatCop(item.monto_cop)} de ${item.artista?.nombre_artistico}. El dinero volverá a su saldo disponible.`,
        confirmar: 'Rechazar retiro',
      });
      if (motivo) ejecutar(() => rechazarRetiro(item.id, motivo), 'Retiro rechazado.');
    },
  },
});
