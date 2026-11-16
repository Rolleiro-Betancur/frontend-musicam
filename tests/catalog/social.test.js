import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../src/core/http/api-error.js';
import { cerrarSesion, iniciarSesion } from '../../src/core/session/session.js';
import { activarToggle } from '../../src/features/catalog/components/toggle-button.js';
import {
  crearConjuntoDeIds,
  favoritos,
  puedeUsarSocial,
} from '../../src/features/catalog/social.service.js';
import { favoriteButton } from '../../src/features/catalog/components/favorite-button.js';
import { followButton } from '../../src/features/catalog/components/follow-button.js';

const usuario = (extra = {}) => ({ id: 'u1', nombre: 'Ana', rol: 'USUARIO', ...extra });
const entrar = (extra) =>
  iniciarSesion({ access_token: 'a', refresh_token: 'r', usuario: usuario(extra) });

beforeEach(() => {
  cerrarSesion();
  globalThis.location = { hash: '#/eventos/e1' };
});

/** DOM mínimo para probar la delegación sin navegador. */
function crearEscenario({ activo = false } = {}) {
  const atributos = new Map();
  const boton = {
    dataset: { id: 'e1', activo: String(activo) },
    getAttribute: (n) => atributos.get(n) ?? null,
    setAttribute: (n, v) => atributos.set(n, String(v)),
    removeAttribute: (n) => atributos.delete(n),
    closest: () => boton,
  };
  const escuchas = new Set();
  const raiz = {
    addEventListener: (_t, fn) => escuchas.add(fn),
    removeEventListener: (_t, fn) => escuchas.delete(fn),
    contains: () => true,
  };
  const clic = () =>
    Promise.all([...escuchas].map((fn) => fn({ target: boton, preventDefault() {} })));
  return { boton, raiz, escuchas, clic };
}

