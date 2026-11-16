import { isoToBogotaLocal } from '../../shared/utils/format-date.js';
import * as accountApi from './account.api.js';

export const PAGE_SIZE = 10;
const PAGE_SIZE_TODAS = 100;
const MAX_PAGINAS = 5;

export const ETIQUETA_COMPRA = {
  PENDIENTE: 'Pago pendiente',
  APROBADA: 'Pagada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
  REEMBOLSADA: 'Reembolsada',
};

export const FILTROS_HISTORIAL = [
  ['', 'Todas'],
  ['APROBADA', 'Pagadas'],
  ['PENDIENTE', 'Pendientes'],
  ['RECHAZADA', 'Rechazadas'],
  ['ANULADA', 'Anuladas'],
  ['REEMBOLSADA', 'Reembolsadas'],
];

export const PESTANAS = ['proximos', 'historial', 'calendario'];

// --- Clasificación de compras ------------------------------------------------------------

/** ¿Se puede (todavía) comprar o pagar este evento? RN-07: programado, en vivo o replay. */
export function eventoEsComprable(evento) {
  return (
    evento.estado === 'PROGRAMADO' ||
    evento.estado === 'EN_VIVO' ||
    (evento.estado === 'FINALIZADO' && Boolean(evento.replay_disponible))
  );
}

/** Pestaña "Próximos": compra aprobada de un evento programado o en vivo. */
export const esProxima = (compra) =>
  compra.estado === 'APROBADA' && ['PROGRAMADO', 'EN_VIVO'].includes(compra.evento.estado);

/** Pago iniciado y sin completar de un evento que aún se puede pagar. */
export const esPagoPendiente = (compra) =>
  compra.estado === 'PENDIENTE' && eventoEsComprable(compra.evento);

/** Historial: todo lo que no está en Próximos ni es un pago pendiente aprovechable. */
export const esHistorial = (compra) => !esProxima(compra) && !esPagoPendiente(compra);

/**
 * La acción correcta de una entrada (§6.4): ver ahora, ver cuando empiece, ver replay o completar
 * el pago. Las demás no tienen acción. El permiso real lo decide el backend.
 * @returns {{tipo: 'VER'|'COMPLETAR_PAGO'|'NINGUNA', texto: string, href?: string}}
 */
export function accionDeCompra(compra) {
  const evento = compra.evento;
  const href = `#/ver/${encodeURIComponent(evento.id)}`;
  if (compra.estado === 'PENDIENTE') {
    return eventoEsComprable(evento)
      ? { tipo: 'COMPLETAR_PAGO', texto: 'Completar pago' }
      : { tipo: 'NINGUNA', texto: 'Este evento ya no está a la venta' };
  }
  if (compra.estado !== 'APROBADA') return { tipo: 'NINGUNA', texto: '' };
  if (evento.estado === 'EN_VIVO') return { tipo: 'VER', texto: 'Ver ahora', href };
  if (evento.estado === 'PROGRAMADO') return { tipo: 'VER', texto: 'Ver cuando empiece', href };
  if (evento.estado === 'FINALIZADO' && evento.replay_disponible) {
    return { tipo: 'VER', texto: 'Ver replay', href };
  }
  return { tipo: 'NINGUNA', texto: 'Sin reproducción disponible' };
}

/** Historial filtrado por estado de la compra (el servidor no filtra "eventos terminados"). */
export function filtrarHistorial(compras, estado) {
  return compras.filter((c) => esHistorial(c) && (!estado || c.estado === estado));
}

/** Paginación en el cliente con la misma forma que la del servidor. */
export function paginarLocal(items, page, pageSize = PAGE_SIZE) {
  const ultima = Math.max(1, Math.ceil(items.length / pageSize));
  const actual = Math.min(Math.max(1, page), ultima);
  return {
    items: items.slice((actual - 1) * pageSize, actual * pageSize),
    page: actual,
    page_size: pageSize,
    total: items.length,
  };
}

// --- Carga -------------------------------------------------------------------------------

