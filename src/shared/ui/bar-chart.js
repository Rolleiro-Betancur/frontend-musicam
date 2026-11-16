import { html } from '../utils/html.js';

/**
 * Datos de una gráfica de barras de una sola serie.
 * @typedef {object} DatosBarras
 * @property {string[]} etiquetas
 * @property {number[]} valores
 * @property {string} [nombreSerie]
 * @property {(valor: number) => string} [formatoValor] texto del tooltip
 * @property {(valor: number) => string} [formatoEje] texto de las marcas del eje Y
 * @property {(indice: number) => string|null} [detalle] segunda línea del tooltip
 * @property {boolean} [entero] el eje Y solo marca enteros (conteos)
 * @property {string[]} [colores] un color CSS por barra (variables como `--accent`)
 */

/**
 * Contenedor de una gráfica de barras con su descripción accesible y una tabla equivalente solo
 * para lectores de pantalla (un `<canvas>` no es accesible por sí solo). La tabla va dentro de un
 * `div.visually-hidden`: aplicado a la propia `<table>`, `width: 1px` se ignora y la tabla se
 * extiende fuera de la pantalla provocando scroll horizontal.
 * @param {{descripcion: string, leyenda?: string, columnas: string[], filas: (string|number)[][]}} o
 */
export function vistaGraficaBarras({ descripcion, leyenda = '', columnas, filas }) {
  return html`<figure class="studio-chart mb-0">
    <div class="studio-chart__canvas">
      <canvas role="img" aria-label="${descripcion}" data-grafica></canvas>
    </div>
    ${leyenda ? html`<figcaption class="small text-muted-2 mt-2">${leyenda}</figcaption>` : ''}
    <div class="visually-hidden">
    <table>
      <caption>
        ${descripcion}
      </caption>
      <thead>
        <tr>
          ${columnas.map((c) => html`<th scope="col">${c}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${filas.map((fila) => html`<tr>${fila.map((celda) => html`<td>${celda}</td>`)}</tr>`)}
      </tbody>
    </table>
    </div>
  </figure>`;
}

/**
 * Dibuja la gráfica. `chart.js` se carga con `import()` solo aquí, cuando hay datos que mostrar.
 * Devuelve `{destroy}`: hay que llamarlo al salir de la pantalla para liberar el canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {DatosBarras} datos
 * @param {{onError?: (error: unknown) => void}} [opciones]
 */
export function crearGraficaBarras(canvas, datos, { onError } = {}) {
  let destruida = false;
  let grafica = null;

  (async () => {
    try {
      const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } =
        await import('chart.js');
      if (destruida) return; // se salió de la pantalla mientras cargaba la librería
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

      const css = getComputedStyle(document.documentElement);
      const color = (nombre) => css.getPropertyValue(nombre).trim();
      const sinAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fondos = datos.colores?.map((c) => (c.startsWith('--') ? color(c) : c));

      grafica = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: datos.etiquetas,
          datasets: [
            {
              label: datos.nombreSerie ?? '',
              data: datos.valores,
              backgroundColor: fondos ?? color('--accent'),
              hoverBackgroundColor: color('--accent-soft'),
              borderRadius: 6,
              maxBarThickness: 48,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: sinAnimacion ? false : undefined,
          scales: {
            x: { ticks: { color: color('--text-muted') }, grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: {
                color: color('--text-muted'),
                precision: datos.entero ? 0 : undefined,
                callback: datos.formatoEje ? (v) => datos.formatoEje(v) : undefined,
              },
              grid: { color: color('--border') },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) =>
                  datos.formatoValor ? datos.formatoValor(item.parsed.y) : String(item.parsed.y),
                afterLabel: (item) => datos.detalle?.(item.dataIndex) ?? '',
              },
            },
          },
        },
      });
    } catch (error) {
      if (!destruida) onError?.(error);
    }
  })();

  return {
    destroy() {
      destruida = true;
      grafica?.destroy();
      grafica = null;
    },
  };
}
