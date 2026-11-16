import { api } from '../../core/http/api-client.js';

/**
 * @typedef {{tipo: 'VIVO'|'REPLAY', url: string, token: string, expira_en: string}} Reproduccion
 */

/**
 * `GET /eventos/{id}`: estado, fechas y artista del evento. Se consulta antes de `entrar` porque
 * el 403 de un evento aún no iniciado es el mismo `ACCESO_NO_AUTORIZADO` que el de no comprar.
 */
export function obtenerEventoParaVer(eventoId, signal) {
  return api.get(`/eventos/${encodeURIComponent(eventoId)}`, { signal });
}

/**
 * `POST /eventos/{id}/reproduccion/entrar`. Cada llamada cuenta como una vista en el backend.
 * @returns {Promise<Reproduccion>}
 */
export function entrar(eventoId, signal) {
  return api.post(`/eventos/${encodeURIComponent(eventoId)}/reproduccion/entrar`, undefined, {
    signal,
  });
}

/** `POST /eventos/{id}/reproduccion/salir` → 204. Con `keepalive` sobrevive al cierre de la página. */
export function salir(eventoId, { keepalive = false } = {}) {
  return api.post(`/eventos/${encodeURIComponent(eventoId)}/reproduccion/salir`, undefined, {
    keepalive,
  });
}
