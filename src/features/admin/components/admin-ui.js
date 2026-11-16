import { html } from '../../../shared/utils/html.js';
import { liveBadge } from '../../../shared/ui/live-badge.js';
import {
  ETIQUETA_ESTADO_COMPRA,
  ETIQUETA_ESTADO_EVENTO,
  ETIQUETA_ESTADO_RETIRO,
  ETIQUETA_ROL,
} from '../admin.service.js';

/** Insignia con texto; `variante`: ok | warn | danger | accent | muted. */
export function badge(texto, variante = 'muted') {
  return html`<span class="admin-badge admin-badge--${variante}">${texto}</span>`;
}

export const badgeRol = (rol) =>
  badge(ETIQUETA_ROL[rol] ?? rol, { ADMIN: 'accent', ARTISTA: 'ok' }[rol] ?? 'muted');

export const badgeEstadoUsuario = (estado) =>
  estado === 'ACTIVO' ? badge('Activo', 'ok') : badge('Suspendido', 'danger');

export function badgeEstadoEvento(estado) {
  if (estado === 'EN_VIVO') return liveBadge();
  const variante =
    { PROGRAMADO: 'accent', FINALIZADO: 'ok', CANCELADO: 'danger' }[estado] ?? 'muted';
  return badge(ETIQUETA_ESTADO_EVENTO[estado] ?? estado, variante);
}

export function badgeEstadoCompra(estado) {
  const variante =
    { APROBADA: 'ok', PENDIENTE: 'warn', RECHAZADA: 'danger', ANULADA: 'danger' }[estado] ??
    'muted';
  return badge(ETIQUETA_ESTADO_COMPRA[estado] ?? estado, variante);
}

export function badgeEstadoRetiro(estado) {
  const variante = { PAGADO: 'ok', PENDIENTE: 'warn', RECHAZADO: 'danger' }[estado] ?? 'muted';
  return badge(ETIQUETA_ESTADO_RETIRO[estado] ?? estado, variante);
}
