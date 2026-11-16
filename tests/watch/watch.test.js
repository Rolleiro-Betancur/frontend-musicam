import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError } from '../../src/core/http/api-error.js';
import {
  clasificarErrorEntrar,
  decidirVista,
  entrarAlEvento,
  msHastaExpirar,
} from '../../src/features/watch/watch.service.js';
import { crearPlayer } from '../../src/features/watch/player/player-adapter.js';
import { HlsPlayer } from '../../src/features/watch/player/hls-player.js';
import {
  SimulatedPlayer,
  formatDuracion,
} from '../../src/features/watch/player/simulated-player.js';
import {
  vistaDenegado,
  vistaEspera,
  vistaReproductor,
} from '../../src/features/watch/components/watch-views.js';
import { eventAction } from '../../src/features/catalog/components/event-action.js';

const evento = (extra = {}) => ({
  id: 'e1',
  titulo: 'Concierto',
  categoria: 'ROCK',
  portada_url: null,
  precio_cop: 20000,
  fecha_inicio: '2026-12-05T01:00:00+00:00',
  estado: 'EN_VIVO',
  replay_disponible: false,
  suspendido_admin: false,
  comprado: false,
  artista: { id: 'a1', nombre_artistico: 'Los Cumbieros' },
  ...extra,
});
const usuario = (extra = {}) => ({ id: 'u1', rol: 'USUARIO', ...extra });
const err = (status, codigo) => new ApiError({ status, codigo, mensaje: codigo });

test('decidirVista: suspendido, cancelado, borrador y finalizado sin replay', () => {
  assert.equal(decidirVista(evento({ suspendido_admin: true }), usuario()).vista, 'SUSPENDIDO');
  for (const estado of ['CANCELADO', 'BORRADOR']) {
    const d = decidirVista(evento({ estado }), usuario());
    assert.equal(d.vista, 'NO_DISPONIBLE');
    assert.ok(d.mensaje);
  }
  const sinReplay = decidirVista(evento({ estado: 'FINALIZADO' }), usuario());
  assert.equal(sinReplay.vista, 'NO_DISPONIBLE');
});

test('decidirVista: programado → sala de espera si hay derecho; si no, acceso denegado', () => {
  const programado = { estado: 'PROGRAMADO' };
  assert.equal(decidirVista(evento({ ...programado, comprado: true }), usuario()).vista, 'ESPERA');
  assert.equal(decidirVista(evento(programado), usuario()).vista, 'DENEGADO');
  assert.equal(
    decidirVista(evento(programado), usuario({ id: 'a1', rol: 'ARTISTA' })).vista,
    'ESPERA',
  );
  assert.equal(decidirVista(evento(programado), usuario({ rol: 'ADMIN' })).vista, 'ESPERA');
});

test('decidirVista: en vivo o replay → entrar (el servidor decide el acceso)', () => {
  assert.equal(decidirVista(evento(), usuario()).vista, 'ENTRAR');
  const replay = evento({ estado: 'FINALIZADO', replay_disponible: true });
  assert.equal(decidirVista(replay, usuario()).vista, 'ENTRAR');
});

test('clasificarErrorEntrar mapea los 403 y el 404; el resto se relanza', () => {
  assert.equal(clasificarErrorEntrar(err(403, 'EVENTO_SUSPENDIDO')), 'SUSPENDIDO');
  assert.equal(clasificarErrorEntrar(err(403, 'ACCESO_NO_AUTORIZADO')), 'DENEGADO');
  assert.equal(clasificarErrorEntrar(err(404, 'EVENTO_NO_ENCONTRADO')), 'NO_ENCONTRADO');
  assert.throws(
    () => clasificarErrorEntrar(err(500, 'ERROR_INTERNO')),
    (e) => e.status === 500,
  );
  assert.throws(
    () => clasificarErrorEntrar(err(0, 'ERROR_RED')),
    (e) => e.codigo === 'ERROR_RED',
  );
});

