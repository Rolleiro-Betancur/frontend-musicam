import { api } from '../../core/http/api-client.js';

/** @param {{email: string, password: string}} credenciales @param {AbortSignal} [signal] */
export function login(credenciales, signal) {
  return api.post('/auth/login', credenciales, { signal });
}

/**
 * Devuelve el `Usuario` creado (no entrega tokens: hay que iniciar sesión después).
 * @param {{nombre: string, email: string, password: string, rol: 'USUARIO'|'ARTISTA',
 *   nombre_artistico?: string, acepta_tratamiento_datos: true}} datos
 * @param {AbortSignal} [signal]
 */
export function registro(datos, signal) {
  return api.post('/auth/registro', datos, { signal });
}
