import { ApiError } from '../../core/http/api-error.js';
import * as checkoutApi from './checkout.api.js';

export const INTERVALO_SONDEO_MS = 1500;
export const MAX_SONDEO_MS = 30000;
const MAX_FALLOS_SEGUIDOS = 3;

/** Métodos de pago del contrato (`metodo_pago`) con su texto de interfaz. */
export const METODOS = [
  ['CARD', 'Tarjeta', 'bi-credit-card'],
  ['PSE', 'PSE', 'bi-bank'],
  ['NEQUI', 'Nequi', 'bi-phone'],
];
export const etiquetaMetodo = (codigo) => METODOS.find(([c]) => c === codigo)?.[1] ?? codigo;

/** Botones de la pasarela simulada → `resultado` del simulador. */
export const RESULTADO_POR_ACCION = {
  aprobar: 'APPROVED',
  rechazar: 'DECLINED',
  cancelar: 'VOIDED',
};

/** Espera `ms` o rechaza como petición cancelada si se aborta la señal. */
export function esperarMs(ms, signal) {
  return new Promise((resolver, rechazar) => {
    const cancelar = () => {
      clearTimeout(temporizador);
      rechazar(new ApiError({ codigo: 'PETICION_CANCELADA', mensaje: 'Petición cancelada.' }));
    };
    const temporizador = setTimeout(() => {
      signal?.removeEventListener('abort', cancelar);
      resolver();
    }, ms);
    if (signal?.aborted) return cancelar();
    signal?.addEventListener('abort', cancelar, { once: true });
  });
}

/**
 * Busca una compra del mismo evento entre las `estados` indicadas (pendiente o aprobada).
 * @returns {Promise<object|null>}
 */
async function buscarCompraExistente(eventoId, signal, api) {
  for (const estado of ['PENDIENTE', 'APROBADA']) {
    const pagina = await api.listarMisCompras({ estado, page_size: 100 }, signal);
    const encontrada = pagina.items.find((c) => c.evento_id === eventoId);
    if (encontrada) return encontrada;
  }
  return null;
}

/**
 * Crea la compra. Ante `409 COMPRA_DUPLICADA` retoma la existente (PENDIENTE o ya APROBADA).
 * El monto y la referencia salen siempre de la respuesta del servidor.
 * @returns {Promise<{compra: object, retomada: boolean}>}
 */
export async function iniciarCompra(evento, metodo, signal, api = checkoutApi) {
  try {
    const { compra } = await api.crearCompra(evento.id, metodo, signal);
    return { compra, retomada: false };
  } catch (error) {
    if (error.codigo !== 'COMPRA_DUPLICADA') throw error;
    const existente = await buscarCompraExistente(evento.id, signal, api);
    if (!existente) throw error;
    return { compra: existente, retomada: true };
  }
}

/**
 * Sondea `GET /compras/{id}` hasta que deje de ser PENDIENTE (cada 1,5 s, máx. 30 s).
 * Tolera fallos de red aislados; cancelación, 401/403/404 y 3 fallos seguidos se propagan.
 * @returns {Promise<{compra: object, agotado: boolean}>}
 */
export async function sondearCompra(
  compraId,
  signal,
  {
    intervaloMs = INTERVALO_SONDEO_MS,
    maxMs = MAX_SONDEO_MS,
    api = checkoutApi,
    esperar = esperarMs,
    ahora = Date.now,
  } = {},
) {
  const inicio = ahora();
  let ultima = null;
  let ultimoError = null;
  let fallos = 0;
  for (;;) {
    try {
      const compra = await api.obtenerCompra(compraId, signal);
      ultima = compra;
      fallos = 0;
      if (compra.estado !== 'PENDIENTE') return { compra, agotado: false };
    } catch (error) {
      if (error.cancelada || [401, 403, 404].includes(error.status)) throw error;
      ultimoError = error;
      if (++fallos >= MAX_FALLOS_SEGUIDOS) throw error;
    }
    if (ahora() - inicio >= maxMs) {
      if (!ultima) throw ultimoError;
      return { compra: ultima, agotado: true };
    }
    await esperar(intervaloMs, signal);
  }
}

/**
 * Qué ofrecer tras un pago aprobado, según el estado del evento (C3).
 * @returns {{texto: string, href: string}}
 */
export function accionTrasCompra(evento) {
  const href = `#/ver/${encodeURIComponent(evento.id)}`;
  if (evento.estado === 'EN_VIVO') return { texto: 'Ver ahora', href };
  if (evento.estado === 'FINALIZADO') return { texto: 'Ver replay', href };
  return { texto: 'Ver cuando empiece', href };
}
