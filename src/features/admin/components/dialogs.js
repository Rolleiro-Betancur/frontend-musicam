import { html } from '../../../shared/utils/html.js';
import { fromHtml } from '../../../shared/utils/dom.js';
import { clearFieldErrors, formField, setFieldError } from '../../../shared/ui/form-field.js';
import { openModal } from '../../../shared/ui/modal.js';
import {
  MOTIVO_MAX,
  construirNuevoAdmin,
  erroresDeFormulario,
  validarMotivo,
  validarNuevoAdmin,
} from '../admin.service.js';

/**
 * Diálogo que pide un motivo obligatorio (suspender un evento, rechazar un retiro). Resuelve el
 * motivo, o `null` si se cancela. La acción la ejecuta quien lo llama (así sus errores salen en
 * el aviso de la página).
 * @param {{titulo: string, mensaje: string, confirmar: string}} o
 * @returns {Promise<string|null>}
 */
export function pedirMotivo({ titulo, mensaje, confirmar }) {
  return new Promise((resolver) => {
    let motivo = null;
    const cuerpo = fromHtml(
      html`<p>${mensaje}</p>
        <div data-field="motivo">
          <label class="form-label" for="campo-motivo">Motivo (obligatorio)</label>
          <textarea
            id="campo-motivo"
            name="motivo"
            class="form-control"
            rows="3"
            maxlength="${MOTIVO_MAX}"
            aria-describedby="campo-motivo-error"
          ></textarea>
          <div class="invalid-feedback" id="campo-motivo-error" aria-live="polite"></div>
        </div>`,
      'form',
    );
    cuerpo.noValidate = true;
    const pie = fromHtml(
      html`<button type="button" class="btn btn-outline-secondary" data-action="cancelar">
          Cancelar
        </button>
        <button type="button" class="btn btn-danger" data-action="confirmar">${confirmar}</button>`,
      'div',
    );
    pie.className = 'd-flex gap-2';
    const { el, cerrar, cerrado } = openModal({ titulo, cuerpo, pie, tamano: 'sm' });

    const confirmarMotivo = () => {
      const texto = cuerpo.elements.motivo.value;
      const error = validarMotivo(texto);
      setFieldError(cuerpo, 'motivo', error ?? '');
      if (error) return cuerpo.elements.motivo.focus();
      motivo = texto.trim();
      cerrar();
    };
    cuerpo.addEventListener('submit', (e) => {
      e.preventDefault();
      confirmarMotivo();
    });
    el.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-action]')?.dataset.action;
      if (accion === 'confirmar') confirmarMotivo();
      if (accion === 'cancelar') cerrar();
    });
    el.addEventListener('shown.bs.modal', () => cuerpo.elements.motivo.focus());
    cerrado.then(() => resolver(motivo));
  });
}

/**
 * Modal para crear otro administrador (RN-01). Muestra los errores del servidor junto a cada
 * campo y bloquea el envío mientras la petición está en curso.
 * @param {(valores: {nombre: string, email: string, password: string}) => Promise<unknown>} crear
 * @returns {Promise<boolean>} `true` si se creó
 */
export function dialogoCrearAdmin(crear) {
  return new Promise((resolver) => {
    let creado = false;
    let ocupado = false;
    const cuerpo = fromHtml(
      html`<div class="alert alert-danger" role="alert" data-alerta hidden></div>
        ${formField({ name: 'nombre', label: 'Nombre', required: true, maxlength: 100, autocomplete: 'name' })}
        ${formField({
          name: 'email',
          label: 'Correo electrónico',
          type: 'email',
          required: true,
          autocomplete: 'off',
        })}
        ${formField({
          name: 'password',
          label: 'Contraseña',
          type: 'password',
          required: true,
          autocomplete: 'new-password',
          help: 'Mínimo 8 caracteres, con al menos una letra y un número.',
        })}
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-outline-secondary" data-action="cancelar">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary">Crear administrador</button>
        </div>`,
      'form',
    );
    cuerpo.noValidate = true;
    const { el, cerrar, cerrado } = openModal({ titulo: 'Crear administrador', cuerpo });
    const alerta = cuerpo.querySelector('[data-alerta]');
    const boton = cuerpo.querySelector('button[type="submit"]');

    const aplicar = (campos) => {
      let primero = null;
      for (const [campo, mensaje] of Object.entries(campos)) {
        if (!cuerpo.elements[campo]) continue;
        setFieldError(cuerpo, campo, mensaje);
        primero ??= cuerpo.elements[campo];
      }
      primero?.focus();
    };

    cuerpo.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ocupado) return;
      clearFieldErrors(cuerpo);
      alerta.hidden = true;
      const valores = {
        nombre: cuerpo.elements.nombre.value,
        email: cuerpo.elements.email.value,
        password: cuerpo.elements.password.value,
      };
      const errores = validarNuevoAdmin(valores);
      if (Object.keys(errores).length) return aplicar(errores);

      ocupado = true;
      boton.disabled = true;
      boton.textContent = 'Creando…';
      try {
        await crear(construirNuevoAdmin(valores));
        creado = true;
        cerrar();
      } catch (error) {
        if (error.cancelada) return;
        const { campos, general } = erroresDeFormulario(error);
        aplicar(campos);
        if (general) {
          alerta.textContent = general;
          alerta.hidden = false;
        }
      } finally {
        ocupado = false;
        boton.disabled = false;
        boton.textContent = 'Crear administrador';
      }
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="cancelar"]')) cerrar();
    });
    el.addEventListener('shown.bs.modal', () => cuerpo.elements.nombre.focus());
    cerrado.then(() => resolver(creado));
  });
}
