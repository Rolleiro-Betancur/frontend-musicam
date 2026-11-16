import { config } from '../../core/config.js';
import { html } from '../../shared/utils/html.js';
import { fromHtml } from '../../shared/utils/dom.js';

function paginaCentrada({ title, icono, titulo, mensaje, enlace }) {
  const el = fromHtml(
    html`<div class="container py-5 text-center" style="max-width:560px">
      <i class="bi ${icono} display-3 text-muted-2" aria-hidden="true"></i>
      <h1 class="mt-3">${titulo}</h1>
      <p class="text-muted-2">${mensaje}</p>
      <a class="btn btn-primary" href="${enlace.href}">${enlace.texto}</a>
    </div>`,
    'section',
  );
  return { title, el, destroy() {} };
}

export async function notFoundPage() {
  return paginaCentrada({
    title: 'Página no encontrada',
    icono: 'bi-compass',
    titulo: 'No encontramos esa página',
    mensaje: 'La dirección no existe o fue movida.',
    enlace: { href: '#/', texto: 'Ir al inicio' },
  });
}

export async function forbiddenPage() {
  return paginaCentrada({
    title: 'No tienes acceso',
    icono: 'bi-shield-lock',
    titulo: 'No tienes acceso',
    mensaje: 'Tu cuenta no tiene permiso para ver esta sección.',
    enlace: { href: '#/', texto: 'Volver al inicio' },
  });
}

export async function comingSoonPage() {
  return paginaCentrada({
    title: 'Próximamente',
    icono: 'bi-hourglass-split',
    titulo: 'Próximamente',
    mensaje: `Esta sección de ${config.appName} estará disponible muy pronto.`,
    enlace: { href: '#/', texto: 'Volver al inicio' },
  });
}
