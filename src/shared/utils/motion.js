/** ¿La persona pidió menos movimiento (`prefers-reduced-motion`)? */
export function prefiereMenosMovimiento() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Valor de `behavior` para `scrollIntoView`/`scrollBy`. El CSS no basta: un `behavior: 'smooth'`
 * escrito en JS ignora `scroll-behavior: auto`, así que se decide aquí.
 * @returns {'auto'|'smooth'}
 */
export function comportamientoDeScroll() {
  return prefiereMenosMovimiento() ? 'auto' : 'smooth';
}

/** Lleva un elemento a la vista respetando `prefers-reduced-motion`. */
export function irAlInicioDe(el) {
  el.scrollIntoView({ behavior: comportamientoDeScroll(), block: 'start' });
}
