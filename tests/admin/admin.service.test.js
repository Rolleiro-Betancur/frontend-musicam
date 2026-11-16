import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../src/core/http/api-error.js';
import {
  GRUPOS_CONFIGURACION,
  erroresDeFormulario,
  filtrosAQuery,
  filtrosRetirosAQuery,
  gruposDeConfiguracion,
  leerFiltrosCompras,
  leerFiltrosEventos,
  leerFiltrosRetiros,
  leerFiltrosUsuarios,
  paramsCompras,
  paramsEventos,
  paramsRetiros,
  paramsUsuarios,
  paresDe,
  textoDeAviso,
  validarMotivo,
  validarNuevoAdmin,
  validarRango,
} from '../../src/features/admin/admin.service.js';

const q = (texto) => new URLSearchParams(texto);
const UUID = '3f2a9c1e-7b0d-4c55-9a1e-2d6f8b1c0a11';

test('leerFiltrosUsuarios descarta lo inválido de la URL', () => {
  assert.deepEqual(leerFiltrosUsuarios(q('q=%20ana%20&rol=SUPER&estado=ACTIVO&page=0')), {
    q: 'ana',
    rol: '',
    estado: 'ACTIVO',
    page: 1,
  });
  assert.equal(leerFiltrosUsuarios(q('rol=ARTISTA&page=3')).page, 3);
  assert.equal(leerFiltrosUsuarios(q(`q=${'x'.repeat(300)}`)).q.length, 100);
});

test('leerFiltrosEventos valida categoría, estado, suspendido y fechas', () => {
  const f = leerFiltrosEventos(
    q('categoria=ROCK&estado=EN_VIVO&suspendido=true&desde=2026-12-01&hasta=ayer'),
  );
  assert.deepEqual(f, {
    q: '',
    categoria: 'ROCK',
    estado: 'EN_VIVO',
    suspendido: 'true',
    desde: '2026-12-01',
    hasta: '',
    page: 1,
  });
  assert.equal(leerFiltrosEventos(q('categoria=X&estado=Y&suspendido=quizas')).suspendido, '');
});

test('leerFiltrosCompras solo acepta UUID válidos para evento y usuario', () => {
  const f = leerFiltrosCompras(q(`estado=APROBADA&evento_id=${UUID}&usuario_id=no-es-uuid`));
  assert.equal(f.estado, 'APROBADA');
  assert.equal(f.evento_id, UUID);
  assert.equal(f.usuario_id, '');
});

test('la cola de retiros abre en PENDIENTE; TODOS significa sin filtro', () => {
  assert.equal(leerFiltrosRetiros(q('')).estado, 'PENDIENTE');
  assert.equal(leerFiltrosRetiros(q('estado=TODOS')).estado, '');
  assert.equal(leerFiltrosRetiros(q('estado=PAGADO')).estado, 'PAGADO');
  assert.equal(leerFiltrosRetiros(q('estado=raro')).estado, 'PENDIENTE');
});

test('filtrosAQuery omite vacíos y la página 1; ida y vuelta', () => {
  assert.equal(filtrosAQuery(leerFiltrosUsuarios(q(''))), '');
  const f = { q: 'a b', rol: 'ARTISTA', estado: '', page: 2 };
  const query = filtrosAQuery(f);
  assert.equal(query, '?q=a+b&rol=ARTISTA&page=2');
  assert.deepEqual(leerFiltrosUsuarios(q(query)), f);
});

test('filtrosRetirosAQuery: PENDIENTE no se escribe, TODOS sí; ida y vuelta', () => {
  assert.equal(filtrosRetirosAQuery({ estado: 'PENDIENTE', page: 1 }), '');
  assert.equal(filtrosRetirosAQuery({ estado: '', page: 1 }), '?estado=TODOS');
  assert.equal(filtrosRetirosAQuery({ estado: 'PAGADO', page: 2 }), '?estado=PAGADO&page=2');
  for (const estado of ['PENDIENTE', '', 'PAGADO', 'RECHAZADO']) {
    const f = { estado, page: 1 };
    assert.deepEqual(leerFiltrosRetiros(q(filtrosRetirosAQuery(f))), f);
  }
});

test('los parámetros de la API convierten los días de Bogotá a ISO UTC', () => {
  const f = leerFiltrosEventos(q('desde=2026-12-04&hasta=2026-12-05&estado=PROGRAMADO'));
  const p = paramsEventos(f);
  assert.equal(p.desde, '2026-12-04T05:00:00.000Z');
  assert.equal(p.hasta, '2026-12-06T04:59:00.000Z');
  assert.equal(p.page_size, 20);
  assert.equal(p.estado, 'PROGRAMADO');
  const c = paramsCompras(leerFiltrosCompras(q(`usuario_id=${UUID}&desde=2026-12-04`)));
  assert.equal(c.usuario_id, UUID);
  assert.equal(c.desde, '2026-12-04T05:00:00.000Z');
  assert.equal(c.hasta, '');
  assert.deepEqual(paramsUsuarios(leerFiltrosUsuarios(q('rol=ADMIN'))), {
    page: 1,
    page_size: 20,
    q: '',
    rol: 'ADMIN',
    estado: '',
  });
  assert.deepEqual(paramsRetiros(leerFiltrosRetiros(q(''))), {
    page: 1,
    page_size: 20,
    estado: 'PENDIENTE',
  });
});

test('validarRango', () => {
  assert.ok(validarRango({ desde: '2026-12-10', hasta: '2026-12-01' }));
  assert.equal(validarRango({ desde: '2026-12-01', hasta: '2026-12-10' }), null);
  assert.equal(validarRango({ desde: '', hasta: '' }), null);
});

