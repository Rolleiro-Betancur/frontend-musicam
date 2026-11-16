import { html } from '../../../shared/utils/html.js';
import { armarMes, etiquetaDiaLarga, etiquetaMes } from '../tickets.service.js';

const DIAS_SEMANA = [
  ['L', 'lunes'],
  ['M', 'martes'],
  ['X', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
  ['D', 'domingo'],
];

function celda(c, { dias, seleccionado, hoy }) {
  if (!c.delMes) return html`<td class="cal__out" aria-hidden="true"></td>`;
  const n = dias.get(c.fecha)?.length ?? 0;
  const etiqueta = `${etiquetaDiaLarga(c.fecha)}${
    n ? `: ${n} ${n === 1 ? 'evento' : 'eventos'}` : ', sin eventos'
  }${c.fecha === hoy ? ', hoy' : ''}`;
  const clases = ['cal__day', n ? 'cal__day--evento' : '', c.fecha === hoy ? 'cal__day--hoy' : '']
    .filter(Boolean)
    .join(' ');
  return html`<td>
    <button
      type="button"
      class="${clases}"
      data-action="dia"
      data-fecha="${c.fecha}"
      aria-pressed="${String(c.fecha === seleccionado)}"
      aria-label="${etiqueta}"
    >
      <span aria-hidden="true">${c.dia}</span>
      ${n ? html`<span class="cal__dot" aria-hidden="true"></span>` : ''}
    </button>
  </td>`;
}

/**
 * Calendario mensual. Los días con evento comprado se marcan; `seleccionado` es el día elegido.
 * @param {{mes: {anio: number, mes: number}, dias: Map<string, object[]>, seleccionado: string|null,
 *   hoy: string}} o
 */
export function vistaCalendario({ mes, dias, seleccionado, hoy }) {
  const semanas = armarMes(mes.anio, mes.mes);
  return html`<div class="cal">
    <div class="cal__head">
      <button type="button" class="btn btn-outline-light" data-action="mes-anterior" aria-label="Mes anterior">
        <i class="bi bi-chevron-left" aria-hidden="true"></i>
      </button>
      <h2 class="cal__title fs-5 mb-0" aria-live="polite" data-mes>${etiquetaMes(mes)}</h2>
      <button type="button" class="btn btn-outline-light" data-action="mes-siguiente" aria-label="Mes siguiente">
        <i class="bi bi-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
    <table class="cal__grid">
      <thead>
        <tr>
          ${DIAS_SEMANA.map(([corto, largo]) => html`<th scope="col" abbr="${largo}">${corto}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${semanas.map(
          (fila) => html`<tr>${fila.map((c) => celda(c, { dias, seleccionado, hoy }))}</tr>`,
        )}
      </tbody>
    </table>
    <p class="small text-muted-2 mt-2 mb-0">
      <span class="cal__dot cal__dot--leyenda" aria-hidden="true"></span> Días con un evento
      comprado. Horas en hora de Colombia.
    </p>
  </div>`;
}
