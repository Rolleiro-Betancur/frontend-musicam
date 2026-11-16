import * as watchApi from './watch.api.js';

export const REINTENTO_ESPERA_MS = 30000;

/**
 * Qué mostrar según el evento (§5.3). Función pura; el backend sigue siendo la autoridad.
 * - `SUSPENDIDO`, `NO_DISPONIBLE`: sin reproducción.
 * - `ESPERA`: programado y la persona tiene derecho (comprador, dueño o ADMIN).
 * - `DENEGADO`: programado sin derecho; se invita a comprar.
 * - `ENTRAR`: en vivo o replay disponible → se llama a `reproduccion/entrar` y el servidor decide.
 * @returns {{vista: 'SUSPENDIDO'|'NO_DISPONIBLE'|'ESPERA'|'DENEGADO'|'ENTRAR', mensaje?: string}}
 */
export function decidirVista(evento, usuario) {
  if (evento.suspendido_admin) return { vista: 'SUSPENDIDO' };
  if (evento.estado === 'CANCELADO') {
    return { vista: 'NO_DISPONIBLE', mensaje: 'Este evento fue cancelado.' };
  }
  if (evento.estado === 'BORRADOR') {
    return { vista: 'NO_DISPONIBLE', mensaje: 'Este evento aún no está publicado.' };
  }
  if (evento.estado === 'FINALIZADO' && !evento.replay_disponible) {
    return { vista: 'NO_DISPONIBLE', mensaje: 'El evento terminó y no tiene reproducción.' };
  }
  if (evento.estado === 'PROGRAMADO') {
    const esDueno = Boolean(usuario) && usuario.id === evento.artista?.id;
    const tieneDerecho = Boolean(evento.comprado) || esDueno || usuario?.rol === 'ADMIN';
    return { vista: tieneDerecho ? 'ESPERA' : 'DENEGADO' };
  }
  return { vista: 'ENTRAR' };
}

/**
 * Traduce un error de `entrar` a un resultado de pantalla; lo demás se relanza.
 * @returns {'DENEGADO'|'SUSPENDIDO'|'NO_ENCONTRADO'}
 */
export function clasificarErrorEntrar(error) {
  if (error.status === 403 && error.codigo === 'EVENTO_SUSPENDIDO') return 'SUSPENDIDO';
  if (error.status === 403 && error.codigo === 'ACCESO_NO_AUTORIZADO') return 'DENEGADO';
  if (error.status === 404) return 'NO_ENCONTRADO';
  throw error;
}

/**
 * Llama a `entrar`. Devuelve `{estado: 'OK', reproduccion}` o el estado de acceso denegado.
 * @returns {Promise<{estado: 'OK', reproduccion: object}|{estado: 'DENEGADO'|'SUSPENDIDO'|'NO_ENCONTRADO'}>}
 */
export async function entrarAlEvento(eventoId, signal, api = watchApi) {
  try {
    return { estado: 'OK', reproduccion: await api.entrar(eventoId, signal) };
  } catch (error) {
    return { estado: clasificarErrorEntrar(error) };
  }
}

/** Milisegundos hasta que expira el token de reproducción (nunca negativo). */
export function msHastaExpirar(expiraEn, ahora = Date.now()) {
  const ms = new Date(expiraEn).getTime() - ahora;
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}
