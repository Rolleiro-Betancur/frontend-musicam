import { config } from '../../../core/config.js';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { categoryChips } from '../../../shared/ui/category-chips.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { eventCardSkeleton } from '../../../shared/ui/event-card.js';
import { hero } from '../../../shared/ui/hero.js';
import { activarRails, rail } from '../../../shared/ui/rail.js';
import { showToast } from '../../../shared/ui/toast.js';
import { activarFavoritos, eventCardConFavorito } from '../components/favorite-button.js';
import { cargarInicio, elegirHero } from '../catalog.service.js';
import { precargarSocial } from '../social.service.js';

function heroBienvenida(usuario) {
  return html`<section class="hero-welcome">
    <div class="container">
      <p class="eyebrow mb-2">Conciertos en vivo</p>
      <h1 class="mb-3">${config.appName}: tu escenario, sin cuotas fijas</h1>
      <p class="lead text-muted-2 mb-4" style="max-width:560px">
        Artistas independientes de Colombia venden y transmiten sus conciertos. Tú solo pagas la
        entrada de los que quieres ver.
      </p>
      ${
        usuario
          ? html``
          : html`<div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary rounded-pill px-4" href="#/registro">Crear cuenta</a>
            <a class="btn btn-outline-light rounded-pill px-4" href="#/login">Iniciar sesión</a>
          </div>`
      }
    </div>
  </section>`;
}

/** Llamada a artistas (C1/C2): sin planes ni cuotas, solo comisión por boleto. */
function llamadaArtistas(usuario) {
  let boton = html``;
  if (!usuario) {
    boton = html`<a class="btn btn-primary rounded-pill px-4" href="#/registro"
      >Crear cuenta de artista</a
    >`;
  } else if (usuario.rol === 'ARTISTA') {
    boton = html`<a class="btn btn-primary rounded-pill px-4" href="#/estudio">Ir al estudio</a>`;
  }
  return html`<section class="surface-card p-4 p-md-5 mt-5" aria-labelledby="cta-artistas">
    <h2 id="cta-artistas" class="mb-2">¿Eres artista? Vende tu concierto sin cuotas fijas</h2>
    <p class="text-muted-2 mb-3">
      Crea tu evento, publícalo y transmite tú mismo. Solo se cobra una comisión por cada boleto
      vendido.
    </p>
    ${boton}
  </section>`;
}

function filaDe(titulo, eventos, estado) {
  if (!eventos.length) return html``;
  return rail({
    titulo,
    verTodoHref: `#/eventos?estado=${estado}`,
    items: eventos.map((e) => eventCardConFavorito(e)),
  });
}

function esqueleto() {
  return html`<div role="status" aria-label="Cargando inicio">
    <div class="skeleton" style="height:min(50vh,420px);border-radius:0"></div>
    <div class="container">
      <div class="rail__head mt-5"><span class="skeleton" style="width:200px;height:28px"></span></div>
      <div class="rail__track">
        ${[1, 2, 3, 4].map((n) => html`<div class="rail__item" data-n="${n}">${eventCardSkeleton()}</div>`)}
      </div>
    </div>
  </div>`;
}

/** Inicio: hero con el evento en vivo o el más cercano + filas + categorías + llamada a artistas. */
export async function homePage(ctx) {
  const el = fromHtml(html``, 'section');
  activarFallbackPortadas(el);
  let limpiarRails = () => {};

  function pintar(datos) {
    const { usuario } = sessionState.get();
    const destacado = elegirHero(datos);
    const sinEventos = !datos.vivos.length && !datos.proximos.length && !datos.replays.length;
    setHtml(
      el,
      html`${
        destacado
          ? hero({
              evento: destacado,
              cta: {
                href: `#/eventos/${encodeURIComponent(destacado.id)}`,
                texto: destacado.estado === 'EN_VIVO' ? 'Ver el evento en vivo' : 'Ver evento',
              },
            })
          : heroBienvenida(usuario)
      }
        <div class="container pb-4">
          ${
            sinEventos
              ? emptyState({
                  icono: 'bi-music-note-list',
                  titulo: 'Aún no hay conciertos publicados',
                  mensaje: 'Vuelve pronto: los artistas están preparando sus próximos eventos.',
                })
              : html`${filaDe('En vivo ahora', datos.vivos, 'EN_VIVO')}
              ${filaDe('Próximos conciertos', datos.proximos, 'PROGRAMADO')}
              ${filaDe('Reproducciones disponibles', datos.replays, 'FINALIZADO')}`
          }
          <section class="mt-5" aria-labelledby="categorias">
            <h2 id="categorias" class="fs-4 mb-3">Explora por categoría</h2>
            ${categoryChips({ modo: 'link' })}
          </section>
          ${llamadaArtistas(usuario)}
        </div>`,
    );
    limpiarRails();
    limpiarRails = activarRails(el);
  }

  async function cargar() {
    setHtml(el, esqueleto());
    try {
      // Los favoritos se cargan en paralelo; si fallan, los corazones salen apagados.
      const [datos] = await Promise.all([cargarInicio(ctx.signal), precargarSocial(ctx.signal)]);
      pintar(datos);
      if (datos.parcial) {
        showToast('Algunas secciones no se pudieron cargar. Recarga para reintentar.', 'warning');
      }
    } catch (error) {
      if (error.cancelada) return;
      setHtml(el, html`<div class="container">${errorState({ mensaje: error.mensaje })}</div>`);
    }
  }

  const quitarDelegacion = delegate(el, 'click', { reintentar: cargar });
  const quitarFavoritos = activarFavoritos(el);
  await cargar();
  return {
    title: 'Inicio',
    el,
    destroy() {
      quitarDelegacion();
      quitarFavoritos();
      limpiarRails();
    },
  };
}
