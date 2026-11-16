import { activarFallbackAvatares } from '../../../shared/ui/avatar.js';
import { artistCardSkeleton } from '../../../shared/ui/artist-card.js';
import { html } from '../../../shared/utils/html.js';
import { activarSeguir, artistCardConSeguir, seguidosDelUsuario } from '../../catalog/index.js';
import { cargarSeguidos } from '../tickets.service.js';
import { crearPaginaSocial } from './social-list.js';

/** "Siguiendo": artistas que sigo, con botón para dejar de seguir (cambio optimista). */
export const followingPage = crearPaginaSocial({
  titulo: 'Siguiendo',
  singular: 'artista',
  plural: 'artistas',
  claseGrid: 'artist-grid',
  vacio: {
    icono: 'bi-people',
    titulo: 'Aún no sigues a ningún artista',
    mensaje: 'Sigue a tus artistas favoritos para encontrarlos aquí.',
    accion: { href: '#/artistas', texto: 'Explorar artistas' },
  },
  cargarPagina: (page, signal) => cargarSeguidos(page, signal),
  // Todo lo que llega aquí se sigue: el botón sale como "Siguiendo".
  alCargar: (artistas) => artistas.forEach((a) => seguidosDelUsuario.fijar(a.id, true)),
  itemHtml: (artista) => artistCardConSeguir(artista),
  esqueleto: () =>
    html`<div class="artist-grid" aria-hidden="true">
      ${Array.from({ length: 6 }, () => artistCardSkeleton())}
    </div>`,
  activar: (raiz, callbacks) => activarSeguir(raiz, callbacks),
  preparar: activarFallbackAvatares,
});
