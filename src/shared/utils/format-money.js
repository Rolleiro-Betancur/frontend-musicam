const formateador = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Formatea un entero en COP (los montos siempre vienen del servidor). */
export function formatCop(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return formateador.format(numero);
}
