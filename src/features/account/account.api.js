import { api } from '../../core/http/api-client.js';

/** @param {AbortSignal} [signal] */
export function obtenerPerfil(signal) {
  return api.get('/usuarios/me', { signal });
}

/** @param {{nombre?: string, biografia?: string|null, nombre_artistico?: string}} cambios */
export function actualizarPerfil(cambios, signal) {
  return api.patch('/usuarios/me', cambios, { signal });
}

/** Sube la foto como `multipart/form-data` (campo `foto`). Devuelve el `Usuario`. */
export function subirFoto(archivo, signal) {
  const datos = new FormData();
  datos.append('foto', archivo);
  return api.put('/usuarios/me/foto', datos, { signal });
}

/** Idempotente. Devuelve el `Usuario` con `foto_url: null`. */
export function quitarFoto(signal) {
  return api.delete('/usuarios/me/foto', { signal });
}

/**
 * @typedef {'PENDIENTE'|'APROBADA'|'RECHAZADA'|'ANULADA'|'REEMBOLSADA'} EstadoCompra
 * @typedef {{id: string, evento_id: string, referencia: string, monto_cop: number,
 *   metodo_pago: string, estado: EstadoCompra, expira_en: string, creado_en: string,
 *   aprobado_en: string|null, evento: object}} MiCompra
 */

/**
 * `GET /usuarios/me/compras`: mis compras con el resumen del evento y el monto pagado.
 * `proximos=true` devuelve solo las APROBADA de eventos PROGRAMADO/EN_VIVO, por fecha ascendente;
 * sin él, de la más reciente a la más antigua.
 * @param {{estado?: EstadoCompra, proximos?: boolean, page?: number, page_size?: number}} params
 * @returns {Promise<{items: MiCompra[], page: number, page_size: number, total: number}>}
 */
export function listarMisCompras(params, signal) {
  return api.get('/usuarios/me/compras', {
    query: { ...params, proximos: params.proximos ? 'true' : undefined },
    signal,
  });
}

/** `GET /usuarios/me/favoritos`: resumen de los eventos marcados (solo los visibles). */
export function listarFavoritos(params, signal) {
  return api.get('/usuarios/me/favoritos', { query: params, signal });
}

/** `GET /usuarios/me/seguidos`: artistas que sigo (id, nombre artístico, foto y biografía). */
export function listarSeguidos(params, signal) {
  return api.get('/usuarios/me/seguidos', { query: params, signal });
}
