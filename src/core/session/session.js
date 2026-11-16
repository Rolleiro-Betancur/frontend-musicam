import { api } from '../http/api-client.js';
import { createStore } from '../store.js';
import { emit } from '../event-bus.js';
import * as tokens from './session-store.js';

/**
 * @typedef {{id: string, email: string, nombre: string, rol: 'USUARIO'|'ARTISTA'|'ADMIN',
 *   estado: string, foto_url: string|null, nombre_artistico: string|null,
 *   biografia: string|null}} Usuario
 */

/** estado: 'cargando' mientras se rehidrata; luego 'anonimo' o 'autenticado'. */
export const sessionState = createStore({
  /** @type {'cargando'|'anonimo'|'autenticado'} */ estado: 'cargando',
  /** @type {Usuario|null} */ usuario: null,
});

export const getUsuario = () => sessionState.get().usuario;
export const isAuthenticated = () => sessionState.get().estado === 'autenticado';
export const hasRole = (...roles) => roles.includes(getUsuario()?.rol);

function publicar(estado, usuario) {
  sessionState.set({ estado, usuario });
  emit('session:cambio', { estado, usuario });
}

/** Guarda la sesión tras un login correcto. */
export function iniciarSesion({ access_token, refresh_token, usuario }) {
  tokens.setAccessToken(access_token);
  tokens.setRefreshToken(refresh_token);
  publicar('autenticado', usuario);
}

/** Actualiza los datos del usuario (p. ej. tras editar el perfil). */
export function actualizarUsuario(usuario) {
  publicar('autenticado', usuario);
}

/**
 * Cierra la sesión local. `motivo` distingue el cierre voluntario del forzado.
 * @param {{motivo?: 'voluntario'|'expirada'|'suspendida', mensaje?: string}} [info]
 */
export function cerrarSesion({ motivo = 'voluntario', mensaje = '' } = {}) {
  const habiaSesion = isAuthenticated() || Boolean(tokens.getRefreshToken());
  tokens.clearTokens();
  publicar('anonimo', null);
  if (habiaSesion) emit('session:cerrada', { motivo, mensaje });
}

/** Rehidrata la sesión al arrancar: refresh → GET /usuarios/me. */
export async function restaurarSesion() {
  if (!tokens.getRefreshToken()) {
    publicar('anonimo', null);
    return;
  }
  try {
    await api.refrescar();
    const usuario = await api.get('/usuarios/me');
    publicar('autenticado', usuario);
  } catch (error) {
    // 401/403 ya disparan cerrarSesion vía onAuthLost; un fallo de red deja la sesión anónima
    // pero conserva el refresh token para reintentar al recargar.
    if (!isAuthenticated()) publicar('anonimo', null);
    if (error?.status === 401 || error?.status === 403) tokens.clearTokens();
  }
}

api.setAuthLostHandler((info) => cerrarSesion(info));
