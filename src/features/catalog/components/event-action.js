import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';

const comprado = html`<p class="text-success fw-semibold">
  <i class="bi bi-check-circle-fill" aria-hidden="true"></i> Comprado
</p>`;

/** Enlace a la pantalla de ver (`#/ver/:id`); allí se decide vivo, replay o sala de espera. */
function enlaceVer(evento, texto, icono) {
  return html`<a
    class="btn btn-primary btn-lg w-100"
    href="#/ver/${encodeURIComponent(evento.id)}"
    ><i class="bi ${icono} me-1" aria-hidden="true"></i>${texto}</a
  >`;
}

/**
 * Bloque de acción del detalle: comprar abre el checkout y los botones "Ver" llevan a `#/ver/:id`.
 * @param {{tipo: string, mensaje?: string}} accion
 * @param {{id: string, precio_cop: number}} evento
 * @param {string} hashActual hash de esta pantalla, para volver tras iniciar sesión
 */
export function eventAction(accion, evento, hashActual) {
  const precio = formatCop(evento.precio_cop);
  switch (accion.tipo) {
    case 'GESTIONAR':
      return html`<p class="text-muted-2">Este evento es tuyo.</p>
        <a
          class="btn btn-primary btn-lg w-100"
          href="#/estudio/eventos/${encodeURIComponent(evento.id)}/editar"
          >Gestionar evento</a
        >`;
    case 'ADMIN':
      return html`<p class="mb-0 text-muted-2">
        Vista de administración: los administradores no compran entradas.
      </p>`;
    case 'NO_DISPONIBLE':
      return html`<p class="catalog-action__price">No disponible</p>
        <p class="mb-0 text-muted-2" role="status">${accion.mensaje}</p>`;
    case 'LOGIN':
      return html`<p class="catalog-action__price mb-3">${precio}</p>
        <a
          class="btn btn-primary btn-lg w-100"
          href="#/login?redirect=${encodeURIComponent(hashActual)}"
          >Iniciar sesión para comprar</a
        >`;
    case 'COMPRAR':
      // `data-action="comprar"`: la página abre el checkout (feature `checkout`).
      return html`<p class="catalog-action__price mb-3">${precio}</p>
        <button type="button" class="btn btn-primary btn-lg w-100" data-action="comprar">
          <i class="bi bi-ticket-perforated me-1" aria-hidden="true"></i>Comprar entrada · ${precio}
        </button>`;
    case 'VER_AHORA':
      return html`${comprado} ${enlaceVer(evento, 'Ver ahora', 'bi-play-fill')}`;
    case 'VER_CUANDO_EMPIECE':
      return html`${comprado} ${enlaceVer(evento, 'Ver cuando empiece', 'bi-clock')}`;
    case 'VER_REPLAY':
      return html`${comprado} ${enlaceVer(evento, 'Ver replay', 'bi-play-circle')}`;
    default:
      return html``;
  }
}