/** Próximos: lo clasifica y ordena el servidor (`proximos=true`). */
export const cargarProximos = (page, signal, api = accountApi) =>
  api.listarMisCompras({ proximos: true, page, page_size: PAGE_SIZE }, signal);

/** Pagos pendientes de eventos que todavía se pueden pagar. */
export async function cargarPagosPendientes(signal, api = accountApi) {
  const datos = await api.listarMisCompras({ estado: 'PENDIENTE', page_size: 50 }, signal);
  return datos.items.filter(esPagoPendiente);
}

/** Todas mis compras (para el historial y el calendario). Pocas por persona: se piden de 100 en 100. */
export async function cargarTodasLasCompras(signal, api = accountApi) {
  const todas = [];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const datos = await api.listarMisCompras({ page, page_size: PAGE_SIZE_TODAS }, signal);
    todas.push(...datos.items);
    if (datos.items.length < PAGE_SIZE_TODAS) break;
  }
  return todas;
}

export const cargarFavoritos = (page, signal, pageSize = 12) =>
  accountApi.listarFavoritos({ page, page_size: pageSize }, signal);
export const cargarSeguidos = (page, signal, pageSize = 12) =>
  accountApi.listarSeguidos({ page, page_size: pageSize }, signal);

// --- Calendario (hora de Bogotá) ----------------------------------------------------------

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Día (YYYY-MM-DD) de un instante, en hora de Bogotá. */
export const claveDia = (iso) => isoToBogotaLocal(iso).slice(0, 10);

/** Hoy en Bogotá como `YYYY-MM-DD`. */
export const hoyBogota = (ahora = Date.now()) => claveDia(new Date(ahora).toISOString());

/** Compras APROBADA agrupadas por día de Bogotá, cada día ordenado por hora de inicio. */
export function agruparPorDia(compras) {
  const dias = new Map();
  for (const compra of compras) {
    if (compra.estado !== 'APROBADA') continue;
    const dia = claveDia(compra.evento.fecha_inicio);
    if (!dias.has(dia)) dias.set(dia, []);
    dias.get(dia).push(compra);
  }
  for (const lista of dias.values()) {
    lista.sort((a, b) => a.evento.fecha_inicio.localeCompare(b.evento.fecha_inicio));
  }
  return dias;
}

const fechaDe = (d) => d.toISOString().slice(0, 10);

/**
 * Semanas (lunes a domingo) de un mes. Las celdas fuera del mes llevan `delMes: false`.
 * @param {number} anio
 * @param {number} mes 1–12
 * @returns {{fecha: string, dia: number, delMes: boolean}[][]}
 */
export function armarMes(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const desfase = (primero.getUTCDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const semanas = Math.ceil((desfase + diasDelMes) / 7);
  const resultado = [];
  for (let s = 0; s < semanas; s++) {
    const fila = [];
    for (let d = 0; d < 7; d++) {
      const fecha = new Date(Date.UTC(anio, mes - 1, 1 - desfase + s * 7 + d));
      fila.push({
        fecha: fechaDe(fecha),
        dia: fecha.getUTCDate(),
        delMes: fecha.getUTCMonth() === mes - 1,
      });
    }
    resultado.push(fila);
  }
  return resultado;
}

/** Mes anterior o siguiente (`delta` = -1 | 1). */
export function moverMes({ anio, mes }, delta) {
  const f = new Date(Date.UTC(anio, mes - 1 + delta, 1));
  return { anio: f.getUTCFullYear(), mes: f.getUTCMonth() + 1 };
}

/** "noviembre de 2026". */
export const etiquetaMes = ({ anio, mes }) => `${MESES[mes - 1]} de ${anio}`;

/** "5 de diciembre". */
export function etiquetaDiaLarga(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '');
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}` : String(fecha ?? '');
}

/** Mes con el que abre el calendario: el del próximo evento comprado o, si no hay, el actual. */
export function mesInicial(dias, hoy = hoyBogota()) {
  const proximo = [...dias.keys()].sort().find((d) => d >= hoy);
  const base = proximo ?? hoy;
  return { anio: Number(base.slice(0, 4)), mes: Number(base.slice(5, 7)) };
}
