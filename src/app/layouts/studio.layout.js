import { createShell } from './public.layout.js';
import { createPanelNav } from './panel-nav.js';

/** Estudio del artista: barra lateral fija en escritorio y offcanvas en móvil. */
export function createStudioLayout() {
  const nav = createPanelNav({
    titulo: 'Estudio',
    offcanvas: true,
    enlaces: [
      { href: '#/estudio', texto: 'Resumen', icono: 'bi-speedometer2' },
      { href: '#/estudio/eventos', texto: 'Eventos', icono: 'bi-calendar-event' },
      { href: '#/estudio/finanzas', texto: 'Finanzas', icono: 'bi-wallet2' },
    ],
  });
  const shell = createShell({ conBarraLateral: nav.el, botonMovil: nav.boton });
  return {
    ...shell,
    destroy() {
      nav.destroy();
      shell.destroy();
    },
  };
}
