import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError } from '../../src/core/http/api-error.js';
import {
  construirRetiro,
  enmascararCuenta,
  erroresDeRetiro,
  etiquetaDia,
  resumenGrafica,
  textoPico,
  validarRetiro,
} from '../../src/features/studio/finanzas.service.js';
import { tarjetasSaldo } from '../../src/features/studio/components/saldo-cards.js';
import {
  crearGraficaVentas,
  vistaGraficaVentas,
} from '../../src/features/studio/components/sales-chart.js';
import { kpiCard } from '../../src/shared/ui/kpi-card.js';

const normal = (s) => String(s).replace(/\s+/g, ' ');
const retiro = (extra = {}) => ({
  monto_cop: '100000',
  banco: 'Bancolombia',
  tipo_cuenta: 'AHORROS',
  cuenta_ultimos4: '0042',
  ...extra,
});
const ventas = [
  { fecha: '2026-11-01', entradas: 12, ingresos_netos_cop: 216000 },
  { fecha: '2026-11-03', entradas: 1, ingresos_netos_cop: 18000 },
];

test('textoPico usa un decimal con coma', () => {
  assert.equal(textoPico(41.5), '41,5');
  assert.equal(textoPico(0), '0,0');
  assert.equal(textoPico(undefined), '0,0');
});

test('etiquetaDia no cambia de día por zona horaria', () => {
  assert.equal(etiquetaDia('2026-11-01'), '1 nov');
  assert.equal(etiquetaDia('2026-12-31'), '31 dic');
  assert.equal(etiquetaDia('basura'), 'basura');
});

test('resumenGrafica describe la gráfica sin sumar dinero', () => {
  assert.equal(resumenGrafica([]), 'Sin ventas registradas.');
  assert.match(resumenGrafica(ventas), /2 días con ventas, del 1 nov al 3 nov/);
  assert.match(resumenGrafica([ventas[0]]), /1 día con ventas/);
});

test('enmascararCuenta', () => {
  assert.equal(enmascararCuenta('0042'), '••••0042');
});

test('retiro válido', () => {
  assert.deepEqual(validarRetiro(retiro()), {});
});

test('cuenta: exactamente 4 dígitos; un número más largo se rechaza', () => {
  assert.deepEqual(validarRetiro(retiro({ cuenta_ultimos4: '1234' })), {});
  assert.deepEqual(validarRetiro(retiro({ cuenta_ultimos4: '0000' })), {});
  const larga = validarRetiro(retiro({ cuenta_ultimos4: '1234567890' }));
  assert.match(larga.cuenta_ultimos4, /no el número completo/);
  const cinco = validarRetiro(retiro({ cuenta_ultimos4: '12345' }));
  assert.match(cinco.cuenta_ultimos4, /no el número completo/);
  for (const mala of ['', '123', '12a4', '12 34', '١٢٣٤']) {
    assert.match(
      validarRetiro(retiro({ cuenta_ultimos4: mala })).cuenta_ultimos4,
      /4 dígitos/,
      mala,
    );
  }
});

test('validarRetiro: monto, banco y tipo de cuenta', () => {
  const errores = validarRetiro(retiro({ monto_cop: '12.5', banco: '  ', tipo_cuenta: 'AHORRO' }));
  assert.ok(errores.monto_cop && errores.banco && errores.tipo_cuenta);
  assert.ok(validarRetiro(retiro({ monto_cop: '' })).monto_cop);
  assert.ok(validarRetiro(retiro({ monto_cop: '0' })).monto_cop);
  assert.ok(validarRetiro(retiro({ banco: 'x'.repeat(61) })).banco);
});

test('construirRetiro envía solo lo que permite el contrato, con ceros a la izquierda', () => {
  const cuerpo = construirRetiro({
    ...retiro({ cuenta_ultimos4: ' 0042 ', banco: ' Bancolombia ' }),
    numero_completo: '1234567890123456',
    password: 'no',
  });
  assert.deepEqual(cuerpo, {
    monto_cop: 100000,
    banco: 'Bancolombia',
    tipo_cuenta: 'AHORROS',
    cuenta_ultimos4: '0042',
  });
  assert.equal(typeof cuerpo.cuenta_ultimos4, 'string');
});

