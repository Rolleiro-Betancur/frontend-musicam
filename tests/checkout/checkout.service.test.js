import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../src/core/http/api-error.js';
import {
  accionTrasCompra,
  esperarMs,
  iniciarCompra,
  sondearCompra,
} from '../../src/features/checkout/checkout.service.js';

const compra = (extra = {}) => ({
  id: 'c1',
  evento_id: 'e1',
  referencia: 'conc-abc',
  monto_cop: 20000,
  estado: 'PENDIENTE',
  ...extra,
});
const evento = { id: 'e1', titulo: 'Concierto', precio_cop: 99999, estado: 'PROGRAMADO' };

/** Reloj falso: cada espera adelanta el tiempo sin esperar de verdad. */
function relojFalso() {
  let t = 0;
  const esperas = [];
  return {
    ahora: () => t,
    esperar: async (ms) => {
      esperas.push(ms);
      t += ms;
    },
    esperas,
  };
}

test('iniciarCompra usa el monto y la referencia de la respuesta del servidor', async () => {
  let enviado;
  const api = {
    crearCompra: async (eventoId, metodo) => {
      enviado = { eventoId, metodo };
      return { compra: compra({ monto_cop: 18000 }), checkout: {} };
    },
  };
  const r = await iniciarCompra(evento, 'NEQUI', undefined, api);
  assert.deepEqual(enviado, { eventoId: 'e1', metodo: 'NEQUI' });
  assert.equal(r.compra.monto_cop, 18000, 'no se usa el precio del evento (99999)');
  assert.equal(r.retomada, false);
});

test('COMPRA_DUPLICADA retoma la compra PENDIENTE existente del mismo evento', async () => {
  const consultas = [];
  const api = {
    crearCompra: async () => {
      throw new ApiError({ status: 409, codigo: 'COMPRA_DUPLICADA', mensaje: 'dup' });
    },
    listarMisCompras: async (params) => {
      consultas.push(params.estado);
      return {
        items: [compra({ id: 'otra', evento_id: 'e9' }), compra({ id: 'pend' })],
      };
    },
  };
  const r = await iniciarCompra(evento, 'CARD', undefined, api);
  assert.equal(r.retomada, true);
  assert.equal(r.compra.id, 'pend');
  assert.deepEqual(consultas, ['PENDIENTE']);
});

test('COMPRA_DUPLICADA con la compra ya APROBADA la devuelve para ofrecer "Ver ahora"', async () => {
  const api = {
    crearCompra: async () => {
      throw new ApiError({ status: 409, codigo: 'COMPRA_DUPLICADA', mensaje: 'dup' });
    },
    listarMisCompras: async ({ estado }) => ({
      items: estado === 'APROBADA' ? [compra({ id: 'ok', estado: 'APROBADA' })] : [],
    }),
  };
  const r = await iniciarCompra(evento, 'PSE', undefined, api);
  assert.equal(r.compra.estado, 'APROBADA');
  assert.equal(r.retomada, true);
});

test('COMPRA_DUPLICADA sin compra localizable propaga el error original', async () => {
  const api = {
    crearCompra: async () => {
      throw new ApiError({ status: 409, codigo: 'COMPRA_DUPLICADA', mensaje: 'dup' });
    },
    listarMisCompras: async () => ({ items: [] }),
  };
  await assert.rejects(
    iniciarCompra(evento, 'PSE', undefined, api),
    (e) => e.codigo === 'COMPRA_DUPLICADA',
  );
});

test('otros errores al comprar se propagan tal cual (p. ej. comprar el propio evento)', async () => {
  const api = {
    crearCompra: async () => {
      throw new ApiError({ status: 403, codigo: 'COMPRA_PROPIO_EVENTO', mensaje: 'x' });
    },
  };
  await assert.rejects(iniciarCompra(evento, 'CARD', undefined, api), (e) => e.status === 403);
});

