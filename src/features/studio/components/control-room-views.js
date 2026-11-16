import { html } from '../../../shared/utils/html.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { badgeEstado } from './studio-views.js';
import { estadoDePasos, textoDuracion } from '../studio.service.js';

const ETIQUETA_PASO = { hecho: 'Completado', activo: 'En curso', bloqueado: 'Pendiente' };

function paso({ numero, titulo, estado, cuerpo }) {
  return html`<section
    class="studio-step studio-step--${estado}"
    aria-labelledby="paso-${numero}"
    ${estado === 'activo' ? html`aria-current="step"` : ''}
  >
    <header class="studio-step__head">
      <span class="studio-step__num" aria-hidden="true">${numero}</span>
      <h2 class="fs-5 mb-0" id="paso-${numero}">${titulo}</h2>
      <span class="studio-step__state">${ETIQUETA_PASO[estado]}</span>
    </header>
    ${estado === 'bloqueado' ? '' : html`<div class="studio-step__body">${cuerpo}</div>`}
  </section>`;
}

/** Cuerpo del paso 1: credenciales. La clave se inyecta después, solo en memoria. */
function cuerpoCredenciales({ estado }) {
  if (estado !== 'activo') {
    return html`<p class="mb-0 text-muted-2">Las credenciales ya se usaron para iniciar.</p>`;
  }
  return html`<p class="text-muted-2">
      Genera la dirección de ingesta y la clave de emisión para configurar OBS. Si ya generaste una
      antes, esta nueva la invalida.
    </p>
    <div data-credenciales></div>
    <button type="button" class="btn btn-primary" data-action="generar" data-generar>
      Generar credenciales
    </button>`;
}

function cuerpoIniciar({ estado }) {
  if (estado !== 'activo') return html`<p class="mb-0 text-muted-2">La transmisión ya comenzó.</p>`;
  return html`<form novalidate data-form-iniciar>
    <div class="mb-3" data-field="stream_key">
      <label class="form-label" for="campo-stream_key">Clave de emisión</label>
      <input
        id="campo-stream_key"
        name="stream_key"
        type="password"
        class="form-control"
        autocomplete="off"
        spellcheck="false"
        aria-describedby="campo-stream_key-error"
      />
      <div class="invalid-feedback" id="campo-stream_key-error" aria-live="polite"></div>
    </div>
    <div class="alert alert-danger" role="alert" data-alerta-iniciar hidden></div>
    <button type="submit" class="btn btn-primary">
      <i class="bi bi-broadcast me-1" aria-hidden="true"></i>Iniciar transmisión
    </button>
  </form>`;
}

function metrica(clave, etiqueta, valor) {
  return html`<div class="studio-metric">
    <span class="studio-metric__value" data-metric="${clave}">${valor}</span>
    <span class="studio-metric__label">${etiqueta}</span>
  </div>`;
}

function cuerpoEnVivo({ estado, transmision, evento }) {
  if (estado === 'bloqueado') return html``;
  const t = transmision ?? {};
  return html`<div class="studio-metrics">
      ${metrica('espectadores', 'Espectadores ahora', t.espectadores_actuales ?? 0)}
      ${metrica('pico', 'Pico de espectadores', t.pico_espectadores ?? 0)}
      ${metrica('duracion', 'Duración', textoDuracion(t.duracion_transcurrida_min))}
    </div>
    ${
      estado === 'activo'
        ? html`<p class="small text-muted-2 mt-3 mb-0" role="status" data-estado-sondeo>
          Se actualiza cada 5 segundos.
        </p>
        <div data-dev-tools></div>`
        : html`<p class="small text-muted-2 mt-3 mb-0">
          Transmitido el ${formatDateTime(evento.fecha_inicio)}.
        </p>`
    }`;
}

