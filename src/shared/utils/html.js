/** Fragmento HTML ya seguro (escapado o marcado como confiable con `raw`). */
export class SafeHtml {
  /** @param {string} valor */
  constructor(valor) {
    this.valor = valor;
  }

  toString() {
    return this.valor;
  }
}

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** @param {unknown} valor */
export function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

/** Marca HTML como confiable. Solo para contenido propio, nunca para datos de la API. */
export function raw(valor) {
  return new SafeHtml(String(valor ?? ''));
}

function convertir(valor) {
  if (valor instanceof SafeHtml) return valor.valor;
  if (Array.isArray(valor)) return valor.map(convertir).join('');
  if (valor === null || valor === undefined || valor === false) return '';
  return escapeHtml(valor);
}

/**
 * Plantilla etiquetada: escapa todo valor interpolado salvo `SafeHtml`.
 * @returns {SafeHtml}
 */
export function html(cadenas, ...valores) {
  let resultado = cadenas[0];
  valores.forEach((valor, i) => {
    resultado += convertir(valor) + cadenas[i + 1];
  });
  return new SafeHtml(resultado);
}
