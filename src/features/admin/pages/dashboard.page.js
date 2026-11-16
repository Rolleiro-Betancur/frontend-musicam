import '../admin.css';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { crearGraficaBarras, vistaGraficaBarras } from '../../../shared/ui/bar-chart.js';
import { errorState } from '../../../shared/ui/empty-state.js';
import { kpiCard, kpiGrid } from '../../../shared/ui/kpi-card.js';
import { cargarDashboard, paresDe } from '../admin.service.js';

const ESTADOS = [
  ['BORRADOR', 'Borrador'],
  ['PROGRAMADO', 'Programado'],
  ['EN_VIVO', 'En vivo'],
  ['FINALIZADO', 'Finalizado'],
  ['CANCELADO', 'Cancelado'],
];
const COLORES_ESTADO = ['--text-muted', '--accent', '--live-dot', '--success', '--danger'];
const ROLES = [
  ['USUARIO', 'Espectadores'],
  ['ARTISTA', 'Artistas'],
  ['ADMIN', 'Administradores'],
];

function esqueleto() {
  return html`<h1 class="mb-3">Dashboard</h1>
    <div class="d-grid gap-3" role="status" aria-label="Cargando dashboard">
      <div class="kpi-grid">
        ${Array.from({ length: 4 }, () => html`<span class="skeleton" style="height:96px;border-radius:14px"></span>`)}
      </div>
      <div class="kpi-grid">
        ${Array.from({ length: 4 }, () => html`<span class="skeleton" style="height:96px;border-radius:14px"></span>`)}
      </div>
      <span class="skeleton" style="height:280px;border-radius:14px"></span>
    </div>`;
}

/** Figura con su gráfica de barras o, si todo vale cero, un aviso (no se carga chart.js). */
function figura({ clave, titulo, pares, unidad, leyenda }) {
  const hayDatos = pares.some(([, valor]) => valor > 0);
  return html`<section class="surface-card p-3 p-md-4 h-100" aria-labelledby="graf-${clave}">
    <h2 id="graf-${clave}" class="fs-5 mb-3">${titulo}</h2>
    <div data-chart="${clave}">
      ${
        hayDatos
          ? vistaGraficaBarras({
              descripcion: `${titulo}: ${pares.map(([e, v]) => `${e} ${v}`).join(', ')}.`,
              leyenda,
              columnas: ['Categoría', unidad],
              filas: pares,
            })
          : html`<p class="text-muted-2 mb-0">Aún no hay datos para mostrar.</p>`
      }
    </div>
  </section>`;
}

/** Dashboard: KPIs de usuarios y de negocio, y gráficas de eventos y usuarios (Chart.js diferido). */
export async function dashboardPage(ctx) {
  const el = fromHtml(html``, 'section');
  let graficas = [];

  function limpiarGraficas() {
    graficas.forEach((g) => g.destroy());
    graficas = [];
  }

  function pintar(d) {
    limpiarGraficas();
    const porRol = d.usuarios?.por_rol ?? {};
    const porEstado = d.usuarios?.por_estado ?? {};
    const parEventos = paresDe(d.eventos_por_estado, ESTADOS);
    const parRoles = paresDe(porRol, ROLES);
    const retiros = d.retiros_pendientes ?? { cantidad: 0, monto_cop: 0 };

    setHtml(
      el,
      html`<h1 class="mb-1">Dashboard</h1>
        <p class="text-muted-2 mb-4">Resumen de la plataforma. Las cifras se calculan en el servidor.</p>

        <h2 class="fs-5 mb-3">Usuarios</h2>
        ${kpiGrid(
          html`${parRoles.map(([etiqueta, valor]) => kpiCard({ valor, etiqueta, icono: 'bi-people' }))}
          ${kpiCard({
            valor: Number(porEstado.SUSPENDIDO ?? 0),
            etiqueta: 'Suspendidos',
            icono: 'bi-person-slash',
          })}`,
          'Usuarios por rol',
        )}

        <h2 class="fs-5 mt-4 mb-3">Negocio</h2>
        ${kpiGrid(
          html`${kpiCard({
            valor: d.entradas_vendidas,
            etiqueta: 'Entradas vendidas',
            icono: 'bi-ticket-perforated',
          })}
          ${kpiCard({
            valor: formatCop(d.ingresos_brutos_cop),
            etiqueta: 'Ingresos brutos',
            icono: 'bi-cash',
          })}
          ${kpiCard({
            valor: formatCop(d.comisiones_acumuladas_cop),
            etiqueta: 'Comisiones acumuladas',
            icono: 'bi-percent',
          })}
          ${kpiCard({
            valor: retiros.cantidad,
            etiqueta: 'Retiros pendientes',
            ayuda: `${formatCop(retiros.monto_cop)} por aprobar`,
            icono: 'bi-cash-coin',
          })}`,
          'Negocio',
        )}
        <p class="mt-2 mb-0">
          <a href="#/admin/retiros">Ir a la cola de retiros</a>
        </p>

        <div class="row g-3 mt-2">
          <div class="col-lg-7">
            ${figura({
              clave: 'eventos',
              titulo: 'Eventos por estado',
              pares: parEventos,
              unidad: 'Eventos',
              leyenda: 'Cantidad de eventos en cada estado.',
            })}
          </div>
          <div class="col-lg-5">
            ${figura({
              clave: 'usuarios',
              titulo: 'Usuarios por rol',
              pares: parRoles,
              unidad: 'Usuarios',
              leyenda: 'Cantidad de cuentas de cada tipo.',
            })}
          </div>
        </div>`,
    );

    const alFallar = (clave) => () => {
      const caja = el.querySelector(`[data-chart="${clave}"] .studio-chart__canvas`);
      if (caja) caja.textContent = 'No pudimos cargar la gráfica. Los datos están en la tabla.';
    };
    const montar = (clave, pares, nombreSerie, extra = {}) => {
      const canvas = el.querySelector(`[data-chart="${clave}"] [data-grafica]`);
      if (!canvas) return; // sin datos: no se carga chart.js
      graficas.push(
        crearGraficaBarras(
          canvas,
          {
            etiquetas: pares.map(([e]) => e),
            valores: pares.map(([, v]) => v),
            nombreSerie,
            entero: true,
            formatoValor: (v) => `${v} ${nombreSerie.toLowerCase()}`,
            ...extra,
          },
          { onError: alFallar(clave) },
        ),
      );
    };
    montar('eventos', parEventos, 'Eventos', { colores: COLORES_ESTADO });
    montar('usuarios', parRoles, 'Usuarios');
  }

  async function cargar() {
    limpiarGraficas();
    setHtml(el, esqueleto());
    try {
      pintar(await cargarDashboard(ctx.signal));
    } catch (error) {
      if (error.cancelada) return;
      setHtml(el, html`<h1 class="mb-3">Dashboard</h1>${errorState({ mensaje: error.mensaje })}`);
    }
  }

  const quitar = delegate(el, 'click', { reintentar: cargar });
  await cargar();
  return {
    title: 'Dashboard',
    el,
    destroy() {
      quitar();
      limpiarGraficas(); // libera los canvas de Chart.js
    },
  };
}
