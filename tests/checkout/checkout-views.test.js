import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vistaError,
  vistaMetodo,
  vistaPasarela,
  vistaProcesando,
  vistaResultado,
} from '../../src/features/checkout/components/checkout-views.js';
import { eventAction } from '../../src/features/catalog/components/event-action.js';

const normal = (s) => String(s).replace(/\s/g, ' ');
const evento = { id: 'e1', titulo: 'Concierto', precio_cop: 20000, estado: 'EN_VIVO' };
const compra = {
  id: 'c1',
  referencia: 'conc-abc123',
  monto_cop: 18000,
  metodo_pago: 'NEQUI',
  estado: 'PENDIENTE',
  expira_en: '2026-12-05T01:30:00+00:00',
};

test('el paso de método ofrece Tarjeta, PSE y Nequi con uno seleccionado', () => {
  const salida = String(vistaMetodo({ evento, metodo: 'PSE' }));
  for (const nombre of ['Tarjeta', 'PSE', 'Nequi']) assert.ok(salida.includes(nombre));
  assert.match(salida, /value="PSE"\s+checked/);
  assert.ok(salida.includes('data-action="continuar"'));
});

test('la pasarela muestra la franja de pruebas y el monto y la referencia de la COMPRA', () => {
  const salida = normal(vistaPasarela({ evento, compra }));
  assert.ok(salida.includes('Entorno de pruebas · no se cobra dinero real'));
  assert.ok(salida.includes('$ 18.000'), 'monto de la compra, no el precio del evento');
  assert.ok(!salida.includes('$ 20.000'));
  assert.ok(salida.includes('conc-abc123'));
  for (const accion of ['aprobar', 'rechazar', 'cancelar']) {
    assert.ok(salida.includes(`data-action="${accion}"`));
  }
});

test('la pasarela escapa los datos que vienen del servidor', () => {
  const salida = String(
    vistaPasarela({
      evento: { ...evento, titulo: '<script>x</script>' },
      compra: { ...compra, referencia: '"><img src=x onerror=alert(1)>' },
    }),
  );
  assert.ok(!salida.includes('<script>'));
  assert.ok(!salida.includes('<img src=x'));
});

test('resultado APROBADA: botón según el evento y enlace a Mis eventos', () => {
  const aprobada = { ...compra, estado: 'APROBADA' };
  const enVivo = normal(vistaResultado({ evento, compra: aprobada }));
  assert.ok(enVivo.includes('Ver ahora') && enVivo.includes('#/mis-eventos'));
  const programado = normal(
    vistaResultado({ evento: { ...evento, estado: 'PROGRAMADO' }, compra: aprobada }),
  );
  assert.ok(programado.includes('Ver cuando empiece') && programado.includes('#/mis-eventos'));
});

test('resultado RECHAZADA permite reintentar y ANULADA permite volver a comprar', () => {
  const rechazada = String(vistaResultado({ evento, compra: { ...compra, estado: 'RECHAZADA' } }));
  assert.ok(rechazada.includes('rechazado') && rechazada.includes('data-action="reintentar"'));
  const anulada = normal(vistaResultado({ evento, compra: { ...compra, estado: 'ANULADA' } }));
  assert.ok(anulada.includes('Volver a comprar') && anulada.includes('data-action="reintentar"'));
});

test('la vista de espera no tiene botones (evita el doble envío)', () => {
  assert.ok(!String(vistaProcesando('Procesando…')).includes('<button'));
});

test('vistaError muestra el mensaje escapado y la acción pedida', () => {
  const salida = String(vistaError({ mensaje: '<b>mal</b>', accion: 'comprobar' }));
  assert.ok(!salida.includes('<b>mal</b>'));
  assert.ok(salida.includes('data-action="comprobar"'));
  assert.ok(!String(vistaError({ mensaje: 'x' })).includes('data-action="comprobar"'));
});

test('el CTA de comprar del detalle queda habilitado y abre el checkout', () => {
  const salida = String(eventAction({ tipo: 'COMPRAR' }, evento, '#/eventos/e1'));
  assert.ok(salida.includes('data-action="comprar"'));
  assert.ok(!/<button[^>]*disabled/s.test(salida));
});
