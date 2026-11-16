import { bogotaLocalToIso } from '../../shared/utils/format-date.js';
import { buildQuery } from '../../shared/utils/query-string.js';
import { esCategoriaValida } from '../../shared/utils/categorias.js';
import * as catalogApi from './catalog.api.js';

export const PAGE_SIZE = 12;
const ITEMS_POR_FILA = 12;

/** Estados que el catálogo público puede mostrar (RN-21). */
export const ESTADOS_CATALOGO = [
  ['', 'Todos'],
  ['EN_VIVO', 'En vivo'],
  ['PROGRAMADO', 'Próximos'],
  ['FINALIZADO', 'Reproducciones'],
];
const ESTADOS_VALIDOS = new Set(ESTADOS_CATALOGO.map(([valor]) => valor).filter(Boolean));
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lee los filtros de la URL descartando valores inválidos (la URL es entrada del usuario).
 * @param {URLSearchParams} query
 */
export function leerFiltros(query) {
  const q = (query.get('q') ?? '').trim().slice(0, 100);
  const categoria = query.get('categoria') ?? '';
  const estado = query.get('estado') ?? '';
  const desde = query.get('desde') ?? '';
  const hasta = query.get('hasta') ?? '';
  const page = Number.parseInt(query.get('page') ?? '1', 10);
  return {
    q,
    categoria: esCategoriaValida(categoria) ? categoria : '',
    estado: ESTADOS_VALIDOS.has(estado) ? estado : '',
    desde: FECHA.test(desde) ? desde : '',
    hasta: FECHA.test(hasta) ? hasta : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Cadena `?q=...` para la URL; omite vacíos y la página 1. */
export function filtrosAQuery(filtros) {
  return buildQuery({ ...filtros, page: filtros.page > 1 ? filtros.page : '' });
}

/** Mensaje de error si el rango de fechas es incoherente; `null` si es válido. */
export function validarRango({ desde, hasta }) {
  return desde && hasta && desde > hasta
    ? 'La fecha "desde" no puede ser posterior a "hasta".'
    : null;
}

/** Parámetros de `GET /eventos`: las fechas (día en Bogotá) se envían como ISO UTC. */
export function filtrosAParams(filtros) {
  return {
    page: filtros.page,
    page_size: PAGE_SIZE,
    q: filtros.q,
    categoria: filtros.categoria,
    estado: filtros.estado,
    desde: filtros.desde ? bogotaLocalToIso(`${filtros.desde}T00:00`) : '',
    hasta: filtros.hasta ? bogotaLocalToIso(`${filtros.hasta}T23:59`) : '',
  };
}

export function hayFiltros(filtros) {
  return Boolean(
    filtros.q || filtros.categoria || filtros.estado || filtros.desde || filtros.hasta,
  );
}

export function buscarEventos(filtros, signal) {
  return catalogApi.listarEventos(filtrosAParams(filtros), signal);
}

/** Evento en vivo o, si no hay, el más cercano (el backend ordena por `fecha_inicio`). */
export function elegirHero({ vivos, proximos }) {
  return vivos[0] ?? proximos[0] ?? null;
}

/**
 * Carga las tres filas del inicio. Si fallan todas se lanza el primer error; si falla solo
 * alguna, las demás se muestran y se marca `parcial` para avisar a la persona.
 * @returns {Promise<{vivos: object[], proximos: object[], replays: object[], parcial: boolean}>}
 */
export async function cargarInicio(signal) {
  const pedir = (estado) => catalogApi.listarEventos({ estado, page_size: ITEMS_POR_FILA }, signal);
  const resultados = await Promise.allSettled([
    pedir('EN_VIVO'),
    pedir('PROGRAMADO'),
    pedir('FINALIZADO'),
  ]);
  const cancelada = resultados.find((r) => r.status === 'rejected' && r.reason?.cancelada);
  if (cancelada) throw cancelada.reason;
  const fallidos = resultados.filter((r) => r.status === 'rejected');
  if (fallidos.length === resultados.length) throw fallidos[0].reason;
  const [vivos, proximos, replays] = resultados.map((r) =>
    r.status === 'fulfilled' ? r.value.items : [],
  );
  return { vivos, proximos, replays, parcial: fallidos.length > 0 };
}

/**
 * Único bloque de acción del detalle (§6.4). Función pura: depende del evento y del usuario.
 * El backend decide el permiso real; esto solo elige qué mostrar.
 * @returns {{tipo: 'GESTIONAR'|'ADMIN'|'NO_DISPONIBLE'|'LOGIN'|'COMPRAR'|'VER_AHORA'|
 *   'VER_CUANDO_EMPIECE'|'VER_REPLAY', mensaje?: string}}
 */
export function estadoAccion(evento, usuario) {
  if (usuario && usuario.id === evento.artista?.id) return { tipo: 'GESTIONAR' };
  if (usuario?.rol === 'ADMIN') return { tipo: 'ADMIN' };

  if (evento.suspendido_admin) {
    return { tipo: 'NO_DISPONIBLE', mensaje: 'Este evento no está disponible por el momento.' };
  }
  if (evento.estado === 'CANCELADO') {
    return { tipo: 'NO_DISPONIBLE', mensaje: 'Este evento fue cancelado.' };
  }
  if (evento.estado === 'BORRADOR') {
    return { tipo: 'NO_DISPONIBLE', mensaje: 'Este evento aún no está publicado.' };
  }
  if (evento.estado === 'FINALIZADO' && !evento.replay_disponible) {
    return { tipo: 'NO_DISPONIBLE', mensaje: 'El evento terminó y no tiene reproducción.' };
  }

  if (!usuario) return { tipo: 'LOGIN' };
  if (!evento.comprado) return { tipo: 'COMPRAR' };
  if (evento.estado === 'EN_VIVO') return { tipo: 'VER_AHORA' };
  if (evento.estado === 'FINALIZADO') return { tipo: 'VER_REPLAY' };
  return { tipo: 'VER_CUANDO_EMPIECE' };
}

export const PAGE_SIZE_ARTISTAS = 12;

/** Filtros del directorio de artistas leídos de la URL (valores inválidos se descartan). */
export function leerFiltrosArtistas(query) {
  const page = Number.parseInt(query.get('page') ?? '1', 10);
  return {
    q: (query.get('q') ?? '').trim().slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function artistasAQuery(filtros) {
  return buildQuery({ q: filtros.q, page: filtros.page > 1 ? filtros.page : '' });
}

export function buscarArtistas(filtros, signal) {
  return catalogApi.listarArtistas(
    { q: filtros.q, page: filtros.page, page_size: PAGE_SIZE_ARTISTAS },
    signal,
  );
}

export function cargarArtista(id, signal) {
  return catalogApi.obtenerArtista(id, signal);
}

/** "1 seguidor" / "87 seguidores". */
export function textoSeguidores(n) {
  return `${n} ${n === 1 ? 'seguidor' : 'seguidores'}`;
}
