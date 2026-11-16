import '../watch.css';
import { on } from '../../../core/event-bus.js';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { createCountdown } from '../../../shared/ui/countdown.js';
import { errorState } from '../../../shared/ui/empty-state.js';
import { abrirCheckout } from '../../checkout/index.js';
import { crearPlayer } from '../player/player-adapter.js';
import { obtenerEventoParaVer, salir } from '../watch.api.js';
import {
  REINTENTO_ESPERA_MS,
  decidirVista,
  entrarAlEvento,
  msHastaExpirar,
} from '../watch.service.js';
import {
  esqueletoVer,
  vistaDenegado,
  vistaEspera,
  vistaMensaje,
  vistaReproductor,
} from '../components/watch-views.js';

const VOLVER = { href: '#/eventos', texto: 'Ver todos los eventos' };

/**
 * Pantalla de ver (§5.3): vivo o replay. Llama a `entrar` una sola vez por visita y a `salir`
 * al abandonarla (destroy) o al cerrar la pestaña (pagehide, con keepalive).
 * @param {{params: {eventoId: string}, signal: AbortSignal}} ctx
 */
export async function watchPage(ctx) {
  const eventoId = ctx.params.eventoId;
  const el = fromHtml(html``, 'section');
  activarFallbackPortadas(el);

  let titulo = 'Ver evento';
  let evento = null;
  let dentro = false; // true entre un `entrar` correcto y su `salir`
  let player = null;
  let countdown = null;
  let intervaloEspera = null;
  let temporizadorToken = null;
  let esperaActiva = false;
  let checkout = null;
  let destruida = false;
  let secuencia = 0;

  const mostrar = (vista) => setHtml(el, vista);

  function detenerVista() {
    clearInterval(intervaloEspera);
    clearTimeout(temporizadorToken);
    intervaloEspera = null;
    temporizadorToken = null;
    countdown?.destroy();
    countdown = null;
    player?.destroy();
    player = null;
    esperaActiva = false;
  }

  /** Avisa que se dejó de ver. Es de mejor esfuerzo: al salir no hay a quién mostrar un error. */
  function salirSiDentro({ keepalive = false } = {}) {
    if (!dentro) return Promise.resolve();
    dentro = false;
    return salir(eventoId, { keepalive }).catch(() => {});
  }

  // --- Estados ----------------------------------------------------------------------------

  function mostrarEspera() {
    esperaActiva = true;
    mostrar(vistaEspera({ evento }));
    countdown = createCountdown({ objetivo: evento.fecha_inicio, onFin: alLlegarLaHora });
    el.querySelector('[data-countdown]').append(countdown.el);
  }

  /** Al llegar la hora se reintenta y, mientras no empiece, cada 30 s. */
  function alLlegarLaHora() {
    iniciar({ silencioso: true });
    clearInterval(intervaloEspera);
    intervaloEspera = setInterval(() => iniciar({ silencioso: true }), REINTENTO_ESPERA_MS);
  }

  function avisoEspera(texto) {
    const estado = el.querySelector('[data-estado-espera]');
    if (estado) estado.textContent = texto;
  }

  function mostrarErrorPlayer(mensaje) {
    el.querySelector('[data-mensaje-player]').textContent = mensaje;
    el.querySelector('[data-error-player]').hidden = false;
  }

  /** El token venció: se detiene el reproductor y se ofrece "Reanudar" (sin reintentos en bucle). */
  async function alExpirarToken() {
    player?.destroy();
    player = null;
    await salirSiDentro();
    const overlay = el.querySelector('[data-reanudar]');
    if (overlay) overlay.hidden = false;
  }

  async function montarReproductor(reproduccion) {
    mostrar(vistaReproductor({ evento, tipo: reproduccion.tipo }));
    player = crearPlayer();
    temporizadorToken = setTimeout(alExpirarToken, msHastaExpirar(reproduccion.expira_en));
    try {
      await player.mount(el.querySelector('[data-player]'), {
        url: reproduccion.url,
        tipo: reproduccion.tipo,
        evento,
        onError: mostrarErrorPlayer,
      });
    } catch {
      mostrarErrorPlayer('No pudimos iniciar el reproductor. Inténtalo de nuevo.');
    }
  }

  /** `entrar` una sola vez: si ya se entró, no se vuelve a llamar. */
  async function reproducir() {
    if (dentro) return;
    const resultado = await entrarAlEvento(eventoId, ctx.signal);
    if (destruida) return;
    switch (resultado.estado) {
      case 'OK':
        dentro = true;
        titulo = evento.titulo;
        await montarReproductor(resultado.reproduccion);
        break;
      case 'DENEGADO':
        mostrar(vistaDenegado({ evento }));
        break;
      case 'SUSPENDIDO':
        mostrarSuspendido();
        break;
      default:
        mostrarNoEncontrado();
    }
  }

  function mostrarSuspendido() {
    mostrar(
      vistaMensaje({
        icono: 'bi-slash-circle',
        titulo: 'Evento no disponible',
        mensaje: 'Este evento no está disponible por el momento.',
        enlace: VOLVER,
      }),
    );
  }

  function mostrarNoEncontrado() {
    mostrar(
      vistaMensaje({
        icono: 'bi-calendar-x',
        titulo: 'No encontramos este evento',
        mensaje: 'Puede que haya sido retirado o que el enlace sea incorrecto.',
        enlace: VOLVER,
      }),
    );
  }

  /**
   * Carga el evento y decide la vista. `silencioso` (sondeo de la sala de espera) no pinta
   * esqueleto ni cambia nada mientras el evento siga sin empezar.
   */
  async function iniciar({ silencioso = false } = {}) {
    const propia = ++secuencia;
    if (!silencioso) {
      detenerVista();
      mostrar(esqueletoVer());
    }
    try {
      const actual = await obtenerEventoParaVer(eventoId, ctx.signal);
      if (propia !== secuencia || destruida) return;
      evento = actual;
      titulo = actual.titulo;
      const { vista, mensaje } = decidirVista(actual, sessionState.get().usuario);

      if (silencioso && vista === 'ESPERA' && esperaActiva) {
        avisoEspera('Aún no comienza. Volveremos a revisar en unos segundos.');
        return;
      }
      if (silencioso) detenerVista();

      switch (vista) {
        case 'SUSPENDIDO':
          return mostrarSuspendido();
        case 'NO_DISPONIBLE':
          return mostrar(
            vistaMensaje({
              icono: 'bi-calendar-x',
              titulo: 'Evento no disponible',
              mensaje,
              enlace: VOLVER,
            }),
          );
        case 'DENEGADO':
          return mostrar(vistaDenegado({ evento }));
        case 'ESPERA':
          return mostrarEspera();
        default:
          return await reproducir();
      }
    } catch (error) {
      if (error.cancelada || propia !== secuencia || destruida) return;
      if (error.status === 404) return mostrarNoEncontrado();
      if (silencioso && esperaActiva) {
        avisoEspera('No pudimos actualizar el estado. Lo intentaremos de nuevo.');
        return;
      }
      mostrar(html`<div class="container py-4">${errorState({ mensaje: error.mensaje })}</div>`);
    }
  }

  /** "Reanudar" tras vencer el token (o fallar el reproductor): nueva entrada solicitada por la persona. */
  async function reanudar() {
    await salirSiDentro();
    detenerVista();
    mostrar(esqueletoVer());
    try {
      await reproducir();
    } catch (error) {
      if (error.cancelada || destruida) return;
      mostrar(html`<div class="container py-4">${errorState({ mensaje: error.mensaje })}</div>`);
    }
  }

  // --- Eventos ----------------------------------------------------------------------------

  const alClic = (e) => {
    const accion = e.target.closest('[data-action]')?.dataset.action;
    if (accion === 'reintentar') iniciar();
    if (accion === 'reanudar') reanudar();
    if (accion === 'comprar' && evento && !checkout) {
      checkout = abrirCheckout(evento);
      checkout.cerrado.then(() => {
        checkout = null;
      });
    }
  };
  el.addEventListener('click', alClic);

  // Cerrar la pestaña no ejecuta destroy(): se avisa con keepalive para que la petición salga.
  const alOcultar = () => salirSiDentro({ keepalive: true });
  window.addEventListener('pagehide', alOcultar);

  // Tras comprar desde el candado, se vuelve a decidir: ahora sí hay derecho de acceso (C3/C4).
  const quitarCompra = on('compra:aprobada', (datos) => {
    if (datos.eventoId === eventoId) iniciar();
  });

  await iniciar();
  return {
    get title() {
      return titulo;
    },
    el,
    destroy() {
      destruida = true;
      detenerVista();
      quitarCompra();
      window.removeEventListener('pagehide', alOcultar);
      el.removeEventListener('click', alClic);
      checkout?.cerrar();
      salirSiDentro({ keepalive: true });
    },
  };
}
