import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  elegirHero,
  estadoAccion,
  filtrosAParams,
  filtrosAQuery,
  hayFiltros,
  leerFiltros,
  validarRango,
} from '../../src/features/catalog/catalog.service.js';

const evento = (extra = {}) => ({
  id: 'e1',
  artista: { id: 'a1', nombre_artistico: 'Los Cumbieros', foto_url: null },
  estado: 'PROGRAMADO',
  replay_disponible: false,
  suspendido_admin: false,
  comprado: false,
  ...extra,
});
const usuario = (extra = {}) => ({ id: 'u1', rol: 'USUARIO', ...extra });

test('sin sesión: iniciar sesión para comprar', () => {
  assert.equal(estadoAccion(evento(), null).tipo, 'LOGIN');
  assert.equal(estadoAccion(evento({ estado: 'EN_VIVO' }), null).tipo, 'LOGIN');
});

test('con sesión y sin compra: comprar', () => {
  assert.equal(estadoAccion(evento(), usuario()).tipo, 'COMPRAR');
  assert.equal(estadoAccion(evento({ estado: 'EN_VIVO' }), usuario()).tipo, 'COMPRAR');
});

test('comprado: ver ahora, ver cuando empiece o ver replay según el estado', () => {
  const c = { comprado: true };
  assert.equal(estadoAccion(evento({ ...c, estado: 'EN_VIVO' }), usuario()).tipo, 'VER_AHORA');
  assert.equal(
    estadoAccion(evento({ ...c, estado: 'PROGRAMADO' }), usuario()).tipo,
    'VER_CUANDO_EMPIECE',
  );
  assert.equal(
    estadoAccion(evento({ ...c, estado: 'FINALIZADO', replay_disponible: true }), usuario()).tipo,
    'VER_REPLAY',
  );
});

test('finalizado con replay y sin compra: comprar (RN-07 permite comprar el replay)', () => {
  const e = evento({ estado: 'FINALIZADO', replay_disponible: true });
  assert.equal(estadoAccion(e, usuario()).tipo, 'COMPRAR');
});

test('el dueño siempre ve gestionar', () => {
  const dueno = usuario({ id: 'a1', rol: 'ARTISTA' });
  assert.equal(estadoAccion(evento(), dueno).tipo, 'GESTIONAR');
  assert.equal(estadoAccion(evento({ estado: 'BORRADOR' }), dueno).tipo, 'GESTIONAR');
  assert.equal(estadoAccion(evento({ suspendido_admin: true }), dueno).tipo, 'GESTIONAR');
});

test('otro artista no es dueño: puede comprar', () => {
  assert.equal(estadoAccion(evento(), usuario({ id: 'a2', rol: 'ARTISTA' })).tipo, 'COMPRAR');
});

test('no disponible: suspendido, cancelado, borrador y finalizado sin replay', () => {
  const casos = [
    evento({ suspendido_admin: true }),
    evento({ estado: 'CANCELADO' }),
    evento({ estado: 'BORRADOR' }),
    evento({ estado: 'FINALIZADO', replay_disponible: false }),
  ];
  for (const e of casos) {
    for (const u of [null, usuario()]) {
      const accion = estadoAccion(e, u);
      assert.equal(accion.tipo, 'NO_DISPONIBLE');
      assert.ok(accion.mensaje);
    }
  }
});

test('un evento suspendido no se muestra como comprable aunque ya esté comprado', () => {
  assert.equal(
    estadoAccion(evento({ suspendido_admin: true, comprado: true }), usuario()).tipo,
    'NO_DISPONIBLE',
  );
});

test('el administrador no compra', () => {
  assert.equal(estadoAccion(evento(), usuario({ rol: 'ADMIN' })).tipo, 'ADMIN');
});

test('leerFiltros descarta valores inválidos de la URL', () => {
  const f = leerFiltros(
    new URLSearchParams(
      'q=%20rock%20&categoria=NOEXISTE&estado=BORRADOR&desde=ayer&hasta=2026-12-31&page=-3',
    ),
  );
  assert.deepEqual(f, {
    q: 'rock',
    categoria: '',
    estado: '',
    desde: '',
    hasta: '2026-12-31',
    page: 1,
  });
});

test('leerFiltros acepta valores válidos', () => {
  const f = leerFiltros(new URLSearchParams('categoria=SALSA_TROPICAL&estado=EN_VIVO&page=3'));
  assert.equal(f.categoria, 'SALSA_TROPICAL');
  assert.equal(f.estado, 'EN_VIVO');
  assert.equal(f.page, 3);
});

test('filtrosAQuery omite vacíos y la página 1; ida y vuelta con leerFiltros', () => {
  assert.equal(filtrosAQuery(leerFiltros(new URLSearchParams())), '');
  const original = {
    q: 'a b',
    categoria: 'ROCK',
    estado: '',
    desde: '2026-12-01',
    hasta: '',
    page: 2,
  };
  const query = filtrosAQuery(original);
  assert.equal(query, '?q=a+b&categoria=ROCK&desde=2026-12-01&page=2');
  assert.deepEqual(leerFiltros(new URLSearchParams(query)), original);
});

test('filtrosAParams convierte los días de Bogotá a ISO UTC', () => {
  const p = filtrosAParams({
    q: '',
    categoria: '',
    estado: '',
    desde: '2026-12-04',
    hasta: '2026-12-05',
    page: 2,
  });
  assert.equal(p.desde, '2026-12-04T05:00:00.000Z');
  assert.equal(p.hasta, '2026-12-06T04:59:00.000Z');
  assert.equal(p.page, 2);
  assert.equal(p.page_size, 12);
});

test('validarRango y hayFiltros', () => {
  assert.ok(validarRango({ desde: '2026-12-10', hasta: '2026-12-01' }));
  assert.equal(validarRango({ desde: '2026-12-01', hasta: '2026-12-10' }), null);
  assert.equal(validarRango({ desde: '', hasta: '2026-12-10' }), null);
  const vacio = { q: '', categoria: '', estado: '', desde: '', hasta: '' };
  assert.equal(hayFiltros({ ...vacio, page: 4 }), false);
  assert.equal(hayFiltros({ ...vacio, q: 'x', page: 1 }), true);
});

test('elegirHero prefiere el evento en vivo y luego el más cercano', () => {
  const vivo = { id: 'v' };
  const prox = { id: 'p' };
  assert.equal(elegirHero({ vivos: [vivo], proximos: [prox] }), vivo);
  assert.equal(elegirHero({ vivos: [], proximos: [prox, { id: 'q' }] }), prox);
  assert.equal(elegirHero({ vivos: [], proximos: [] }), null);
});
