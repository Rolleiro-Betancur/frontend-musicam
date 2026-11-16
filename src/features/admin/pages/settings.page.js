import '../admin.css';
import { html } from '../../../shared/utils/html.js';
import { delegate, fromHtml, setHtml } from '../../../shared/utils/dom.js';
import { errorState } from '../../../shared/ui/empty-state.js';
import { cargarConfiguracion, gruposDeConfiguracion } from '../admin.service.js';

function esqueleto() {
  return html`<h1 class="mb-3">Configuración</h1>
    <div class="d-grid gap-2" role="status" aria-label="Cargando configuración">
      ${Array.from({ length: 8 }, () => html`<span class="skeleton" style="height:36px"></span>`)}
    </div>`;
}

/** Parámetros de la plataforma en solo lectura. Solo se muestran los de una lista permitida. */
export async function settingsPage(ctx) {
  const el = fromHtml(html``, 'section');

  function pintar(config) {
    const grupos = gruposDeConfiguracion(config);
    setHtml(
      el,
      html`<h1 class="mb-1">Configuración</h1>
        <p class="text-muted-2 mb-4">
          Parámetros vigentes, en solo lectura. Los secretos y las credenciales nunca se muestran.
        </p>
        <div class="d-grid gap-3">
          ${grupos.map(
            (g, i) => html`<section class="surface-card p-3 p-md-4" aria-labelledby="cfg-${i}">
              <h2 id="cfg-${i}" class="fs-5 mb-2">${g.titulo}</h2>
              <dl class="admin-config mb-0">
                ${g.filas.map(
                  ([etiqueta, valor]) => html`<div class="admin-config__fila">
                    <dt>${etiqueta}</dt>
                    <dd>${valor}</dd>
                  </div>`,
                )}
              </dl>
            </section>`,
          )}
        </div>`,
    );
  }

  async function cargar() {
    setHtml(el, esqueleto());
    try {
      pintar(await cargarConfiguracion(ctx.signal));
    } catch (error) {
      if (error.cancelada) return;
      setHtml(
        el,
        html`<h1 class="mb-3">Configuración</h1>${errorState({ mensaje: error.mensaje })}`,
      );
    }
  }

  const quitar = delegate(el, 'click', { reintentar: cargar });
  await cargar();
  return { title: 'Configuración', el, destroy: quitar };
}
