import { html } from '../../../shared/utils/html.js';
import { fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { avatar, activarFallbackAvatares } from '../../../shared/ui/avatar.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { skeletonBlock } from '../../../shared/ui/skeleton.js';
import { activarFavoritos, eventCardConFavorito } from '../components/favorite-button.js';
import { activarSeguir, followButton } from '../components/follow-button.js';
import { cargarArtista, textoSeguidores } from '../catalog.service.js';
import { precargarSocial, seguidos } from '../social.service.js';

function esqueleto() {
  return html`<div class="container py-4" role="status" aria-label="Cargando artista">
    <div class="d-flex align-items-center gap-4 mb-4">
      ${skeletonBlock({ ancho: '120px', alto: '120px', radio: '50%' })}
      <div class="flex-grow-1 d-grid gap-2">
        ${skeletonBlock({ ancho: '50%', alto: '32px' })} ${skeletonBlock({ ancho: '30%' })}
      </div>
    </div>
    ${skeletonBlock({ alto: '60px' })}
  </div>`;
}

/** Perfil público del artista: foto, bio, seguidores y próximos eventos. */
export async function artistDetailPage(ctx) {
  const el = fromHtml(html``, 'section');
  activarFallbackAvatares(el);
  activarFallbackPortadas(el);
  let titulo = 'Artista';

  function pintar(artista) {
    titulo = artista.nombre_artistico;
    const eventos = artista.eventos_proximos ?? [];
    setHtml(
      el,
      html`<div class="container py-4">
        <nav aria-label="Migas de pan" class="mb-3"><a href="#/artistas">← Todos los artistas</a></nav>
        <header class="artist-header">
          ${avatar({ nombre: artista.nombre_artistico, fotoUrl: artista.foto_url, tamano: 120 })}
          <div class="flex-grow-1">
            <h1 class="mb-1">${artista.nombre_artistico}</h1>
            <p class="text-muted-2 mb-2" data-seguidores data-total="${artista.seguidores}">
              ${textoSeguidores(artista.seguidores)}
            </p>
            ${followButton({ artistaId: artista.id, siguiendo: seguidos.tiene(artista.id), compacto: false })}
          </div>
        </header>
        ${
          artista.biografia
            ? html`<section class="mt-4" aria-labelledby="bio">
              <h2 id="bio" class="fs-5">Biografía</h2>
              <p class="catalog-detail__desc mb-0">${artista.biografia}</p>
            </section>`
            : ''
        }
        <section class="mt-5" aria-labelledby="proximos">
          <h2 id="proximos" class="fs-4 mb-3">Próximos eventos</h2>
          ${
            eventos.length
              ? html`<div class="event-grid">${eventos.map((e) => eventCardConFavorito(e))}</div>`
              : emptyState({
                  icono: 'bi-calendar-x',
                  titulo: 'Sin eventos próximos',
                  mensaje: 'Este artista no tiene conciertos programados por ahora.',
                  accion: { href: '#/eventos', texto: 'Descubrir otros conciertos' },
                })
          }
        </section>
      </div>`,
    );
  }

  async function cargar() {
    setHtml(el, esqueleto());
    try {
      const [artista] = await Promise.all([
        cargarArtista(ctx.params.id, ctx.signal),
        precargarSocial(ctx.signal),
      ]);
      // `siguiendo` viene del servidor y manda sobre lo que se tuviera en memoria.
      if (artista.siguiendo !== undefined) seguidos.fijar(artista.id, artista.siguiendo);
      pintar(artista);
    } catch (error) {
      if (error.cancelada) return;
      if (error.status === 404) {
        setHtml(
          el,
          html`<div class="container py-4">
            ${emptyState({
              icono: 'bi-person-x',
              titulo: 'No encontramos a este artista',
              mensaje: 'Puede que ya no esté disponible o que el enlace sea incorrecto.',
              accion: { href: '#/artistas', texto: 'Ver todos los artistas' },
            })}
          </div>`,
        );
        return;
      }
      setHtml(
        el,
        html`<div class="container py-4">${errorState({ mensaje: error.mensaje })}</div>`,
      );
    }
  }

  /** Ajusta el contador de seguidores al instante (y lo revierte si el servidor falla). */
  const ajustarSeguidores = (delta) => {
    const nodo = el.querySelector('[data-seguidores]');
    if (!nodo) return;
    const total = Math.max(0, Number(nodo.dataset.total) + delta);
    nodo.dataset.total = String(total);
    nodo.textContent = textoSeguidores(total);
  };
  const quitarSeguir = activarSeguir(el, {
    alOptimista: ({ activo }) => ajustarSeguidores(activo ? 1 : -1),
    alRevertir: ({ activo }) => ajustarSeguidores(activo ? 1 : -1),
  });
  const quitarFavoritos = activarFavoritos(el);

  const reintentar = (e) => {
    if (e.target.closest('[data-action="reintentar"]')) cargar();
  };
  el.addEventListener('click', reintentar);

  await cargar();
  return {
    get title() {
      return titulo;
    },
    el,
    destroy() {
      quitarSeguir();
      quitarFavoritos();
      el.removeEventListener('click', reintentar);
    },
  };
}
