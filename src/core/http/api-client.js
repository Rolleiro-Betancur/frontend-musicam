import { ApiError, MENSAJES_POR_ESTADO } from './api-error.js';
import { config } from '../config.js';
import * as tokensPorDefecto from '../session/session-store.js';

export const TIMEOUT_MS = 15000;

/** Combina la señal de la ruta con un temporizador de tiempo máximo. */
function combinarSenales(externa, timeoutMs) {
  const controlador = new AbortController();
  let agotado = false;
  const temporizador = setTimeout(() => {
    agotado = true;
    controlador.abort();
  }, timeoutMs);
  const alAbortar = () => controlador.abort();
  if (externa) {
    if (externa.aborted) controlador.abort();
    else externa.addEventListener('abort', alAbortar, { once: true });
  }
  return {
    signal: controlador.signal,
    agotado: () => agotado,
    limpiar() {
      clearTimeout(temporizador);
      externa?.removeEventListener('abort', alAbortar);
    },
  };
}

/**
 * Todo fallo de JWT del backend llega como 401 `NO_AUTENTICADO` (o sin cuerpo). Otros 401, como
 * `CLAVE_EMISION_INVALIDA`, son reglas de negocio: no justifican renovar ni cerrar la sesión.
 */
function esProblemaDeSesion(error) {
  return error.codigo === 'NO_AUTENTICADO' || error.codigo.startsWith('HTTP_');
}

function construirQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

async function leerCuerpo(respuesta) {
  if (respuesta.status === 204) return null;
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function errorDesdeRespuesta(respuesta, cuerpo) {
  const status = respuesta.status;
  return new ApiError({
    status,
    codigo: cuerpo?.codigo || `HTTP_${status}`,
    mensaje: cuerpo?.mensaje || MENSAJES_POR_ESTADO[status] || MENSAJES_POR_ESTADO[500],
    detalles: cuerpo?.detalles ?? null,
  });
}

/**
 * @param {{
 *   baseUrl?: string,
 *   fetchFn?: typeof fetch,
 *   tokens?: {getAccessToken: () => string|null, setAccessToken: (t: string|null) => void, getRefreshToken: () => string|null},
 *   timeoutMs?: number,
 *   onAuthLost?: (info: {motivo: 'expirada'|'suspendida', mensaje: string}) => void,
 * }} [opciones]
 */
export function createApiClient(opciones = {}) {
  const baseUrl = opciones.baseUrl ?? config.apiUrl;
  const fetchFn = opciones.fetchFn ?? ((...args) => globalThis.fetch(...args));
  const tokens = opciones.tokens ?? tokensPorDefecto;
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS;
  let onAuthLost = opciones.onAuthLost ?? (() => {});
  let refrescoEnCurso = null;

  async function enviar(metodo, ruta, { body, query, signal, token, keepalive, headers } = {}) {
    const cabeceras = { Accept: 'application/json', ...headers };
    let cuerpo;
    if (body instanceof FormData) {
      cuerpo = body; // sin Content-Type: el navegador pone el boundary
    } else if (body !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      cuerpo = JSON.stringify(body);
    }
    if (token) cabeceras.Authorization = `Bearer ${token}`;

    const combinada = combinarSenales(signal, timeoutMs);
    try {
      const respuesta = await fetchFn(`${baseUrl}${ruta}${construirQuery(query)}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo,
        signal: combinada.signal,
        keepalive,
      });
      const datos = await leerCuerpo(respuesta);
      if (!respuesta.ok) throw errorDesdeRespuesta(respuesta, datos);
      return datos;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (combinada.agotado()) {
        throw new ApiError({
          codigo: 'TIEMPO_AGOTADO',
          mensaje: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
        });
      }
      if (signal?.aborted || error?.name === 'AbortError') {
        throw new ApiError({ codigo: 'PETICION_CANCELADA', mensaje: 'Petición cancelada.' });
      }
      throw new ApiError({
        codigo: 'ERROR_RED',
        mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      });
    } finally {
      combinada.limpiar();
    }
  }

  /** Renueva el access token. Una sola petición aunque fallen varias a la vez. */
  function refrescar() {
    if (!refrescoEnCurso) {
      refrescoEnCurso = (async () => {
        const refresh = tokens.getRefreshToken();
        if (!refresh) {
          throw new ApiError({
            status: 401,
            codigo: 'SIN_SESION',
            mensaje: MENSAJES_POR_ESTADO[401],
          });
        }
        // Contrato: el refresh token se envía como Bearer, sin cuerpo.
        const datos = await enviar('POST', '/auth/refresh', { token: refresh });
        tokens.setAccessToken(datos.access_token);
        return datos.access_token;
      })().finally(() => {
        refrescoEnCurso = null;
      });
    }
    return refrescoEnCurso;
  }

  function sesionPerdida(error) {
    const rechazo = [401, 403].includes(error.status);
    if (!rechazo) return;
    if (error.codigo === 'CUENTA_SUSPENDIDA') {
      onAuthLost({ motivo: 'suspendida', mensaje: error.mensaje });
    } else {
      onAuthLost({ motivo: 'expirada', mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }
  }

  async function request(metodo, ruta, opts = {}) {
    const esAuth = ruta.startsWith('/auth/');
    const tokenUsado = tokens.getAccessToken();
    try {
      return await enviar(metodo, ruta, { ...opts, token: tokenUsado });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 403 && error.codigo === 'CUENTA_SUSPENDIDA' && !esAuth) {
        onAuthLost({ motivo: 'suspendida', mensaje: error.mensaje });
        throw error;
      }
      if (error.status !== 401 || esAuth || opts.reintentado || !esProblemaDeSesion(error)) {
        throw error;
      }

      try {
        // Si otra petición ya renovó el token mientras esta fallaba, solo se reintenta.
        const actual = tokens.getAccessToken();
        if (!actual || actual === tokenUsado) await refrescar();
      } catch (falloRefresh) {
        if (falloRefresh instanceof ApiError) sesionPerdida(falloRefresh);
        throw falloRefresh;
      }
      return request(metodo, ruta, { ...opts, reintentado: true });
    }
  }

  return {
    request,
    get: (ruta, opts) => request('GET', ruta, opts),
    post: (ruta, body, opts) => request('POST', ruta, { ...opts, body }),
    put: (ruta, body, opts) => request('PUT', ruta, { ...opts, body }),
    patch: (ruta, body, opts) => request('PATCH', ruta, { ...opts, body }),
    delete: (ruta, opts) => request('DELETE', ruta, opts),
    refrescar,
    setAuthLostHandler(fn) {
      onAuthLost = fn;
    },
  };
}

export const api = createApiClient();
