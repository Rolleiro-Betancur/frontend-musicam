import { html } from '../../../shared/utils/html.js';
import { CATEGORIAS } from '../../../shared/utils/categorias.js';
import { formField } from '../../../shared/ui/form-field.js';
import { ETIQUETA_ESTADO } from '../studio.service.js';

export const TEXTO_SIN_CUOTA =
  'Sin cuota fija ni suscripción. Solo se cobra una comisión por cada boleto vendido.';

/** Aviso sobre lo que no se puede editar. */
function avisos({ estado, editables, suspendido }) {
  const lista = [];
  if (suspendido) {
    lista.push(
      html`<div class="alert alert-warning" role="status">
        Este evento fue suspendido por moderación.
      </div>`,
    );
  }
  if (estado && editables.size === 0) {
    lista.push(
      html`<div class="alert alert-secondary" role="status">
        Este evento está <strong>${ETIQUETA_ESTADO[estado].toLowerCase()}</strong> y ya no se puede
        editar.
      </div>`,
    );
  } else if (estado === 'PROGRAMADO' && !editables.has('precio_cop')) {
    lista.push(
      html`<div class="alert alert-secondary" role="status">
        Este evento ya tiene entradas vendidas: el precio, la fecha, la duración y la reproducción
        posterior no se pueden cambiar. Puedes editar el título, la descripción, la portada y la
        categoría.
      </div>`,
    );
  }
  return lista;
}

function botones({ esNuevo, estado, evento }) {
  if (esNuevo) {
    return html`<button type="submit" class="btn btn-outline-light" data-intencion="guardar">
        Guardar borrador
      </button>
      <button type="button" class="btn btn-primary" data-action="guardar-publicar">
        Guardar y publicar
      </button>`;
  }
  switch (estado) {
    case 'BORRADOR':
      return html`<button type="submit" class="btn btn-outline-light">Guardar</button>
        <button type="button" class="btn btn-primary" data-action="publicar">Publicar</button>
        <button type="button" class="btn btn-outline-danger ms-md-auto" data-action="eliminar">
          Eliminar borrador
        </button>`;
    case 'PROGRAMADO':
      return html`<button type="submit" class="btn btn-primary">Guardar cambios</button>
        <a
          class="btn btn-outline-light"
          href="#/estudio/eventos/${encodeURIComponent(evento.id)}/transmision"
          >Sala de control</a
        >
        <button type="button" class="btn btn-outline-danger ms-md-auto" data-action="cancelar">
          Cancelar evento
        </button>`;
    case 'EN_VIVO':
      return html`<a
        class="btn btn-primary"
        href="#/estudio/eventos/${encodeURIComponent(evento.id)}/transmision"
        >Ir a la transmisión</a
      >`;
    default:
      return html``;
  }
}

/**
 * Formulario de evento (§5.5). Los campos no editables salen deshabilitados.
 * @param {{valores: object, editables: Set<string>, esNuevo: boolean, estado?: string,
 *   evento?: object}} o
 */
export function vistaFormulario({ valores, editables, esNuevo, estado, evento }) {
  const off = (campo) => !editables.has(campo);
  return html`<form novalidate data-form>
    ${avisos({ estado, editables, suspendido: evento?.suspendido_admin })}
    <div class="alert alert-danger" role="alert" data-alerta hidden></div>
    ${formField({
      name: 'titulo',
      label: 'Título',
      value: valores.titulo,
      required: true,
      maxlength: 150,
      disabled: off('titulo'),
    })}
    ${formField({
      name: 'descripcion',
      label: 'Descripción',
      type: 'textarea',
      value: valores.descripcion,
      rows: 5,
      disabled: off('descripcion'),
    })}
    <div class="mb-3" data-field="categoria">
      <label for="campo-categoria" class="form-label">Categoría</label>
      <select
        id="campo-categoria"
        name="categoria"
        class="form-select"
        aria-describedby="campo-categoria-error"
        ${off('categoria') ? html`disabled` : ''}
      >
        ${CATEGORIAS.map(
          ([valor, etiqueta]) =>
            html`<option value="${valor}" ${valor === valores.categoria ? html`selected` : ''}>
              ${etiqueta}
            </option>`,
        )}
      </select>
      <div class="invalid-feedback" id="campo-categoria-error" aria-live="polite"></div>
    </div>
    ${formField({
      name: 'portada_url',
      label: 'Portada (URL de la imagen)',
      type: 'url',
      value: valores.portada_url,
      maxlength: 255,
      placeholder: 'https://…',
      help: 'Opcional. Si no pones imagen, se usa un degradado según la categoría.',
      disabled: off('portada_url'),
    })}
    <div class="row g-3">
      <div class="col-md-6">
        ${formField({
          name: 'precio_cop',
          label: 'Precio de la entrada (COP)',
          type: 'number',
          value: valores.precio_cop,
          required: true,
          min: 1,
          step: 1,
          inputmode: 'numeric',
          help: TEXTO_SIN_CUOTA,
          disabled: off('precio_cop'),
        })}
      </div>
      <div class="col-md-6">
        ${formField({
          name: 'duracion_estimada_min',
          label: 'Duración estimada (minutos)',
          type: 'number',
          value: valores.duracion_estimada_min,
          required: true,
          min: 15,
          max: 240,
          step: 1,
          inputmode: 'numeric',
          disabled: off('duracion_estimada_min'),
        })}
      </div>
    </div>
    ${formField({
      name: 'fecha_inicio',
      label: 'Fecha y hora de inicio (hora de Colombia)',
      type: 'datetime-local',
      value: valores.fecha_inicio,
      required: true,
      help: 'Al publicar, debe ser al menos 30 minutos después de ahora.',
      disabled: off('fecha_inicio'),
    })}
    <div class="mb-4" data-field="replay_habilitado">
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="campo-replay_habilitado"
          name="replay_habilitado"
          ${valores.replay_habilitado ? html`checked` : ''}
          ${off('replay_habilitado') ? html`disabled` : ''}
          aria-describedby="campo-replay_habilitado-ayuda campo-replay_habilitado-error"
        />
        <label class="form-check-label" for="campo-replay_habilitado">
          Permitir reproducción posterior (replay)
        </label>
      </div>
      <div class="form-text" id="campo-replay_habilitado-ayuda">
        Quienes compren la entrada podrán ver el replay después del evento.
      </div>
      <div class="invalid-feedback" id="campo-replay_habilitado-error" aria-live="polite"></div>
    </div>
    <div class="d-flex flex-wrap gap-2">${botones({ esNuevo, estado, evento })}</div>
  </form>`;
}
