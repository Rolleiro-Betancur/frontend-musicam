/**
 * Enlaces principales según el rol (§4.4). Solo muestran u ocultan navegación: la seguridad real
 * la aplican los guards del router y, sobre todo, el backend.
 * @param {'USUARIO'|'ARTISTA'|'ADMIN'|undefined} rol
 * @returns {{href: string, texto: string}[]}
 */
export function enlacesPorRol(rol) {
  const base = [
    { href: '#/eventos', texto: 'Descubrir' },
    { href: '#/artistas', texto: 'Artistas' },
  ];
  if (rol === 'USUARIO' || rol === 'ARTISTA') {
    base.push({ href: '#/mis-eventos', texto: 'Mis eventos' });
    base.push({ href: '#/favoritos', texto: 'Favoritos' });
  }
  if (rol === 'ARTISTA') base.push({ href: '#/estudio', texto: 'Estudio' });
  if (rol === 'ADMIN') base.push({ href: '#/admin', texto: 'Administración' });
  return base;
}
