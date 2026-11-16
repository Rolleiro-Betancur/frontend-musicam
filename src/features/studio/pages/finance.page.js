import '../studio.css';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { formatCop } from '../../../shared/utils/format-money.js';
import { formatDateTime } from '../../../shared/utils/format-date.js';
import { confirmDialog } from '../../../shared/ui/confirm-dialog.js';
import { emptyState, errorState } from '../../../shared/ui/empty-state.js';
import { clearFieldErrors, formField, setFieldError } from '../../../shared/ui/form-field.js';
import { pagination } from '../../../shared/ui/pagination.js';
import { showToast } from '../../../shared/ui/toast.js';
import { tarjetasSaldo } from '../components/saldo-cards.js';
import {
  ETIQUETA_RETIRO,
  ETIQUETA_TIPO_CUENTA,
  TIPOS_CUENTA,
  cargarSaldo,
  enmascararCuenta,
  erroresDeRetiro,
  listarRetiros,
  solicitarRetiro,
  validarRetiro,
} from '../finanzas.service.js';

const skeletonSaldo = html`<div class="kpi-grid" role="status" aria-label="Cargando saldo">
  ${Array.from(
    { length: 4 },
    () => html`<span class="skeleton" style="height:130px;border-radius:14px"></span>`,
  )}
</div>`;

function detalleDe(retiro) {
  if (retiro.estado === 'RECHAZADO') {
    return html`<span class="text-danger">${retiro.motivo_rechazo || 'Sin motivo indicado.'}</span>`;
  }
  if (retiro.estado === 'PAGADO') {
    return html`<span class="text-muted-2">Pagado el ${formatDateTime(retiro.resuelto_en)}</span>`;
  }
  return html`<span class="text-muted-2">Pendiente de aprobación</span>`;
}

