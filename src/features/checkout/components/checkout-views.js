import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatTime } from '../../../shared/utils/format-date.js';
import { METODOS, accionTrasCompra, etiquetaMetodo } from '../checkout.service.js';

/** Encabezado de cada vista: recibe el foco al cambiar de paso (`data-foco`). */
const titulo = (texto) => html`<h3 class="fs-5 mb-3" tabindex="-1" data-foco>${texto}</h3>`;

const cerrar = html`<button type="button" class="btn btn-outline-secondary" data-action="cerrar">
  Cerrar
</button>`;

/** Paso 1: elegir el método de pago. El precio mostrado es el del evento (informativo). */
export function vistaMetodo({ evento, metodo, aviso = '' }) {
  return html`${titulo('Elige cómo pagar')}
    <p class="mb-1 fw-semibold">${evento.titulo}</p>
    <p class="text-muted-2">${evento.artista?.nombre_artistico ?? ''}</p>
    ${aviso ? html`<div class="alert alert-warning" role="status">${aviso}</div>` : ''}
    <fieldset class="mb-3">
      <legend class="visually-hidden">Método de pago</legend>
      <div class="d-grid gap-2">
        ${METODOS.map(
          ([valor, etiqueta, icono]) => html`
            <div>
              <input
                class="role-input visually-hidden"
                type="radio"
                name="metodo"
                id="metodo-${valor}"
                value="${valor}"
                ${valor === metodo ? html`checked` : ''}
              />
              <label class="role-card d-flex align-items-center gap-3" for="metodo-${valor}">
                <i class="bi ${icono} fs-4" aria-hidden="true"></i>
                <span class="fw-semibold">${etiqueta}</span>
              </label>
            </div>
          `,
        )}
      </div>
    </fieldset>
    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
      <span class="text-muted-2">Precio de la entrada: ${formatCop(evento.precio_cop)}</span>
      <button type="button" class="btn btn-primary" data-action="continuar">Continuar</button>
    </div>`;
}

/** Espera de una petición en curso (los botones desaparecen: no hay doble envío). */
export function vistaProcesando(texto) {
  return html`<div class="text-center py-4" role="status">
    <span class="spinner-border mb-3" aria-hidden="true"></span>
    <h3 class="fs-5 mb-0" tabindex="-1" data-foco>${texto}</h3>
  </div>`;
}

/** Paso 2: panel con aspecto de pasarela. Monto y referencia vienen de la compra del servidor. */
export function vistaPasarela({ evento, compra }) {
  return html`<div class="gateway">
    <div class="gateway__strip" role="note">
      <i class="bi bi-shield-exclamation" aria-hidden="true"></i>
      Entorno de pruebas · no se cobra dinero real
    </div>
    <div class="gateway__body">
      ${titulo('Confirma tu pago')}
      <dl class="gateway__summary">
        <div><dt>Evento</dt><dd>${evento.titulo}</dd></div>
        <div><dt>Monto</dt><dd class="gateway__amount">${formatCop(compra.monto_cop)}</dd></div>
        <div><dt>Método</dt><dd>${etiquetaMetodo(compra.metodo_pago)}</dd></div>
        <div><dt>Referencia</dt><dd class="gateway__ref">${compra.referencia}</dd></div>
        <div><dt>Vence</dt><dd>${formatTime(compra.expira_en)}</dd></div>
      </dl>
      <div class="d-grid gap-2">
        <button type="button" class="btn btn-primary" data-action="aprobar">Aprobar pago</button>
        <button type="button" class="btn btn-outline-danger" data-action="rechazar">
          Rechazar pago
        </button>
        <button type="button" class="btn btn-outline-secondary" data-action="cancelar">
          Cancelar
        </button>
      </div>
    </div>
  </div>`;
}

/** El sondeo llegó a su límite sin respuesta definitiva. */
export function vistaTardando() {
  return html`${titulo('Seguimos esperando la confirmación')}
    <p class="text-muted-2">
      Tu pago aún no se confirma. Puedes revisar de nuevo o consultar el estado más tarde en
      <a href="#/mis-eventos" data-action="ir">Mis eventos</a>.
    </p>
    <div class="d-flex gap-2 flex-wrap">
      <button type="button" class="btn btn-primary" data-action="seguir-esperando">
        Revisar de nuevo
      </button>
      ${cerrar}
    </div>`;
}

/**
 * Resultado según el estado final de la compra.
 * @param {{evento: object, compra: {estado: string}}} o
 */
export function vistaResultado({ evento, compra }) {
  switch (compra.estado) {
    case 'APROBADA': {
      const accion = accionTrasCompra(evento);
      return html`<div class="text-center">
        <i class="bi bi-check-circle-fill display-4 text-success" aria-hidden="true"></i>
        ${titulo('¡Pago aprobado!')}
        <p class="text-muted-2">Tu entrada para <strong>${evento.titulo}</strong> ya está activa.</p>
        <div class="d-grid gap-2">
          <a class="btn btn-primary btn-lg" href="${accion.href}" data-action="ir">${accion.texto}</a>
          <a class="btn btn-outline-light" href="#/mis-eventos" data-action="ir">Ir a Mis eventos</a>
        </div>
      </div>`;
    }
    case 'RECHAZADA':
      return html`<div class="text-center">
        <i class="bi bi-x-circle-fill display-4 text-danger" aria-hidden="true"></i>
        ${titulo('El pago fue rechazado')}
        <p class="text-muted-2">No se realizó ningún cobro. Puedes intentarlo de nuevo.</p>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <button type="button" class="btn btn-primary" data-action="reintentar">Reintentar</button>
          ${cerrar}
        </div>
      </div>`;
    case 'ANULADA':
      return html`<div class="text-center">
        <i class="bi bi-slash-circle display-4 text-warning" aria-hidden="true"></i>
        ${titulo('El pago fue cancelado')}
        <p class="text-muted-2">No se realizó ningún cobro. Si quieres, vuelve a comprar.</p>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <button type="button" class="btn btn-primary" data-action="reintentar">
            Volver a comprar
          </button>
          ${cerrar}
        </div>
      </div>`;
    default:
      return html`<div class="text-center">
        ${titulo('Esta compra ya no está activa')}
        <p class="text-muted-2">Su estado actual es ${compra.estado}.</p>
        ${cerrar}
      </div>`;
  }
}

/**
 * Error con el mensaje del backend. `accion`: 'comprobar' (consultar el estado real de la
 * compra), 'reintentar' (volver al paso de método) o ninguna (solo cerrar).
 */
export function vistaError({ mensaje, accion }) {
  const boton =
    accion === 'comprobar'
      ? html`<button type="button" class="btn btn-primary" data-action="comprobar">
          Comprobar estado de la compra
        </button>`
      : accion === 'reintentar'
        ? html`<button type="button" class="btn btn-primary" data-action="reintentar">
            Intentar de nuevo
          </button>`
        : '';
  return html`<div role="alert">
    ${titulo('No pudimos completar la operación')}
    <p class="text-muted-2">${mensaje}</p>
    <div class="d-flex gap-2 flex-wrap">${boton} ${cerrar}</div>
  </div>`;
}
