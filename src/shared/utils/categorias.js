/** Categorías del contrato (enum de `Evento.categoria`) con su texto de interfaz. */
export const CATEGORIAS = [
  ['POP', 'Pop'],
  ['ROCK', 'Rock'],
  ['URBANO', 'Urbano'],
  ['ELECTRONICA', 'Electrónica'],
  ['SALSA_TROPICAL', 'Salsa y tropical'],
  ['FOLCLOR', 'Folclor'],
  ['JAZZ_BLUES', 'Jazz y blues'],
  ['CLASICA', 'Clásica'],
  ['OTRO', 'Otros'],
];

const ETIQUETAS = Object.fromEntries(CATEGORIAS);

export const esCategoriaValida = (valor) => valor in ETIQUETAS;

export const etiquetaCategoria = (codigo) => ETIQUETAS[codigo] ?? 'Otros';
