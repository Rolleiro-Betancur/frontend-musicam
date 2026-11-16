import { api } from '../../core/http/api-client.js';

/**
 * @typedef {{id: string, nombre_artistico: string, foto_url: string|null}} ArtistaResumen
 * @typedef {{id: string, artista: ArtistaResumen, titulo: string, categoria: string,
 *   portada_url: string|null, precio_cop: number, fecha_inicio: string, estado: string,
 *   replay_disponible: boolean}} EventoResumen
 * @typedef {EventoResumen & {descripcion: string|null, duracion_estimada_min: number,
 *   replay_habilitado: boolean, inicio_real: string|null, fin_real: string|null,
 *   suspendido_admin: boolean, es_favorito?: boolean, comprado?: boolean}} EventoDetalle
 * @typedef {{items: EventoResumen[], page: number, page_size: number, total: number}} EventoPagina
 */

/**
 * `GET /eventos` (público). Filtros: page, page_size, estado, q, categoria, artista_id, desde, hasta.
 * @param {Record<string, string|number>} params
 * @param {AbortSignal} [signal]
 * @returns {Promise<EventoPagina>}
 */
export function listarEventos(params, signal) {
  return api.get('/eventos', { query: params, signal });
}

/**
 * `GET /eventos/{id}`. Con sesión añade `es_favorito` y `comprado`.
 * @param {string} id
 * @param {AbortSignal} [signal]
 * @returns {Promise<EventoDetalle>}
 */
export function obtenerEvento(id, signal) {
  return api.get(`/eventos/${encodeURIComponent(id)}`, { signal });
}

/**
 * @typedef {{id: string, nombre_artistico: string, foto_url: string|null,
 *   biografia: string|null}} ArtistaPublico
 * @typedef {ArtistaPublico & {seguidores: number, eventos_proximos: EventoResumen[],
 *   siguiendo?: boolean}} ArtistaPerfil
 */

/**
 * `GET /artistas` (público): solo artistas ACTIVO. Filtro `q` por nombre artístico.
 * @param {{page?: number, page_size?: number, q?: string}} params
 * @param {AbortSignal} [signal]
 * @returns {Promise<{items: ArtistaPublico[], page: number, page_size: number, total: number}>}
 */
export function listarArtistas(params, signal) {
  return api.get('/artistas', { query: params, signal });
}

/**
 * `GET /artistas/{id}`. `siguiendo` solo viene con sesión.
 * @param {string} id
 * @param {AbortSignal} [signal]
 * @returns {Promise<ArtistaPerfil>}
 */
export function obtenerArtista(id, signal) {
  return api.get(`/artistas/${encodeURIComponent(id)}`, { signal });
}

// --- Favoritos y seguidos (RN-17): todas las operaciones son idempotentes y devuelven 204 ---

const rutaFavorito = (id) => `/usuarios/me/favoritos/${encodeURIComponent(id)}`;
const rutaSeguido = (id) => `/usuarios/me/seguidos/${encodeURIComponent(id)}`;

/** `PUT /usuarios/me/favoritos/{evento_id}` → 204. Solo eventos visibles (404 si no). */
export function agregarFavorito(eventoId, signal) {
  return api.put(rutaFavorito(eventoId), undefined, { signal });
}

/** `DELETE /usuarios/me/favoritos/{evento_id}` → 204 aunque no estuviera marcado. */
export function quitarFavorito(eventoId, signal) {
  return api.delete(rutaFavorito(eventoId), { signal });
}

/** `PUT /usuarios/me/seguidos/{artista_id}` → 204 (422 si es uno mismo; 404 si no es artista). */
export function seguirArtista(artistaId, signal) {
  return api.put(rutaSeguido(artistaId), undefined, { signal });
}

/** `DELETE /usuarios/me/seguidos/{artista_id}` → 204 aunque no lo siguiera. */
export function dejarDeSeguirArtista(artistaId, signal) {
  return api.delete(rutaSeguido(artistaId), { signal });
}

/** `GET /usuarios/me/favoritos` (paginado): solo se usa para saber qué eventos están marcados. */
export function listarMisFavoritos(params, signal) {
  return api.get('/usuarios/me/favoritos', { query: params, signal });
}

/** `GET /usuarios/me/seguidos` (paginado): solo se usa para saber a quién sigo. */
export function listarMisSeguidos(params, signal) {
  return api.get('/usuarios/me/seguidos', { query: params, signal });
}