test('sondearCompra consulta cada 1,5 s hasta que deja de ser PENDIENTE', async () => {
  const estados = ['PENDIENTE', 'PENDIENTE', 'APROBADA'];
  let llamadas = 0;
  const reloj = relojFalso();
  const api = { obtenerCompra: async () => compra({ estado: estados[llamadas++] }) };
  const r = await sondearCompra('c1', undefined, { api, ...reloj });
  assert.equal(r.compra.estado, 'APROBADA');
  assert.equal(r.agotado, false);
  assert.equal(llamadas, 3);
  assert.deepEqual(reloj.esperas, [1500, 1500]);
});

test('sondearCompra se rinde a los 30 s y avisa con agotado', async () => {
  let llamadas = 0;
  const reloj = relojFalso();
  const api = {
    obtenerCompra: async () => {
      llamadas++;
      return compra();
    },
  };
  const r = await sondearCompra('c1', undefined, { api, ...reloj });
  assert.equal(r.agotado, true);
  assert.equal(r.compra.estado, 'PENDIENTE');
  assert.equal(llamadas, 21, 'una consulta inicial y una por cada 1,5 s hasta 30 s');
});

test('sondearCompra tolera fallos de red aislados', async () => {
  let n = 0;
  const reloj = relojFalso();
  const api = {
    obtenerCompra: async () => {
      n++;
      if (n === 1 || n === 2) throw new ApiError({ codigo: 'ERROR_RED', mensaje: 'red' });
      return compra({ estado: 'RECHAZADA' });
    },
  };
  const r = await sondearCompra('c1', undefined, { api, ...reloj });
  assert.equal(r.compra.estado, 'RECHAZADA');
});

test('sondearCompra falla tras 3 errores seguidos y ante 404/403', async () => {
  const reloj = relojFalso();
  const red = {
    obtenerCompra: async () => {
      throw new ApiError({ codigo: 'ERROR_RED', mensaje: 'red' });
    },
  };
  await assert.rejects(
    sondearCompra('c1', undefined, { api: red, ...reloj }),
    (e) => e.codigo === 'ERROR_RED',
  );
  const noExiste = {
    obtenerCompra: async () => {
      throw new ApiError({ status: 404, codigo: 'COMPRA_NO_ENCONTRADA', mensaje: 'x' });
    },
  };
  await assert.rejects(
    sondearCompra('c1', undefined, { api: noExiste, ...reloj }),
    (e) => e.status === 404,
  );
});

test('sondearCompra se detiene al cancelarse la señal', async () => {
  const controlador = new AbortController();
  let llamadas = 0;
  const api = {
    obtenerCompra: async () => {
      llamadas++;
      return compra();
    },
  };
  const promesa = sondearCompra('c1', controlador.signal, { api, intervaloMs: 5000 });
  await new Promise((r) => setTimeout(r, 20));
  controlador.abort();
  await assert.rejects(promesa, (e) => e.cancelada === true);
  assert.equal(llamadas, 1);
});

test('esperarMs resuelve y rechaza como cancelada con una señal ya abortada', async () => {
  await esperarMs(5);
  const c = new AbortController();
  c.abort();
  await assert.rejects(esperarMs(1000, c.signal), (e) => e.cancelada === true);
});

test('accionTrasCompra: Ver ahora / Ver cuando empiece / Ver replay según el evento', () => {
  assert.equal(accionTrasCompra({ id: 'e1', estado: 'EN_VIVO' }).texto, 'Ver ahora');
  assert.equal(accionTrasCompra({ id: 'e1', estado: 'PROGRAMADO' }).texto, 'Ver cuando empiece');
  assert.equal(accionTrasCompra({ id: 'e1', estado: 'FINALIZADO' }).texto, 'Ver replay');
  assert.equal(accionTrasCompra({ id: 'e 1', estado: 'EN_VIVO' }).href, '#/ver/e%201');
});
