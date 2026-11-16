import '../account.css';
import { on } from '../../../core/event-bus.js';
import { html } from '../../../shared/utils/html.js';
import { fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { activarFallbackPortadas } from '../../../shared/ui/cover.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { abrirCheckout } from '../../checkout/index.js';
import { vistaCalendario } from '../components/calendar-view.js';
import { esqueletoEntradas, ticketCard } from '../components/ticket-card.js';
import {
  FILTROS_HISTORIAL,
  PESTANAS,
  agruparPorDia,
  cargarPagosPendientes,
  cargarProximos,
  cargarTodasLasCompras,
  etiquetaDiaLarga,
  filtrarHistorial,
  hoyBogota,
  mesInicial,
  moverMes,
  paginarLocal,
} from '../tickets.service.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

const NOMBRE_PESTANA = { proximos: 'Próximos', historial: 'Historial', calendario: 'Calendario' };

const lista = (compras) => html`<ul class="ticket-list">${compras.map((c) => ticketCard(c))}</ul>`;

const explorar = { href: '#/eventos', texto: 'Explorar conciertos' };

/** "Mis eventos": próximos, historial y calendario de las entradas del usuario. */
export async function misEventosPage(ctx) {
  const pedida = ctx.query.get('tab');
  let pestana = PESTANAS.includes(pedida) ? pedida : 'proximos';
  let filtro = '';
  let paginaProximos = 1;
  let paginaHistorial = 1;
  let todas = null; // caché de todas las compras (historial y calendario)
  let cargaTodas = null;
  let calendario = null;
  let secuencia = 0;
  let checkout = null;
  const visibles = new Map(); // id de compra → compra, para "Completar pago"

  const el = fromHtml(
    html`<div class="container py-4">
      <h1 class="mb-3">Mis eventos</h1>
      <div class="account-tabs" role="tablist" aria-label="Mis eventos" data-tabs>
        ${PESTANAS.map(
          (p) => html`<button
            type="button"
            role="tab"
            id="tab-${p}"
            aria-controls="panel-eventos"
            data-action="pestana"
            data-valor="${p}"
          >
            ${NOMBRE_PESTANA[p]}
          </button>`,
        )}
      </div>
      <div id="panel-eventos" role="tabpanel" tabindex="0" data-panel></div>
    </div>`,
    'section',
  );
  activarFallbackPortadas(el);
  const panel = el.querySelector('[data-panel]');
  const tabs = el.querySelector('[data-tabs]');

  /** Compras de todos los estados, una sola carga por visita (se invalida al pagar). */
  function asegurarTodas() {
    if (todas) return Promise.resolve(todas);
    cargaTodas ??= cargarTodasLasCompras(ctx.signal)
      .then((datos) => {
        todas = datos;
        return datos;
      })
      .finally(() => {
        cargaTodas = null;
      });
    return cargaTodas;
  }

  function recordar(compras) {
    compras.forEach((c) => visibles.set(c.id, c));
  }

  function mostrarError(error) {
    setHtml(panel, errorState({ mensaje: error.mensaje }));
  }

  // --- Próximos ---------------------------------------------------------------------------

  async function mostrarProximos() {
    const propia = ++secuencia;
    setHtml(panel, esqueletoEntradas());
    try {
      const [datos, pendientes] = await Promise.all([
        cargarProximos(paginaProximos, ctx.signal),
        cargarPagosPendientes(ctx.signal),
      ]);
      if (propia !== secuencia) return;
      if (!datos.items.length && paginaProximos > 1) {
        paginaProximos -= 1;
        return mostrarProximos();
      }
      recordar([...pendientes, ...datos.items]);
      if (!datos.items.length && !pendientes.length) {
        return setHtml(
          panel,
          emptyState({
            icono: 'bi-ticket-perforated',
            titulo: 'Aún no tienes eventos próximos',
            mensaje: 'Cuando compres una entrada, aparecerá aquí.',
            accion: explorar,
          }),
        );
      }
      setHtml(
        panel,
        html`${
          pendientes.length
            ? html`<section class="mb-4" aria-labelledby="pendientes">
                <h2 id="pendientes" class="fs-5">Pagos pendientes</h2>
                <p class="text-muted-2">Empezaste estas compras y aún no se completaron.</p>
                ${lista(pendientes)}
              </section>`
            : ''
        }
          ${
            datos.items.length
              ? html`<section aria-labelledby="proximos">
                <h2 id="proximos" class="fs-5 mb-3">Próximos eventos</h2>
                ${lista(datos.items)}
                <div class="mt-4">
                  ${pagination({
                    page: datos.page,
                    pageSize: datos.page_size,
                    total: datos.total,
                  })}
                </div>
              </section>`
              : ''
          }`,
      );
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      mostrarError(error);
    }
  }

  // --- Historial --------------------------------------------------------------------------

  function pintarListaHistorial() {
    const zona = panel.querySelector('[data-lista]');
    const datos = paginarLocal(filtrarHistorial(todas, filtro), paginaHistorial);
    paginaHistorial = datos.page;
    recordar(datos.items);
    if (!datos.items.length) {
      return setHtml(
        zona,
        filtro
          ? emptyState({
              icono: 'bi-funnel',
              titulo: 'No tienes compras con ese estado',
              mensaje: 'Prueba con otro filtro.',
            })
          : emptyState({
              icono: 'bi-clock-history',
              titulo: 'Aún no tienes historial',
              mensaje: 'Aquí verás tus compras pasadas, rechazadas o reembolsadas.',
              accion: explorar,
            }),
      );
    }
    setHtml(
      zona,
      html`${lista(datos.items)}
        <div class="mt-4">
          ${pagination({ page: datos.page, pageSize: datos.page_size, total: datos.total })}
        </div>`,
    );
  }

  async function mostrarHistorial() {
    const propia = ++secuencia;
    setHtml(panel, esqueletoEntradas());
    try {
      await asegurarTodas();
      if (propia !== secuencia) return;
      setHtml(
        panel,
        html`<div class="mb-3" style="max-width:260px">
            <label class="form-label" for="filtro-compra">Estado de la compra</label>
            <select id="filtro-compra" class="form-select" data-filtro>
              ${FILTROS_HISTORIAL.map(
                ([valor, etiqueta]) =>
                  html`<option value="${valor}" ${valor === filtro ? html`selected` : ''}>
                    ${etiqueta}
                  </option>`,
              )}
            </select>
          </div>
          <div data-lista></div>`,
      );
      pintarListaHistorial();
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      mostrarError(error);
    }
  }

  // --- Calendario -------------------------------------------------------------------------

  function pintarCalendario() {
    const dias = agruparPorDia(todas);
    const { mes, seleccionado } = calendario;
    setHtml(
      panel,
      html`<div class="cal-layout">
        ${vistaCalendario({ mes, dias, seleccionado, hoy: hoyBogota() })}
        <section aria-labelledby="dia-titulo" aria-live="polite">
          <h2 id="dia-titulo" class="fs-5 mb-3">
            ${seleccionado ? etiquetaDiaLarga(seleccionado) : 'Tus eventos del día'}
          </h2>
          ${
            seleccionado
              ? dias.has(seleccionado)
                ? lista(dias.get(seleccionado))
                : html`<p class="text-muted-2">No tienes eventos este día.</p>`
              : html`<p class="text-muted-2">Elige un día marcado para ver tus eventos.</p>`
          }
        </section>
      </div>`,
    );
    recordar([...dias.values()].flat());
  }

  async function mostrarCalendario() {
    const propia = ++secuencia;
    setHtml(panel, esqueletoEntradas(2));
    try {
      await asegurarTodas();
      if (propia !== secuencia) return;
      const dias = agruparPorDia(todas);
      if (!dias.size) {
        return setHtml(
          panel,
          emptyState({
            icono: 'bi-calendar-event',
            titulo: 'Aún no tienes eventos comprados',
            mensaje: 'Cuando compres una entrada, el día del evento se marcará aquí.',
            accion: explorar,
          }),
        );
      }
      calendario ??= { mes: mesInicial(dias), seleccionado: null };
      pintarCalendario();
    } catch (error) {
      if (error.cancelada || propia !== secuencia) return;
      mostrarError(error);
    }
  }

  // --- Pestañas ---------------------------------------------------------------------------

  function mostrarPestana() {
    if (pestana === 'historial') return mostrarHistorial();
    if (pestana === 'calendario') return mostrarCalendario();
    return mostrarProximos();
  }

  function marcarPestanas() {
    tabs.querySelectorAll('[role="tab"]').forEach((boton) => {
      const activa = boton.dataset.valor === pestana;
      boton.setAttribute('aria-selected', String(activa));
      boton.tabIndex = activa ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `tab-${pestana}`);
  }

  function elegirPestana(nueva, { enfocar = false } = {}) {
    pestana = nueva;
    marcarPestanas();
    const destino = `#/mis-eventos${nueva === 'proximos' ? '' : `?tab=${nueva}`}`;
    if (destino !== location.hash) history.replaceState(null, '', destino);
    if (enfocar) tabs.querySelector(`#tab-${nueva}`).focus();
    mostrarPestana();
  }

  // --- Eventos ----------------------------------------------------------------------------

  const enfocarDia = (fecha) => panel.querySelector(`[data-fecha="${fecha}"]`)?.focus();

  const alClic = (e) => {
    const boton = e.target.closest('[data-action]');
    if (!boton || !el.contains(boton)) return;
    const accion = boton.dataset.action;
    if (accion === 'pestana') return elegirPestana(boton.dataset.valor);
    if (accion === 'reintentar') return mostrarPestana();
    if (accion === 'ir-pagina') {
      const n = Number(boton.dataset.page);
      if (pestana === 'historial') {
        paginaHistorial = n;
        pintarListaHistorial();
      } else {
        paginaProximos = n;
        mostrarProximos();
      }
      return irAlInicioDe(el.querySelector('h1'));
    }
    if (accion === 'completar-pago') {
      const compra = visibles.get(boton.dataset.compra);
      if (compra && !checkout) {
        checkout = abrirCheckout(compra.evento);
        checkout.cerrado.then(() => {
          checkout = null;
        });
      }
      return;
    }
    if (accion === 'dia') {
      calendario.seleccionado = boton.dataset.fecha;
      pintarCalendario();
      return enfocarDia(calendario.seleccionado);
    }
    if (accion === 'mes-anterior' || accion === 'mes-siguiente') {
      calendario.mes = moverMes(calendario.mes, accion === 'mes-anterior' ? -1 : 1);
      calendario.seleccionado = null;
      pintarCalendario();
      panel.querySelector(`[data-action="${accion}"]`)?.focus();
    }
  };

  const alTeclear = (e) => {
    const indice = PESTANAS.indexOf(pestana);
    const destino = {
      ArrowRight: PESTANAS[(indice + 1) % PESTANAS.length],
      ArrowLeft: PESTANAS[(indice + PESTANAS.length - 1) % PESTANAS.length],
      Home: PESTANAS[0],
      End: PESTANAS[PESTANAS.length - 1],
    }[e.key];
    if (!destino) return;
    e.preventDefault();
    elegirPestana(destino, { enfocar: true });
  };

  const alCambiar = (e) => {
    if (e.target.matches('[data-filtro]')) {
      filtro = e.target.value;
      paginaHistorial = 1;
      pintarListaHistorial();
    }
  };

  el.addEventListener('click', alClic);
  tabs.addEventListener('keydown', alTeclear);
  el.addEventListener('change', alCambiar);

  // Tras pagar una compra pendiente, todo se vuelve a consultar y el botón cambia solo (C3).
  const quitarCompra = on('compra:aprobada', () => {
    todas = null;
    calendario = null;
    mostrarPestana();
  });

  marcarPestanas();
  mostrarPestana();
  return {
    title: 'Mis eventos',
    el,
    destroy() {
      secuencia += 1; // descarta respuestas en vuelo
      quitarCompra();
      checkout?.cerrar();
      el.removeEventListener('click', alClic);
      tabs.removeEventListener('keydown', alTeclear);
      el.removeEventListener('change', alCambiar);
    },
  };
}
