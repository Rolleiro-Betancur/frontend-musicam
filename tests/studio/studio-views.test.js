import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEXTO_SIN_CUOTA,
  vistaFormulario,
} from '../../src/features/studio/components/event-form-view.js';
import {
  vistaCredenciales,
  vistaSala,
} from '../../src/features/studio/components/control-room-views.js';
import { filaEvento } from '../../src/features/studio/components/studio-views.js';
import {
  CAMPOS,
  camposEditables,
  valoresIniciales,
} from '../../src/features/studio/studio.service.js';

const evento = (extra = {}) => ({
  id: 'e1',
  titulo: 'Mi concierto',
  descripcion: null,
  categoria: 'ROCK',
  portada_url: null,
  precio_cop: 20000,
  fecha_inicio: '2026-12-05T01:00:00+00:00',
  duracion_estimada_min: 90,
  replay_habilitado: true,
  replay_disponible: false,
  estado: 'PROGRAMADO',
  suspendido_admin: false,
  ...extra,
});
const formulario = (e, conVentas = false, esNuevo = false) =>
  String(
    vistaFormulario({
      valores: valoresIniciales(esNuevo ? null : e),
      editables: esNuevo ? new Set(CAMPOS) : camposEditables(e.estado, conVentas),
      esNuevo,
      estado: esNuevo ? undefined : e.estado,
      evento: e,
    }),
  );
const normal = (s) => s.replace(/\s+/g, ' ');

test('el formulario aclara que no hay cuota fija, justo bajo el precio (C2)', () => {
  const salida = normal(formulario(evento(), false, true));
  assert.ok(salida.includes(TEXTO_SIN_CUOTA));
  assert.ok(salida.includes('Sin cuota fija'));
  assert.ok(!/suscripci[oó]n mensual|plan/i.test(salida.replace(TEXTO_SIN_CUOTA, '')));
});

test('evento nuevo: guardar borrador y guardar y publicar', () => {
  const salida = formulario(evento(), false, true);
  assert.ok(salida.includes('Guardar borrador'));
  assert.ok(salida.includes('data-action="guardar-publicar"'));
});

test('borrador: Guardar, Publicar y Eliminar; programado: Guardar cambios y Cancelar con aviso', () => {
  const borrador = formulario(evento({ estado: 'BORRADOR' }));
  for (const accion of ['data-action="publicar"', 'data-action="eliminar"'])
    assert.ok(borrador.includes(accion));
  const programado = formulario(evento());
  assert.ok(programado.includes('data-action="cancelar"'));
  assert.ok(!programado.includes('data-action="eliminar"'));
});

test('con ventas: precio, fecha, duración y replay deshabilitados, con explicación', () => {
  const salida = formulario(evento(), true);
  for (const campo of [
    'precio_cop',
    'fecha_inicio',
    'duracion_estimada_min',
    'replay_habilitado',
  ]) {
    assert.match(
      salida,
      new RegExp(`name="${campo}"[^>]*disabled|disabled[^>]*name="${campo}"`, 's'),
      campo,
    );
  }
  assert.doesNotMatch(salida, /name="titulo"[^>]*disabled/s);
  assert.ok(normal(salida).includes('ya tiene entradas vendidas'));
});

test('estados no editables quedan en solo lectura', () => {
  for (const estado of ['EN_VIVO', 'FINALIZADO', 'CANCELADO']) {
    const salida = formulario(evento({ estado }));
    assert.ok(!salida.includes('type="submit"'), estado);
    assert.match(salida, /name="titulo"[^>]*disabled/s, estado);
    assert.ok(normal(salida).includes('ya no se puede editar'), estado);
  }
});

test('el formulario escapa los datos del evento', () => {
  const salida = formulario(
    evento({ titulo: '"><script>x</script>', descripcion: '</textarea><b>x</b>' }),
  );
  assert.ok(!salida.includes('<script>'));
  assert.ok(!salida.includes('</textarea><b>'));
});

test('las credenciales avisan que se muestran una sola vez y no llevan la clave en el HTML', () => {
  const salida = normal(String(vistaCredenciales()));
  assert.ok(salida.includes('Esta clave se muestra una sola vez'));
  assert.ok(salida.includes('Guárdala en OBS'));
  assert.ok(salida.includes('data-action="copiar"'));
  assert.ok(!/value="/.test(salida), 'los valores se asignan en memoria, no en el marcado');
});

test('sala de control: pasos según el estado del evento', () => {
  const programado = String(vistaSala({ evento: evento(), transmision: null }));
  assert.ok(programado.includes('data-credenciales') && programado.includes('data-form-iniciar'));
  assert.ok(!programado.includes('data-action="finalizar"'));

  const enVivo = String(
    vistaSala({
      evento: evento({ estado: 'EN_VIVO' }),
      transmision: {
        espectadores_actuales: 41,
        pico_espectadores: 57,
        duracion_transcurrida_min: 12,
      },
    }),
  );
  assert.ok(enVivo.includes('data-metric="espectadores"') && enVivo.includes('>41<'));
  assert.ok(enVivo.includes('>57<') && enVivo.includes('12 min'));
  assert.ok(enVivo.includes('data-action="finalizar"') && enVivo.includes('data-dev-tools'));

  const fin = String(
    vistaSala({
      evento: evento({ estado: 'FINALIZADO' }),
      transmision: {
        espectadores_actuales: 0,
        pico_espectadores: 57,
        duracion_transcurrida_min: 90,
      },
    }),
  );
  assert.ok(fin.includes('data-resumen') && !fin.includes('data-action="finalizar"'));
});

test('fila del listado: acciones por estado y solo enlaces en el resumen', () => {
  const borrador = String(filaEvento(evento({ estado: 'BORRADOR' })));
  for (const a of ['publicar', 'eliminar']) assert.ok(borrador.includes(`data-action="${a}"`));
  const programado = String(filaEvento(evento()));
  assert.ok(programado.includes('data-action="cancelar"') && programado.includes('/transmision'));
  const resumen = String(filaEvento(evento(), { soloEnlaces: true }));
  assert.ok(!resumen.includes('data-action='));
  assert.ok(resumen.includes('/editar'));
});

test('la stream_key no se guarda en almacenamiento ni se escribe en consola', () => {
  const archivos = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.push(ruta);
    }
  };
  recorrer('src/features/studio');
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8');
    assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(fuente), archivo);
    assert.ok(!/console\.(log|info|debug)/.test(fuente), archivo);
  }
});
