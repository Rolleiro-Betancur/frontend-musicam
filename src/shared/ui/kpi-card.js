import { html } from '../utils/html.js';

/**
 * Tarjeta KPI: cifra grande y etiqueta, con una ayuda breve opcional.
 * @param {{valor: string|number, etiqueta: string, ayuda?: string, icono?: string}} o
 */
export function kpiCard({ valor, etiqueta, ayuda = '', icono = '' }) {
  return html`<div class="kpi">
    <span class="kpi__label">
      ${icono ? html`<i class="bi ${icono}" aria-hidden="true"></i>` : ''}${etiqueta}
    </span>
    <span class="kpi__value">${valor}</span>
    ${ayuda ? html`<span class="kpi__help">${ayuda}</span>` : ''}
  </div>`;
}

/** Cuadrícula de tarjetas KPI. */
export function kpiGrid(tarjetas, etiqueta = 'Indicadores') {
  return html`<div class="kpi-grid" role="group" aria-label="${etiqueta}">${tarjetas}</div>`;
}
