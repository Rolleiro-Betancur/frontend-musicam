import '../admin.css';
import { html } from '../../../shared/utils/html.js';
import { debounce } from '../../../shared/utils/debounce.js';
import { fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { showToast } from '../../../shared/ui/toast.js';
import { textoDeAviso } from '../admin.service.js';
import { irAlInicioDe } from '../../../shared/utils/motion.js';

/** Filas de esqueleto para la carga de una tabla. */
function esqueletoTabla(columnas) {
  return html`<div class="table-responsive" role="status" aria-label="Cargando">
    <table class="table table-sm admin-table" aria-hidden="true">
      <tbody>
        ${Array.from(
          { length: 6 },
          () => html`<tr>
            ${columnas.map(() => html`<td><span class="skeleton" style="width:80%;height:14px"></span></td>`)}
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

const hayFiltrosActivos = (filtros) =>
  Object.entries(filtros).some(([clave, valor]) => clave !== 'page' && valor !== '');

/**
 * Crea una página de lista de administración: filtros arriba, tabla densa, paginación abajo, un
 * aviso visible para los errores del servidor (mostrados tal cual) y botones que se bloquean
 * mientras hay una acción en curso.
 *
 * @param {{
 *   titulo: string,
 *   descripcion?: string,
 *   ruta: string,
 *   cabeceraExtra?: import('../../../shared/utils/html.js').SafeHtml,
 *   leerFiltros: (query: URLSearchParams) => Record<string, any>,
 *   aQuery: (filtros: Record<string, any>) => string,
 *   formularioFiltros: (filtros: Record<string, any>) => import('../../../shared/utils/html.js').SafeHtml,
 *   leerFormulario: (form: HTMLFormElement) => Record<string, any>,
 *   validar?: (filtros: Record<string, any>) => string|null,
 *   cargar: (filtros: Record<string, any>, signal: AbortSignal) => Promise<{items: any[], page: number, page_size: number, total: number}>,
 *   columnas: string[],
 *   fila: (item: any) => import('../../../shared/utils/html.js').SafeHtml,
 *   vacio: (filtros: Record<string, any>) => Parameters<typeof emptyState>[0],
 *   acciones?: Record<string, (c: object) => unknown>,
 *   alIniciar?: (c: object) => (() => void) | void,
 * }} config
 */
export function crearPaginaLista(config) {
  return async function paginaLista(ctx) {
    let filtros = config.leerFiltros(ctx.query);
    let secuencia = 0;
    let ocupado = false;
    const items = new Map();

    const el = fromHtml(
      html`<h1 class="mb-1">${config.titulo}</h1>
        ${config.descripcion ? html`<p class="text-muted-2">${config.descripcion}</p>` : ''}
        <div class="mb-3 d-flex flex-wrap gap-2">${config.cabeceraExtra ?? ''}</div>
        <div data-aviso></div>
        <form class="admin-filters" role="search" novalidate data-form>
          ${config.formularioFiltros(filtros)}
          <div class="admin-filters__limpiar">
            <button type="button" class="btn btn-outline-light btn-sm" data-action="limpiar">
              Limpiar filtros
            </button>
          </div>
        </form>
        <p class="small text-warning" role="alert" data-validacion hidden></p>
        <p class="text-muted-2 small mb-2" role="status" aria-live="polite" data-resumen></p>
        <div data-tabla></div>
        <div class="mt-3" data-paginacion></div>`,
      'section',
    );
    const form = el.querySelector('[data-form]');
    const zonaAviso = el.querySelector('[data-aviso]');
    const zonaValidacion = el.querySelector('[data-validacion]');
    const resumen = el.querySelector('[data-resumen]');
    const tabla = el.querySelector('[data-tabla]');
    const zonaPaginacion = el.querySelector('[data-paginacion]');

    // --- Aviso de errores del servidor (visible, con su código) ---------------------------

    function mostrarAviso(texto) {
      setHtml(
        zonaAviso,
        html`<div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i class="bi bi-exclamation-octagon-fill" aria-hidden="true"></i>
          <span class="flex-grow-1">${texto}</span>
          <button
            type="button"
            class="btn-close"
            data-action="cerrar-aviso"
            aria-label="Cerrar aviso"
          ></button>
        </div>`,
      );
    }
    const limpiarAviso = () => zonaAviso.replaceChildren();

    // --- Carga ----------------------------------------------------------------------------

    function sincronizarUrl() {
      const destino = `${config.ruta}${config.aQuery(filtros)}`;
      if (destino !== location.hash) history.replaceState(null, '', destino);
    }

    function pintarPagina(datos) {
      items.clear();
      datos.items.forEach((i) => items.set(i.id, i));
      zonaPaginacion.replaceChildren();
      if (!datos.items.length) {
        resumen.textContent = 'Sin resultados.';
        return setHtml(tabla, emptyState(config.vacio(filtros)));
      }
      resumen.textContent = `${datos.total} ${datos.total === 1 ? 'resultado' : 'resultados'}`;
      setHtml(
        tabla,
        html`<div class="table-responsive">
          <table class="table table-sm table-hover admin-table align-middle">
            <caption class="visually-hidden">
              ${config.titulo}
            </caption>
            <thead>
              <tr>
                ${config.columnas.map((c) => html`<th scope="col">${c}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${datos.items.map((i) => config.fila(i))}
            </tbody>
          </table>
        </div>`,
      );
      setHtml(
        zonaPaginacion,
        pagination({ page: datos.page, pageSize: datos.page_size, total: datos.total }),
      );
    }

    /** `silencioso`: no vuelve a pintar el esqueleto (se usa tras una acción sobre una fila). */
    async function cargar({ silencioso = false } = {}) {
      const mensaje = config.validar?.(filtros) ?? null;
      zonaValidacion.textContent = mensaje ?? '';
      zonaValidacion.hidden = !mensaje;
      if (mensaje) {
        resumen.textContent = '';
        tabla.replaceChildren();
        return zonaPaginacion.replaceChildren();
      }
      const propia = ++secuencia;
      if (!silencioso) {
        resumen.textContent = 'Cargando…';
        zonaPaginacion.replaceChildren();
        setHtml(tabla, esqueletoTabla(config.columnas));
      }
      try {
        const datos = await config.cargar(filtros, ctx.signal);
        if (propia !== secuencia) return;
        if (!datos.items.length && filtros.page > 1) {
          filtros = { ...filtros, page: filtros.page - 1 };
          return cargar({ silencioso });
        }
        pintarPagina(datos);
      } catch (error) {
        if (error.cancelada || propia !== secuencia) return;
        resumen.textContent = '';
        setHtml(tabla, errorState({ mensaje: error.mensaje }));
      }
    }

    // --- Filtros --------------------------------------------------------------------------

    function aplicarFiltros(nuevos) {
      filtros = { ...nuevos, page: 1 };
      sincronizarUrl();
      cargar();
    }

    /** Cambia filtros desde código (p. ej. al pulsar un comprador) y refleja el cambio en el formulario. */
    function fijarFiltros(parcial) {
      for (const [nombre, valor] of Object.entries(parcial)) {
        if (form.elements[nombre]) form.elements[nombre].value = valor;
      }
      aplicarFiltros({ ...filtros, ...parcial });
    }

    const aplicarDesdeFormulario = () => aplicarFiltros(config.leerFormulario(form));
    const aplicarConRetraso = debounce(aplicarDesdeFormulario, 300);

    const alEscribir = (e) => {
      if (e.target.matches('[data-debounce]')) aplicarConRetraso();
    };
    const alCambiar = (e) => {
      if (!e.target.matches('[data-debounce]')) aplicarDesdeFormulario();
    };
    const alEnviar = (e) => {
      e.preventDefault();
      aplicarConRetraso.cancel();
      aplicarDesdeFormulario();
    };

    // --- Acciones sobre filas -------------------------------------------------------------

    /** Ejecuta un trabajo con los botones de la fila bloqueados; luego recarga la lista. */
    async function ejecutar(boton, trabajo, textoExito) {
      if (ocupado) return false;
      ocupado = true;
      limpiarAviso();
      const fila = boton?.closest('tr') ?? el;
      const botones = fila.querySelectorAll('button');
      botones.forEach((b) => (b.disabled = true));
      try {
        await trabajo();
        showToast(textoExito, 'success');
        await cargar({ silencioso: true });
        return true;
      } catch (error) {
        if (!error.cancelada) mostrarAviso(textoDeAviso(error));
        botones.forEach((b) => (b.disabled = false));
        return false;
      } finally {
        ocupado = false;
      }
    }

    const contexto = (boton) => ({
      boton,
      id: boton.dataset.id,
      item: items.get(boton.dataset.id),
      ejecutar: (trabajo, texto) => ejecutar(boton, trabajo, texto),
      recargar: () => cargar({ silencioso: true }),
      fijarFiltros,
      mostrarAviso,
      signal: ctx.signal,
    });

    const acciones = {
      ...config.acciones,
    };

    const alClic = (e) => {
      const boton = e.target.closest('[data-action]');
      if (!boton || !el.contains(boton)) return;
      const accion = boton.dataset.action;
      if (accion === 'cerrar-aviso') return limpiarAviso();
      if (accion === 'reintentar') return cargar();
      if (accion === 'limpiar') {
        // Los valores por defecto pueden no ser "vacío" (p. ej. la cola de retiros abre en PENDIENTE).
        const porDefecto = config.leerFiltros(new URLSearchParams());
        for (const [nombre, valor] of Object.entries(porDefecto)) {
          if (nombre !== 'page' && form.elements[nombre]) form.elements[nombre].value = valor;
        }
        aplicarConRetraso.cancel();
        return aplicarFiltros(porDefecto);
      }
      if (accion === 'ir-pagina') {
        filtros = { ...filtros, page: Number(boton.dataset.page) };
        sincronizarUrl();
        cargar();
        return irAlInicioDe(el.querySelector('h1'));
      }
      acciones[accion]?.(contexto(boton));
    };

    el.addEventListener('click', alClic);
    form.addEventListener('input', alEscribir);
    form.addEventListener('change', alCambiar);
    form.addEventListener('submit', alEnviar);
    const quitarExtra = config.alIniciar?.({ el, recargar: () => cargar(), mostrarAviso });

    cargar();
    return {
      title: config.titulo,
      el,
      destroy() {
        secuencia += 1; // descarta respuestas en vuelo
        aplicarConRetraso.cancel();
        el.removeEventListener('click', alClic);
        form.removeEventListener('input', alEscribir);
        form.removeEventListener('change', alCambiar);
        form.removeEventListener('submit', alEnviar);
        quitarExtra?.();
      },
    };
  };
}

export { hayFiltrosActivos };
