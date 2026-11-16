import '../studio.css';
import { sessionState } from '../../../core/session/session.js';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { kpiCard, kpiGrid } from '../../../shared/ui/kpi-card.js';
import { tarjetasSaldo } from '../components/saldo-cards.js';
import { crearGraficaVentas, vistaGraficaVentas } from '../components/sales-chart.js';
import { esqueletoLista, filaEvento } from '../components/studio-views.js';
import { cargarEstadisticas, textoPico } from '../finanzas.service.js';
import { listarEventos } from '../studio.service.js';

function seccionEventos(titulo, eventos) {
  if (!eventos.length) return html``;
  return html`<section class="mt-4" aria-label="${titulo}">
    <h2 class="fs-5 mb-3">${titulo}</h2>
    <ul class="studio-list">
      ${eventos.map((e) => filaEvento(e, { soloEnlaces: true }))}
    </ul>
  </section>`;
}

function esqueleto() {
  return html`<h1 class="mb-3">Estudio</h1>
    <div class="d-grid gap-3" role="status" aria-label="Cargando resumen">
      <div class="kpi-grid">
        ${Array.from(
          { length: 4 },
          () => html`<span class="skeleton" style="height:96px;border-radius:14px"></span>`,
        )}
      </div>
      <span class="skeleton" style="height:280px;border-radius:14px"></span>
      ${esqueletoLista()}
    </div>`;
}

/** Resumen del estudio: KPIs, ventas por día, saldo y próximos eventos. */
export async function studioHomePage(ctx) {
  const el = fromHtml(html``, 'section');
  activarFallbackPortadas(el);
  const { usuario } = sessionState.get();
  let grafica = null;

  function pintar({ estadisticas, vivos, proximos }) {
    grafica?.destroy();
    grafica = null;
    const { resumen, saldo, ventas_por_dia: ventas } = estadisticas;
    setHtml(
      el,
      html`<h1 class="mb-1">Estudio</h1>
        <p class="text-muted-2">Hola, ${usuario?.nombre_artistico || usuario?.nombre}.</p>
        <nav class="studio-quick mb-4" aria-label="Accesos rápidos">
          <a href="#/estudio/eventos/nuevo"
            ><i class="bi bi-plus-circle" aria-hidden="true"></i>Crear evento</a
          >
          <a href="#/estudio/eventos"
            ><i class="bi bi-calendar-event" aria-hidden="true"></i>Mis eventos</a
          >
          <a href="#/estudio/finanzas"
            ><i class="bi bi-wallet2" aria-hidden="true"></i>Finanzas y retiros</a
          >
        </nav>
        ${kpiGrid(
          html`${kpiCard({
            valor: resumen.entradas_vendidas,
            etiqueta: 'Entradas vendidas',
            icono: 'bi-ticket-perforated',
          })}
          ${kpiCard({
            valor: formatCop(resumen.ingresos_netos_cop),
            etiqueta: 'Ingresos netos',
            icono: 'bi-cash-stack',
          })}
          ${kpiCard({ valor: resumen.seguidores, etiqueta: 'Seguidores', icono: 'bi-people' })}
          ${kpiCard({
            valor: textoPico(resumen.pico_espectadores_promedio),
            etiqueta: 'Pico promedio de espectadores',
            ayuda: 'Solo de eventos transmitidos.',
            icono: 'bi-broadcast',
          })}`,
          'Resumen',
        )}
        <section class="mt-4 surface-card p-3 p-md-4" aria-labelledby="ventas-dia">
          <h2 id="ventas-dia" class="fs-5 mb-3">Ventas por día</h2>
          ${
            ventas.length
              ? vistaGraficaVentas(ventas)
              : emptyState({
                  icono: 'bi-graph-up',
                  titulo: 'Aún no tienes ventas',
                  mensaje:
                    'Cuando vendas entradas, aquí verás cómo van por día. Publica un evento para empezar.',
                  accion: { href: '#/estudio/eventos/nuevo', texto: 'Crear evento' },
                })
          }
        </section>
        <section class="mt-4" aria-labelledby="saldo-titulo">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 id="saldo-titulo" class="fs-5 mb-0">Saldo</h2>
            <a href="#/estudio/finanzas">Ir a finanzas</a>
          </div>
          ${tarjetasSaldo(saldo, { conAyuda: false })}
        </section>
        ${seccionEventos('En vivo ahora', vivos)} ${seccionEventos('Próximos eventos', proximos)}
        ${
          !vivos.length && !proximos.length
            ? html`<div class="mt-4">
              ${emptyState({
                icono: 'bi-calendar-plus',
                titulo: 'Aún no tienes eventos próximos',
                mensaje: 'Crea tu primer evento y publícalo: no necesitas ninguna aprobación.',
                accion: { href: '#/estudio/eventos/nuevo', texto: 'Crear evento' },
              })}
            </div>`
            : ''
        }`,
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
    setHtml(el, esqueleto());
    try {
      const [estadisticas, vivos, proximos] = await Promise.all([
        cargarEstadisticas(ctx.signal),
        listarEventos({ estado: 'EN_VIVO', page: 1, pageSize: 5 }, ctx.signal),
        listarEventos({ estado: 'PROGRAMADO', page: 1, pageSize: 5 }, ctx.signal),
      ]);
      pintar({ estadisticas, vivos: vivos.items, proximos: proximos.items });
    } catch (error) {
      if (error.cancelada) return;
      setHtml(el, html`<h1 class="mb-3">Estudio</h1>${errorState({ mensaje: error.mensaje })}`);
    }
  }

  const quitar = delegate(el, 'click', { reintentar: cargar });
  await cargar();
  return {
    title: 'Estudio',
    el,
    destroy() {
      quitar();
      grafica?.destroy(); // libera el canvas de Chart.js
      grafica = null;
    },
  };
}
