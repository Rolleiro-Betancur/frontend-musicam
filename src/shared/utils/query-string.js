/** @returns {Record<string, string>} */
export function parseQuery(texto = '') {
  const limpio = texto.startsWith('?') ? texto.slice(1) : texto;
  return Object.fromEntries(new URLSearchParams(limpio));
}

/** Omite valores vacíos, nulos e indefinidos. */
export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(clave, String(valor));
  }
  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

/** Separa un hash (`#/eventos/1?q=a`) en ruta y query. */
export function parseHash(hash = '') {
  const sinAlmohadilla = hash.replace(/^#/, '');
  const [ruta, ...resto] = sinAlmohadilla.split('?');
  return { path: ruta || '/', query: new URLSearchParams(resto.join('?')) };
}
