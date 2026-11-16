import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accionDeCompra,
  agruparPorDia,
  armarMes,
  cargarPagosPendientes,
  cargarProximos,
  cargarTodasLasCompras,
  claveDia,
  esHistorial,
  esPagoPendiente,
  esProxima,
  etiquetaDiaLarga,
  etiquetaMes,
  filtrarHistorial,
  hoyBogota,
  mesInicial,
  moverMes,
  paginarLocal,
} from '../../src/features/account/tickets.service.js';

const compra = (estado, evento = {}, extra = {}) => ({
  id: `c-${Math.random().toString(36).slice(2, 8)}`,
  estado,
  monto_cop: 20000,
  evento: {
    id: 'e1',
    estado: 'PROGRAMADO',
    replay_disponible: false,
    fecha_inicio: '2026-12-05T01:00:00+00:00',
    ...evento,
  },
  ...extra,
});

test('clasificación: próximas, pagos pendientes e historial', () => {
  assert.equal(esProxima(compra('APROBADA')), true);
  assert.equal(esProxima(compra('APROBADA', { estado: 'EN_VIVO' })), true);
  assert.equal(esProxima(compra('APROBADA', { estado: 'FINALIZADO' })), false);
  assert.equal(esProxima(compra('PENDIENTE')), false);

  assert.equal(esPagoPendiente(compra('PENDIENTE')), true);
  assert.equal(esPagoPendiente(compra('PENDIENTE', { estado: 'CANCELADO' })), false);
  assert.equal(esPagoPendiente(compra('PENDIENTE', { estado: 'FINALIZADO' })), false);
  assert.equal(
    esPagoPendiente(compra('PENDIENTE', { estado: 'FINALIZADO', replay_disponible: true })),
    true,
  );

  for (const estado of ['RECHAZADA', 'ANULADA', 'REEMBOLSADA']) {
    assert.equal(esHistorial(compra(estado)), true, estado);
  }
  assert.equal(esHistorial(compra('APROBADA', { estado: 'FINALIZADO' })), true);
  assert.equal(esHistorial(compra('APROBADA')), false, 'una próxima no es historial');
  assert.equal(esHistorial(compra('PENDIENTE')), false, 'un pago pendiente no es historial');
});

test('acción correcta según la compra y el estado del evento', () => {
  const ver = (c) => accionDeCompra(c);
  assert.deepEqual(ver(compra('APROBADA', { estado: 'EN_VIVO' })), {
    tipo: 'VER',
    texto: 'Ver ahora',
    href: '#/ver/e1',
  });
  assert.equal(ver(compra('APROBADA')).texto, 'Ver cuando empiece');
  const replay = ver(compra('APROBADA', { estado: 'FINALIZADO', replay_disponible: true }));
  assert.equal(replay.texto, 'Ver replay');
  assert.equal(ver(compra('PENDIENTE')).tipo, 'COMPLETAR_PAGO');
  assert.equal(ver(compra('PENDIENTE')).texto, 'Completar pago');
});

test('sin acción: rechazadas, anuladas, reembolsadas y eventos sin reproducción', () => {
  for (const estado of ['RECHAZADA', 'ANULADA', 'REEMBOLSADA']) {
    assert.equal(accionDeCompra(compra(estado)).tipo, 'NINGUNA', estado);
  }
  const sinReplay = accionDeCompra(compra('APROBADA', { estado: 'FINALIZADO' }));
  assert.equal(sinReplay.tipo, 'NINGUNA');
  assert.ok(sinReplay.texto);
  const cancelado = accionDeCompra(compra('PENDIENTE', { estado: 'CANCELADO' }));
  assert.equal(cancelado.tipo, 'NINGUNA');
});

test('filtrarHistorial filtra por estado de la compra y excluye lo que va en otras pestañas', () => {
  const todas = [
    compra('APROBADA'), // próxima: no entra
    compra('APROBADA', { estado: 'FINALIZADO' }),
    compra('RECHAZADA'),
    compra('ANULADA'),
    compra('PENDIENTE'), // pago pendiente aprovechable: no entra
    compra('PENDIENTE', { estado: 'CANCELADO' }),
  ];
  assert.equal(filtrarHistorial(todas, '').length, 4);
  assert.equal(filtrarHistorial(todas, 'APROBADA').length, 1);
  assert.equal(filtrarHistorial(todas, 'PENDIENTE').length, 1);
  assert.equal(filtrarHistorial(todas, 'REEMBOLSADA').length, 0);
});

test('paginarLocal tiene la misma forma que la paginación del servidor', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  assert.deepEqual(paginarLocal(items, 1, 10), {
    items: items.slice(0, 10),
    page: 1,
    page_size: 10,
    total: 25,
  });
  assert.equal(paginarLocal(items, 3, 10).items.length, 5);
  assert.equal(paginarLocal(items, 99, 10).page, 3, 'no pasa de la última página');
  assert.equal(paginarLocal([], 1, 10).page, 1);
});

