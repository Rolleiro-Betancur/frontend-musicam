import { getUsuario } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { eventCard } from '../../../shared/ui/event-card.js';
import { alternarFavorito, favoritos, puedeUsarSocial } from '../social.service.js';
import { activarToggle } from './toggle-button.js';

const ETIQUETA = { si: 'Quitar de favoritos', no: 'Agregar a favoritos' };

/**
 * Botón de favorito. `tarjeta`: corazón sobre el póster; `completo`: botón con texto (detalle).
 * No se muestra a los administradores (no usan favoritos). Sin sesión se ve, y al pulsarlo lleva
 * a iniciar sesión. Actívalo con `activarFavoritos(raiz)`.
 * @param {{eventoId: string, activo?: boolean, variante?: 'tarjeta'|'completo'}} o
 */
export function favoriteButton({ eventoId, activo = false, variante = 'tarjeta' }) {
  const usuario = getUsuario();
  if (usuario && !puedeUsarSocial(usuario)) return html``;
  const etiqueta = activo ? ETIQUETA.si : ETIQUETA.no;
  const icono = html`<i class="bi ${activo ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i>`;
  return variante === 'completo'
    ? html`<button
        type="button"
        class="btn btn-outline-light w-100"
        data-fav
        data-id="${eventoId}"
        data-activo="${String(activo)}"
        aria-pressed="${String(activo)}"
      >
        ${icono}
        <span data-texto>${activo ? 'En tus favoritos' : 'Guardar en favoritos'}</span>
      </button>`
    : html`<button
        type="button"
        class="event-card__fav"
        data-fav
        data-id="${eventoId}"
        data-activo="${String(activo)}"
        aria-pressed="${String(activo)}"
        aria-label="${etiqueta}"
        title="${etiqueta}"
      >
        ${icono}
      </button>`;
}

/** Cambia la apariencia de un botón de favorito según su estado. */
function aplicar(boton, activo) {
  boton.dataset.activo = String(activo);
  boton.setAttribute('aria-pressed', String(activo));
  const icono = boton.querySelector('i');
  icono.classList.toggle('bi-heart-fill', activo);
  icono.classList.toggle('bi-heart', !activo);
  const texto = boton.querySelector('[data-texto]');
  if (texto) {
    texto.textContent = activo ? 'En tus favoritos' : 'Guardar en favoritos';
  } else {
    const etiqueta = activo ? ETIQUETA.si : ETIQUETA.no;
    boton.setAttribute('aria-label', etiqueta);
    boton.title = etiqueta;
  }
}

/**
 * Activa los botones de favorito dentro de `raiz` (cambio optimista con reversión si falla).
 * `alOptimista`/`alRevertir` permiten a una lista (p. ej. "Mis favoritos") ocultar y restaurar
 * la tarjeta. Devuelve la función que quita el listener.
 */
export function activarFavoritos(raiz, { alOptimista, alRevertir, alExito } = {}) {
  return activarToggle(raiz, {
    selector: '[data-fav]',
    aplicar,
    solicitar: (id, activo) => alternarFavorito(id, activo),
    alOptimista,
    alRevertir,
    alExito,
  });
}

/** Tarjeta de evento con su corazón, ya con el estado real del favorito. */
export function eventCardConFavorito(evento) {
  return eventCard(evento, {
    favorito: favoriteButton({ eventoId: evento.id, activo: favoritos.tiene(evento.id) }),
  });
}
