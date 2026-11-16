import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../../src/core/http/api-client.js';
import { ApiError } from '../../src/core/http/api-error.js';

const BASE = 'http://api.test/api/v1';

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

function tokensFalsos({ access = 'viejo', refresh = 'refresh-1' } = {}) {
  const estado = { access, refresh };
  return {
    estado,
    getAccessToken: () => estado.access,
    setAccessToken: (t) => (estado.access = t),
    getRefreshToken: () => estado.refresh,
  };
}

function crear(fetchFn, extra = {}) {
  const tokens = extra.tokens ?? tokensFalsos();
  const perdidas = [];
  const cliente = createApiClient({
    baseUrl: BASE,
    fetchFn,
    tokens,
    onAuthLost: (info) => perdidas.push(info),
    ...extra,
  });
  return { cliente, tokens, perdidas };
}

test('envía el Bearer y serializa JSON', async () => {
  let visto;
  const { cliente } = crear(async (url, init) => {
    visto = { url, init };
    return json({ ok: true });
  });
  await cliente.post('/auth/login', { email: 'a@b.co' });
  assert.equal(visto.url, `${BASE}/auth/login`);
  assert.equal(visto.init.headers.Authorization, 'Bearer viejo');
  assert.equal(visto.init.headers['Content-Type'], 'application/json');
  assert.equal(visto.init.body, '{"email":"a@b.co"}');
});

test('refresh single-flight: varias 401 simultáneas hacen un solo refresh', async () => {
  let refrescos = 0;
  let cuerpoRefresh = 'no-llamado';
  let authRefresh = null;
  const { cliente, tokens } = crear(async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refrescos++;
      cuerpoRefresh = init.body;
      authRefresh = init.headers.Authorization;
      await new Promise((r) => setTimeout(r, 20));
      return json({ access_token: 'nuevo' });
    }
    if (init.headers.Authorization === 'Bearer nuevo') return json({ ruta: url });
    return json({ codigo: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión.' }, 401);
  });

  const resultados = await Promise.all([
    cliente.get('/usuarios/me'),
    cliente.get('/eventos'),
    cliente.get('/usuarios/me/favoritos'),
  ]);

  assert.equal(refrescos, 1);
  assert.equal(authRefresh, 'Bearer refresh-1', 'el refresh token viaja como Bearer');
  assert.equal(cuerpoRefresh, undefined, 'sin cuerpo');
  assert.equal(tokens.estado.access, 'nuevo');
  assert.equal(resultados.length, 3);
  resultados.forEach((r) => assert.ok(r.ruta));
});

