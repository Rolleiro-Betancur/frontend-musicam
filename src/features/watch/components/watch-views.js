import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateLong, formatTime } from '../../../shared/utils/format-date.js';
import { coverMedia } from '../../../shared/ui/cover.js';
import { liveBadge, replayBadge } from '../../../shared/ui/live-badge.js';

const volverAlEvento = (evento) =>
  html`<a href="#/eventos/${encodeURIComponent(evento.id)}">← Volver al evento</a>`;

/** Mensaje centrado sin evento a la vista (suspendido, no disponible, no encontrado). */
export function vistaMensaje({ icono, titulo, mensaje, enlace }) {
  return html`<div class="container py-5 text-center" style="max-width:560px">
    <i class="bi ${icono} display-3 text-muted-2" aria-hidden="true"></i>
    <h1 class="mt-3">${titulo}</h1>
    <p class="text-muted-2">${mensaje}</p>
    <a class="btn btn-primary" href="${enlace.href}">${enlace.texto}</a>
  </div>`;
}

/** Acceso denegado (C4): póster difuminado, candado e invitación a comprar. */
export function vistaDenegado({ evento }) {
  return html`<div class="container py-4">
    <div class="watch-locked">
      <div class="watch-locked__poster" aria-hidden="true">${coverMedia(evento)}</div>
      <div class="watch-locked__panel">
        <i class="bi bi-lock-fill display-4" aria-hidden="true"></i>
        <h1 class="fs-3 mt-2">${evento.titulo}</h1>
        <p class="mb-3">Este contenido es solo para quienes compraron su entrada.</p>
        <button type="button" class="btn btn-primary btn-lg" data-action="comprar">
          Comprar entrada · ${formatCop(evento.precio_cop)}
        </button>
        <p class="mt-3 mb-0">${volverAlEvento(evento)}</p>
      </div>
    </div>
  </div>`;
}

/** Sala de espera: cuenta regresiva a `fecha_inicio` (el componente se monta en `[data-countdown]`). */
export function vistaEspera({ evento }) {
  return html`<div class="container py-4">
    <div class="watch-wait">
      <div class="watch-wait__poster" aria-hidden="true">${coverMedia(evento)}</div>
      <div class="watch-wait__panel">
        <p class="eyebrow mb-2">Sala de espera</p>
        <h1 class="fs-2">${evento.titulo}</h1>
        <p class="text-muted-2">
          Empieza el ${formatDateLong(evento.fecha_inicio)} a las ${formatTime(evento.fecha_inicio)}
          (hora de Colombia).
        </p>
        <div class="mb-3" data-countdown></div>
        <p class="small text-muted-2 mb-3" role="status" data-estado-espera>
          Esta pantalla se actualizará sola cuando comience.
        </p>
        ${volverAlEvento(evento)}
      </div>
    </div>
  </div>`;
}

/** Panel de chat deshabilitado: reserva el espacio de diseño (el chat real queda fuera del MVP). */
function panelChat() {
  return html`<aside class="surface-card p-3 watch-chat" aria-label="Chat">
    <h2 class="fs-6">Chat</h2>
    <p class="text-muted-2 flex-grow-1">El chat llegará pronto</p>
    <div class="d-flex gap-2">
      <input
        type="text"
        class="form-control"
        placeholder="Escribe un mensaje"
        aria-label="Mensaje de chat (no disponible)"
        disabled
      />
      <button type="button" class="btn btn-primary" disabled>Enviar</button>
    </div>
  </aside>`;
}

/** Pantalla de reproducción: reproductor, datos del evento y chat. */
export function vistaReproductor({ evento, tipo }) {
  return html`<div class="container py-4">
    <nav aria-label="Migas de pan" class="mb-3">${volverAlEvento(evento)}</nav>
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="player">
          <div class="player__stage" data-player></div>
          <div class="player__overlay" data-reanudar hidden>
            <i class="bi bi-clock-history display-5" aria-hidden="true"></i>
            <p class="mb-3" role="status">Tu sesión de reproducción venció.</p>
            <button type="button" class="btn btn-primary btn-lg" data-action="reanudar">
              Reanudar
            </button>
          </div>
          <div class="player__overlay" data-error-player hidden role="alert">
            <i class="bi bi-exclamation-triangle display-5 text-warning" aria-hidden="true"></i>
            <p class="mb-3" data-mensaje-player></p>
            <button type="button" class="btn btn-primary btn-lg" data-action="reanudar">
              Reintentar
            </button>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 align-items-center mt-3 mb-2">
          ${tipo === 'VIVO' ? liveBadge() : replayBadge()}
        </div>
        <h1 class="mb-1">${evento.titulo}</h1>
        <p class="text-muted-2">
          ${evento.artista?.nombre_artistico ?? ''} ·
          <a href="#/artistas/${encodeURIComponent(evento.artista?.id ?? '')}">Ver artista</a>
        </p>
      </div>
      <div class="col-lg-4">${panelChat()}</div>
    </div>
  </div>`;
}

export function esqueletoVer() {
  return html`<div class="container py-4" role="status" aria-label="Cargando reproducción">
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="skeleton" style="aspect-ratio:16/9;border-radius:14px"></div>
      </div>
      <div class="col-lg-4">
        <div class="skeleton" style="height:240px;border-radius:14px"></div>
      </div>
    </div>
  </div>`;
}
