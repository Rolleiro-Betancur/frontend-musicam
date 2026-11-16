import { config } from '../../core/config.js';
import { esUrlExternaSegura } from './validators.js';

/**
 * Convierte la ruta relativa del backend (`/uploads/...`) en URL absoluta con el origen de la API.
 * Las URLs absolutas solo se aceptan si pasan la validación de URLs externas.
 * @returns {string|null}
 */
export function mediaUrl(ruta, origen = new URL(config.apiUrl).origin) {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return esUrlExternaSegura(ruta) ? ruta : null;
  if (!ruta.startsWith('/')) return null;
  return `${origen}${ruta}`;
}