test('validarMotivo: obligatorio, sin solo espacios y máximo 255', () => {
  assert.ok(validarMotivo(''));
  assert.ok(validarMotivo('    '));
  assert.ok(validarMotivo(undefined));
  assert.ok(validarMotivo('x'.repeat(256)));
  assert.equal(validarMotivo('Contenido inapropiado'), null);
  assert.equal(validarMotivo('x'.repeat(255)), null);
});

test('validarNuevoAdmin refleja las reglas de nombre, correo y contraseña', () => {
  const malo = validarNuevoAdmin({ nombre: ' ', email: 'x', password: 'corta' });
  assert.ok(malo.nombre && malo.email && malo.password);
  assert.deepEqual(
    validarNuevoAdmin({ nombre: 'Ana', email: 'ana@example.com', password: 'Clave1234' }),
    {},
  );
});

test('erroresDeFormulario: 422 por campo, 409 de correo y mensajes generales', () => {
  const e422 = new ApiError({
    status: 422,
    codigo: 'VALIDACION',
    mensaje: 'x',
    detalles: { password: ['Muy corta'] },
  });
  assert.deepEqual(erroresDeFormulario(e422), { campos: { password: 'Muy corta' }, general: '' });
  const e409 = new ApiError({ status: 409, codigo: 'EMAIL_YA_REGISTRADO', mensaje: 'Ya existe.' });
  assert.deepEqual(erroresDeFormulario(e409), { campos: { email: 'Ya existe.' }, general: '' });
  const red = new ApiError({ codigo: 'ERROR_RED', mensaje: 'Sin conexión.' });
  assert.deepEqual(erroresDeFormulario(red), { campos: {}, general: 'Sin conexión.' });
});

test('textoDeAviso muestra el mensaje del servidor tal cual y su código (RN-16, RN-20)', () => {
  const casos = [
    ['RETIRO_YA_RESUELTO', 409, 'El retiro ya fue resuelto.'],
    ['ADMIN_NO_PUEDE_AUTOMODIFICARSE', 403, 'No puedes suspenderte a ti mismo.'],
    ['ULTIMO_ADMIN_ACTIVO', 409, 'No puede quedar el sistema sin un administrador activo.'],
  ];
  for (const [codigo, status, mensaje] of casos) {
    const texto = textoDeAviso(new ApiError({ status, codigo, mensaje }));
    assert.equal(texto, `${mensaje} (${codigo})`);
  }
  const sinCodigo = textoDeAviso(
    new ApiError({ status: 500, codigo: 'HTTP_500', mensaje: 'Falló.' }),
  );
  assert.equal(sinCodigo, 'Falló.');
});

test('paresDe respeta el orden y rellena con 0', () => {
  assert.deepEqual(
    paresDe({ ARTISTA: 3 }, [
      ['USUARIO', 'Espectadores'],
      ['ARTISTA', 'Artistas'],
    ]),
    [
      ['Espectadores', 0],
      ['Artistas', 3],
    ],
  );
  assert.deepEqual(paresDe(undefined, [['X', 'x']]), [['x', 0]]);
});

test('la configuración se muestra formateada', () => {
  const grupos = gruposDeConfiguracion({
    entorno: 'development',
    comision_plataforma_pct: 10,
    precio_min_cop: 5000,
    retiro_auto_aprobar: false,
    enforce_start_window: true,
    jwt_access_ttl_min: 15,
    jwt_refresh_ttl_dias: 7,
    max_upload_mb: 2,
  });
  const plano = Object.fromEntries(grupos.flatMap((g) => g.filas));
  assert.equal(plano['Comisión de la plataforma'], '10 %');
  assert.equal(plano['Retiro mínimo'], undefined, 'lo que no llega no se inventa');
  assert.match(plano['Precio mínimo de entrada'].replace(/\s/g, ' '), /^\$ 5\.000$/);
  assert.equal(plano['Aprobación automática de retiros'], 'No');
  assert.equal(plano['Exigir ventana de inicio'], 'Sí');
  assert.equal(plano['Vigencia del token de acceso'], '15 min');
  assert.equal(plano['Vigencia del token de refresco'], '7 días');
  assert.equal(plano['Tamaño máximo de foto'], '2 MB');
});

test('la configuración nunca muestra secretos: lo que no está en la lista permitida se descarta', () => {
  const grupos = gruposDeConfiguracion({
    comision_plataforma_pct: 10,
    wompi_integrity_secret: 'sim-integrity-secret',
    wompi_events_secret: 'sim-events-secret',
    jwt_secret_key: 'cambia-esto',
    secret_key: 'otra',
    playback_token_secret: 'cambia-esto-3',
    database_url: 'postgresql+psycopg://app:app@db/streaming',
    admin_password: 'Cambiar123',
  });
  const todo = JSON.stringify(grupos);
  for (const prohibido of [
    'sim-integrity-secret',
    'sim-events-secret',
    'cambia-esto',
    'otra',
    'postgresql',
    'Cambiar123',
  ]) {
    assert.ok(!todo.includes(prohibido), prohibido);
  }
  assert.equal(grupos.flatMap((g) => g.filas).length, 1);
  // Y la propia lista permitida no contiene claves de aspecto secreto.
  const claves = GRUPOS_CONFIGURACION.flatMap((g) => g.filas.map(([clave]) => clave));
  for (const clave of claves)
    assert.ok(!/secret|password|credential|database|_key$/.test(clave), clave);
});
