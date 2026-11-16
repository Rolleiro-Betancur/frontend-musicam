import { formatCop } from '../../../shared/utils/format-money.js';
import { crearGraficaBarras, vistaGraficaBarras } from '../../../shared/ui/bar-chart.js';
import { etiquetaDia, resumenGrafica } from '../finanzas.service.js';

const compacto = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Contenedor de la gráfica de ventas por día (con tabla equivalente para lectores de pantalla).
 * @param {{fecha: string, entradas: number, ingresos_netos_cop: number}[]} ventas
 */
export function vistaGraficaVentas(ventas) {
  return vistaGraficaBarras({
    descripcion: resumenGrafica(ventas),
    leyenda: 'Ingresos netos por día (hora de Colombia). Solo se muestran los días con ventas.',
    columnas: ['Día', 'Entradas', 'Ingresos netos'],
    filas: ventas.map((v) => [etiquetaDia(v.fecha), v.entradas, formatCop(v.ingresos_netos_cop)]),
  });
}

/**
 * Dibuja la gráfica de ventas por día. Devuelve `{destroy}`: hay que llamarlo en `destroy()`.
 * @param {HTMLCanvasElement} canvas
 * @param {{fecha: string, entradas: number, ingresos_netos_cop: number}[]} ventas
 * @param {{onError?: (error: unknown) => void}} [opciones]
 */
export function crearGraficaVentas(canvas, ventas, opciones) {
  return crearGraficaBarras(
    canvas,
    {
      etiquetas: ventas.map((v) => etiquetaDia(v.fecha)),
      valores: ventas.map((v) => v.ingresos_netos_cop),
      nombreSerie: 'Ingresos netos',
      formatoValor: formatCop,
      formatoEje: (v) => compacto.format(v),
      detalle: (i) => {
        const n = ventas[i].entradas;
        return `${n} ${n === 1 ? 'entrada' : 'entradas'}`;
      },
    },
    opciones,
  );
}
