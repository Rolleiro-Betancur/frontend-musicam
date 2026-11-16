/** Origen de una URL, o cadena vacía si es inválida o falta (entonces solo vale el propio origen). */
function origenDe(url) {
  try {
    return new URL(url ?? '').origin;
  } catch {
    return '';
  }
}

/**
 * Política de seguridad de contenido (CSP) recomendada en §7 del AGENTS.md. Se inyecta como
 * `<meta>` en el HTML del build (no en el servidor de desarrollo, que necesita su canal HMR).
 *
 * Se parte del origen de `VITE_API_URL`, así que la política no puede desalinearse de la API que
 * usa el cliente. `style-src` admite `'unsafe-inline'` porque Bootstrap y los componentes usan
 * `style=""` para valores dinámicos; los scripts solo pueden venir del propio origen.
 *
 * Nota: con `VITE_PLAYER_MODE=hls` el origen del servidor de medios debe añadirse a
 * `connect-src` y `media-src` (hls.js descarga las listas y los segmentos con XHR).
 *
 * @param {string} [apiUrl]
 * @returns {string}
 */
export function construirCsp(apiUrl) {
  const origenApi = origenDe(apiUrl);
  const conApi = origenApi ? ` ${origenApi}` : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' https: data: blob:${conApi}`,
    `media-src 'self' https: blob:${conApi}`,
    "font-src 'self' data:",
    `connect-src 'self'${conApi}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
