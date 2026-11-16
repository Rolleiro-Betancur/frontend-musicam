import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { validarImagen, validarRequerido } from '../../../shared/utils/validators.js';
import { avatar, activarFallbackAvatares } from '../../../shared/ui/avatar.js';
import { clearFieldErrors, formField, setFieldError } from '../../../shared/ui/form-field.js';
import { errorState } from '../../../shared/ui/empty-state.js';
import { skeletonBlock } from '../../../shared/ui/skeleton.js';
import { showToast } from '../../../shared/ui/toast.js';
import {
  cambiarFoto,
  camposDeError,
  cargarPerfil,
  eliminarFoto,
  guardarPerfil,
} from '../account.service.js';

const ROLES = { USUARIO: 'Espectador', ARTISTA: 'Artista', ADMIN: 'Administrador' };
const MAX_BIO = 1000;

function esperaCerrarSesion(error) {
  // 401/403 con sesión perdida o cuenta suspendida: el cliente ya cerró la sesión y avisó.
  return error.codigo === 'CUENTA_SUSPENDIDA' || error.codigo === 'SIN_SESION';
}

/** @param {{signal: AbortSignal}} ctx */
export async function profilePage(ctx) {
  const el = fromHtml(
    html`<div class="container py-5" style="max-width:720px">
      <h1 class="mb-4">Mi perfil</h1>
      <div data-contenido></div>
    </div>`,
    'section',
  );
  const contenido = el.querySelector('[data-contenido]');
  activarFallbackAvatares(el);

  let usuario = null;
  let archivo = null; // foto seleccionada, aún sin subir
  let previewUrl = null;
  let ocupadoFoto = false;
  let guardando = false;
  let quitarDelegacion = () => {};

  const soltarPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    archivo = null;
  };

  function pintarCargando() {
    setHtml(
      contenido,
      html`<div class="surface-card p-4 d-grid gap-3" role="status" aria-label="Cargando perfil">
        ${skeletonBlock({ ancho: '96px', alto: '96px', radio: '50%' })}
        ${skeletonBlock({ alto: '40px' })} ${skeletonBlock({ alto: '40px' })}
        ${skeletonBlock({ alto: '96px' })}
      </div>`,
    );
  }

  function pintarError(mensaje) {
    setHtml(contenido, errorState({ mensaje }));
  }

  function pintarFoto(errorFoto = '') {
    const zona = contenido.querySelector('[data-foto]');
    const nombre = usuario.nombre_artistico || usuario.nombre;
    const imagen = previewUrl
      ? html`<img
          class="avatar"
          src="${previewUrl}"
          alt="Vista previa de la nueva foto"
          style="width:96px;height:96px"
        />`
      : avatar({ nombre, fotoUrl: usuario.foto_url, tamano: 96 });
    setHtml(
      zona,
      html`<div class="d-flex align-items-center gap-3 flex-wrap">
          ${imagen}
          <div class="d-flex flex-wrap gap-2">
            ${
              archivo
                ? html`<button
                      type="button"
                      class="btn btn-primary"
                      data-action="subir-foto"
                      ${ocupadoFoto ? html`disabled` : ''}
                    >
                      ${ocupadoFoto ? 'Subiendo…' : 'Guardar foto'}
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      data-action="cancelar-foto"
                      ${ocupadoFoto ? html`disabled` : ''}
                    >
                      Cancelar
                    </button>`
                : html`<button
                      type="button"
                      class="btn btn-outline-light"
                      data-action="elegir-foto"
                      ${ocupadoFoto ? html`disabled` : ''}
                    >
                      ${usuario.foto_url ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    ${
                      usuario.foto_url
                        ? html`<button
                            type="button"
                            class="btn btn-outline-danger"
                            data-action="quitar-foto"
                            ${ocupadoFoto ? html`disabled` : ''}
                          >
                            Quitar foto
                          </button>`
                        : ''
                    }`
            }
          </div>
        </div>
        <div class="form-text">JPEG, PNG o WebP, de hasta 2 MB.</div>
        <div class="text-danger small mt-1" role="alert" data-error-foto>${errorFoto}</div>`,
    );
  }

  function pintarPerfil() {
    const esArtista = usuario.rol === 'ARTISTA';
    setHtml(
      contenido,
      html`<div class="surface-card p-4 mb-4">
          <h2 class="fs-5 mb-3">Foto de perfil</h2>
          <div data-foto></div>
          <input type="file" id="foto-input" accept="image/jpeg,image/png,image/webp" hidden />
        </div>
        <form novalidate class="surface-card p-4">
          <h2 class="fs-5 mb-3">Datos de la cuenta</h2>
          <div class="mb-3">
            <label class="form-label" for="perfil-email">Correo electrónico</label>
            <input id="perfil-email" class="form-control" value="${usuario.email}" disabled />
          </div>
          <p class="mb-3">
            <span class="eyebrow">Tipo de cuenta</span><br />
            ${ROLES[usuario.rol] ?? usuario.rol}
          </p>
          ${formField({
            name: 'nombre',
            label: 'Nombre',
            value: usuario.nombre,
            required: true,
            maxlength: 100,
            autocomplete: 'name',
          })}
          ${
            esArtista
              ? formField({
                  name: 'nombre_artistico',
                  label: 'Nombre artístico',
                  value: usuario.nombre_artistico ?? '',
                  required: true,
                  maxlength: 100,
                })
              : ''
          }
          ${formField({
            name: 'biografia',
            label: 'Biografía',
            type: 'textarea',
            value: usuario.biografia ?? '',
            maxlength: MAX_BIO,
            help: `Máximo ${MAX_BIO} caracteres.`,
          })}
          <button type="submit" class="btn btn-primary">Guardar cambios</button>
        </form>`,
    );
    pintarFoto();
  }

  async function cargar() {
    pintarCargando();
    try {
      usuario = await cargarPerfil(ctx.signal);
      pintarPerfil();
    } catch (error) {
      if (error.cancelada || esperaCerrarSesion(error)) return;
      pintarError(error.mensaje);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    const form = e.target;
    clearFieldErrors(form);
    const errores = {
      nombre: validarRequerido(form.elements.nombre.value, 'El nombre', 100),
      nombre_artistico:
        usuario.rol === 'ARTISTA'
          ? validarRequerido(form.elements.nombre_artistico.value, 'El nombre artístico', 100)
          : null,
      biografia:
        form.elements.biografia.value.length > MAX_BIO
          ? `La biografía admite máximo ${MAX_BIO} caracteres.`
          : null,
    };
    const primero = Object.entries(errores).find(([, m]) => m);
    Object.entries(errores).forEach(
      ([campo, m]) => form.elements[campo] && setFieldError(form, campo, m),
    );
    if (primero) return form.elements[primero[0]].focus();

    guardando = true;
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      usuario = await guardarPerfil(
        {
          nombre: form.elements.nombre.value,
          biografia: form.elements.biografia.value,
          nombre_artistico: form.elements.nombre_artistico?.value ?? '',
        },
        usuario,
        ctx.signal,
      );
      showToast('Perfil actualizado.', 'success');
    } catch (error) {
      if (error.cancelada || esperaCerrarSesion(error)) return;
      const campos = camposDeError(error);
      if (Object.keys(campos).length) {
        Object.entries(campos).forEach(([c, m]) => form.elements[c] && setFieldError(form, c, m));
      } else {
        showToast(error.mensaje, 'danger');
      }
    } finally {
      guardando = false;
      boton.disabled = false;
      boton.textContent = 'Guardar cambios';
    }
  }

  function elegirArchivo(input) {
    const elegido = input.files?.[0];
    input.value = '';
    if (!elegido) return;
    const problema = validarImagen(elegido);
    if (problema) {
      soltarPreview();
      return pintarFoto(problema);
    }
    soltarPreview();
    archivo = elegido;
    previewUrl = URL.createObjectURL(elegido);
    pintarFoto();
  }

  async function subir() {
    if (!archivo || ocupadoFoto) return;
    ocupadoFoto = true;
    pintarFoto();
    let mensajeError = '';
    try {
      usuario = await cambiarFoto(archivo, ctx.signal);
      soltarPreview();
      showToast('Foto actualizada.', 'success');
    } catch (error) {
      if (error.cancelada || esperaCerrarSesion(error)) return;
      mensajeError = error.mensaje;
    } finally {
      ocupadoFoto = false;
      pintarFoto(mensajeError);
    }
  }

  async function quitar() {
    if (ocupadoFoto) return;
    ocupadoFoto = true;
    pintarFoto();
    let mensajeError = '';
    try {
      usuario = await eliminarFoto(ctx.signal);
      showToast('Foto eliminada.', 'success');
    } catch (error) {
      if (error.cancelada || esperaCerrarSesion(error)) return;
      mensajeError = error.mensaje;
    } finally {
      ocupadoFoto = false;
      pintarFoto(mensajeError);
    }
  }

  quitarDelegacion = delegate(el, 'click', {
    reintentar: cargar,
    'elegir-foto': () => el.querySelector('#foto-input').click(),
    'subir-foto': subir,
    'cancelar-foto': () => {
      soltarPreview();
      pintarFoto();
    },
    'quitar-foto': quitar,
  });
  el.addEventListener('submit', guardar);
  el.addEventListener('change', (e) => {
    if (e.target.id === 'foto-input') elegirArchivo(e.target);
  });

  await cargar();
  return {
    title: 'Mi perfil',
    el,
    destroy() {
      quitarDelegacion();
      el.removeEventListener('submit', guardar);
      soltarPreview();
    },
  };
}
