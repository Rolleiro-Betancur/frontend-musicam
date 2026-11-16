const env = import.meta.env ?? {};

const POLITICA_POR_DEFECTO = '#/politica-datos';

/**
 * Los enlaces que vienen del entorno solo pueden ser rutas internas (`#/…`) o `https://`
 * (o `http://localhost` en desarrollo). Cualquier otra cosa (`javascript:`, `data:`…) se descarta.
 * @param {unknown} valor
 * @param {string} porDefecto
 */
export function enlaceDeConfig(valor, porDefecto) {
  const v = typeof valor === 'string' ? valor.trim() : '';
  const valido =
    (v.startsWith('#/') && !v.startsWith('#//')) ||
    v.startsWith('https://') ||
    /^http:\/\/localhost(:\d+)?(\/|$)/.test(v);
  return valido ? v : porDefecto;
}

const politicaDatosUrl = enlaceDeConfig(env.VITE_POLITICA_DATOS_URL, POLITICA_POR_DEFECTO);

export const config = Object.freeze({
  apiUrl: (env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, ''),
  appName: env.VITE_APP_NAME || 'MusicCam',
  playerMode: env.VITE_PLAYER_MODE || 'simulated',
  enableDevTools: String(env.VITE_ENABLE_DEV_TOOLS) === 'true',
  politicaDatosUrl,
  /** ¿La política está fuera de la app? Entonces se abre con `rel="noopener noreferrer"`. */
  politicaDatosExterna: !politicaDatosUrl.startsWith('#'),
  isDev: Boolean(env.DEV),
});