function tablaRetiros(items) {
  return html`<div class="table-responsive">
    <table class="table studio-table">
      <caption class="visually-hidden">
        Historial de retiros
      </caption>
      <thead>
        <tr>
          <th scope="col">Solicitado</th>
          <th scope="col">Monto</th>
          <th scope="col">Cuenta</th>
          <th scope="col">Estado</th>
          <th scope="col">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(
          (r) => html`<tr>
            <td>${formatDateTime(r.solicitado_en)}</td>
            <td class="fw-semibold">${formatCop(r.monto_cop)}</td>
            <td>
              ${r.banco} · ${ETIQUETA_TIPO_CUENTA[r.tipo_cuenta] ?? r.tipo_cuenta}
              ${enmascararCuenta(r.cuenta_ultimos4)}
            </td>
            <td>
              <span class="studio-state studio-state--${r.estado.toLowerCase()}"
                >${ETIQUETA_RETIRO[r.estado] ?? r.estado}</span
              >
            </td>
            <td class="studio-table__wrap">${detalleDe(r)}</td>
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

/** Finanzas del artista (§5.6): saldo, solicitud de retiro e historial. */
export async function financePage(ctx) {
  let pagina = 1;
  let ocupado = false;
  let secSaldo = 0;
  let secRetiros = 0;

  const el = fromHtml(
    html`<h1 class="mb-1">Finanzas</h1>
      <p class="text-muted-2 mb-4">Tu saldo y tus retiros. Solo cobramos comisión por boleto vendido.</p>

      <section aria-labelledby="saldo-titulo">
        <h2 id="saldo-titulo" class="visually-hidden">Saldo</h2>
        <div data-saldo></div>
      </section>

      <section class="mt-4 surface-card p-3 p-md-4" aria-labelledby="retiro-titulo">
        <h2 id="retiro-titulo" class="fs-5 mb-1">Solicitar un retiro</h2>
        <p class="text-muted-2" data-disponible role="status"></p>
        <form novalidate data-form-retiro style="max-width:560px">
          <div class="alert alert-danger" role="alert" data-alerta hidden></div>
          ${formField({
            name: 'monto_cop',
            label: 'Monto (COP)',
            type: 'number',
            required: true,
            min: 1,
            step: 1,
            inputmode: 'numeric',
          })}
          ${formField({ name: 'banco', label: 'Banco', required: true, maxlength: 60 })}
          <div class="mb-3" data-field="tipo_cuenta">
            <label for="campo-tipo_cuenta" class="form-label">Tipo de cuenta</label>
            <select
              id="campo-tipo_cuenta"
              name="tipo_cuenta"
              class="form-select"
              aria-describedby="campo-tipo_cuenta-error"
            >
              ${TIPOS_CUENTA.map(([valor, etiqueta]) => html`<option value="${valor}">${etiqueta}</option>`)}
            </select>
            <div class="invalid-feedback" id="campo-tipo_cuenta-error" aria-live="polite"></div>
          </div>
          ${formField({
            name: 'cuenta_ultimos4',
            label: 'Últimos 4 dígitos de la cuenta',
            required: true,
            inputmode: 'numeric',
            placeholder: '0000',
            help: 'Solo los últimos 4 dígitos. No pedimos ni guardamos el número completo.',
          })}
          <button type="submit" class="btn btn-primary">Solicitar retiro</button>
        </form>
      </section>

      <section class="mt-4" aria-labelledby="historial-titulo">
        <h2 id="historial-titulo" class="fs-5 mb-3">Historial de retiros</h2>
        <div data-retiros></div>
        <div class="mt-3" data-paginacion></div>
      </section>`,
    'section',
  );
  const zonaSaldo = el.querySelector('[data-saldo]');
  const textoDisponible = el.querySelector('[data-disponible]');
  const zonaRetiros = el.querySelector('[data-retiros]');
  const zonaPaginacion = el.querySelector('[data-paginacion]');
  const form = el.querySelector('[data-form-retiro]');
  const alerta = el.querySelector('[data-alerta]');
  const boton = form.querySelector('button[type="submit"]');

  async function recargarSaldo() {
    const propia = ++secSaldo;
    setHtml(zonaSaldo, skeletonSaldo);
    try {
      const saldo = await cargarSaldo(ctx.signal);
      if (propia !== secSaldo) return;
      textoDisponible.textContent = `Disponible para retirar: ${formatCop(saldo.disponible_cop)}.`;
      setHtml(zonaSaldo, tarjetasSaldo(saldo));
    } catch (error) {
      if (error.cancelada || propia !== secSaldo) return;
      textoDisponible.textContent = '';
      setHtml(
        zonaSaldo,
        html`<div data-reintento="saldo">
          ${errorState({ titulo: 'No pudimos cargar tu saldo', mensaje: error.mensaje })}
        </div>`,
      );
    }
  }

  async function recargarRetiros() {
    const propia = ++secRetiros;
    zonaPaginacion.replaceChildren();
    setHtml(
      zonaRetiros,
      html`<div class="d-grid gap-2" role="status" aria-label="Cargando retiros">
        ${Array.from({ length: 3 }, () => html`<span class="skeleton" style="height:48px"></span>`)}
      </div>`,
    );
    try {
      const datos = await listarRetiros(pagina, ctx.signal);
      if (propia !== secRetiros) return;
      if (!datos.items.length && pagina > 1) {
        pagina -= 1;
        return recargarRetiros();
      }
      if (!datos.items.length) {
        setHtml(
          zonaRetiros,
          emptyState({
            icono: 'bi-cash-coin',
            titulo: 'Aún no has solicitado retiros',
            mensaje: 'Cuando solicites uno, aparecerá aquí con su estado.',
          }),
        );
        return;
      }
      setHtml(zonaRetiros, tablaRetiros(datos.items));
      setHtml(
        zonaPaginacion,
        pagination({ page: datos.page, pageSize: datos.page_size, total: datos.total }),
      );
    } catch (error) {
      if (error.cancelada || propia !== secRetiros) return;
      setHtml(
        zonaRetiros,
        html`<div data-reintento="retiros">
          ${errorState({ titulo: 'No pudimos cargar tus retiros', mensaje: error.mensaje })}
        </div>`,
      );
    }
  }

  function leerValores() {
    return {
      monto_cop: form.elements.monto_cop.value,
      banco: form.elements.banco.value,
      tipo_cuenta: form.elements.tipo_cuenta.value,
      cuenta_ultimos4: form.elements.cuenta_ultimos4.value,
    };
  }

  function aplicarErrores(errores) {
    let primero = null;
    for (const [campo, mensaje] of Object.entries(errores)) {
      if (!form.elements[campo]) continue;
      setFieldError(form, campo, mensaje);
      primero ??= form.elements[campo];
    }
    primero?.focus();
  }

  async function alEnviar(e) {
    e.preventDefault();
    if (ocupado) return;
    clearFieldErrors(form);
    alerta.hidden = true;
    const valores = leerValores();
    const errores = validarRetiro(valores);
    if (Object.keys(errores).length) return aplicarErrores(errores);

    const ok = await confirmDialog({
      titulo: 'Confirmar retiro',
      mensaje: `¿Solicitar un retiro de ${formatCop(Number(valores.monto_cop))} a ${valores.banco.trim()} (${
        ETIQUETA_TIPO_CUENTA[valores.tipo_cuenta]
      }, cuenta ${enmascararCuenta(valores.cuenta_ultimos4.trim())})?`,
      confirmar: 'Solicitar retiro',
    });
    if (!ok || ocupado) return;

    ocupado = true;
    boton.disabled = true;
    boton.textContent = 'Solicitando…';
    try {
      const retiro = await solicitarRetiro(valores, ctx.signal);
      showToast(
        retiro.estado === 'PAGADO'
          ? 'Retiro pagado (simulado).'
          : 'Retiro solicitado. Quedará pendiente de aprobación.',
        'success',
      );
      form.reset();
      pagina = 1;
      recargarSaldo();
      recargarRetiros();
    } catch (error) {
      if (error.cancelada) return;
      const { campos, general } = erroresDeRetiro(error);
      aplicarErrores(campos);
      if (general) {
        alerta.textContent = general;
        alerta.hidden = false;
      }
    } finally {
      ocupado = false;
      boton.disabled = false;
      boton.textContent = 'Solicitar retiro';
    }
  }

  const quitarClic = delegate(el, 'click', {
    'ir-pagina': (_e, b) => {
      pagina = Number(b.dataset.page);
      recargarRetiros();
    },
    reintentar: (_e, b) => {
      if (b.closest('[data-reintento="saldo"]')) recargarSaldo();
      else recargarRetiros();
    },
  });
  form.addEventListener('submit', alEnviar);

  recargarSaldo();
  recargarRetiros();
  return {
    title: 'Finanzas',
    el,
    destroy() {
      quitarClic();
      form.removeEventListener('submit', alEnviar);
    },
  };
}
