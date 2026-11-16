import { api } from '../../core/http/api-client.js';

/**
 * @typedef {'BORRADOR'|'PROGRAMADO'|'EN_VIVO'|'FINALIZADO'|'CANCELADO'} EstadoEvento
 * @typedef {{id: string, titulo: string, categoria: string, portada_url: string|null,
 *   precio_cop: number, fecha_inicio: string, estado: EstadoEvento, replay_disponible: boolean,
 *   artista: {id: string, nombre_artistico: string, foto_url: string|null}}} EventoResumen
 * @typedef {EventoResumen & {descripcion: string|null, duracion_estimada_min: number,
 *   replay_habilitado: boolean, suspendido_admin: boolean}} Evento
 * @typedef {{estado: EstadoEvento, espectadores_actuales: number, pico_espectadores: number,
 *   duracion_transcurrida_min: number|null, inicio_real: string|null,
 *   fin_real: string|null}} EstadoTransmision
 */

const ruta = (id) => `/eventos/${encodeURIComponent(id)}`;

/** `GET /artistas/me/eventos`: todos mis eventos, filtro opcional `estado`. */
export function listarMisEventos(params, signal) {
  return api.get('/artistas/me/eventos', { query: params, signal });
}

/** `GET /eventos/{id}`: el dueño ve su evento en cualquier estado. @returns {Promise<Evento>} */
export function obtenerEvento(id, signal) {
  return api.get(ruta(id), { signal });
}

/**
 * `GET /artistas/me/eventos/{id}/estadisticas`: aquí solo se lee `entradas_vendidas` para saber
 * si hay compras aprobadas (RN-04). No hay pantalla de estadísticas todavía.
 * @returns {Promise<{entradas_vendidas: number}>}
 */
export function obtenerVentasDeEvento(id, signal) {
  return api.get(`/artistas/me/eventos/${encodeURIComponent(id)}/estadisticas`, { signal });
}

/** `POST /eventos` → 201, nace en BORRADOR. */
export function crearEvento(cuerpo, signal) {
  return api.post('/eventos', cuerpo, { signal });
}

/** `PATCH /eventos/{id}`: solo los campos enviados. */
export function actualizarEvento(id, cambios, signal) {
  return api.patch(ruta(id), cambios, { signal });
}

/** `DELETE /eventos/{id}` → 204 (solo BORRADOR). */
export function eliminarEvento(id, signal) {
  return api.delete(ruta(id), { signal });
}

/** `POST /eventos/{id}/publicar`: BORRADOR → PROGRAMADO. */
export function publicarEvento(id, signal) {
  return api.post(`${ruta(id)}/publicar`, undefined, { signal });
}

/** `POST /eventos/{id}/cancelar`: BORRADOR/PROGRAMADO → CANCELADO (reembolsa lo vendido). */
export function cancelarEvento(id, signal) {
  return api.post(`${ruta(id)}/cancelar`, undefined, { signal });
}

/**
 * `POST .../transmision/credenciales` → `{rtmp_url, stream_key}`. La clave se muestra una sola
 * vez; pedirla de nuevo invalida la anterior.
 */
export function generarCredenciales(id, signal) {
  return api.post(`${ruta(id)}/transmision/credenciales`, undefined, { signal });
}

/** `POST .../transmision/iniciar` con la clave de emisión. @returns {Promise<EstadoTransmision>} */
export function iniciarTransmision(id, streamKey, signal) {
  return api.post(`${ruta(id)}/transmision/iniciar`, { stream_key: streamKey }, { signal });
}

/** `POST .../transmision/finalizar`. @returns {Promise<EstadoTransmision>} */
export function finalizarTransmision(id, signal) {
  return api.post(`${ruta(id)}/transmision/finalizar`, undefined, { signal });
}

/** `GET .../transmision`: estado, audiencia, pico y duración. @returns {Promise<EstadoTransmision>} */
export function obtenerEstadoTransmision(id, signal) {
  return api.get(`${ruta(id)}/transmision`, { signal });
}

/** `POST /dev/eventos/{id}/audiencia-simulada` (404 si el backend no tiene los endpoints de dev). */
export function simularAudiencia(id, espectadores, signal) {
  return api.post(
    `/dev/eventos/${encodeURIComponent(id)}/audiencia-simulada`,
    { espectadores },
    { signal },
  );
}

/**
 * @typedef {{fecha: string, entradas: number, ingresos_netos_cop: number}} VentaDiaria
 * @typedef {{disponible_cop: number, retenido_cop: number, en_proceso_cop: number,
 *   retirado_cop: number}} Saldo
 * @typedef {{resumen: {eventos_por_estado: Record<string, number>, entradas_vendidas: number,
 *   ingresos_brutos_cop: number, comision_plataforma_cop: number, ingresos_netos_cop: number,
 *   seguidores: number, pico_espectadores_promedio: number}, saldo: Saldo,
 *   ventas_por_dia: VentaDiaria[]}} Estadisticas
 * @typedef {{evento_id: string, entradas_vendidas: number, ingresos_brutos_cop: number,
 *   ingresos_netos_cop: number, pico_espectadores: number, vistas_vivo: number,
 *   vistas_replay: number, duracion_real_min: number|null, favoritos: number,
 *   ventas_por_dia: VentaDiaria[]}} EstadisticasEvento
 * @typedef {{id: string, monto_cop: number, banco: string, tipo_cuenta: string,
 *   cuenta_ultimos4: string, estado: 'PENDIENTE'|'PAGADO'|'RECHAZADO',
 *   referencia_pago: string|null, motivo_rechazo: string|null, solicitado_en: string,
 *   resuelto_en: string|null}} Retiro
 */

/** `GET /artistas/me/estadisticas`: resumen, saldo y ventas por día (America/Bogota). @returns {Promise<Estadisticas>} */
export function obtenerEstadisticas(signal) {
  return api.get('/artistas/me/estadisticas', { signal });
}

/** `GET /artistas/me/eventos/{id}/estadisticas`. @returns {Promise<EstadisticasEvento>} */
export function obtenerEstadisticasDeEvento(id, signal) {
  return api.get(`/artistas/me/eventos/${encodeURIComponent(id)}/estadisticas`, { signal });
}

/** `GET /artistas/me/saldo`: disponible, retenido, en proceso y retirado. @returns {Promise<Saldo>} */
export function obtenerSaldo(signal) {
  return api.get('/artistas/me/saldo', { signal });
}

/** `GET /artistas/me/retiros` (paginado, del más reciente al más antiguo). */
export function listarRetiros(params, signal) {
  return api.get('/artistas/me/retiros', { query: params, signal });
}

/**
 * `POST /artistas/me/retiros` → 201. Solo banco, tipo de cuenta y los últimos 4 dígitos.
 * @param {{monto_cop: number, banco: string, tipo_cuenta: string, cuenta_ultimos4: string}} cuerpo
 * @returns {Promise<Retiro>}
 */
export function crearRetiro(cuerpo, signal) {
  return api.post('/artistas/me/retiros', cuerpo, { signal });
}