test('entrarAlEvento llama a entrar una sola vez y devuelve la reproducción', async () => {
  let llamadas = 0;
  const reproduccion = { tipo: 'VIVO', url: 'u', token: 't', expira_en: 'x' };
  const api = {
    entrar: async () => {
      llamadas++;
      return reproduccion;
    },
  };
  const r = await entrarAlEvento('e1', undefined, api);
  assert.deepEqual(r, { estado: 'OK', reproduccion });
  assert.equal(llamadas, 1);
});

test('entrarAlEvento: sin compra no hay reproducción (C4)', async () => {
  const api = {
    entrar: async () => {
      throw err(403, 'ACCESO_NO_AUTORIZADO');
    },
  };
  assert.deepEqual(await entrarAlEvento('e1', undefined, api), { estado: 'DENEGADO' });
});

test('msHastaExpirar nunca es negativo ni NaN', () => {
  const ahora = Date.parse('2026-12-05T01:00:00Z');
  assert.equal(msHastaExpirar('2026-12-05T01:10:00Z', ahora), 600000);
  assert.equal(msHastaExpirar('2026-12-05T00:00:00Z', ahora), 0);
  assert.equal(msHastaExpirar('basura', ahora), 0);
});

test('crearPlayer elige la implementación según VITE_PLAYER_MODE', () => {
  assert.ok(crearPlayer('simulated') instanceof SimulatedPlayer);
  assert.ok(crearPlayer('hls') instanceof HlsPlayer);
  assert.ok(crearPlayer('cualquier-cosa') instanceof SimulatedPlayer);
  assert.ok(crearPlayer() instanceof SimulatedPlayer, 'por defecto es el simulado');
});

test('formatDuracion: MM:SS y H:MM:SS', () => {
  assert.equal(formatDuracion(0), '00:00');
  assert.equal(formatDuracion(75), '01:15');
  assert.equal(formatDuracion(3725), '1:02:05');
  assert.equal(formatDuracion(-4), '00:00');
});

test('el acceso denegado invita a comprar y no muestra reproductor', () => {
  const salida = String(vistaDenegado({ evento: evento() }));
  assert.ok(salida.includes('Este contenido es solo para quienes compraron su entrada'));
  assert.ok(salida.includes('data-action="comprar"'));
  assert.ok(!salida.includes('data-player'));
});

test('la sala de espera tiene el contenedor de la cuenta regresiva', () => {
  assert.ok(String(vistaEspera({ evento: evento() })).includes('data-countdown'));
});

test('el reproductor trae el chat deshabilitado y escapa el título', () => {
  const salida = String(
    vistaReproductor({ evento: evento({ titulo: '<script>x</script>' }), tipo: 'VIVO' }),
  );
  assert.ok(salida.includes('El chat llegará pronto'));
  assert.match(salida, /<input[^>]*disabled/s);
  assert.ok(!salida.includes('<script>'));
  assert.ok(salida.includes('EN VIVO'));
  assert.ok(String(vistaReproductor({ evento: evento(), tipo: 'REPLAY' })).includes('REPLAY'));
});

test('los botones Ver del detalle enlazan a #/ver/:id', () => {
  for (const tipo of ['VER_AHORA', 'VER_REPLAY', 'VER_CUANDO_EMPIECE']) {
    const salida = String(eventAction({ tipo }, evento(), '#/eventos/e1'));
    assert.ok(salida.includes('href="#/ver/e1"'), tipo);
    assert.ok(!/disabled/.test(salida), tipo);
  }
});

test('hls.js solo se importa de forma diferida dentro del reproductor HLS', () => {
  const archivos = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.push(ruta);
    }
  };
  recorrer('src');
  const conHls = archivos.filter((f) => readFileSync(f, 'utf8').includes("'hls.js'"));
  assert.deepEqual(
    conHls.map((f) => f.replaceAll('\\', '/')),
    ['src/features/watch/player/hls-player.js'],
  );
  const fuente = readFileSync(conHls[0], 'utf8');
  assert.ok(fuente.includes("import('hls.js')"));
  assert.ok(!/^import .* from 'hls\.js'/m.test(fuente), 'sin importación estática');
});
