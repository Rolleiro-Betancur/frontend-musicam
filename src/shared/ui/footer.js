import { config } from '../../core/config.js';
import { html } from '../utils/html.js';
import { fromHtml } from '../utils/dom.js';

export function createFooter() {
  const footer = fromHtml(
    html`<div class="container py-4 d-flex flex-column flex-md-row justify-content-between gap-2">
      <span class="text-muted-2">© ${new Date().getFullYear()} ${config.appName}</span>
      <span class="text-muted-2">Sin cuota fija: solo una comisión por boleto vendido.</span>
      <a
        href="${config.politicaDatosUrl}"
        ${config.politicaDatosExterna ? html`target="_blank" rel="noopener noreferrer"` : ''}
        >Tratamiento de datos</a
      >
    </div>`,
    'footer',
  );
  footer.classList.add('border-top', 'mt-5');
  return footer;
}
