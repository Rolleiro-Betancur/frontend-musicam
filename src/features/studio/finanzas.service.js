import * as studioApi from './studio.api.js';

/**
 * Estadísticas y finanzas del estudio: lógica pura (formato, validación del retiro) y las
 * operaciones que usan las páginas. No calcula dinero: todo monto viene del servidor.
 */

export const PAGE_SIZE_RETIROS = 10;

export const TIPOS_CUENTA = [
  ['AHORROS', 'Ahorros'],
  ['CORRIENTE', 'Corriente'],
  ['NEQUI', 'Nequi'],
];
export const ETIQUETA_TIPO_CUENTA = Object.fromEntries(TIPOS_CUENTA);
export const ETIQUETA_RETIRO = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', RECHAZADO: 'Rechazado' };

export const cargarEstadisticas = (signal) => studioApi.obtenerEstadisticas(signal);
export const cargarEstadisticasEvento = (id, signal) =>
  studioApi.obtenerEstadisticasDeEvento(id, signal);
export const cargarSaldo = (signal) => studioApi.obtenerSaldo(signal);
export const listarRetiros = (page, signal) =>
  studioApi.listarRetiros({ page, page_size: PAGE_SIZE_RETIROS }, signal);
export const solicitarRetiro = (valores, signal) =>
  studioApi.crearRetiro(construirRetiro(valores), signal);

/** Pico promedio de espectadores con un decimal ("41,5"). */
export function textoPico(n) {
  return Number(n ?? 0).toLocaleString('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-01" → "1 nov". La fecha ya viene en America/Bogota: no se convierte de zona. */
export function etiquetaDia(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : String(fecha ?? '');
}

/** Descripción para lectores de pantalla de la gráfica de ventas (sin sumar dinero aquí). */
export function resumenGrafica(ventas) {
  if (!ventas.length) return 'Sin ventas registradas.';
  const dias = ventas.length;
  const primero = etiquetaDia(ventas[0].fecha);
  const ultimo = etiquetaDia(ventas[dias - 1].fecha);
  const nombre = dias === 1 ? 'día' : 'días';
  return `Gráfica de barras de ingresos netos por día: ${dias} ${nombre} con ventas, del ${primero} al ${ultimo}.`;
}

/** "••••0042". */
export const enmascararCuenta = (ultimos4) => `••••${ultimos4}`;

/**
 * Validación del retiro (§5.6). Solo se acepta un texto de exactamente 4 dígitos: un número más
 * largo se rechaza y nunca se envía. El mínimo y el saldo los valida el servidor.
 */
export function validarRetiro(valores) {
  const errores = {};
  const monto = Number(valores.monto_cop);
  if (valores.monto_cop === '' || !Number.isInteger(monto) || monto <= 0) {
    errores.monto_cop = 'Escribe un monto en pesos, sin decimales.';
  }
  const banco = valores.banco.trim();
  if (!banco) errores.banco = 'El banco es obligatorio.';
  else if (banco.length > 60) errores.banco = 'El banco admite máximo 60 caracteres.';
  if (!ETIQUETA_TIPO_CUENTA[valores.tipo_cuenta]) errores.tipo_cuenta = 'Elige el tipo de cuenta.';
  const cuenta = valores.cuenta_ultimos4.trim();
  if (!/^\d{4}$/.test(cuenta)) {
    errores.cuenta_ultimos4 = /^\d{5,}$/.test(cuenta)
      ? 'Escribe solo los últimos 4 dígitos, no el número completo.'
      : 'Escribe exactamente los últimos 4 dígitos de la cuenta.';
  }
  return errores;
}

/** Cuerpo de `POST /artistas/me/retiros`: nada más que lo que el contrato permite. */
export function construirRetiro(valores) {
  return {
    monto_cop: Number(valores.monto_cop),
    banco: valores.banco.trim(),
    tipo_cuenta: valores.tipo_cuenta,
    cuenta_ultimos4: valores.cuenta_ultimos4.trim(),
  };
}

function primerMensaje(valor) {
  if (Array.isArray(valor)) return primerMensaje(valor[0]);
  if (valor && typeof valor === 'object') return primerMensaje(Object.values(valor)[0]);
  return valor ? String(valor) : '';
}

const CAMPO_POR_CODIGO = { SALDO_INSUFICIENTE: 'monto_cop', MONTO_FUERA_DE_RANGO: 'monto_cop' };

/** Errores del servidor del retiro: junto al campo del monto o de la cuenta, o en una alerta. */
export function erroresDeRetiro(error) {
  const campos = {};
  if (error.status === 422 && error.detalles) {
    for (const [campo, valor] of Object.entries(error.detalles))
      campos[campo] = primerMensaje(valor);
  }
  const porCodigo = CAMPO_POR_CODIGO[error.codigo];
  if (porCodigo) campos[porCodigo] = error.mensaje;
  return { campos, general: Object.keys(campos).length ? '' : error.mensaje };
}
