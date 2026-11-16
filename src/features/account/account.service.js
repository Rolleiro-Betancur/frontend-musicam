import { actualizarUsuario } from '../../core/session/session.js';
import * as accountApi from './account.api.js';

/** Carga el perfil y sincroniza la sesión (navbar). */
export async function cargarPerfil(signal) {
  const usuario = await accountApi.obtenerPerfil(signal);
  actualizarUsuario(usuario);
  return usuario;
}

/** Guarda los datos editables; la biografía vacía se envía como `null`. */
export async function guardarPerfil({ nombre, biografia, nombre_artistico }, usuario, signal) {
  const cambios = { nombre: nombre.trim(), biografia: biografia.trim() || null };
  if (usuario.rol === 'ARTISTA') cambios.nombre_artistico = nombre_artistico.trim();
  const actualizado = await accountApi.actualizarPerfil(cambios, signal);
  actualizarUsuario(actualizado);
  return actualizado;
}

export async function cambiarFoto(archivo, signal) {
  const actualizado = await accountApi.subirFoto(archivo, signal);
  actualizarUsuario(actualizado);
  return actualizado;
}

export async function eliminarFoto(signal) {
  const actualizado = await accountApi.quitarFoto(signal);
  actualizarUsuario(actualizado);
  return actualizado;
}

/** Errores 422 `{campo: [mensajes]}` → `{campo: mensaje}`. */
export function camposDeError(error) {
  const campos = {};
  if (error.status === 422 && error.detalles) {
    for (const [campo, valor] of Object.entries(error.detalles)) {
      campos[campo] = Array.isArray(valor) ? String(valor[0]) : String(valor);
    }
  }
  if (error.codigo === 'NOMBRE_ARTISTICO_EN_USO') campos.nombre_artistico = error.mensaje;
  return campos;
}