function diferido() {
  let resolver;
  let rechazar;
  const promesa = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

test('cambio optimista: la interfaz cambia antes de que responda el servidor', async () => {
  entrar();
  const { boton, raiz, clic } = crearEscenario({ activo: false });
  const espera = diferido();
  const eventos = [];
  activarToggle(raiz, {
    selector: '[x]',
    aplicar: (_b, activo) => eventos.push(`aplicar:${activo}`),
    solicitar: (id, activo) => {
      eventos.push(`solicitar:${id}:${activo}`);
      return espera.promesa;
    },
    alOptimista: ({ activo }) => eventos.push(`optimista:${activo}`),
    alExito: ({ activo }) => eventos.push(`exito:${activo}`),
  });
  const terminado = clic();
  assert.deepEqual(eventos, ['aplicar:true', 'optimista:true', 'solicitar:e1:true']);
  assert.equal(boton.getAttribute('aria-busy'), 'true');
  espera.resolver();
  await terminado;
  assert.deepEqual(eventos.at(-1), 'exito:true');
  assert.equal(boton.getAttribute('aria-busy'), null);
});

test('si el servidor falla, se revierte, se avisa y el botón queda libre', async () => {
  entrar();
  const { boton, raiz, clic } = crearEscenario({ activo: true });
  const eventos = [];
  const avisos = [];
  activarToggle(raiz, {
    selector: '[x]',
    aplicar: (_b, activo) => eventos.push(`aplicar:${activo}`),
    solicitar: async () => {
      throw new ApiError({ status: 500, codigo: 'ERROR_INTERNO', mensaje: 'Falló el servidor.' });
    },
    alOptimista: ({ activo }) => eventos.push(`optimista:${activo}`),
    alRevertir: ({ activo }) => eventos.push(`revertir:${activo}`),
    alExito: () => eventos.push('exito'),
    avisar: (m) => avisos.push(m),
  });
  await clic();
  assert.deepEqual(eventos, ['aplicar:false', 'optimista:false', 'aplicar:true', 'revertir:true']);
  assert.deepEqual(avisos, ['Falló el servidor.']);
  assert.equal(boton.getAttribute('aria-busy'), null);
});

test('un segundo clic mientras hay una petición en curso se ignora (sin doble envío)', async () => {
  entrar();
  const { raiz, clic } = crearEscenario();
  const espera = diferido();
  let llamadas = 0;
  activarToggle(raiz, {
    selector: '[x]',
    aplicar() {},
    solicitar: () => {
      llamadas++;
      return espera.promesa;
    },
  });
  const primero = clic();
  await clic();
  assert.equal(llamadas, 1);
  espera.resolver();
  await primero;
});

test('una petición cancelada no revierte ni avisa', async () => {
  entrar();
  const { raiz, clic } = crearEscenario();
  const eventos = [];
  activarToggle(raiz, {
    selector: '[x]',
    aplicar: (_b, activo) => eventos.push(`aplicar:${activo}`),
    solicitar: async () => {
      throw new ApiError({ codigo: 'PETICION_CANCELADA', mensaje: 'cancelada' });
    },
    avisar: () => eventos.push('aviso'),
  });
  await clic();
  assert.deepEqual(eventos, ['aplicar:true']);
});

test('sin sesión lleva a iniciar sesión y no llama al servidor', async () => {
  const { raiz, clic } = crearEscenario();
  let llamadas = 0;
  activarToggle(raiz, { selector: '[x]', aplicar() {}, solicitar: async () => llamadas++ });
  await clic();
  assert.equal(llamadas, 0);
  assert.equal(globalThis.location.hash, '#/login?redirect=%23%2Feventos%2Fe1');
});

test('la función devuelta quita el listener (destroy)', () => {
  const { raiz, escuchas } = crearEscenario();
  const quitar = activarToggle(raiz, { selector: '[x]', aplicar() {}, solicitar: async () => {} });
  assert.equal(escuchas.size, 1);
  quitar();
  assert.equal(escuchas.size, 0);
});

test('conjunto de IDs: carga por páginas hasta agotarlas y no vuelve a pedir', async () => {
  entrar();
  const pedidas = [];
  const conjunto = crearConjuntoDeIds(async ({ page }) => {
    pedidas.push(page);
    return {
      items:
        page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` })) : [{ id: 'ultimo' }],
    };
  });
  const ids = await conjunto.asegurar();
  assert.equal(ids.size, 101);
  assert.deepEqual(pedidas, [1, 2]);
  await conjunto.asegurar();
  assert.deepEqual(pedidas, [1, 2], 'ya estaba cargado');
  assert.equal(conjunto.tiene('ultimo'), true);
  conjunto.fijar('ultimo', false);
  assert.equal(conjunto.tiene('ultimo'), false);
  conjunto.reiniciar();
  await conjunto.asegurar();
  assert.deepEqual(pedidas, [1, 2, 1, 2]);
});

test('conjunto de IDs: sin sesión o siendo ADMIN no llama a la API', async () => {
  let llamadas = 0;
  const conjunto = crearConjuntoDeIds(async () => {
    llamadas++;
    return { items: [] };
  });
  await conjunto.asegurar();
  entrar({ rol: 'ADMIN' });
  await conjunto.asegurar();
  assert.equal(llamadas, 0);
  assert.equal(puedeUsarSocial(), false);
});

test('conjunto de IDs: si la carga falla, se reintenta la próxima vez', async () => {
  entrar();
  let intentos = 0;
  const conjunto = crearConjuntoDeIds(async () => {
    intentos++;
    if (intentos === 1) throw new ApiError({ codigo: 'ERROR_RED', mensaje: 'red' });
    return { items: [{ id: 'e1' }] };
  });
  await assert.rejects(conjunto.asegurar(), (e) => e.codigo === 'ERROR_RED');
  await conjunto.asegurar();
  assert.equal(conjunto.tiene('e1'), true);
});

test('al cambiar de persona se descartan los favoritos en memoria', () => {
  entrar({ id: 'u1' });
  favoritos.fijar('e1', true);
  assert.equal(favoritos.tiene('e1'), true);
  entrar({ id: 'u2' });
  assert.equal(favoritos.tiene('e1'), false);
});

test('botón de favorito: estado, accesibilidad y roles', () => {
  entrar();
  const encendido = String(favoriteButton({ eventoId: 'e1', activo: true }));
  assert.ok(encendido.includes('aria-pressed="true"') && encendido.includes('bi-heart-fill'));
  assert.ok(encendido.includes('aria-label="Quitar de favoritos"'));
  assert.ok(encendido.includes('data-fav') && encendido.includes('data-id="e1"'));
  const apagado = String(favoriteButton({ eventoId: 'e1', activo: false }));
  assert.ok(
    apagado.includes('aria-pressed="false"') &&
      apagado.includes('aria-label="Agregar a favoritos"'),
  );
  const completo = String(favoriteButton({ eventoId: 'e1', activo: false, variante: 'completo' }));
  assert.ok(completo.includes('Guardar en favoritos'));

  entrar({ rol: 'ADMIN' });
  assert.equal(String(favoriteButton({ eventoId: 'e1' })), '', 'el administrador no ve favoritos');
  cerrarSesion();
  assert.ok(String(favoriteButton({ eventoId: 'e1' })).includes('data-fav'), 'sin sesión se ve');
});

test('botón Seguir: Siguiendo, perfil propio y administrador', () => {
  entrar({ id: 'u1' });
  const siguiendo = String(followButton({ artistaId: 'a1', siguiendo: true }));
  assert.ok(siguiendo.includes('Siguiendo') && siguiendo.includes('aria-pressed="true"'));
  assert.ok(
    String(followButton({ artistaId: 'a1' })).includes('>Seguir<') ||
      String(followButton({ artistaId: 'a1' })).includes('Seguir'),
  );
  assert.equal(String(followButton({ artistaId: 'u1' })), '', 'no se puede seguir a uno mismo');
  entrar({ rol: 'ADMIN' });
  assert.equal(String(followButton({ artistaId: 'a1' })), '');
});

test('los botones escapan el id que reciben', () => {
  entrar();
  const salida = String(favoriteButton({ eventoId: '"><script>x</script>' }));
  assert.ok(!salida.includes('<script>'));
});
