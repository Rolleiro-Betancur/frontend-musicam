const handlers = new Map();

/** @returns {() => void} función para cancelar la suscripción */
export function on(evento, fn) {
  if (!handlers.has(evento)) handlers.set(evento, new Set());
  handlers.get(evento).add(fn);
  return () => off(evento, fn);
}

export function off(evento, fn) {
  handlers.get(evento)?.delete(fn);
}

export function emit(evento, detalle) {
  handlers.get(evento)?.forEach((fn) => fn(detalle));
}
