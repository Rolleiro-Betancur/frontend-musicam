import { createShell } from './public.layout.js';
import { createPanelNav } from './panel-nav.js';

/** Administración: barra lateral fija en escritorio y offcanvas en móvil. */
export function createAdminLayout() {
  const nav = createPanelNav({
    titulo: 'Administración',
    offcanvas: true,
    enlaces: [
      { href: '#/admin', texto: 'Dashboard', icono: 'bi-bar-chart' },
      { href: '#/admin/usuarios', texto: 'Usuarios', icono: 'bi-people' },
      { href: '#/admin/eventos', texto: 'Eventos', icono: 'bi-calendar-event' },
      { href: '#/admin/compras', texto: 'Compras', icono: 'bi-receipt' },
      { href: '#/admin/retiros', texto: 'Retiros', icono: 'bi-cash-coin' },
      { href: '#/admin/configuracion', texto: 'Configuración', icono: 'bi-gear' },
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
