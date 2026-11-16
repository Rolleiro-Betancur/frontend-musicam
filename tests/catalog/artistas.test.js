import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  artistasAQuery,
  leerFiltrosArtistas,
  textoSeguidores,
} from '../../src/features/catalog/catalog.service.js';
import { html } from '../../src/shared/utils/html.js';
import { artistCard } from '../../src/shared/ui/artist-card.js';
import { encontrarRuta } from '../../src/app/route-match.js';

test('leerFiltrosArtistas recorta, limita y descarta páginas inválidas', () => {
  const f = leerFiltrosArtistas(new URLSearchParams(`q=%20luna%20&page=abc`));
  assert.deepEqual(f, { q: 'luna', page: 1 });
  assert.equal(leerFiltrosArtistas(new URLSearchParams('q=' + 'x'.repeat(300))).q.length, 100);
  assert.equal(leerFiltrosArtistas(new URLSearchParams('page=4')).page, 4);
});

test('artistasAQuery omite vacíos y la página 1; ida y vuelta', () => {
  assert.equal(artistasAQuery({ q: '', page: 1 }), '');
  const query = artistasAQuery({ q: 'luna c', page: 2 });
  assert.equal(query, '?q=luna+c&page=2');
  assert.deepEqual(leerFiltrosArtistas(new URLSearchParams(query)), { q: 'luna c', page: 2 });
});

test('textoSeguidores usa singular y plural', () => {
  assert.equal(textoSeguidores(0), '0 seguidores');
  assert.equal(textoSeguidores(1), '1 seguidor');
  assert.equal(textoSeguidores(87), '87 seguidores');
});

test('la tarjeta de artista escapa nombre y biografía y acepta el botón de la feature', () => {
  const salida = String(
    artistCard({
      id: 'a-1',
      nombre_artistico: '<b onmouseover=alert(1)>Luna</b>',
      foto_url: null,
      biografia: '"><script>x</script>',
    }),
  );
  assert.ok(!salida.includes('<script>'));
  assert.ok(!salida.includes('<b onmouseover'));
  assert.ok(salida.includes('href="#/artistas/a-1"'));
  assert.ok(!salida.includes('<button'), 'sin botón si nadie lo aporta');
  const conBoton = String(
    artistCard(
      { id: 'a-1', nombre_artistico: 'Luna', foto_url: null },
      { accion: html`<button data-seguir>Seguir</button>` },
    ),
  );
  assert.ok(conBoton.includes('<button data-seguir>Seguir</button>'));
});

test('el router resuelve /artistas y /artistas/:id (y no confunde /artistas/me)', () => {
  assert.equal(encontrarRuta('/artistas')?.route.path, '/artistas');
  const detalle = encontrarRuta('/artistas/6e421db5-0e6a');
  assert.equal(detalle.route.path, '/artistas/:id');
  assert.equal(detalle.params.id, '6e421db5-0e6a');
});
