import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { coverMedia } from '../../../shared/ui/cover.js';
import { estadoBadge } from '../../../shared/ui/live-badge.js';
import { ETIQUETA_COMPRA, accionDeCompra } from '../tickets.service.js';

function botonDeAccion(accion, compra) {
  if (accion.tipo === 'VER') {
    return html`<a class="btn btn-primary btn-sm" href="${accion.href}">${accion.texto}</a>`;
  }
  if (accion.tipo === 'COMPLETAR_PAGO') {
    return html`<button
      type="button"
      class="btn btn-primary btn-sm"
      data-action="completar-pago"
      data-compra="${compra.id}"
    >
      ${accion.texto}
    </button>`;
  }
  return accion.texto ? html`<span class="small text-muted-2">${accion.texto}</span>` : html``;
}

/**
 * Entrada de "Mis eventos" (`MiCompra`): póster, título, artista, fecha en hora de Bogotá, estado
 * de la compra, monto pagado y la acción correcta.
 */
export function ticketCard(compra) {
  const evento = compra.evento;
  const accion = accionDeCompra(compra);
  const href = `#/eventos/${encodeURIComponent(evento.id)}`;
  return html`<li class="ticket" data-evento="${evento.id}">
    <a class="ticket__thumb" href="${href}" tabindex="-1" aria-hidden="true">
      ${coverMedia(evento)}
    </a>
    <div class="ticket__info">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
        ${estadoBadge(evento)}
        <span class="ticket__state ticket__state--${compra.estado.toLowerCase()}"
          >${ETIQUETA_COMPRA[compra.estado] ?? compra.estado}</span
        >
      </div>
      <p class="ticket__title"><a href="${href}">${evento.titulo}</a></p>
      <p class="ticket__meta">
        ${evento.artista?.nombre_artistico ?? ''} · ${formatDateTime(evento.fecha_inicio)}
      </p>
      <p class="ticket__meta">
        ${compra.estado === 'APROBADA' ? 'Pagaste' : 'Monto'}
        <strong>${formatCop(compra.monto_cop)}</strong>
      </p>
    </div>
    <div class="ticket__actions">${botonDeAccion(accion, compra)}</div>
  </li>`;
}

export function esqueletoEntradas(n = 3) {
  return html`<ul class="ticket-list" role="status" aria-label="Cargando entradas">
    ${Array.from(
      { length: n },
      () => html`<li class="ticket" aria-hidden="true">
        <span class="skeleton" style="width:140px;aspect-ratio:16/9"></span>
        <div class="ticket__info d-grid gap-2">
          <span class="skeleton" style="width:30%;height:14px"></span>
          <span class="skeleton" style="width:60%;height:18px"></span>
          <span class="skeleton" style="width:45%;height:14px"></span>
        </div>
      </li>`,
    )}
  </ul>`;
}
