/** Error normalizado de la API: `{codigo, mensaje, detalles}` más el estado HTTP. */
export class ApiError extends Error {
  /**
   * @param {{status?: number, codigo?: string, mensaje?: string, detalles?: Record<string, unknown>|null}} datos
   */
  constructor({
    status = 0,
    codigo = 'ERROR',
    mensaje = 'Ocurrió un error inesperado.',
    detalles = null,
  }) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
  }

  get cancelada() {
    return this.codigo === 'PETICION_CANCELADA';
  }
}

export const MENSAJES_POR_ESTADO = {
  400: 'La solicitud no es válida.',
  401: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  409: 'Esta acción entra en conflicto con el estado actual.',
  422: 'Revisa los datos enviados.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  500: 'Algo falló de nuestro lado. Inténtalo de nuevo más tarde.',
};
