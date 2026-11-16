import { on } from '../../core/event-bus.js';
import { getUsuario, isAuthenticated } from '../../core/session/session.js';
import * as catalogApi from './catalog.api.js';

const PAGE_SIZE = 100;
const MAX_PAGINAS = 5;

/** ¿Puede esta persona marcar favoritos y seguir? ADMIN no (RN-17: 403). */
export function puedeUsarSocial(usuario = getUsuario()) {
  return Boolean(usuario) && usuario.rol !== 'ADMIN';
}

/**
 * Conjunto de IDs (favoritos o seguidos) que se carga una vez por sesión y se mantiene al día
 * con cada cambio, para pintar bien el corazón y el botón Seguir en las listas (cuyos resúmenes
 * no traen `es_favorito` ni `siguiendo`).
 * @param {(params: object, signal?: AbortSignal) => Promise<{items: {id: string}[]}>} listar
 */
export function crearConjuntoDeIds(listar) {
  let ids = new Set();
  let cargado = false;
  let pendiente = null;

  return {
    /** Carga el conjunto si falta. Sin sesión (o ADMIN) queda vacío sin llamar a la API. */
    async asegurar(signal) {
      if (cargado || !puedeUsarSocial()) return ids;
      pendiente ??= (async () => {
        const nuevos = new Set();
        for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
          const datos = await listar({ page: pagina, page_size: PAGE_SIZE }, signal);
          datos.items.forEach((e) => nuevos.add(e.id));
          if (datos.items.length < PAGE_SIZE) break;
        }
        ids = nuevos;
        cargado = true;
      })().finally(() => {
        pendiente = null;
      });
      await pendiente;
      return ids;
    },
    tiene: (id) => ids.has(id),
    fijar(id, activo) {
      if (activo) ids.add(id);
      else ids.delete(id);
    },
    reiniciar() {
      ids = new Set();
      cargado = false;
    },
  };
}

export const favoritos = crearConjuntoDeIds(catalogApi.listarMisFavoritos);
export const seguidos = crearConjuntoDeIds(catalogApi.listarMisSeguidos);

// Al cambiar de persona (o cerrar sesión) los conjuntos dejan de valer.
let ultimoUsuarioId = getUsuario()?.id ?? null;
on('session:cambio', ({ usuario }) => {
  const id = usuario?.id ?? null;
  if (id !== ultimoUsuarioId) {
    favoritos.reiniciar();
    seguidos.reiniciar();
    ultimoUsuarioId = id;
  }
});

/** Carga ambos conjuntos sin romper la pantalla si fallan: sin ellos, los botones salen "apagados". */
export function precargarSocial(signal) {
  if (!isAuthenticated()) return Promise.resolve();
  return Promise.allSettled([favoritos.asegurar(signal), seguidos.asegurar(signal)]);
}

/** Marca o desmarca un favorito en el servidor y en el conjunto local. */
export async function alternarFavorito(eventoId, activo, signal) {
  await (activo
    ? catalogApi.agregarFavorito(eventoId, signal)
    : catalogApi.quitarFavorito(eventoId, signal));
  favoritos.fijar(eventoId, activo);
}

/** Sigue o deja de seguir a un artista en el servidor y en el conjunto local. */
export async function alternarSeguido(artistaId, activo, signal) {
  await (activo
    ? catalogApi.seguirArtista(artistaId, signal)
    : catalogApi.dejarDeSeguirArtista(artistaId, signal));
  seguidos.fijar(artistaId, activo);
}