test('cargarProximos pide proximos=true al servidor', async () => {
  let pedido;
  const api = {
    listarMisCompras: async (p) => {
      pedido = p;
      return { items: [] };
    },
  };
  await cargarProximos(2, undefined, api);
  assert.deepEqual(pedido, { proximos: true, page: 2, page_size: 10 });
});

test('cargarPagosPendientes descarta los que ya no se pueden pagar', async () => {
  const api = {
    listarMisCompras: async (p) => {
      assert.equal(p.estado, 'PENDIENTE');
      return { items: [compra('PENDIENTE'), compra('PENDIENTE', { estado: 'CANCELADO' })] };
    },
  };
  assert.equal((await cargarPagosPendientes(undefined, api)).length, 1);
});

test('cargarTodasLasCompras recorre las páginas de 100 hasta agotarlas', async () => {
  const paginas = [
    Array(100)
      .fill(0)
      .map(() => compra('APROBADA')),
    Array(7)
      .fill(0)
      .map(() => compra('ANULADA')),
  ];
  const pedidas = [];
  const api = {
    listarMisCompras: async (p) => {
      pedidas.push(p.page);
      return { items: paginas[p.page - 1] };
    },
  };
  const todas = await cargarTodasLasCompras(undefined, api);
  assert.equal(todas.length, 107);
  assert.deepEqual(pedidas, [1, 2]);
});

test('el día de un evento se calcula en hora de Bogotá, no en UTC', () => {
  // 01:00 UTC del 5 de dic = 8:00 p. m. del 4 de dic en Bogotá.
  assert.equal(claveDia('2026-12-05T01:00:00+00:00'), '2026-12-04');
  assert.equal(claveDia('2026-12-05T05:00:00+00:00'), '2026-12-05');
  assert.equal(hoyBogota(Date.parse('2026-11-03T03:00:00Z')), '2026-11-02');
});

test('agruparPorDia: solo APROBADA, por día de Bogotá y ordenadas por hora', () => {
  const a = compra('APROBADA', { id: 'a', fecha_inicio: '2026-12-05T06:00:00+00:00' });
  const b = compra('APROBADA', { id: 'b', fecha_inicio: '2026-12-05T01:00:00+00:00' }); // 4 dic Bogotá
  const c = compra('APROBADA', { id: 'c', fecha_inicio: '2026-12-05T02:00:00+00:00' }); // 4 dic Bogotá
  const rechazada = compra('RECHAZADA', { fecha_inicio: '2026-12-05T02:00:00+00:00' });
  const dias = agruparPorDia([a, b, c, rechazada]);
  assert.deepEqual([...dias.keys()].sort(), ['2026-12-04', '2026-12-05']);
  assert.deepEqual(
    dias.get('2026-12-04').map((x) => x.evento.id),
    ['b', 'c'],
  );
  assert.equal(dias.get('2026-12-05').length, 1);
});

test('armarMes: semanas de lunes a domingo (noviembre de 2026 empieza en domingo)', () => {
  const semanas = armarMes(2026, 11);
  assert.equal(semanas.length, 6);
  assert.ok(semanas.every((s) => s.length === 7));
  const primera = semanas[0];
  assert.deepEqual(
    primera.slice(0, 6).map((c) => c.delMes),
    Array(6).fill(false),
  );
  assert.deepEqual(
    primera.slice(0, 6).map((c) => c.fecha),
    ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
  );
  assert.deepEqual(primera[6], { fecha: '2026-11-01', dia: 1, delMes: true });
  const delMes = semanas.flat().filter((c) => c.delMes);
  assert.equal(delMes.length, 30);
  assert.equal(delMes.at(-1).fecha, '2026-11-30');
});

test('armarMes: un mes que empieza en lunes no tiene celdas de relleno al inicio', () => {
  const semanas = armarMes(2026, 6); // 1 de junio de 2026 es lunes
  assert.deepEqual(semanas[0][0], { fecha: '2026-06-01', dia: 1, delMes: true });
  assert.equal(semanas.length, 5);
});

test('moverMes cambia de año y etiquetaMes / etiquetaDiaLarga', () => {
  assert.deepEqual(moverMes({ anio: 2026, mes: 12 }, 1), { anio: 2027, mes: 1 });
  assert.deepEqual(moverMes({ anio: 2026, mes: 1 }, -1), { anio: 2025, mes: 12 });
  assert.equal(etiquetaMes({ anio: 2026, mes: 11 }), 'noviembre de 2026');
  assert.equal(etiquetaDiaLarga('2026-12-05'), '5 de diciembre');
});

test('mesInicial abre en el mes del próximo evento o, si no hay, en el actual', () => {
  const dias = new Map([
    ['2026-09-10', []],
    ['2027-02-03', []],
    ['2026-12-20', []],
  ]);
  assert.deepEqual(mesInicial(dias, '2026-11-03'), { anio: 2026, mes: 12 });
  assert.deepEqual(mesInicial(new Map([['2026-01-10', []]]), '2026-11-03'), {
    anio: 2026,
    mes: 11,
  });
  assert.deepEqual(mesInicial(new Map(), '2026-11-03'), { anio: 2026, mes: 11 });
});
