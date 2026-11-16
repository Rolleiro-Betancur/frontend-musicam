import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './shared/styles/tokens.css';
import './shared/styles/bootstrap-overrides.css';
import './shared/styles/base.css';
import './shared/styles/components.css';

import { config } from './core/config.js';
import { on } from './core/event-bus.js';
import { restaurarSesion } from './core/session/session.js';
import { showToast } from './shared/ui/toast.js';
import { createRouter } from './app/router.js';

document.title = config.appName;

// El enlace "Saltar al contenido" no puede usar un hash: lo interpretaría el router.
document.querySelector('.skip-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('outlet')?.focus();
});

// Cierre de sesión forzado (token vencido o cuenta suspendida): se avisa; los guards redirigen.
on('session:cerrada', ({ motivo, mensaje }) => {
  if (motivo === 'voluntario') {
    showToast('Cerraste sesión.', 'info');
    return;
  }
  showToast(mensaje || 'Tu sesión se cerró.', motivo === 'suspendida' ? 'danger' : 'warning');
});

async function arrancar() {
  const router = createRouter(document.getElementById('app'));
  router.mostrarCarga(); // skeleton mientras se rehidrata la sesión (§4.3)
  await restaurarSesion();
  await router.start();
}

arrancar();
