import { on } from '../../../core/event-bus.js';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateLong, formatTime } from '../../../shared/utils/format-date.js';
import { etiquetaCategoria } from '../../../shared/utils/categorias.js';
import { avatar, activarFallbackAvatares } from '../../../shared/ui/avatar.js';
import { activarFallbackPortadas, coverMedia } from '../../../shared/ui/cover.js';
import { createCountdown } from '../../../shared/ui/countdown.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { estadoBadge } from '../../../shared/ui/live-badge.js';
import { skeletonBlock } from '../../../shared/ui/skeleton.js';
import { showToast } from '../../../shared/ui/toast.js';
import { abrirCheckout } from '../../checkout/index.js';
import { eventAction } from '../components/event-action.js';
import { activarFavoritos, favoriteButton } from '../components/favorite-button.js';
import { activarSeguir, followButton } from '../components/follow-button.js';
import { favoritos, precargarSocial, seguidos } from '../social.service.js';
import { obtenerEvento } from '../catalog.api.js';
import { estadoAccion } from '../catalog.service.js';

const ETIQUETA_ESTADO = { BORRADOR: 'Borrador', CANCELADO: 'Cancelado' };

function esqueleto() {
  return html`<div class="container py-4" role="status" aria-label="Cargando evento">
    <div class="row g-4">
      <div class="col-lg-8 d-grid gap-3">
        <div class="skeleton" style="aspect-ratio:16/9;border-radius:14px"></div>
        ${skeletonBlock({ ancho: '60%', alto: '32px' })} ${skeletonBlock({ ancho: '40%' })}
        ${skeletonBlock({ alto: '80px' })}
      </div>
      <div class="col-lg-4">${skeletonBlock({ alto: '180px', radio: '14px' })}</div>
    </div>
  </div>`;
}

/** Etiqueta de estado para lo que solo ve su dueño (borrador, cancelado, suspendido). */
function etiquetaPrivada(evento) {
  const texto = evento.suspendido_admin ? 'Suspendido' : ETIQUETA_ESTADO[evento.estado];
  return texto ? html`<span class="soft-badge">${texto}</span>` : html``;
}

