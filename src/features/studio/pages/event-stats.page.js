import '../studio.css';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { kpiCard, kpiGrid } from '../../../shared/ui/kpi-card.js';
import { crearGraficaVentas, vistaGraficaVentas } from '../components/sales-chart.js';
import { badgeEstado } from '../components/studio-views.js';
import { cargarEstadisticasEvento } from '../finanzas.service.js';
import { cargarEvento, textoDuracion } from '../studio.service.js';

const migas = html`<nav aria-label="Migas de pan" class="mb-3">
  <a href="#/estudio/eventos">← Mis eventos</a>
</nav>`;

/** Métricas de un evento y su gráfica de ventas por día. */
export async function eventStatsPage(ctx) {
  const id = ctx.params.id;
  const el = fromHtml(html``, 'section');
  let grafica = null;
  let titulo = 'Estadísticas';

  function mensaje(icono, tituloMsg, texto) {
    setHtml(
      el,
      html`${migas}
        <h1 class="visually-hidden">Estadísticas del evento</h1>
        ${emptyState({
          icono,
          titulo: tituloMsg,
          mensaje: texto,
          accion: { href: '#/estudio/eventos', texto: 'Volver a mis eventos' },
        })}`,
    );
  }

  function pintar(evento, stats) {
    grafica?.destroy();
    grafica = null;
    titulo = `Estadísticas: ${evento.titulo}`;
    const ventas = stats.ventas_por_dia;
    setHtml(
      el,
      html`${migas}
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          ${badgeEstado(evento.estado)}
        </div>
        <h1 class="mb-1">Estadísticas</h1>
        <p class="text-muted-2 mb-4">${evento.titulo} · ${formatDateTime(evento.fecha_inicio)}</p>
        ${kpiGrid(
          html`${kpiCard({
            valor: stats.entradas_vendidas,
            etiqueta: 'Entradas vendidas',
            icono: 'bi-ticket-perforated',
          })}
          ${kpiCard({
            valor: formatCop(stats.ingresos_brutos_cop),
            etiqueta: 'Ingresos brutos',
            icono: 'bi-cash',
          })}
          ${kpiCard({
            valor: formatCop(stats.ingresos_netos_cop),
            etiqueta: 'Ingresos netos',
            ayuda: 'Después de la comisión por boleto.',
            icono: 'bi-cash-stack',
          })}
          ${kpiCard({
            valor: stats.pico_espectadores,
            etiqueta: 'Pico de espectadores',
            icono: 'bi-broadcast',
          })}
          ${kpiCard({ valor: stats.vistas_vivo, etiqueta: 'Vistas en vivo', icono: 'bi-eye' })}
          ${kpiCard({
            valor: stats.vistas_replay,
            etiqueta: 'Vistas del replay',
            icono: 'bi-play-circle',
          })}
          ${kpiCard({
            valor: textoDuracion(stats.duracion_real_min),
            etiqueta: 'Duración real',
            icono: 'bi-clock',
          })}
          ${kpiCard({ valor: stats.favoritos, etiqueta: 'Favoritos', icono: 'bi-heart' })}`,
          'Métricas del evento',
        )}
        <section class="mt-4 surface-card p-3 p-md-4" aria-labelledby="ventas-dia">
          <h2 id="ventas-dia" class="fs-5 mb-3">Ventas por día</h2>
          ${
            ventas.length
              ? vistaGraficaVentas(ventas)
              : emptyState({
                  icono: 'bi-graph-up',
                  titulo: 'Este evento aún no tiene ventas',
                  mensaje: 'Cuando se vendan entradas, verás aquí las ventas por día.',
                })
          }
        </section>`,
    );
    const canvas = el.querySelector('[data-grafica]');
    if (canvas) {
      grafica = crearGraficaVentas(canvas, ventas, {
        onError: () => {
          const caja = el.querySelector('.studio-chart__canvas');
          if (caja) caja.textContent = 'No pudimos cargar la gráfica. Los datos están en la tabla.';
        },
      });
    }
  }

  async function cargar() {
    grafica?.destroy();
    grafica = null;
    setHtml(
      el,
      html`${migas}
        <div class="d-grid gap-3" role="status" aria-label="Cargando estadísticas">
          <span class="skeleton" style="width:40%;height:32px"></span>
          <div class="kpi-grid">
            ${Array.from(
              { length: 8 },
              () => html`<span class="skeleton" style="height:96px;border-radius:14px"></span>`,
            )}
          </div>
          <span class="skeleton" style="height:280px;border-radius:14px"></span>
        </div>`,
    );
    try {
      const [evento, stats] = await Promise.all([
        cargarEvento(id, ctx.signal),
        cargarEstadisticasEvento(id, ctx.signal),
      ]);
      if (evento.artista?.id !== sessionState.get().usuario?.id) {
        return mensaje(
          'bi-shield-lock',
          'Este evento no es tuyo',
          'Solo su artista ve sus estadísticas.',
        );
      }
      pintar(evento, stats);
    } catch (error) {
      if (error.cancelada) return;
      if (error.status === 403) {
        return mensaje(
          'bi-shield-lock',
          'Este evento no es tuyo',
          'Solo su artista ve sus estadísticas.',
        );
      }
      if (error.status === 404) {
        return mensaje(
          'bi-calendar-x',
          'No encontramos este evento',
          'Puede que haya sido eliminado.',
        );
      }
      setHtml(el, html`${migas}${errorState({ mensaje: error.mensaje })}`);
    }
  }

  const quitar = delegate(el, 'click', { reintentar: cargar });
  await cargar();
  return {
    get title() {
      return titulo;
    },
    el,
    destroy() {
      quitar();
      grafica?.destroy();
      grafica = null;
    },
  };
}
