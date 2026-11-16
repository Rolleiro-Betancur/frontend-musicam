import { config } from '../../../core/config.js';
import { html } from '../../../shared/utils/html.js';
import { fromHtml } from '../../../shared/utils/dom.js';
import {
  validarEmail,
  validarPassword,
  validarRequerido,
} from '../../../shared/utils/validators.js';
import { clearFieldErrors, formField, setFieldError } from '../../../shared/ui/form-field.js';
import { showToast } from '../../../shared/ui/toast.js';
import { destinoTrasAutenticar, erroresDeFormulario, registrar } from '../auth.service.js';
import { aplicarErrores, marcarOcupado, mostrarAlerta } from '../components/form-feedback.js';

function tarjetaRol({ valor, icono, titulo, texto, marcado }) {
  return html`<div class="col-12 col-sm-6">
    <input
      class="role-input visually-hidden"
      type="radio"
      name="rol"
      id="rol-${valor}"
      value="${valor}"
      ${marcado ? html`checked` : ''}
    />
    <label class="role-card d-block" for="rol-${valor}">
      <i class="bi ${icono} fs-3 text-muted-2" aria-hidden="true"></i>
      <span class="d-block fw-semibold mt-1">${titulo}</span>
      <span class="d-block text-muted-2 small">${texto}</span>
    </label>
  </div>`;
}

/** @param {{query: URLSearchParams, signal: AbortSignal}} ctx */
export async function registerPage(ctx) {
  const redirect = ctx.query.get('redirect');
  const loginHref = redirect ? `#/login?redirect=${encodeURIComponent(redirect)}` : '#/login';

  const el = fromHtml(
    html`<div class="container py-5" style="max-width:560px">
      <h1 class="mb-1">Crea tu cuenta</h1>
      <p class="text-muted-2 mb-4">Elige cómo quieres usar la plataforma.</p>
      <form novalidate class="surface-card p-4">
        <div class="alert alert-danger" role="alert" data-alerta hidden></div>
        <fieldset class="mb-4">
          <legend class="form-label fs-6">Soy…</legend>
          <div class="row g-3">
            ${tarjetaRol({
              valor: 'USUARIO',
              icono: 'bi-ticket-perforated',
              titulo: 'Quiero ver conciertos',
              texto: 'Compra entradas y mira los eventos en vivo o en replay.',
              marcado: true,
            })}
            ${tarjetaRol({
              valor: 'ARTISTA',
              icono: 'bi-mic',
              titulo: 'Soy artista',
              texto: 'Publica y transmite tus conciertos. Sin cuota fija.',
              marcado: false,
            })}
          </div>
        </fieldset>
        ${formField({
          name: 'nombre',
          label: 'Nombre',
          autocomplete: 'name',
          required: true,
          maxlength: 100,
        })}
        <div data-artista hidden>
          ${formField({
            name: 'nombre_artistico',
            label: 'Nombre artístico',
            maxlength: 100,
            help: 'Es el nombre con el que el público te encontrará.',
          })}
        </div>
        ${formField({
          name: 'email',
          label: 'Correo electrónico',
          type: 'email',
          autocomplete: 'email',
          required: true,
        })}
        ${formField({
          name: 'password',
          label: 'Contraseña',
          type: 'password',
          autocomplete: 'new-password',
          required: true,
          help: 'Mínimo 8 caracteres, con al menos una letra y un número.',
        })}
        <div class="mb-3" data-field="acepta_tratamiento_datos">
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id="campo-acepta_tratamiento_datos"
              name="acepta_tratamiento_datos"
              aria-describedby="campo-acepta_tratamiento_datos-error"
            />
            <label class="form-check-label" for="campo-acepta_tratamiento_datos">
              Acepto el
              <a href="${config.politicaDatosUrl}" target="_blank" rel="noopener noreferrer"
                >tratamiento de mis datos personales</a
              >.
            </label>
          </div>
          <div class="invalid-feedback d-block" id="campo-acepta_tratamiento_datos-error"></div>
        </div>
        <button type="submit" class="btn btn-primary w-100" disabled>Crear cuenta</button>
      </form>
      <p class="text-center mt-3 mb-0">
        ¿Ya tienes cuenta? <a href="${loginHref}">Inicia sesión</a>
      </p>
    </div>`,
    'section',
  );

  const form = el.querySelector('form');
  const alerta = el.querySelector('[data-alerta]');
  const boton = form.querySelector('button[type="submit"]');
  const bloqueArtista = el.querySelector('[data-artista]');
  const consentimiento = form.elements.acepta_tratamiento_datos;
  let enviando = false;

  const rolActual = () => form.elements.rol.value;
  const actualizarBoton = () => {
    boton.disabled = enviando || !consentimiento.checked;
  };
  const alCambiarRol = () => {
    bloqueArtista.hidden = rolActual() !== 'ARTISTA';
  };

  function validar() {
    const esArtista = rolActual() === 'ARTISTA';
    return {
      nombre: validarRequerido(form.elements.nombre.value, 'El nombre', 100),
      nombre_artistico: esArtista
        ? validarRequerido(form.elements.nombre_artistico.value, 'El nombre artístico', 100)
        : null,
      email: validarEmail(form.elements.email.value),
      password: validarPassword(form.elements.password.value),
      acepta_tratamiento_datos: consentimiento.checked
        ? null
        : 'Debes aceptar el tratamiento de datos.',
    };
  }

  async function enviar(e) {
    e.preventDefault();
    if (enviando || !consentimiento.checked) return;
    clearFieldErrors(form);
    mostrarAlerta(alerta, '');

    const errores = validar();
    let primero = null;
    for (const [campo, mensaje] of Object.entries(errores)) {
      setFieldError(form, campo, mensaje);
      if (mensaje) primero ??= form.elements[campo];
    }
    if (primero) {
      primero.focus();
      return;
    }

    enviando = true;
    actualizarBoton();
    marcarOcupado(boton, true, 'Creando cuenta…');
    try {
      const usuario = await registrar(
        {
          rol: rolActual(),
          nombre: form.elements.nombre.value,
          nombre_artistico: form.elements.nombre_artistico.value,
          email: form.elements.email.value,
          password: form.elements.password.value,
        },
        ctx.signal,
      );
      showToast('¡Cuenta creada! Ya iniciaste sesión.', 'success');
      location.hash = destinoTrasAutenticar(usuario, redirect, { alRegistrar: true });
    } catch (error) {
      if (error.cancelada) return;
      if (error.cuentaCreada) {
        showToast('Tu cuenta se creó. Inicia sesión para continuar.', 'warning');
        location.hash = loginHref;
        return;
      }
      const primerError = aplicarErrores(form, alerta, erroresDeFormulario(error));
      primerError?.focus();
    } finally {
      enviando = false;
      marcarOcupado(boton, false);
      actualizarBoton();
    }
  }

  form.addEventListener('submit', enviar);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'rol') alCambiarRol();
    if (e.target === consentimiento) actualizarBoton();
  });
  return {
    title: 'Crear cuenta',
    el,
    destroy() {
      form.removeEventListener('submit', enviar);
    },
  };
}