test('si el refresh falla, avisa sesión expirada y lanza el error', async () => {
  const { cliente, perdidas } = crear(async (url) => {
    if (url.endsWith('/auth/refresh')) return json({ codigo: 'NO_AUTENTICADO', mensaje: 'x' }, 401);
    return json({ codigo: 'NO_AUTENTICADO', mensaje: 'x' }, 401);
  });
  await assert.rejects(
    cliente.get('/usuarios/me'),
    (e) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(perdidas.length, 1);
  assert.equal(perdidas[0].motivo, 'expirada');
});

test('un 401 en /auth/login no intenta refrescar', async () => {
  let llamadas = 0;
  const { cliente } = crear(async () => {
    llamadas++;
    return json({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales inválidas.' }, 401);
  });
  await assert.rejects(
    cliente.post('/auth/login', {}),
    (e) => e.codigo === 'CREDENCIALES_INVALIDAS',
  );
  assert.equal(llamadas, 1);
});

test('403 CUENTA_SUSPENDIDA cierra la sesión', async () => {
  const { cliente, perdidas } = crear(async () =>
    json({ codigo: 'CUENTA_SUSPENDIDA', mensaje: 'Tu cuenta está suspendida.' }, 403),
  );
  await assert.rejects(cliente.get('/usuarios/me'), (e) => e.codigo === 'CUENTA_SUSPENDIDA');
  assert.deepEqual(perdidas, [{ motivo: 'suspendida', mensaje: 'Tu cuenta está suspendida.' }]);
});

test('normaliza errores del backend con detalles por campo (422)', async () => {
  const { cliente } = crear(async () =>
    json(
      { codigo: 'VALIDACION', mensaje: 'Datos inválidos', detalles: { email: ['Inválido'] } },
      422,
    ),
  );
  await assert.rejects(cliente.post('/auth/registro', {}), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 422);
    assert.equal(e.codigo, 'VALIDACION');
    assert.deepEqual(e.detalles, { email: ['Inválido'] });
    return true;
  });
});

test('errores sin JSON usan un mensaje amigable por estado, incluido 429', async () => {
  const { cliente } = crear(async () => new Response('<html>boom</html>', { status: 500 }));
  await assert.rejects(cliente.get('/x'), (e) => e.status === 500 && !e.mensaje.includes('<html>'));

  const { cliente: limitado } = crear(async () => new Response('', { status: 429 }));
  await assert.rejects(limitado.get('/x'), (e) => e.status === 429 && /Demasiados/.test(e.mensaje));
});

test('un fallo de red se vuelve ERROR_RED con mensaje propio', async () => {
  const { cliente } = crear(async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(
    cliente.get('/x'),
    (e) => e.codigo === 'ERROR_RED' && /conectar/.test(e.mensaje),
  );
});

test('FormData: no fija Content-Type (lo pone el navegador)', async () => {
  let init;
  const { cliente } = crear(async (_url, i) => {
    init = i;
    return json({});
  });
  const datos = new FormData();
  datos.append('foto', new Blob(['x'], { type: 'image/png' }), 'a.png');
  await cliente.put('/usuarios/me/foto', datos);
  assert.ok(init.body instanceof FormData);
  assert.equal('Content-Type' in init.headers, false);
});

test('204 devuelve null', async () => {
  const { cliente } = crear(async () => new Response(null, { status: 204 }));
  assert.equal(await cliente.put('/usuarios/me/favoritos/1'), null);
});

test('cancelación: abortar la señal de la ruta rechaza con PETICION_CANCELADA', async () => {
  const { cliente } = crear(
    (_url, init) =>
      new Promise((_resolver, rechazar) => {
        init.signal.addEventListener('abort', () =>
          rechazar(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  const controlador = new AbortController();
  const promesa = cliente.get('/eventos', { signal: controlador.signal });
  controlador.abort();
  await assert.rejects(promesa, (e) => e.cancelada === true);
});

test('tiempo máximo: rechaza con TIEMPO_AGOTADO', async () => {
  const { cliente } = crear(
    (_url, init) =>
      new Promise((_resolver, rechazar) => {
        init.signal.addEventListener('abort', () =>
          rechazar(new DOMException('Aborted', 'AbortError')),
        );
      }),
    { timeoutMs: 30 },
  );
  await assert.rejects(cliente.get('/lento'), (e) => e.codigo === 'TIEMPO_AGOTADO');
});

test('query: omite valores vacíos', async () => {
  let url;
  const { cliente } = crear(async (u) => {
    url = u;
    return json({});
  });
  await cliente.get('/eventos', { query: { q: 'rock', estado: '', page: 2 } });
  assert.equal(url, `${BASE}/eventos?q=rock&page=2`);
});

test('un 401 de negocio (CLAVE_EMISION_INVALIDA) no renueva ni cierra la sesión', async () => {
  let llamadas = 0;
  let refrescos = 0;
  const { cliente, perdidas } = crear(async (url) => {
    if (url.endsWith('/auth/refresh')) {
      refrescos++;
      return json({ access_token: 'nuevo' });
    }
    llamadas++;
    return json(
      { codigo: 'CLAVE_EMISION_INVALIDA', mensaje: 'La clave de emisión no es válida.' },
      401,
    );
  });
  await assert.rejects(
    cliente.post('/eventos/e1/transmision/iniciar', { stream_key: 'x' }),
    (e) => e.status === 401 && e.codigo === 'CLAVE_EMISION_INVALIDA',
  );
  assert.equal(llamadas, 1);
  assert.equal(refrescos, 0);
  assert.deepEqual(perdidas, []);
});

test('un 401 sin cuerpo se sigue tratando como sesión vencida', async () => {
  let refrescos = 0;
  const { cliente } = crear(async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refrescos++;
      return json({ access_token: 'nuevo' });
    }
    return init.headers.Authorization === 'Bearer nuevo'
      ? json({ ok: true })
      : new Response('', { status: 401 });
  });
  assert.deepEqual(await cliente.get('/usuarios/me'), { ok: true });
  assert.equal(refrescos, 1);
});
