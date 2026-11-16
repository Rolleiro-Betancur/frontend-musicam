import { api } from '../../core/http/api-client.js';

/**
 * @typedef {{id: string, email: string, nombre: string, rol: 'USUARIO'|'ARTISTA'|'ADMIN',
 *   estado: 'ACTIVO'|'SUSPENDIDO', foto_url: string|null, nombre_artistico: string|null,
 *   creado_en: string}} UsuarioAdmin
 * @typedef {{id: string, artista: {id: string, nombre_artistico: string}, titulo: string,
 *   categoria: string, precio_cop: number, fecha_inicio: string, estado: string,
 *   replay_disponible: boolean, suspendido_admin: boolean, motivo_suspension: string|null,
 *   creado_en: string}} EventoAdmin
 * @typedef {{id: string, referencia: string, estado: string, metodo_pago: string,
 *   monto_cop: number, comision_cop: number, neto_artista_cop: number, creado_en: string,
 *   aprobado_en: string|null, usuario: {id: string, nombre: string},
 *   evento: {id: string, titulo: string, estado: string, fecha_inicio: string}}} CompraAdmin
 * @typedef {{id: string, artista: {id: string, nombre_artistico: string}, monto_cop: number,
 *   banco: string, tipo_cuenta: string, cuenta_ultimos4: string,
 *   estado: 'PENDIENTE'|'PAGADO'|'RECHAZADO', referencia_pago: string|null,
 *   motivo_rechazo: string|null, solicitado_en: string, resuelto_en: string|null}} RetiroAdmin
 */

const id = encodeURIComponent;

/** `GET /admin/dashboard`: agregados por SQL (usuarios, eventos, ventas, comisiones, retiros). */
export function obtenerDashboard(signal) {
  return api.get('/admin/dashboard', { signal });
}

/** `GET /admin/usuarios`: filtros `rol`, `estado` y `q`. Paginado. */
export function listarUsuarios(params, signal) {
  return api.get('/admin/usuarios', { query: params, signal });
}

/** `POST /admin/usuarios`: crea otro ADMIN (RN-01). */
export function crearAdmin(cuerpo, signal) {
  return api.post('/admin/usuarios', cuerpo, { signal });
}

/** `PATCH /admin/usuarios/{id}/estado`: suspender o activar (RN-19, RN-20). */
export function cambiarEstadoUsuario(usuarioId, estado, signal) {
  return api.patch(`/admin/usuarios/${id(usuarioId)}/estado`, { estado }, { signal });
}

/** `GET /admin/eventos`: cualquier estado, también borradores, cancelados y suspendidos. */
export function listarEventosAdmin(params, signal) {
  return api.get('/admin/eventos', { query: params, signal });
}

/** `POST /admin/eventos/{id}/suspender`: `motivo` obligatorio. */
export function suspenderEvento(eventoId, motivo, signal) {
  return api.post(`/admin/eventos/${id(eventoId)}/suspender`, { motivo }, { signal });
}

/** `POST /admin/eventos/{id}/reactivar`. */
export function reactivarEvento(eventoId, signal) {
  return api.post(`/admin/eventos/${id(eventoId)}/reactivar`, undefined, { signal });
}

/** `GET /admin/compras` (solo lectura): `estado`, `evento_id`, `usuario_id`, `desde`, `hasta`. */
export function listarComprasAdmin(params, signal) {
  return api.get('/admin/compras', { query: params, signal });
}

/** `GET /admin/retiros`: filtro opcional `estado`. */
export function listarRetirosAdmin(params, signal) {
  return api.get('/admin/retiros', { query: params, signal });
}

/** `POST /admin/retiros/{id}/aprobar`: PENDIENTE → PAGADO (RN-16). */
export function aprobarRetiro(retiroId, signal) {
  return api.post(`/admin/retiros/${id(retiroId)}/aprobar`, undefined, { signal });
}

/** `POST /admin/retiros/{id}/rechazar`: `motivo` obligatorio (RN-16). */
export function rechazarRetiro(retiroId, motivo, signal) {
  return api.post(`/admin/retiros/${id(retiroId)}/rechazar`, { motivo }, { signal });
}

/** `GET /admin/configuracion`: parámetros públicos en solo lectura (sin secretos). */
export function obtenerConfiguracion(signal) {
  return api.get('/admin/configuracion', { signal });
}
