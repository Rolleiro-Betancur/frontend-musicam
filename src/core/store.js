/**
 * Store observable mínimo.
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    /** @param {Partial<T> | ((s: T) => Partial<T>)} patch */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state));
    },
    /** @param {(s: T) => void} fn @returns {() => void} función para cancelar */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