/** Detalle de evento con un único bloque de acción cuyo estado cambia (§6.4). */
export async function eventDetailPage(ctx) {
  const el = fromHtml(html``, 'section');
  activarFallbackPortadas(el);
  activarFallbackAvatares(el);
  let countdown = null;
  let titulo = 'Evento';
  let eventoActual = null;
  let checkout = null;

  function limpiarCountdown() {
    countdown?.destroy();
    countdown = null;
  }

  function pintar(evento) {
    limpiarCountdown();
    const { usuario } = sessionState.get();
    eventoActual = evento;
    const accion = estadoAccion(evento, usuario);
    const artista = evento.artista;
    const esperando = evento.estado === 'PROGRAMADO' && !evento.suspendido_admin;
    titulo = evento.titulo;

    setHtml(
      el,
      html`<div class="container py-4">
        <nav aria-label="Migas de pan" class="mb-3">
          <a href="#/eventos">← Todos los eventos</a>
        </nav>
        <div class="row g-4">
          <div class="col-lg-8">
            <div class="catalog-detail__poster mb-4">
              ${coverMedia(evento, `Póster de ${evento.titulo}`)}
            </div>
            <div class="d-flex flex-wrap gap-2 mb-2">
              ${estadoBadge(evento)} ${etiquetaPrivada(evento)}
              <span class="soft-badge">${etiquetaCategoria(evento.categoria)}</span>
            </div>
            <h1 class="mb-2">${evento.titulo}</h1>
            <p class="text-muted-2 mb-1">
              <i class="bi bi-calendar-event" aria-hidden="true"></i>
              ${formatDateLong(evento.fecha_inicio)} · ${formatTime(evento.fecha_inicio)} (hora de
              Colombia)
            </p>
            <p class="text-muted-2 mb-4">
              <i class="bi bi-clock" aria-hidden="true"></i> Duración estimada:
              ${evento.duracion_estimada_min} min
            </p>
            ${
              evento.descripcion
                ? html`<h2 class="fs-5">Acerca del evento</h2>
                  <p class="catalog-detail__desc">${evento.descripcion}</p>`
                : ''
            }
          </div>
          <aside class="col-lg-4" aria-label="Entrada y artista">
            <div class="catalog-action mb-3" data-accion aria-live="polite">
              ${eventAction(accion, evento, `#/eventos/${encodeURIComponent(evento.id)}`)}
              ${
                evento.precio_cop && accion.tipo === 'VER_AHORA'
                  ? html`<p class="small text-muted-2 mb-0 mt-2">
                    Entrada pagada: ${formatCop(evento.precio_cop)}
                  </p>`
                  : ''
              }
              ${
                esperando
                  ? html`<div class="mt-3">
                    <p class="eyebrow mb-2">Empieza en</p>
                    <div data-countdown></div>
                  </div>`
                  : ''
              }
              <hr class="my-3" />
              ${favoriteButton({ eventoId: evento.id, activo: favoritos.tiene(evento.id), variante: 'completo' })}
            </div>
            <div class="surface-card p-3 d-flex align-items-center gap-3">
              ${avatar({ nombre: artista.nombre_artistico, fotoUrl: artista.foto_url, tamano: 56 })}
              <div class="flex-grow-1">
                <p class="eyebrow mb-0">Artista</p>
                <a class="fw-semibold" href="#/artistas/${encodeURIComponent(artista.id)}"
                  >${artista.nombre_artistico}</a
                >
              </div>
              ${followButton({ artistaId: artista.id, siguiendo: seguidos.tiene(artista.id) })}
            </div>
          </aside>
        </div>
      </div>`,
    );

    const contenedor = el.querySelector('[data-countdown]');
    if (contenedor) {
      // Al llegar la hora se vuelve a consultar el evento una sola vez (puede haber pasado a EN_VIVO).
      countdown = createCountdown({ objetivo: evento.fecha_inicio, onFin: () => cargar(false) });
      contenedor.append(countdown.el);
    }
  }

  async function cargar(conEsqueleto = true) {
    if (conEsqueleto) setHtml(el, esqueleto());
    try {
      const [actual] = await Promise.all([
        obtenerEvento(ctx.params.id, ctx.signal),
        precargarSocial(ctx.signal),
      ]);
      // `es_favorito` viene del servidor y manda sobre lo que se tuviera en memoria.
      if (actual.es_favorito !== undefined) favoritos.fijar(actual.id, actual.es_favorito);
      pintar(actual);
    } catch (error) {
      if (error.cancelada) return;
      if (!conEsqueleto && eventoActual) {
        // Actualización silenciosa fallida: se conserva lo que ya se ve y se avisa.
        showToast(error.mensaje, 'warning');
        return;
      }
      limpiarCountdown();
      if (error.status === 404) {
        setHtml(
          el,
          html`<div class="container py-4">
            ${emptyState({
              icono: 'bi-calendar-x',
              titulo: 'No encontramos este evento',
              mensaje: 'Puede que haya sido retirado o que el enlace sea incorrecto.',
              accion: { href: '#/eventos', texto: 'Ver todos los eventos' },
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

  const alClic = (e) => {
    const accion = e.target.closest('[data-action]')?.dataset.action;
    if (accion === 'reintentar') cargar();
    if (accion === 'comprar' && eventoActual && !checkout) {
      checkout = abrirCheckout(eventoActual);
      checkout.cerrado.then(() => {
        checkout = null;
      });
    }
  };
  el.addEventListener('click', alClic);
  const quitarFavoritos = activarFavoritos(el);
  const quitarSeguir = activarSeguir(el);

  // Tras un pago aprobado se vuelve a consultar el evento: `comprado` pasa a true y el
  // botón cambia solo a "Ver ahora" / "Ver cuando empiece" (C3), sin pasos manuales.
  const quitarCompra = on('compra:aprobada', ({ eventoId }) => {
    if (eventoId === ctx.params.id) cargar(false);
  });

  await cargar();
  return {
    // El título se conoce solo tras cargar; el router lo lee al montar.
    get title() {
      return titulo;
    },
    el,
    destroy() {
      limpiarCountdown();
      quitarCompra();
      checkout?.cerrar();
      quitarFavoritos();
      quitarSeguir();
      el.removeEventListener('click', alClic);
    },
  };
}
