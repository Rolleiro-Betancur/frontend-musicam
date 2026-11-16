import { html } from '../../../shared/utils/html.js';
import { fromHtml } from '../../../shared/utils/dom.js';
import { validarEmail, validarRequerido } from '../../../shared/utils/validators.js';
import { clearFieldErrors, formField, setFieldError } from '../../../shared/ui/form-field.js';
import { showToast } from '../../../shared/ui/toast.js';
import { destinoTrasAutenticar, erroresDeFormulario, iniciarSesion } from '../auth.service.js';
import { aplicarErrores, marcarOcupado, mostrarAlerta } from '../components/form-feedback.js';

/** @param {{query: URLSearchParams, signal: AbortSignal}} ctx */
export async function loginPage(ctx) {
  const redirect = ctx.query.get('redirect');
  const registroHref = redirect
    ? `#/registro?redirect=${encodeURIComponent(redirect)}`
    : '#/registro';

  const el = fromHtml(
    html`<div class="container py-5" style="max-width:440px">
      <h1 class="mb-1">Iniciar sesión</h1>
      <p class="text-muted-2 mb-4">Entra para comprar entradas y ver tus conciertos.</p>
      <form novalidate class="surface-card p-4">
        <div class="alert alert-danger" role="alert" data-alerta hidden></div>
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
          autocomplete: 'current-password',
          required: true,
        })}
        <button type="submit" class="btn btn-primary w-100">Entrar</button>
      </form>
      <p class="text-center mt-3 mb-0">
        ¿Aún no tienes cuenta? <a href="${registroHref}">Regístrate</a>
      </p>
    </div>`,
    'section',
  );

  const form = el.querySelector('form');
  const alerta = el.querySelector('[data-alerta]');
  const boton = form.querySelector('button[type="submit"]');
  let enviando = false;

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    clearFieldErrors(form);
    mostrarAlerta(alerta, '');

    const email = form.elements.email.value;
    const password = form.elements.password.value;
    const errores = {
      email: validarEmail(email),
      password: validarRequerido(password, 'La contraseña'),
    };
    const invalido = Object.entries(errores).find(([, mensaje]) => mensaje);
    for (const [campo, mensaje] of Object.entries(errores)) setFieldError(form, campo, mensaje);
    if (invalido) {
      form.elements[invalido[0]].focus();
      return;
    }

    enviando = true;
    marcarOcupado(boton, true, 'Entrando…');
    try {
      const usuario = await iniciarSesion(email, password, ctx.signal);
      showToast(`Hola, ${usuario.nombre_artistico || usuario.nombre}.`, 'success');
      location.hash = destinoTrasAutenticar(usuario, redirect);
    } catch (error) {
      if (error.cancelada) return;
      aplicarErrores(form, alerta, erroresDeFormulario(error));
    } finally {
      enviando = false;
      marcarOcupado(boton, false);
    }
  }

  form.addEventListener('submit', enviar);
  return {
    title: 'Iniciar sesión',
    el,
    destroy() {
      form.removeEventListener('submit', enviar);
    },
  };
}
