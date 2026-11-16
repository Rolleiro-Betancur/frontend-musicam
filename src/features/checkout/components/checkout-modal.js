import '../checkout.css';
import { emit, on } from '../../../core/event-bus.js';
import { isAuthenticated } from '../../../core/session/session.js';
import { setHtml } from '../../../shared/utils/dom.js';
import { openModal } from '../../../shared/ui/modal.js';
import { simularPago } from '../checkout.api.js';
import { RESULTADO_POR_ACCION, iniciarCompra, sondearCompra } from '../checkout.service.js';
import {
  vistaError,
  vistaMetodo,
  vistaPasarela,
  vistaProcesando,
  vistaResultado,
  vistaTardando,
} from './checkout-views.js';

/** @type {{cerrar: () => void, cerrado: Promise<{compra: object|null}>}|null} */
let activo = null;

/**
 * Abre el modal de checkout (§5.2). Devuelve un manejador: `cerrar()` y `cerrado`, que se
 * resuelve con la última compra conocida al cerrarse. Al aprobarse el pago emite
 * `compra:aprobada` para que otras pantallas (el detalle) se actualicen solas (C3).
 * @param {{id: string, titulo: string, precio_cop: number, estado: string, artista?: object}} evento
 */
export function abrirCheckout(evento) {
  if (activo) return activo;
  if (!isAuthenticated()) {
    location.hash = `#/login?redirect=${encodeURIComponent(`#/eventos/${evento.id}`)}`;
    return { cerrar() {}, cerrado: Promise.resolve({ compra: null }) };
  }

  const controlador = new AbortController();
  const { signal } = controlador;
  const cuerpo = document.createElement('div');
  cuerpo.setAttribute('aria-live', 'polite');
  const modal = openModal({ titulo: 'Comprar entrada', cuerpo });

  let compra = null;
  let metodo = 'NEQUI';
  let ocupado = false;

  function mostrar(vista) {
    setHtml(cuerpo, vista);
    cuerpo.querySelector('[data-foco]')?.focus();
  }

  function mostrarMetodo(aviso = '') {
    mostrar(vistaMetodo({ evento, metodo, aviso }));
  }

  function mostrarResultado() {
    if (compra.estado === 'APROBADA') emit('compra:aprobada', { compra, eventoId: evento.id });
    mostrar(vistaResultado({ evento, compra }));
  }

  /** Muestra el paso que corresponde al estado actual de la compra. */
  function segunEstado() {
    if (compra.estado === 'PENDIENTE') mostrar(vistaPasarela({ evento, compra }));
    else mostrarResultado();
  }

  function fallo(error, accion) {
    if (error.cancelada) return;
    mostrar(vistaError({ mensaje: error.mensaje, accion }));
  }

  /** Ejecuta un paso con los botones bloqueados (la vista de espera los reemplaza). */
  async function ejecutar(textoEspera, paso, accionSiFalla) {
    if (ocupado) return;
    ocupado = true;
    mostrar(vistaProcesando(textoEspera));
    try {
      await paso();
    } catch (error) {
      fallo(error, accionSiFalla);
    } finally {
      ocupado = false;
    }
  }

  async function esperarConfirmacion() {
    const resultado = await sondearCompra(compra.id, signal);
    compra = resultado.compra;
    if (resultado.agotado) mostrar(vistaTardando());
    else mostrarResultado();
  }

  const acciones = {
    continuar: () => {
      const elegido = cuerpo.querySelector('input[name="metodo"]:checked');
      metodo = elegido?.value ?? metodo;
      return ejecutar(
        'Creando tu compra…',
        async () => {
          const r = await iniciarCompra(evento, metodo, signal);
          compra = r.compra;
          segunEstado();
        },
        'reintentar',
      );
    },
    'seguir-esperando': () => ejecutar('Confirmando tu pago…', esperarConfirmacion, 'comprobar'),
    comprobar: () => ejecutar('Consultando tu compra…', esperarConfirmacion, 'comprobar'),
    reintentar: () => mostrarMetodo(),
    cerrar: () => modal.cerrar(),
    ir: () => modal.cerrar(), // el enlace navega por su href
  };

  for (const [accion, resultado] of Object.entries(RESULTADO_POR_ACCION)) {
    acciones[accion] = () =>
      ejecutar(
        'Procesando tu pago…',
        async () => {
          compra = await simularPago(compra.referencia, resultado, signal);
          // El simulador ya devuelve la compra procesada; solo se sondea si sigue PENDIENTE.
          if (compra.estado === 'PENDIENTE') await esperarConfirmacion();
          else mostrarResultado();
        },
        'comprobar',
      );
  }

  const alClic = (e) => {
    const boton = e.target.closest('[data-action]');
    if (boton && cuerpo.contains(boton)) acciones[boton.dataset.action]?.();
  };
  cuerpo.addEventListener('click', alClic);

  // Si cambia la ruta o se cierra la sesión mientras el modal está abierto, se cierra.
  const alCambiarHash = () => modal.cerrar();
  window.addEventListener('hashchange', alCambiarHash);
  const quitarSesion = on('session:cerrada', () => modal.cerrar());

  mostrarMetodo();

  const manejador = {
    cerrar: () => modal.cerrar(),
    cerrado: modal.cerrado.then(() => {
      controlador.abort(); // detiene sondeos y peticiones pendientes
      cuerpo.removeEventListener('click', alClic);
      window.removeEventListener('hashchange', alCambiarHash);
      quitarSesion();
      activo = null;
      return { compra };
    }),
  };
  activo = manejador;
  return manejador;
}
