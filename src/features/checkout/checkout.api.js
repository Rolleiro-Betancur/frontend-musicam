import { api } from '../../core/http/api-client.js';

/**
 * @typedef {'PENDIENTE'|'APROBADA'|'RECHAZADA'|'ANULADA'|'REEMBOLSADA'} EstadoCompra
 * @typedef {{id: string, evento_id: string, referencia: string, monto_cop: number,
 *   metodo_pago: 'CARD'|'PSE'|'NEQUI', estado: EstadoCompra, wompi_transaccion_id: string|null,
 *   expira_en: string, creado_en: string, aprobado_en: string|null}} Compra
 * @typedef {{referencia: string, monto_en_centavos: number, moneda: string,
 *   firma_integridad: string, checkout_url: string, expira_en: string}} Checkout
 */

/**
 * `POST /eventos/{id}/compras` → `201 {compra, checkout}`. El monto lo fija el servidor.
 * @param {string} eventoId
 * @param {'CARD'|'PSE'|'NEQUI'} metodoPago
 * @param {AbortSignal} [signal]
 * @returns {Promise<{compra: Compra, checkout: Checkout}>}
 */
export function crearCompra(eventoId, metodoPago, signal) {
  return api.post(
    `/eventos/${encodeURIComponent(eventoId)}/compras`,
    { metodo_pago: metodoPago },
    { signal },
  );
}

/** `GET /compras/{id}` (dueño o ADMIN). @returns {Promise<Compra>} */
export function obtenerCompra(compraId, signal) {
  return api.get(`/compras/${encodeURIComponent(compraId)}`, { signal });
}

/**
 * `POST /pagos/wompi/simulador/{referencia}`: simula el fin del checkout. Devuelve la compra
 * ya procesada por el mismo camino que el webhook.
 * @param {'APPROVED'|'DECLINED'|'VOIDED'|'ERROR'} resultado
 * @returns {Promise<Compra>}
 */
export function simularPago(referencia, resultado, signal) {
  return api.post(
    `/pagos/wompi/simulador/${encodeURIComponent(referencia)}`,
    { resultado },
    { signal },
  );
}

/**
 * `GET /usuarios/me/compras` (paginado). Sirve para retomar una compra tras `COMPRA_DUPLICADA`.
 * Cada elemento es una `Compra` con el `evento` resumido.
 * @param {{estado?: EstadoCompra, page?: number, page_size?: number}} params
 * @returns {Promise<{items: (Compra & {evento: object})[], page: number, page_size: number, total: number}>}
 */
export function listarMisCompras(params, signal) {
  return api.get('/usuarios/me/compras', { query: params, signal });
}
