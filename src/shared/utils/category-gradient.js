// Pares de color por categoría (valores del OpenAPI). Decorativos, no llevan texto.
const PALETAS = {
  POP: ['#ff5fa2', '#6d4aff'],
  ROCK: ['#d91e32', '#2b1a4d'],
  URBANO: ['#ffb020', '#6d4aff'],
  ELECTRONICA: ['#18c9d6', '#6d4aff'],
  SALSA_TROPICAL: ['#ff7a3d', '#d91e32'],
  FOLCLOR: ['#2ecc8f', '#7a5a1f'],
  JAZZ_BLUES: ['#3d5afe', '#13131a'],
  CLASICA: ['#a898ff', '#252532'],
  OTRO: ['#6d4aff', '#13131a'],
};

function hash(texto) {
  let h = 0;
  for (const c of String(texto ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Degradado determinista por categoría, con variación de ángulo según el ID. */
export function categoryGradient(categoria, id = '') {
  const [a, b] = PALETAS[categoria] ?? PALETAS.OTRO;
  const angulo = 120 + (hash(id) % 120);
  return `linear-gradient(${angulo}deg, ${a} 0%, ${b} 100%)`;
}
