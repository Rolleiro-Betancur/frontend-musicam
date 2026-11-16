import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../../src/shared/utils/html.js';
import { eventCard } from '../../src/shared/ui/event-card.js';
import { partesRestantes } from '../../src/shared/ui/countdown.js';
import { categoryGradient } from '../../src/shared/utils/category-gradient.js';
import { mediaUrl } from '../../src/shared/utils/media-url.js';

const base = {
  id: 'abc-123',
  titulo: 'Concierto',
  categoria: 'ROCK',
  portada_url: null,
  precio_cop: 20000,
  fecha_inicio: '2026-12-05T01:00:00+00:00',
  estado: 'PROGRAMADO',
  replay_disponible: false,
  artista: { id: 'a', nombre_artistico: 'Los Cumbieros', foto_url: null },
};
const normal = (s) => String(s).replace(/\s/g, ' ');

test('la tarjeta escapa título y artista que vienen de la API', () => {
  const salida = String(
    eventCard({
      ...base,
      titulo: '<img src=x onerror=alert(1)>',
      artista: { ...base.artista, nombre_artistico: '"><script>x</script>' },
    }),
  );
  assert.ok(!salida.includes('<img src=x'));
  assert.ok(!salida.includes('<script>'));
  assert.ok(salida.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('muestra precio en COP y fecha en hora de Bogotá; el corazón lo aporta quien la usa', () => {
  const salida = normal(eventCard(base));
  assert.ok(salida.includes('$ 20.000'));
  assert.ok(salida.includes('4 de dic de 2026, 08:00 p. m.'));
  assert.ok(!salida.includes('<button'), 'sin corazón si nadie lo aporta');
  const conCorazon = String(eventCard(base, { favorito: html`<button data-fav>♥</button>` }));
  assert.ok(conCorazon.includes('<button data-fav>♥</button>'));
});

test('insignias: EN VIVO, REPLAY y fecha', () => {
  assert.ok(String(eventCard({ ...base, estado: 'EN_VIVO' })).includes('EN VIVO'));
  const conReplay = { ...base, estado: 'FINALIZADO', replay_disponible: true };
  assert.ok(String(eventCard(conReplay)).includes('REPLAY'));
  const sinReplay = { ...base, estado: 'FINALIZADO', replay_disponible: false };
  assert.ok(!String(eventCard(sinReplay)).includes('REPLAY'));
});

test('portada: sin imagen o con URL insegura usa solo el degradado', () => {
  assert.ok(!String(eventCard(base)).includes('<img'));
  assert.ok(!String(eventCard({ ...base, portada_url: 'http://malo.com/a.jpg' })).includes('<img'));
  assert.ok(!String(eventCard({ ...base, portada_url: 'javascript:alert(1)' })).includes('<img'));
  const con = String(eventCard({ ...base, portada_url: 'https://cdn.com/a.jpg' }));
  assert.ok(con.includes('<img') && con.includes('loading="lazy"') && con.includes('no-referrer'));
  assert.ok(con.includes('linear-gradient'));
});

test('partesRestantes descompone y nunca da negativos', () => {
  const ms = ((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000;
  assert.deepEqual(partesRestantes(ms), {
    dias: 1,
    horas: 2,
    minutos: 3,
    segundos: 4,
    terminado: false,
  });
  assert.equal(partesRestantes(-5000).terminado, true);
  assert.equal(partesRestantes(0).segundos, 0);
});

test('category-gradient es determinista y varía con la categoría y el ID', () => {
  assert.equal(categoryGradient('ROCK', 'x'), categoryGradient('ROCK', 'x'));
  assert.notEqual(categoryGradient('ROCK', 'x'), categoryGradient('POP', 'x'));
  assert.ok(categoryGradient('NO_EXISTE', 'x').startsWith('linear-gradient('));
});

test('mediaUrl: relativa al origen de la API, rechaza esquemas inseguros', () => {
  assert.equal(mediaUrl('/uploads/a.webp', 'http://api.test'), 'http://api.test/uploads/a.webp');
  assert.equal(mediaUrl('https://cdn.com/a.jpg', 'http://api.test'), 'https://cdn.com/a.jpg');
  assert.equal(mediaUrl('http://malo.com/a.jpg', 'http://api.test'), null);
  assert.equal(mediaUrl('javascript:alert(1)', 'http://api.test'), null);
  assert.equal(mediaUrl(null), null);
});
