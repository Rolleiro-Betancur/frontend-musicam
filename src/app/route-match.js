import { routes } from './routes.js';

/** Convierte `/eventos/:id` o `/estudio/*` en una expresión regular con sus parámetros. */
export function compilarRuta(path) {
  const nombres = [];
  const patron = path
    .split('/')
    .map((segmento) => {
      if (segmento === '*') return '(?:.*)';
      if (segmento.startsWith(':')) {
        nombres.push(segmento.slice(1));
        return '([^/]+)';
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${patron}/?$`), nombres };
}

/** @returns {{route: import('./routes.js').Route, params: Record<string,string>}|null} */
export function encontrarRuta(path, tabla = routes) {
  for (const route of tabla) {
    const { regex, nombres } = compilarRuta(route.path);
    const m = regex.exec(path);
    if (m) {
      const params = Object.fromEntries(nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      return { route, params };
    }
  }
  return null;
}
