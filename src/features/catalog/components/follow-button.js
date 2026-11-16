import { getUsuario } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { artistCard } from '../../../shared/ui/artist-card.js';
import { alternarSeguido, puedeUsarSocial, seguidos } from '../social.service.js';
import { activarToggle } from './toggle-button.js';

/**
 * Botón Seguir / Siguiendo. No se muestra a los administradores ni en el perfil propio (no se puede
 * seguir a uno mismo). Sin sesión se ve, y al pulsarlo lleva a iniciar sesión.
 * Actívalo con `activarSeguir(raiz)`.
 * @param {{artistaId: string, siguiendo?: boolean, compacto?: boolean}} o
 */
export function followButton({ artistaId, siguiendo = false, compacto = true }) {
  const usuario = getUsuario();
  if (usuario && (!puedeUsarSocial(usuario) || usuario.id === artistaId)) return html``;
  return html`<button
    type="button"
    class="btn ${compacto ? 'btn-sm' : ''} ${siguiendo ? 'btn-secondary' : 'btn-outline-light'}"
    data-seguir
    data-id="${artistaId}"
    data-activo="${String(siguiendo)}"
    aria-pressed="${String(siguiendo)}"
  >
    <span data-texto>${siguiendo ? 'Siguiendo' : 'Seguir'}</span>
  </button>`;
}

function aplicar(boton, siguiendo) {
  boton.dataset.activo = String(siguiendo);
  boton.setAttribute('aria-pressed', String(siguiendo));
  boton.classList.toggle('btn-secondary', siguiendo);
  boton.classList.toggle('btn-outline-light', !siguiendo);
  boton.querySelector('[data-texto]').textContent = siguiendo ? 'Siguiendo' : 'Seguir';
}

/**
 * Activa los botones Seguir dentro de `raiz` (cambio optimista con reversión si falla).
 * Devuelve la función que quita el listener.
 */
export function activarSeguir(raiz, { alOptimista, alRevertir, alExito } = {}) {
  return activarToggle(raiz, {
    selector: '[data-seguir]',
    aplicar,
    solicitar: (id, activo) => alternarSeguido(id, activo),
    alOptimista,
    alRevertir,
    alExito,
  });
}

/** Tarjeta de artista con su botón Seguir, ya con el estado real. */
export function artistCardConSeguir(artista) {
  return artistCard(artista, {
    accion: followButton({ artistaId: artista.id, siguiendo: seguidos.tiene(artista.id) }),
  });
}
