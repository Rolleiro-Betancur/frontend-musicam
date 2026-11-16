import '../studio.css';
import { config } from '../../../core/config.js';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { setFieldError } from '../../../shared/ui/form-field.js';
import { showToast } from '../../../shared/ui/toast.js';
import { esqueletoSala, vistaCredenciales, vistaSala } from '../components/control-room-views.js';
import {
  cargarEvento,
  estadoTransmision,
  finalizar,
  generarCredenciales,
  iniciar,
  puedeTransmitir,
  simularAudiencia,
  textoDuracion,
} from '../studio.service.js';

export const INTERVALO_SONDEO_MS = 5000;

/**
 * Sala de control del artista (§5.4): credenciales → iniciar → en vivo → finalizar.
 * La `stream_key` vive solo en una variable de esta página: no se guarda en ningún almacenamiento
 * ni en el DOM más allá del campo que la muestra, y se descarta al salir.
 * @param {{params: {id: string}, signal: AbortSignal}} ctx
 */
export async function controlRoomPage(ctx) {
  const id = ctx.params.id;
  const el = fromHtml(html``, 'section');
  let evento = null;
  let transmision = null;
  let streamKey = null; // solo en memoria
  let rtmpUrl = null;
  let intervalo = null;
  let sondeando = false;
  let ocupado = false;
  let destruida = false;

  const q = (selector) => el.querySelector(selector);
  const volverALista = html`<a class="btn btn-primary" href="#/estudio/eventos">Volver a mis eventos</a>`;

  function detenerSondeo() {
    clearInterval(intervalo);
    intervalo = null;
  }

  // --- Sondeo (cada 5 s) --------------------------------------------------------------------

  function pintarMetricas(t) {
    const poner = (clave, valor) => {
      const nodo = q(`[data-metric="${clave}"]`);
      if (nodo) nodo.textContent = String(valor);
    };
    poner('espectadores', t.espectadores_actuales);
    poner('pico', t.pico_espectadores);
    poner('duracion', textoDuracion(t.duracion_transcurrida_min));
  }

  function avisoSondeo(texto) {
    const nodo = q('[data-estado-sondeo]');
    if (nodo) nodo.textContent = texto;
  }

  async function sondear() {
    if (sondeando || destruida) return;
    sondeando = true;
    try {
      const t = await estadoTransmision(id, ctx.signal);
      if (destruida) return;
      transmision = t;
      if (t.estado !== 'EN_VIVO') {
        // Terminó por otra vía (p. ej. otra pestaña): se reconstruye la pantalla.
        detenerSondeo();
        evento = { ...evento, estado: t.estado };
        pintar();
        return;
      }
      pintarMetricas(t);
      avisoSondeo('Se actualiza cada 5 segundos.');
    } catch (error) {
      if (error.cancelada || destruida) return;
      if ([401, 403, 404].includes(error.status)) {
        detenerSondeo();
        avisoSondeo(error.mensaje);
        return;
      }
      avisoSondeo('No pudimos actualizar los datos. Lo intentaremos de nuevo.');
    } finally {
      sondeando = false;
    }
  }

  function iniciarSondeo() {
    detenerSondeo();
    intervalo = setInterval(sondear, INTERVALO_SONDEO_MS);
  }

  // --- Pintado ------------------------------------------------------------------------------

  function pintarCredenciales() {
    const zona = q('[data-credenciales]');
    if (!zona || !streamKey) return;
    setHtml(zona, vistaCredenciales());
    zona.querySelector('[data-cred="rtmp"]').value = rtmpUrl;
    zona.querySelector('[data-cred="key"]').value = streamKey;
    const boton = q('[data-generar]');
    if (boton) boton.textContent = 'Volver a generar credenciales';
    const campo = q('[name="stream_key"]');
    if (campo) campo.value = streamKey; // precarga el paso 2
  }

  function pintarHerramientasDev() {
    const zona = q('[data-dev-tools]');
    if (!zona || !config.enableDevTools) return;
    setHtml(
      zona,
      html`<hr />
        <p class="eyebrow mb-2">Herramientas de desarrollo</p>
        <div class="d-flex flex-wrap align-items-end gap-2">
          <div>
            <label class="form-label" for="dev-audiencia">Espectadores simulados</label>
            <input
              id="dev-audiencia"
              type="number"
              class="form-control"
              min="0"
              max="1000000"
              value="120"
              style="max-width:180px"
            />
          </div>
          <button type="button" class="btn btn-outline-light" data-action="simular">
            Simular audiencia
          </button>
        </div>`,
    );
  }

  function pintar() {
    setHtml(el, vistaSala({ evento, transmision }));
    if (evento.estado === 'PROGRAMADO') pintarCredenciales();
    if (evento.estado === 'EN_VIVO') {
      iniciarSondeo();
      pintarHerramientasDev();
    }
  }

  function mensaje(icono, titulo, texto, acceso = volverALista) {
    setHtml(
      el,
      html`<h1 class="visually-hidden">Sala de control</h1>
        ${emptyState({ icono, titulo, mensaje: texto })}
        <div class="text-center">${acceso}</div>`,
    );
  }

  async function cargar() {
    detenerSondeo();
    setHtml(el, esqueletoSala());
    try {
      const cargado = await cargarEvento(id, ctx.signal);
      if (cargado.artista?.id !== sessionState.get().usuario?.id) {
        return mensaje(
          'bi-shield-lock',
          'Este evento no es tuyo',
          'Solo su artista puede transmitirlo.',
        );
      }
      evento = cargado;
      if (!puedeTransmitir(cargado.estado)) {
        return cargado.estado === 'BORRADOR'
          ? mensaje(
              'bi-pencil-square',
              'Publica el evento primero',
              'Solo se puede transmitir un evento publicado.',
              html`<a class="btn btn-primary" href="#/estudio/eventos/${encodeURIComponent(id)}/editar">Ir al evento</a>`,
            )
          : mensaje(
              'bi-slash-circle',
              'Evento cancelado',
              'Un evento cancelado no se puede transmitir.',
            );
      }
      transmision =
        cargado.estado === 'PROGRAMADO' ? null : await estadoTransmision(id, ctx.signal);
      if (!destruida) pintar();
    } catch (error) {
      if (error.cancelada) return;
      if (error.status === 404) {
        return mensaje(
          'bi-calendar-x',
          'No encontramos este evento',
          'Puede que haya sido eliminado.',
        );
      }
      setHtml(
        el,
        html`<h1 class="visually-hidden">Sala de control</h1>${errorState({ mensaje: error.mensaje })}`,
      );
    }
  }

  // --- Acciones -----------------------------------------------------------------------------

  async function generar(_e, boton) {
    if (ocupado) return;
    if (streamKey) {
      const ok = await confirmDialog({
        titulo: 'Volver a generar la clave',
        mensaje:
          'La clave anterior dejará de funcionar. Tendrás que actualizarla en OBS. ¿Quieres continuar?',
        confirmar: 'Generar nueva clave',
        peligro: true,
      });
      if (!ok) return;
    }
    ocupado = true;
    boton.disabled = true;
    try {
      const credenciales = await generarCredenciales(id, ctx.signal);
      streamKey = credenciales.stream_key;
      rtmpUrl = credenciales.rtmp_url;
      pintarCredenciales();
      q('[data-cred="key"]')?.focus();
    } catch (error) {
      if (error.cancelada) return;
      showToast(error.mensaje, 'danger');
      if (error.status === 409) cargar();
    } finally {
      ocupado = false;
      if (boton.isConnected) boton.disabled = false;
    }
  }

  async function copiar(_e, boton) {
    const texto = boton.dataset.que === 'key' ? streamKey : rtmpUrl;
    try {
      await navigator.clipboard.writeText(texto);
      showToast('Copiado al portapapeles.', 'success');
    } catch {
      showToast('No pudimos copiar. Selecciona el texto y cópialo manualmente.', 'warning');
    }
  }

  function mostrarClave(_e, boton) {
    const campo = q('[data-cred="key"]');
    const visible = campo.type === 'text';
    campo.type = visible ? 'password' : 'text';
    boton.textContent = visible ? 'Mostrar' : 'Ocultar';
    boton.setAttribute('aria-pressed', String(!visible));
  }

  async function alIniciar(e) {
    if (!e.target.matches('[data-form-iniciar]')) return;
    e.preventDefault();
    if (ocupado) return;
    const form = e.target;
    const alerta = q('[data-alerta-iniciar]');
    alerta.hidden = true;
    setFieldError(form, 'stream_key', '');
    const clave = form.elements.stream_key.value.trim();
    if (!clave) {
      setFieldError(form, 'stream_key', 'Escribe la clave de emisión.');
      form.elements.stream_key.focus();
      return;
    }
    ocupado = true;
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      transmision = await iniciar(id, clave, ctx.signal);
      evento = { ...evento, estado: transmision.estado };
      streamKey = null; // ya no hace falta: se descarta de la memoria de la página
      rtmpUrl = null;
      showToast('¡Estás en vivo!', 'success');
      pintar();
    } catch (error) {
      if (error.cancelada) return;
      if (error.codigo === 'CLAVE_EMISION_INVALIDA') {
        setFieldError(form, 'stream_key', error.mensaje);
        form.elements.stream_key.focus();
      } else {
        alerta.textContent = error.mensaje;
        alerta.hidden = false;
        if (error.codigo === 'TRANSICION_INVALIDA') cargar();
      }
    } finally {
      ocupado = false;
      if (boton.isConnected) boton.disabled = false;
    }
  }

  async function alFinalizar(_e, boton) {
    if (ocupado) return;
    const ok = await confirmDialog({
      titulo: 'Finalizar transmisión',
      mensaje:
        'Se cerrará la emisión para todos los espectadores. Esta acción no se puede deshacer. ¿Finalizar ahora?',
      confirmar: 'Finalizar',
      peligro: true,
    });
    if (!ok) return;
    ocupado = true;
    boton.disabled = true;
    try {
      transmision = await finalizar(id, ctx.signal);
      evento = { ...evento, estado: transmision.estado };
      detenerSondeo();
      showToast('Transmisión finalizada.', 'success');
      pintar();
    } catch (error) {
      if (error.cancelada) return;
      showToast(error.mensaje, 'danger');
      if (error.status === 409) cargar();
    } finally {
      ocupado = false;
      if (boton.isConnected) boton.disabled = false;
    }
  }

  async function alSimular(_e, boton) {
    if (ocupado) return;
    const campo = q('#dev-audiencia');
    const n = Number(campo.value);
    if (!Number.isInteger(n) || n < 0) {
      showToast('Escribe un número entero de espectadores.', 'warning');
      return;
    }
    ocupado = true;
    boton.disabled = true;
    try {
      transmision = await simularAudiencia(id, n, ctx.signal);
      pintarMetricas(transmision);
      showToast('Audiencia simulada actualizada.', 'success');
    } catch (error) {
      if (error.cancelada) return;
      showToast(
        error.status === 404
          ? 'Las herramientas de desarrollo no están habilitadas en el servidor.'
          : error.mensaje,
        'warning',
      );
    } finally {
      ocupado = false;
      boton.disabled = false;
    }
  }

  const quitarClic = delegate(el, 'click', {
    generar,
    copiar,
    'mostrar-clave': mostrarClave,
    finalizar: alFinalizar,
    simular: alSimular,
    reintentar: cargar,
  });
  el.addEventListener('submit', alIniciar);

  await cargar();
  return {
    title: 'Sala de control',
    el,
    destroy() {
      destruida = true;
      detenerSondeo(); // el sondeo no sobrevive a la pantalla
      quitarClic();
      el.removeEventListener('submit', alIniciar);
      streamKey = null; // la clave no sobrevive a la pantalla
      rtmpUrl = null;
    },
  };
}
