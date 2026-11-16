import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../src/core/http/api-error.js';
import {
  CAMPOS,
  accionesDeEvento,
  camposEditables,
  construirCambios,
  construirCreacion,
  crearYPublicar,
  erroresDeServidor,
  estadoDePasos,
  hayVentas,
  puedeTransmitir,
  textoDuracion,
  validarEvento,
  valoresIniciales,
} from '../../src/features/studio/studio.service.js';
import { isoToBogotaLocal } from '../../src/shared/utils/format-date.js';

const evento = (extra = {}) => ({
  id: 'e1',
  titulo: 'Mi concierto',
  descripcion: 'Repertorio completo.',
  categoria: 'ROCK',
  portada_url: 'https://cdn.com/a.jpg',
  precio_cop: 20000,
  fecha_inicio: '2026-12-05T01:00:00+00:00',
  duracion_estimada_min: 90,
  replay_habilitado: true,
  estado: 'BORRADOR',
  ...extra,
});
const todos = new Set(CAMPOS);

test('acciones del listado según el estado (§5.5)', () => {
  assert.deepEqual(accionesDeEvento('BORRADOR'), ['editar', 'publicar', 'eliminar']);
  assert.deepEqual(accionesDeEvento('PROGRAMADO'), [
    'editar',
    'transmision',
    'estadisticas',
    'cancelar',
  ]);
  assert.deepEqual(accionesDeEvento('EN_VIVO'), ['transmision', 'estadisticas', 'ver']);
  assert.deepEqual(accionesDeEvento('FINALIZADO'), ['estadisticas', 'ver']);
  assert.deepEqual(accionesDeEvento('CANCELADO'), ['ver']);
});

test('campos editables: borrador todo; programado limitado si hay ventas; el resto, solo lectura', () => {
  assert.equal(camposEditables('BORRADOR', false).size, CAMPOS.length);
  assert.equal(camposEditables('PROGRAMADO', false).size, CAMPOS.length);
  const conVentas = camposEditables('PROGRAMADO', true);
  assert.deepEqual([...conVentas].sort(), ['categoria', 'descripcion', 'portada_url', 'titulo']);
  for (const estado of ['EN_VIVO', 'FINALIZADO', 'CANCELADO']) {
    assert.equal(camposEditables(estado, false).size, 0);
  }
});

test('la fecha se muestra y se envía en hora de Bogotá (ida y vuelta a ISO UTC)', () => {
  const valores = valoresIniciales(evento());
  assert.equal(valores.fecha_inicio, '2026-12-04T20:00');
  assert.equal(isoToBogotaLocal('2026-12-05T01:00:00+00:00'), '2026-12-04T20:00');
  const cuerpo = construirCreacion(valores);
  assert.equal(cuerpo.fecha_inicio, '2026-12-05T01:00:00.000Z');
  assert.equal(cuerpo.precio_cop, 20000);
  assert.equal(cuerpo.duracion_estimada_min, 90);
  assert.equal(cuerpo.replay_habilitado, true);
});

test('construirCreacion omite descripción y portada vacías', () => {
  const valores = {
    ...valoresIniciales(null),
    titulo: ' Hola ',
    precio_cop: '15000',
    fecha_inicio: '2026-12-04T20:00',
  };
  const cuerpo = construirCreacion(valores);
  assert.equal(cuerpo.titulo, 'Hola');
  assert.ok(!('descripcion' in cuerpo));
  assert.ok(!('portada_url' in cuerpo));
  assert.equal(cuerpo.categoria, 'OTRO');
});

test('construirCambios envía solo lo que cambió', () => {
  const original = evento();
  const valores = { ...valoresIniciales(original), titulo: 'Nuevo título', precio_cop: '25000' };
  assert.deepEqual(construirCambios(original, valores, todos), {
    titulo: 'Nuevo título',
    precio_cop: 25000,
  });
  assert.deepEqual(construirCambios(original, valoresIniciales(original), todos), {});
});

test('construirCambios nunca envía campos restringidos si hay ventas', () => {
  const original = evento({ estado: 'PROGRAMADO' });
  const valores = {
    ...valoresIniciales(original),
    titulo: 'Otro',
    precio_cop: '99999',
    replay_habilitado: false,
  };
  const cambios = construirCambios(original, valores, camposEditables('PROGRAMADO', true));
  assert.deepEqual(cambios, { titulo: 'Otro' });
});

test('construirCambios: borrar la descripción la envía como null', () => {
  const original = evento();
  const valores = { ...valoresIniciales(original), descripcion: '   ' };
  assert.deepEqual(construirCambios(original, valores, todos), { descripcion: null });
});

test('validarEvento detecta los errores del formulario', () => {
  const malos = {
    titulo: '  ',
    descripcion: '',
    categoria: 'NOEXISTE',
    portada_url: 'http://malo.com/a.jpg',
    precio_cop: '12.5',
    fecha_inicio: '',
    duracion_estimada_min: '10',
    replay_habilitado: true,
  };
  const errores = validarEvento(malos);
  for (const campo of [
    'titulo',
    'categoria',
    'portada_url',
    'precio_cop',
    'fecha_inicio',
    'duracion_estimada_min',
  ]) {
    assert.ok(errores[campo], campo);
  }
  assert.deepEqual(validarEvento(valoresIniciales(evento())), {});
});

