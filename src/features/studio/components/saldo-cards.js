import { html } from '../../../shared/utils/html.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { kpiCard, kpiGrid } from '../../../shared/ui/kpi-card.js';

const AYUDA = {
  disponible:
    'Lo que ya puedes retirar: ventas de eventos finalizados, menos retiros en proceso o pagados.',
  retenido: 'Ventas de eventos que aún no terminan. Se liberan cuando el evento finaliza.',
  enProceso: 'Retiros que solicitaste y aún están pendientes de aprobación.',
  retirado: 'Retiros que ya se pagaron.',
};

/**
 * Cuatro tarjetas de saldo. Las cifras vienen del servidor; aquí no se calcula nada.
 * @param {{disponible_cop: number, retenido_cop: number, en_proceso_cop: number,
 *   retirado_cop: number}} saldo
 * @param {{conAyuda?: boolean}} [o]
 */
export function tarjetasSaldo(saldo, { conAyuda = true } = {}) {
  const ayuda = (clave) => (conAyuda ? AYUDA[clave] : '');
  return kpiGrid(
    html`${kpiCard({
      valor: formatCop(saldo.disponible_cop),
      etiqueta: 'Disponible',
      ayuda: ayuda('disponible'),
      icono: 'bi-wallet2',
    })}
    ${kpiCard({
      valor: formatCop(saldo.retenido_cop),
      etiqueta: 'Retenido',
      ayuda: ayuda('retenido'),
      icono: 'bi-hourglass-split',
    })}
    ${kpiCard({
      valor: formatCop(saldo.en_proceso_cop),
      etiqueta: 'En proceso',
      ayuda: ayuda('enProceso'),
      icono: 'bi-arrow-repeat',
    })}
    ${kpiCard({
      valor: formatCop(saldo.retirado_cop),
      etiqueta: 'Retirado',
      ayuda: ayuda('retirado'),
      icono: 'bi-check2-circle',
    })}`,
    'Saldo',
  );
}
