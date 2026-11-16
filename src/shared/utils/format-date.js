export const ZONA = 'America/Bogota';

function crear(opciones) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, ...opciones });
}

const fechaLarga = crear({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = crear({ day: '2-digit', month: 'short', year: 'numeric' });
const hora = crear({ hour: '2-digit', minute: '2-digit', hour12: true });
const fechaHora = crear({
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function aFecha(iso) {
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function envolver(formateador, iso) {
  const fecha = aFecha(iso);
  return fecha ? formateador.format(fecha) : '—';
}

export const formatDateLong = (iso) => envolver(fechaLarga, iso);
export const formatDate = (iso) => envolver(fechaCorta, iso);
export const formatTime = (iso) => envolver(hora, iso);
export const formatDateTime = (iso) => envolver(fechaHora, iso);

/**
 * Convierte "YYYY-MM-DDTHH:mm" (hora de Bogotá, UTC-5 sin horario de verano) a ISO UTC.
 * @param {string} local
 */
export function bogotaLocalToIso(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + 5, mi)).toISOString();
}

/**
 * Convierte un ISO UTC al valor de un `<input type="datetime-local">` en hora de Bogotá
 * (UTC-5 fijo), sin depender de la zona horaria del navegador.
 * @param {string} iso
 */
export function isoToBogotaLocal(iso) {
  const fecha = aFecha(iso);
  return fecha ? new Date(fecha.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 16) : '';
}
