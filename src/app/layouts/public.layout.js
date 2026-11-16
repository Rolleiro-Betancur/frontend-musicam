import { createNavbar } from '../../shared/ui/navbar.js';
import { createFooter } from '../../shared/ui/footer.js';

/**
 * Estructura común: navbar + `main#outlet` + footer.
 * Con `conBarraLateral` añade una columna lateral; `botonMovil` (opcional) se coloca sobre el
 * contenido y solo se ve en pantallas pequeñas.
 */
export function createShell({ conBarraLateral, botonMovil } = {}) {
  const raiz = document.createElement('div');
  raiz.className = 'app-shell';
  const navbar = createNavbar();
  const main = document.createElement('main');
  main.id = 'outlet';
  main.tabIndex = -1;
  const footer = createFooter();

  if (conBarraLateral) {
    const contenedor = document.createElement('div');
    contenedor.className = 'container py-4';
    const rejilla = document.createElement('div');
    rejilla.className = 'panel-layout';
    const columna = document.createElement('div');
    columna.className = 'panel-main';
    if (botonMovil) columna.append(botonMovil);
    columna.append(main);
    rejilla.append(conBarraLateral, columna);
    contenedor.append(rejilla);
    raiz.append(navbar.el, contenedor, footer);
  } else {
    raiz.append(navbar.el, main, footer);
  }
  return { el: raiz, outlet: main, destroy: () => navbar.destroy() };
}

export function createPublicLayout() {
  return createShell();
}
