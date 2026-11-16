import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { coverMedia } from '../../../shared/ui/cover.js';
import { liveBadge } from '../../../shared/ui/live-badge.js';
import { ETIQUETA_ESTADO, accionesDeEvento } from '../studio.service.js';

/** Insignia de estado con texto (el color no es la única señal). */
export function badgeEstado(estado) {
  if (estado === 'EN_VIVO') return liveBadge();
  return html`<span class="studio-state studio-state--${estado.toLowerCase()}"
    >${ETIQUETA_ESTADO[estado] ?? estado}</span
  >`;
}

const idCodificado = (evento) => encodeURIComponent(evento.id);

function botonAccion(accion, evento) {
  const id = evento.id;
  switch (accion) {
    case 'editar':
      return html`<a
        class="btn btn-outline-light btn-sm"
        href="#/estudio/eventos/${idCodificado(evento)}/editar"
        >${evento.estado === 'BORRADOR' ? 'Editar' : 'Editar o ver'}</a
      >`;
    case 'transmision':
      return html`<a
        class="btn btn-primary btn-sm"
        href="#/estudio/eventos/${idCodificado(evento)}/transmision"
        ><i class="bi bi-broadcast me-1" aria-hidden="true"></i>${
          evento.estado === 'EN_VIVO' ? 'Ir a la transmisión' : 'Sala de control'
        }</a
      >`;
    case 'estadisticas':
      return html`<a
        class="btn btn-outline-light btn-sm"
        href="#/estudio/eventos/${idCodificado(evento)}/estadisticas"
        ><i class="bi bi-bar-chart me-1" aria-hidden="true"></i>Estadísticas</a
      >`;
    case 'ver':
      return html`<a class="btn btn-outline-light btn-sm" href="#/eventos/${idCodificado(evento)}"
        >Ver página pública</a
      >`;
    case 'publicar':
      return html`<button
        type="button"
        class="btn btn-primary btn-sm"
        data-action="publicar"
        data-id="${id}"
      >
        Publicar
      </button>`;
    case 'eliminar':
      return html`<button
        type="button"
        class="btn btn-outline-danger btn-sm"
        data-action="eliminar"
        data-id="${id}"
      >
        Eliminar
      </button>`;
    case 'cancelar':
      return html`<button
        type="button"
        class="btn btn-outline-danger btn-sm"
        data-action="cancelar"
        data-id="${id}"
      >
        Cancelar evento
      </button>`;
    default:
      return html``;
  }
}

const ENLACES = ['editar', 'transmision', 'estadisticas', 'ver'];

/**
 * Fila del listado con las acciones que permite su estado (§5.5). Con `soloEnlaces` se omiten los
 * botones que necesitan manejador en la página (publicar, eliminar, cancelar).
 */
export function filaEvento(evento, { soloEnlaces = false } = {}) {
  return html`<li class="studio-row" data-evento="${evento.id}">
    <span class="studio-row__thumb" aria-hidden="true">${coverMedia(evento)}</span>
    <div class="studio-row__info">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
        ${badgeEstado(evento.estado)}
        ${
          evento.estado === 'FINALIZADO' && evento.replay_disponible
            ? html`<span class="soft-badge">REPLAY</span>`
            : ''
        }
      </div>
      <p class="studio-row__title">${evento.titulo}</p>
      <p class="studio-row__meta">${formatDateTime(evento.fecha_inicio)} · ${formatCop(evento.precio_cop)}</p>
    </div>
    <div class="studio-row__actions">
      ${accionesDeEvento(evento.estado)
        .filter((a) => !soloEnlaces || ENLACES.includes(a))
        .map((a) => botonAccion(a, evento))}
    </div>
  </li>`;
}

export function esqueletoLista() {
  return html`<ul class="studio-list" aria-hidden="true">
    ${Array.from(
      { length: 4 },
      () => html`<li class="studio-row">
        <span class="skeleton" style="width:120px;aspect-ratio:16/9"></span>
        <div class="studio-row__info d-grid gap-2">
          <span class="skeleton" style="width:30%;height:14px"></span>
          <span class="skeleton" style="width:60%;height:18px"></span>
          <span class="skeleton" style="width:40%;height:14px"></span>
        </div>
      </li>`,
    )}
  </ul>`;
}
