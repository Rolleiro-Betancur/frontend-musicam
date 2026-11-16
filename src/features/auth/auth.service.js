import { iniciarSesion as guardarSesion } from '../../core/session/session.js';
import { esRedirectSeguro } from '../../shared/utils/validators.js';
import * as authApi from './auth.api.js';

/** Inicia sesión y guarda tokens + usuario. */
export async function iniciarSesion(email, password, signal) {
  const respuesta = await authApi.login({ email: email.trim(), password }, signal);
  guardarSesion(respuesta);
  return respuesta.usuario;
}

/**
 * Crea la cuenta y, como el registro no entrega tokens, inicia sesión con las mismas credenciales.
 * Si la cuenta se crea pero el login falla, el error lleva `cuentaCreada = true`.
 */
export async function registrar(datos, signal) {
  const cuerpo = {
    nombre: datos.nombre.trim(),
    email: datos.email.trim(),
    password: datos.password,
    rol: datos.rol,
    acepta_tratamiento_datos: true,
  };
  if (datos.rol === 'ARTISTA') cuerpo.nombre_artistico = datos.nombre_artistico.trim();

  await authApi.registro(cuerpo, signal);
  try {
    return await iniciarSesion(cuerpo.email, cuerpo.password, signal);
  } catch (error) {
    error.cuentaCreada = true;
    throw error;
  }
}

/** Destino tras autenticarse: el `redirect` seguro si existe; si no, según rol (§5.1). */
export function destinoTrasAutenticar(usuario, redirect, { alRegistrar = false } = {}) {
  if (esRedirectSeguro(redirect)) return redirect;
  if (alRegistrar && usuario.rol === 'ARTISTA') return '#/estudio';
  return '#/';
}

/** Primer mensaje de un valor de `detalles` (`['msg']`, `'msg'` u objeto). */
function primerMensaje(valor) {
  if (Array.isArray(valor)) return primerMensaje(valor[0]);
  if (valor && typeof valor === 'object') return primerMensaje(Object.values(valor)[0]);
  return valor ? String(valor) : '';
}

/**
 * Traduce un error de la API a mensajes por campo.
 * @param {import('../../core/http/api-error.js').ApiError} error
 * @returns {{campos: Record<string, string>, general: string}}
 */
export function erroresDeFormulario(error) {
  const campos = {};
  if (error.status === 422 && error.detalles) {
    for (const [campo, valor] of Object.entries(error.detalles)) {
      campos[campo] = primerMensaje(valor);
    }
  }
  if (error.codigo === 'EMAIL_YA_REGISTRADO') campos.email = error.mensaje;
  if (error.codigo === 'NOMBRE_ARTISTICO_EN_USO') campos.nombre_artistico = error.mensaje;
  const general = Object.keys(campos).length ? '' : error.mensaje;
  return { campos, general };
}