test('erroresDeRetiro: saldo y monto junto al campo; 422 por campo; el resto, alerta', () => {
  const saldo = new ApiError({ status: 422, codigo: 'SALDO_INSUFICIENTE', mensaje: 'No alcanza.' });
  assert.deepEqual(erroresDeRetiro(saldo), { campos: { monto_cop: 'No alcanza.' }, general: '' });
  const rango = new ApiError({
    status: 422,
    codigo: 'MONTO_FUERA_DE_RANGO',
    mensaje: 'Mínimo 50.000.',
  });
  assert.deepEqual(erroresDeRetiro(rango).campos, { monto_cop: 'Mínimo 50.000.' });
  const cuenta = new ApiError({
    status: 422,
    codigo: 'VALIDACION',
    mensaje: 'x',
    detalles: { cuenta_ultimos4: ['No es válida'] },
  });
  assert.deepEqual(erroresDeRetiro(cuenta).campos, { cuenta_ultimos4: 'No es válida' });
  const red = new ApiError({ codigo: 'ERROR_RED', mensaje: 'Sin conexión.' });
  assert.deepEqual(erroresDeRetiro(red), { campos: {}, general: 'Sin conexión.' });
});

test('las tarjetas de saldo traen las 4 cifras del servidor y su ayuda', () => {
  const saldo = {
    disponible_cop: 2900000,
    retenido_cop: 400000,
    en_proceso_cop: 300000,
    retirado_cop: 216000,
  };
  const salida = normal(tarjetasSaldo(saldo));
  for (const etiqueta of ['Disponible', 'Retenido', 'En proceso', 'Retirado']) {
    assert.ok(salida.includes(etiqueta), etiqueta);
  }
  for (const cifra of ['$ 2.900.000', '$ 400.000', '$ 300.000', '$ 216.000']) {
    assert.ok(salida.includes(cifra), cifra);
  }
  assert.ok(
    salida.includes('se liberan cuando el evento finaliza') ||
      salida.includes('Se liberan cuando el evento finaliza'),
  );
  assert.ok(!normal(tarjetasSaldo(saldo, { conAyuda: false })).includes('Se liberan'));
});

test('kpiCard escapa etiqueta y valor', () => {
  const salida = String(kpiCard({ valor: '<b>1</b>', etiqueta: '<script>x</script>' }));
  assert.ok(!salida.includes('<script>') && !salida.includes('<b>1</b>'));
});

test('la gráfica trae una descripción accesible y una tabla equivalente', () => {
  const salida = normal(vistaGraficaVentas(ventas));
  assert.match(salida, /<canvas role="img" aria-label="Gráfica de barras/);
  assert.match(salida, /<div class="visually-hidden">\s*<table>/);
  assert.ok(
    !salida.includes('<table class="visually-hidden">'),
    'la clase va en el contenedor, no en la tabla',
  );
  assert.ok(salida.includes('1 nov') && salida.includes('$ 216.000') && salida.includes('>12<'));
  assert.ok(salida.includes('America') === false, 'no inventa zonas en el texto');
  assert.ok(salida.includes('hora de Colombia'));
});

test('destruir la gráfica antes de que cargue chart.js no dibuja ni falla', async () => {
  let error = null;
  const grafica = crearGraficaVentas({}, ventas, { onError: (e) => (error = e) });
  grafica.destroy();
  await new Promise((r) => setTimeout(r, 200)); // deja resolver el import() diferido
  assert.equal(error, null);
  grafica.destroy(); // idempotente
});

test('chart.js solo se importa de forma diferida en la gráfica de barras compartida', () => {
  const archivos = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.push(ruta);
    }
  };
  recorrer('src');
  const conChart = archivos.filter((f) => readFileSync(f, 'utf8').includes("'chart.js'"));
  assert.deepEqual(
    conChart.map((f) => f.replaceAll('\\', '/')),
    ['src/shared/ui/bar-chart.js'],
  );
  const fuente = readFileSync(conChart[0], 'utf8');
  assert.ok(fuente.includes("import('chart.js')"));
  assert.ok(!/^import .* from 'chart\.js'/m.test(fuente), 'sin importación estática');
});

test('las pantallas con gráfica la destruyen en destroy()', () => {
  for (const pagina of ['studio-home', 'event-stats']) {
    const fuente = readFileSync(`src/features/studio/pages/${pagina}.page.js`, 'utf8');
    assert.match(fuente, /destroy\(\) \{[\s\S]*grafica\?\.destroy\(\)/, pagina);
  }
});