function cuerpoFinalizar({ estado, evento }) {
  if (estado === 'activo') {
    return html`<p class="text-muted-2">
        Cuando termines el concierto, finaliza la transmisión. Esto cierra la emisión
        ${evento.replay_habilitado ? 'y deja disponible el replay para quienes compraron' : ''}.
      </p>
      <button type="button" class="btn btn-danger" data-action="finalizar">
        Finalizar transmisión
      </button>`;
  }
  return html`<div data-resumen>
    <p class="mb-2"><i class="bi bi-check-circle-fill text-success" aria-hidden="true"></i> La transmisión terminó.</p>
    <a class="btn btn-outline-light me-2" href="#/estudio/eventos/${encodeURIComponent(evento.id)}/estadisticas"
      >Ver estadísticas</a
    >
    <a class="btn btn-outline-light" href="#/estudio/eventos">Volver a mis eventos</a>
  </div>`;
}

/** Sala de control: resumen del evento y los 4 pasos (§5.4). */
export function vistaSala({ evento, transmision }) {
  const pasos = estadoDePasos(evento.estado);
  return html`<div class="container-fluid px-0">
    <nav aria-label="Migas de pan" class="mb-3">
      <a href="#/estudio/eventos">← Mis eventos</a>
    </nav>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">${badgeEstado(evento.estado)}</div>
    <h1 class="mb-1">Sala de control</h1>
    <p class="text-muted-2 mb-4">${evento.titulo} · ${formatDateTime(evento.fecha_inicio)}</p>
    <div class="studio-steps">
      ${paso({
        numero: 1,
        titulo: 'Credenciales',
        estado: pasos.credenciales,
        cuerpo: cuerpoCredenciales({ estado: pasos.credenciales }),
      })}
      ${paso({
        numero: 2,
        titulo: 'Iniciar',
        estado: pasos.iniciar,
        cuerpo: cuerpoIniciar({ estado: pasos.iniciar }),
      })}
      ${paso({
        numero: 3,
        titulo: 'En vivo',
        estado: pasos.enVivo,
        cuerpo: cuerpoEnVivo({ estado: pasos.enVivo, transmision, evento }),
      })}
      ${paso({
        numero: 4,
        titulo: 'Finalizar',
        estado: pasos.finalizar,
        cuerpo: cuerpoFinalizar({ estado: pasos.finalizar, evento }),
      })}
    </div>
  </div>`;
}

/** Panel de credenciales recién generadas. Los valores se asignan por propiedad, en memoria. */
export function vistaCredenciales() {
  return html`<div class="studio-creds mb-3">
    <div class="alert alert-warning" role="alert">
      <strong>Esta clave se muestra una sola vez.</strong> Guárdala en OBS ahora: no podrás volver a
      consultarla, solo generar otra.
    </div>
    <div class="mb-3">
      <label class="form-label" for="cred-rtmp">Dirección del servidor (RTMP)</label>
      <div class="input-group">
        <input id="cred-rtmp" class="form-control" readonly data-cred="rtmp" />
        <button type="button" class="btn btn-outline-light" data-action="copiar" data-que="rtmp">
          Copiar
        </button>
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label" for="cred-key">Clave de emisión</label>
      <div class="input-group">
        <input
          id="cred-key"
          class="form-control"
          type="password"
          readonly
          spellcheck="false"
          data-cred="key"
        />
        <button type="button" class="btn btn-outline-light" data-action="mostrar-clave" aria-pressed="false">
          Mostrar
        </button>
        <button type="button" class="btn btn-outline-light" data-action="copiar" data-que="key">
          Copiar
        </button>
      </div>
    </div>
  </div>`;
}

export function esqueletoSala() {
  return html`<div class="d-grid gap-3" role="status" aria-label="Cargando sala de control">
    <span class="skeleton" style="width:40%;height:32px"></span>
    ${Array.from({ length: 4 }, () => html`<span class="skeleton" style="height:90px;border-radius:14px"></span>`)}
  </div>`;
}
