import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { formatDate } from '../../../shared/utils/format-date.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import { showToast } from '../../../shared/ui/toast.js';
import {
  ESTADOS_USUARIO,
  ROLES,
  cambiarEstadoUsuario,
  cargarUsuarios,
  crearAdmin,
  filtrosAQuery,
  leerFiltrosUsuarios,
} from '../admin.service.js';
import { crearPaginaLista } from '../components/admin-list.js';
import { badgeEstadoUsuario, badgeRol } from '../components/admin-ui.js';
import { dialogoCrearAdmin } from '../components/dialogs.js';
import { filtroSelect, filtroTexto } from '../components/filtros-ui.js';

/** Cambia el estado de un usuario tras confirmarlo. */
async function cambiarEstado({ item, ejecutar }, estado) {
  const suspender = estado === 'SUSPENDIDO';
  const ok = await confirmDialog({
    titulo: suspender ? 'Suspender usuario' : 'Reactivar usuario',
    mensaje: suspender
      ? `¿Suspender a ${item.nombre}? Perderá el acceso de inmediato y sus eventos saldrán del catálogo.`
      : `¿Reactivar a ${item.nombre}? Recuperará el acceso con su misma sesión.`,
    confirmar: suspender ? 'Suspender' : 'Reactivar',
    peligro: suspender,
  });
  if (!ok) return;
  ejecutar(
    () => cambiarEstadoUsuario(item.id, estado),
    suspender ? 'Usuario suspendido.' : 'Usuario reactivado.',
  );
}

/** Usuarios: filtros por rol, estado y búsqueda; suspender o activar; crear otro ADMIN. */
export const usersPage = crearPaginaLista({
  titulo: 'Usuarios',
  descripcion: 'Busca, suspende o reactiva cuentas y crea otros administradores.',
  ruta: '#/admin/usuarios',
  cabeceraExtra: html`<button type="button" class="btn btn-primary" data-action="crear-admin">
    <i class="bi bi-person-plus me-1" aria-hidden="true"></i>Crear administrador
  </button>`,
  leerFiltros: leerFiltrosUsuarios,
  aQuery: (f) => filtrosAQuery(f),
  formularioFiltros: (f) => html`
    ${filtroTexto({
      name: 'q',
      label: 'Buscar',
      valor: f.q,
      placeholder: 'Nombre, correo o nombre artístico',
      retraso: true,
      maxlength: 100,
    })}
    ${filtroSelect({ name: 'rol', label: 'Rol', valor: f.rol, opciones: ROLES })}
    ${filtroSelect({ name: 'estado', label: 'Estado', valor: f.estado, opciones: ESTADOS_USUARIO })}
  `,
  leerFormulario: (form) => ({
    q: form.elements.q.value.trim(),
    rol: form.elements.rol.value,
    estado: form.elements.estado.value,
  }),
  cargar: cargarUsuarios,
  columnas: ['Usuario', 'Correo', 'Rol', 'Estado', 'Registro', 'Acciones'],
  fila: (u) => {
    const yo = sessionState.get().usuario?.id === u.id;
    return html`<tr data-id="${u.id}">
      <td>
        ${u.nombre} ${yo ? html`<span class="admin-sub d-inline">(tú)</span>` : ''}
        ${u.nombre_artistico ? html`<span class="admin-sub">${u.nombre_artistico}</span>` : ''}
      </td>
      <td>${u.email}</td>
      <td>${badgeRol(u.rol)}</td>
      <td>${badgeEstadoUsuario(u.estado)}</td>
      <td class="admin-nowrap">${formatDate(u.creado_en)}</td>
      <td>
        ${
          u.estado === 'ACTIVO'
            ? html`<button
              type="button"
              class="btn btn-outline-danger btn-sm"
              data-action="suspender"
              data-id="${u.id}"
            >
              Suspender
            </button>`
            : html`<button
              type="button"
              class="btn btn-outline-light btn-sm"
              data-action="activar"
              data-id="${u.id}"
            >
              Reactivar
            </button>`
        }
      </td>
    </tr>`;
  },
  vacio: (f) =>
    f.q || f.rol || f.estado
      ? {
          icono: 'bi-funnel',
          titulo: 'No hay usuarios con esos filtros',
          mensaje: 'Prueba con otra búsqueda o quita algún filtro.',
        }
      : {
          icono: 'bi-people',
          titulo: 'Aún no hay usuarios',
          mensaje: 'Cuando alguien se registre, aparecerá aquí.',
        },
  acciones: {
    suspender: (c) => cambiarEstado(c, 'SUSPENDIDO'),
    activar: (c) => cambiarEstado(c, 'ACTIVO'),
    'crear-admin': async ({ recargar }) => {
      const creado = await dialogoCrearAdmin((valores) => crearAdmin(valores));
      if (creado) {
        showToast('Administrador creado.', 'success');
        recargar();
      }
    },
  },
});
