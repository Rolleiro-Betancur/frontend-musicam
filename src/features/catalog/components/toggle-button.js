import { isAuthenticated } from '../../../core/session/session.js';

/** Aviso por defecto: carga el toast solo si hace falta (así este módulo no depende del DOM al importarse). */
const avisarPorDefecto = (mensaje) =>
  import('../../../shared/ui/toast.js').then((m) => m.showToast(mensaje, 'danger'));

/**
 * Activa, por delegación en `raiz`, los botones que alternan un estado (favorito, seguir) con
 * cambio optimista: la interfaz cambia al instante y, si el servidor falla, se revierte y se avisa.
 *
 * Cada botón lleva `data-id` y `data-activo="true|false"`. Mientras hay una petición en curso el
 * botón ignora más clics (`aria-busy`), sin deshabilitarse para no perder el foco.
 *
 * @param {Element} raiz
 * @param {{
 *   selector: string,
 *   aplicar: (boton: HTMLElement, activo: boolean) => void,
 *   solicitar: (id: string, activo: boolean) => Promise<void>,
 *   alOptimista?: (datos: {id: string, activo: boolean, boton: HTMLElement}) => void,
 *   alRevertir?: (datos: {id: string, activo: boolean, boton: HTMLElement}) => void,
 *   alExito?: (datos: {id: string, activo: boolean, boton: HTMLElement}) => void,
 *   avisar?: (mensaje: string) => void,
 * }} config
 * @returns {() => void} función para quitar el listener (va en `destroy()`)
 */
export function activarToggle(raiz, config) {
  const alClic = async (e) => {
    const boton = e.target.closest?.(config.selector);
    if (!boton || !raiz.contains(boton)) return;
    e.preventDefault();

    if (!isAuthenticated()) {
      location.hash = `#/login?redirect=${encodeURIComponent(location.hash || '#/')}`;
      return;
    }
    if (boton.getAttribute('aria-busy') === 'true') return;

    const id = boton.dataset.id;
    const previo = boton.dataset.activo === 'true';
    const nuevo = !previo;
    const datos = { id, boton };

    boton.setAttribute('aria-busy', 'true');
    config.aplicar(boton, nuevo);
    config.alOptimista?.({ ...datos, activo: nuevo });
    try {
      await config.solicitar(id, nuevo);
      config.alExito?.({ ...datos, activo: nuevo });
    } catch (error) {
      if (error.cancelada) return;
      config.aplicar(boton, previo); // se revierte lo que se mostró de forma optimista
      config.alRevertir?.({ ...datos, activo: previo });
      (config.avisar ?? avisarPorDefecto)(error.mensaje);
    } finally {
      boton.removeAttribute('aria-busy');
    }
  };
  raiz.addEventListener('click', alClic);
  return () => raiz.removeEventListener('click', alClic);
}
