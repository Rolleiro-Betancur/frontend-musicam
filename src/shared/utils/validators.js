export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** @returns {string|null} mensaje de error o null si es válido */
export function validarEmail(valor) {
  const v = (valor ?? '').trim();
  if (!v) return 'Escribe tu correo.';
  if (v.length > 254 || !EMAIL.test(v)) return 'Escribe un correo válido.';
  return null;
}

/** Espejo de RN-03: 8–128 caracteres, con letra y dígito. */
export function validarPassword(valor) {
  const v = valor ?? '';
  if (!v) return 'Escribe una contraseña.';
  if (v.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (v.length > 128) return 'Debe tener máximo 128 caracteres.';
  if (!/[A-Za-z]/.test(v)) return 'Debe incluir al menos una letra.';
  if (!/\d/.test(v)) return 'Debe incluir al menos un número.';
  return null;
}

export function validarRequerido(valor, etiqueta = 'Este campo', max = Infinity) {
  const v = (valor ?? '').trim();
  if (!v) return `${etiqueta} es obligatorio.`;
  if (v.length > max) return `${etiqueta} admite máximo ${max} caracteres.`;
  return null;
}

/** @param {{type: string, size: number}} archivo */
export function validarImagen(archivo) {
  if (!archivo) return 'Selecciona una imagen.';
  if (!TIPOS_IMAGEN.includes(archivo.type)) return 'Solo se admiten imágenes JPEG, PNG o WebP.';
  if (archivo.size > MAX_FOTO_BYTES) return 'La imagen no puede pesar más de 2 MB.';
  return null;
}

/** Solo se aceptan redirecciones internas del router por hash (evita open redirect). */
export function esRedirectSeguro(valor) {
  return typeof valor === 'string' && valor.startsWith('#/') && !valor.startsWith('#//');
}

/** URLs externas: https, o http://localhost en desarrollo. */
export function esUrlExternaSegura(valor) {
  if (typeof valor !== 'string') return false;
  return valor.startsWith('https://') || /^http:\/\/localhost(:\d+)?(\/|$)/.test(valor);
}
