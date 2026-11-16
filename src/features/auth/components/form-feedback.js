import { setFieldError } from '../../../shared/ui/form-field.js';

/** Alerta general del formulario (`role="alert"`). Usa textContent: nunca interpreta HTML. */
export function mostrarAlerta(alerta, mensaje) {
  alerta.textContent = mensaje || '';
  alerta.hidden = !mensaje;
}

/**
 * Pinta los errores por campo; lo que no tenga campo visible se suma a la alerta general.
 * Devuelve el primer control con error para llevarle el foco.
 */
export function aplicarErrores(form, alerta, { campos, general }) {
  const sueltos = [];
  let primero = null;
  for (const [campo, mensaje] of Object.entries(campos)) {
    const input = form.elements[campo];
    if (input && form.querySelector(`[data-field="${campo}"]`)) {
      setFieldError(form, campo, mensaje);
      primero ??= input;
    } else {
      sueltos.push(mensaje);
    }
  }
  mostrarAlerta(alerta, [general, ...sueltos].filter(Boolean).join(' '));
  return primero;
}

/** Deshabilita el botón de envío mientras hay una petición en curso (evita doble envío). */
export function marcarOcupado(boton, ocupado, textoOcupado) {
  boton.disabled = ocupado;
  if (!boton.dataset.texto) boton.dataset.texto = boton.textContent.trim();
  boton.textContent = ocupado ? textoOcupado : boton.dataset.texto;
  boton.setAttribute('aria-busy', String(ocupado));
}
