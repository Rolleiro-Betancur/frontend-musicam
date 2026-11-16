import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import {
  ESTADOS_COMPRA,
  METODOS_PAGO,
  cargarCompras,
  filtrosAQuery,
  leerFiltrosCompras,
  validarRango,
} from '../admin.service.js';
import { crearPaginaLista } from '../components/admin-list.js';
import { badgeEstadoCompra, badgeEstadoEvento } from '../components/admin-ui.js';
import { filtroFecha, filtroSelect, filtroTexto } from '../components/filtros-ui.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida los identificadores que se escriben a mano en los filtros. */
function validar(filtros) {
  for (const [campo, nombre] of [
    ['evento_id', 'evento'],
    ['usuario_id', 'usuario'],
  ]) {
    if (filtros[campo] && !UUID.test(filtros[campo])) {
      return `El ID del ${nombre} no es válido: debe ser un identificador con formato UUID.`;
    }
  }
  return validarRango(filtros);
}

/** Compras: solo lectura, con filtros por estado, evento, usuario y fechas de creación. */
export const purchasesPage = crearPaginaLista({
  titulo: 'Compras',
  descripcion:
    'Consulta de solo lectura. Pulsa el nombre de un comprador o de un evento para filtrar por él. Las fechas se filtran por la fecha de creación de la compra.',
  ruta: '#/admin/compras',
  leerFiltros: leerFiltrosCompras,
  aQuery: (f) => filtrosAQuery(f),
  formularioFiltros: (f) => html`
    ${filtroSelect({ name: 'estado', label: 'Estado', valor: f.estado, opciones: ESTADOS_COMPRA })}
    ${filtroTexto({
      name: 'evento_id',
      label: 'ID del evento',
      valor: f.evento_id,
      placeholder: 'UUID',
      maxlength: 36,
    })}
    ${filtroTexto({
      name: 'usuario_id',
      label: 'ID del usuario',
      valor: f.usuario_id,
      placeholder: 'UUID',
      maxlength: 36,
    })}
    ${filtroFecha({ name: 'desde', label: 'Desde', valor: f.desde })}
    ${filtroFecha({ name: 'hasta', label: 'Hasta', valor: f.hasta })}
  `,
  leerFormulario: (form) => ({
    estado: form.elements.estado.value,
    evento_id: form.elements.evento_id.value.trim(),
    usuario_id: form.elements.usuario_id.value.trim(),
    desde: form.elements.desde.value,
    hasta: form.elements.hasta.value,
  }),
  validar,
  cargar: cargarCompras,
  columnas: [
    'Fecha',
    'Comprador',
    'Evento',
    'Método',
    'Monto',
    'Comisión',
    'Neto artista',
    'Estado',
    'Referencia',
  ],
  fila: (c) => html`<tr data-id="${c.id}">
    <td class="admin-nowrap">${formatDateTime(c.creado_en)}</td>
    <td>
      <button type="button" class="admin-link" data-action="filtrar-usuario" data-valor="${c.usuario?.id}">
        ${c.usuario?.nombre}
      </button>
    </td>
    <td>
      <button type="button" class="admin-link" data-action="filtrar-evento" data-valor="${c.evento?.id}">
        ${c.evento?.titulo}
      </button>
      <span class="admin-sub">${badgeEstadoEvento(c.evento?.estado)}</span>
    </td>
    <td>${METODOS_PAGO[c.metodo_pago] ?? c.metodo_pago}</td>
    <td class="admin-nowrap fw-semibold">${formatCop(c.monto_cop)}</td>
    <td class="admin-nowrap">${formatCop(c.comision_cop)}</td>
    <td class="admin-nowrap">${formatCop(c.neto_artista_cop)}</td>
    <td>${badgeEstadoCompra(c.estado)}</td>
    <td><span class="admin-ref">${c.referencia}</span></td>
  </tr>`,
  vacio: (f) =>
    Object.entries(f).some(([k, v]) => k !== 'page' && v !== '')
      ? {
          icono: 'bi-funnel',
          titulo: 'No hay compras con esos filtros',
          mensaje: 'Prueba con otros filtros.',
        }
      : {
          icono: 'bi-receipt',
          titulo: 'Aún no hay compras',
          mensaje: 'Cuando se compre una entrada, aparecerá aquí.',
        },
  acciones: {
    'filtrar-usuario': ({ boton, fijarFiltros }) =>
      fijarFiltros({ usuario_id: boton.dataset.valor }),
    'filtrar-evento': ({ boton, fijarFiltros }) => fijarFiltros({ evento_id: boton.dataset.valor }),
  },
});
