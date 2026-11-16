// Access token solo en memoria; refresh token en sessionStorage (decisión de MVP, ver README).
const CLAVE_REFRESH = 'refresh_token';
let accessToken = null;

function almacen() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getRefreshToken() {
  try {
    return almacen()?.getItem(CLAVE_REFRESH) ?? null;
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  try {
    if (token) almacen()?.setItem(CLAVE_REFRESH, token);
    else almacen()?.removeItem(CLAVE_REFRESH);
  } catch {
    // Almacenamiento bloqueado: la sesión vivirá solo mientras no se recargue la página.
  }
}

export function clearTokens() {
  accessToken = null;
  setRefreshToken(null);
}
