import '../account.css';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

/**
 * Crea una página de lista paginada cuyos elementos se pueden quitar con un botón (favoritos,
 * artistas que sigo). Al pulsar, el elemento se oculta al instante (cambio optimista); si el
 * servidor falla, reaparece y se avisa; si acierta, se retira del todo.
 *
 * @param {{
 *   titulo: string,
 *   singular: string,
 *   plural: string,
 *   claseGrid: string,
 *   vacio: {icono: string, titulo: string, mensaje: string, accion: {href: string, texto: string}},
 *   cargarPagina: (page: number, signal: AbortSignal) => Promise<{items: object[], page: number, page_size: number, total: number}>,
 *   alCargar: (items: object[]) => void,
 *   itemHtml: (item: object) => import('../../../shared/utils/html.js').SafeHtml,
 *   esqueleto: () => import('../../../shared/utils/html.js').SafeHtml,
 *   activar: (raiz: Element, callbacks: object) => () => void,
 *   preparar?: (raiz: Element) => void,
 * }} config
 */
export function crearPaginaSocial(config) {
  return async function paginaSocial(ctx) {
    let pagina = 1;
    let total = 0;
    let quitados = 0; // ocultos de forma optimista, aún sin confirmar
    let secuencia = 0;

    const el = fromHtml(
      html`<div class="container py-4">
        <h1 class="mb-1">${config.titulo}</h1>
        <p class="text-muted-2" role="status" aria-live="polite" data-resumen></p>
        <div data-lista></div>
        <div class="mt-4" data-paginacion></div>
      </div>`,
      'section',
    );
    config.preparar?.(el);
    const resumen = el.querySelector('[data-resumen]');
    const zona = el.querySelector('[data-lista]');
    const zonaPaginacion = el.querySelector('[data-paginacion]');

    const pintarResumen = () => {
      const n = Math.max(0, total - quitados);
      resumen.textContent = `${n} ${n === 1 ? config.singular : config.plural}`;
    };

    function pintar(datos) {
      total = datos.total;
      quitados = 0;
      zonaPaginacion.replaceChildren();
      if (!datos.items.length) {
        resumen.textContent = '';
        return setHtml(zona, emptyState(config.vacio));
      }
      pintarResumen();
      setHtml(
        zona,
        html`<div class="${config.claseGrid}">
          ${datos.items.map(
            (item) =>
              html`<div class="social-item" data-id="${item.id}">${config.itemHtml(item)}</div>`,
          )}
        </div>`,
      );
      setHtml(
        zonaPaginacion,
        pagination({ page: datos.page, pageSize: datos.page_size, total: datos.total }),
      );
    }

    async function cargar() {
      const propia = ++secuencia;
      resumen.textContent = 'Cargando…';
      zonaPaginacion.replaceChildren();
      setHtml(zona, config.esqueleto());
      try {
        const datos = await config.cargarPagina(pagina, ctx.signal);
        if (propia !== secuencia) return;
        if (!datos.items.length && pagina > 1) {
          pagina -= 1;
          return cargar();
        }
        config.alCargar(datos.items);
        pintar(datos);
      } catch (error) {
        if (error.cancelada || propia !== secuencia) return;
        resumen.textContent = '';
        setHtml(zona, errorState({ mensaje: error.mensaje }));
      }
    }

    const quitarClic = delegate(el, 'click', {
      'ir-pagina': (_e, boton) => {
        pagina = Number(boton.dataset.page);
        cargar();
        irAlInicioDe(el.querySelector('h1'));
      },
      reintentar: cargar,
    });

    const itemDe = (boton) => boton.closest('.social-item');
    const quitarToggle = config.activar(el, {
      // Al pulsar se oculta de inmediato…
      alOptimista: ({ boton }) => {
        itemDe(boton).hidden = true;
        quitados += 1;
        pintarResumen();
      },
      // …si falla, vuelve a aparecer…
      alRevertir: ({ boton }) => {
        itemDe(boton).hidden = false;
        quitados -= 1;
        pintarResumen();
      },
      // …y si acierta, se retira; si no queda nada en la página, se recarga.
      alExito: ({ boton }) => {
        itemDe(boton).remove();
        quitados -= 1;
        total -= 1;
        pintarResumen();
        if (!zona.querySelector('.social-item')) cargar();
      },
    });

    await cargar();
    return {
      title: config.titulo,
      el,
      destroy() {
        secuencia += 1; // descarta respuestas en vuelo
        quitarClic();
        quitarToggle();
      },
    };
  };
}
