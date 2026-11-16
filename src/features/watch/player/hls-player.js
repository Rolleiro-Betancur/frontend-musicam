import { esUrlExternaSegura } from '../../../shared/utils/validators.js';

const MSG_ERROR = 'No pudimos reproducir la transmisión. Inténtalo de nuevo.';

/**
 * Reproductor real: `<video>` con HLS nativo (Safari) o hls.js, que se carga con `import()`
 * solo aquí, la primera vez que se reproduce. Nunca registra la URL ni su token.
 * @implements {import('./player-adapter.js').PlayerAdapter}
 */
export class HlsPlayer {
  constructor() {
    this.video = null;
    this.hls = null;
    this.destruido = false;
  }

  async mount(el, { url, onError }) {
    this.destruido = false;
    const video = document.createElement('video');
    video.className = 'player-video';
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('aria-label', 'Reproductor de video');
    el.replaceChildren(video);
    this.video = video;

    if (!esUrlExternaSegura(url)) {
      onError?.('La dirección de reproducción no es válida.');
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url; // HLS nativo
    } else {
      const { default: Hls } = await import('hls.js');
      if (this.destruido) return; // se salió de la pantalla mientras cargaba la librería
      if (!Hls.isSupported()) {
        onError?.('Tu navegador no admite esta reproducción.');
        return;
      }
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_evento, datos) => {
        if (datos.fatal) onError?.(MSG_ERROR);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      this.hls = hls;
    }
    // El navegador puede bloquear la reproducción automática: la persona usa los controles.
    video.play?.().catch(() => {});
  }

  destroy() {
    this.destruido = true;
    this.hls?.destroy();
    this.hls = null;
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.remove();
      this.video = null;
    }
  }
}