test('validarEvento solo revisa los campos editables', () => {
  const valores = { ...valoresIniciales(evento()), precio_cop: '', titulo: 'Ok' };
  assert.deepEqual(validarEvento(valores, new Set(['titulo'])), {});
});

test('erroresDeServidor: 422 por campo, códigos de negocio y mensajes generales', () => {
  const e422 = new ApiError({
    status: 422,
    codigo: 'VALIDACION',
    mensaje: 'x',
    detalles: { titulo: ['Muy largo'], precio_cop: ['Inválido'] },
  });
  assert.deepEqual(erroresDeServidor(e422), {
    campos: { titulo: 'Muy largo', precio_cop: 'Inválido' },
    general: '',
  });
  const monto = new ApiError({
    status: 422,
    codigo: 'MONTO_FUERA_DE_RANGO',
    mensaje: 'Fuera de rango',
  });
  assert.deepEqual(erroresDeServidor(monto).campos, { precio_cop: 'Fuera de rango' });
  const fecha = new ApiError({
    status: 422,
    codigo: 'FECHA_INICIO_INVALIDA',
    mensaje: 'Muy pronto',
  });
  assert.deepEqual(erroresDeServidor(fecha).campos, { fecha_inicio: 'Muy pronto' });
  const limite = new ApiError({
    status: 422,
    codigo: 'LIMITE_EVENTOS_PROGRAMADOS',
    mensaje: 'Tope alcanzado',
  });
  assert.deepEqual(erroresDeServidor(limite), { campos: {}, general: 'Tope alcanzado' });
});

test('hayVentas consulta solo en PROGRAMADO y no restringe si la consulta falla', async () => {
  let llamadas = 0;
  const api = {
    obtenerVentasDeEvento: async () => {
      llamadas++;
      return { entradas_vendidas: 3 };
    },
  };
  assert.equal(await hayVentas(evento({ estado: 'BORRADOR' }), undefined, api), false);
  assert.equal(llamadas, 0);
  assert.equal(await hayVentas(evento({ estado: 'PROGRAMADO' }), undefined, api), true);
  const sinVentas = { obtenerVentasDeEvento: async () => ({ entradas_vendidas: 0 }) };
  assert.equal(await hayVentas(evento({ estado: 'PROGRAMADO' }), undefined, sinVentas), false);
  const falla = {
    obtenerVentasDeEvento: async () => {
      throw new ApiError({ codigo: 'ERROR_RED', mensaje: 'red' });
    },
  };
  assert.equal(await hayVentas(evento({ estado: 'PROGRAMADO' }), undefined, falla), false);
});

test('crearYPublicar: si publicar falla, el evento queda como borrador y se devuelve el error', async () => {
  const valores = {
    ...valoresIniciales(null),
    titulo: 'X',
    precio_cop: '15000',
    fecha_inicio: '2026-12-04T20:00',
  };
  const ok = {
    crearEvento: async () => ({ id: 'n1', estado: 'BORRADOR' }),
    publicarEvento: async () => ({ id: 'n1', estado: 'PROGRAMADO' }),
  };
  const exito = await crearYPublicar(valores, undefined, ok);
  assert.equal(exito.evento.estado, 'PROGRAMADO');
  assert.equal(exito.errorPublicar, null);

  const fallo = {
    crearEvento: ok.crearEvento,
    publicarEvento: async () => {
      throw new ApiError({ status: 422, codigo: 'FECHA_INICIO_INVALIDA', mensaje: 'Muy pronto' });
    },
  };
  const parcial = await crearYPublicar(valores, undefined, fallo);
  assert.equal(parcial.evento.estado, 'BORRADOR');
  assert.equal(parcial.errorPublicar.codigo, 'FECHA_INICIO_INVALIDA');
});

test('estadoDePasos de la sala de control y quién puede transmitir', () => {
  assert.deepEqual(estadoDePasos('PROGRAMADO'), {
    credenciales: 'activo',
    iniciar: 'activo',
    enVivo: 'bloqueado',
    finalizar: 'bloqueado',
  });
  assert.deepEqual(estadoDePasos('EN_VIVO'), {
    credenciales: 'hecho',
    iniciar: 'hecho',
    enVivo: 'activo',
    finalizar: 'activo',
  });
  assert.deepEqual(estadoDePasos('FINALIZADO'), {
    credenciales: 'hecho',
    iniciar: 'hecho',
    enVivo: 'hecho',
    finalizar: 'hecho',
  });
  assert.equal(puedeTransmitir('BORRADOR'), false);
  assert.equal(puedeTransmitir('CANCELADO'), false);
  assert.equal(puedeTransmitir('PROGRAMADO'), true);
});

test('textoDuracion', () => {
  assert.equal(textoDuracion(null), '—');
  assert.equal(textoDuracion(45), '45 min');
  assert.equal(textoDuracion(65), '1 h 05 min');
});
