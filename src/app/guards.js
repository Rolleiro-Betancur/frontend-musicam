import { hasRole, isAuthenticated } from '../core/session/session.js';

/**
 * Un guard devuelve `true` para dejar pasar o `{redirect}` con el hash de destino.
 * Ocultar navegación no es un permiso: el backend decide; esto solo mejora la experiencia.
 * @typedef {(ctx: {hash: string}) => true | {redirect: string}} Guard
 */

function aLogin(hash) {
  return { redirect: `#/login?redirect=${encodeURIComponent(hash)}` };
}

/** @type {Guard} */
export function requiereSesion(ctx) {
  return isAuthenticated() ? true : aLogin(ctx.hash);
}

/** @returns {Guard} */
export function requiereRol(...roles) {
  return (ctx) => {
    if (!isAuthenticated()) return aLogin(ctx.hash);
    return hasRole(...roles) ? true : { redirect: '#/sin-acceso' };
  };
}

/** Rutas solo para visitantes (login/registro): con sesión se va al inicio. */
export function soloInvitados() {
  return isAuthenticated() ? { redirect: '#/' } : true;
}
