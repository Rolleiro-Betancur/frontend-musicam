import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cerrarSesion, iniciarSesion } from '../../src/core/session/session.js';
import { requiereRol } from '../../src/app/guards.js';
import { routes } from '../../src/app/routes.js';
import { encontrarRuta } from '../../src/app/route-match.js';
import { enlacesPorRol } from '../../src/shared/ui/navbar-links.js';
import {
  badgeEstadoCompra,
  badgeEstadoEvento,
  badgeEstadoRetiro,
  badgeEstadoUsuario,
  badgeRol,
} from '../../src/features/admin/components/admin-ui.js';
import {
  filtroFecha,
  filtroSelect,
  filtroTexto,
} from '../../src/features/admin/components/filtros-ui.js';

const entrar = (rol) =>
  iniciarSesion({
    access_token: 'a',
    refresh_token: 'r',
    usuario: { id: 'u1', nombre: 'Ana', rol },
  });

beforeEach(() => cerrarSesion());

test('el enlace "Administración" de la navbar es solo para ADMIN', () => {
  const textos = (rol) => enlacesPorRol(rol).map((e) => e.texto);
  assert.ok(textos('ADMIN').includes('Administración'));
  for (const rol of ['USUARIO', 'ARTISTA', undefined]) {
    assert.ok(!textos(rol).includes('Administración'), String(rol));
  }
  assert.ok(textos('ARTISTA').includes('Estudio'));
  assert.ok(!textos('ADMIN').includes('Estudio'));
  assert.equal(enlacesPorRol('ADMIN').find((e) => e.texto === 'Administración').href, '#/admin');
});

test('requiereRol(ADMIN): sin sesión va a login; otro rol a "No tienes acceso"; ADMIN pasa', () => {
  const guard = requiereRol('ADMIN');
  assert.deepEqual(guard({ hash: '#/admin/usuarios' }), {
    redirect: '#/login?redirect=%23%2Fadmin%2Fusuarios',
  });
  for (const rol of ['USUARIO', 'ARTISTA']) {
    entrar(rol);
    assert.deepEqual(guard({ hash: '#/admin' }), { redirect: '#/sin-acceso' }, rol);
  }
  entrar('ADMIN');
  assert.equal(guard({ hash: '#/admin' }), true);
});

test('todas las rutas de administración usan el layout admin y exigen ADMIN', () => {
  const rutas = routes.filter((r) => r.path.startsWith('/admin'));
  assert.deepEqual(
    rutas.map((r) => r.path),
    [
      '/admin',
      '/admin/usuarios',
      '/admin/eventos',
      '/admin/compras',
      '/admin/retiros',
      '/admin/configuracion',
    ],
  );
  for (const ruta of rutas) {
    assert.equal(ruta.layout, 'admin', ruta.path);
    assert.ok(ruta.guard, `${ruta.path} sin guard`);
    for (const rol of ['USUARIO', 'ARTISTA']) {
      entrar(rol);
      assert.deepEqual(ruta.guard({ hash: `#${ruta.path}` }), { redirect: '#/sin-acceso' });
    }
    cerrarSesion();
    assert.match(ruta.guard({ hash: `#${ruta.path}` }).redirect, /^#\/login\?redirect=/);
    entrar('ADMIN');
    assert.equal(ruta.guard({ hash: `#${ruta.path}` }), true, ruta.path);
  }
});

test('una subruta de administración inexistente no se sirve (404, no un comodín protegido)', () => {
  assert.equal(encontrarRuta('/admin/usuarios')?.route.path, '/admin/usuarios');
  assert.equal(encontrarRuta('/admin/loquesea'), null);
  assert.equal(encontrarRuta('/estudio/loquesea'), null);
});

test('las insignias de estado llevan texto, no solo color', () => {
  assert.ok(String(badgeEstadoUsuario('SUSPENDIDO')).includes('Suspendido'));
  assert.ok(String(badgeEstadoUsuario('ACTIVO')).includes('Activo'));
  assert.ok(String(badgeRol('ADMIN')).includes('Administrador'));
  assert.ok(String(badgeEstadoEvento('EN_VIVO')).includes('EN VIVO'));
  assert.ok(String(badgeEstadoEvento('CANCELADO')).includes('Cancelado'));
  assert.ok(String(badgeEstadoCompra('REEMBOLSADA')).includes('Reembolsada'));
  assert.ok(String(badgeEstadoRetiro('PENDIENTE')).includes('Pendiente'));
});

test('los campos de filtro escapan sus valores y marcan la búsqueda con retraso', () => {
  const texto = String(
    filtroTexto({ name: 'q', label: 'Buscar', valor: '"><script>x</script>', retraso: true }),
  );
  assert.ok(!texto.includes('<script>'));
  assert.ok(texto.includes('data-debounce'));
  assert.ok(!String(filtroTexto({ name: 'x', label: 'X' })).includes('data-debounce'));
  const select = String(
    filtroSelect({
      name: 'rol',
      label: 'Rol',
      valor: 'ARTISTA',
      opciones: [
        ['USUARIO', 'U'],
        ['ARTISTA', 'A'],
      ],
    }),
  );
  assert.match(select, /value="ARTISTA"\s+selected/);
  assert.ok(select.includes('>Todos<'));
  assert.ok(
    String(filtroFecha({ name: 'desde', label: 'Desde', valor: '2026-12-01' })).includes(
      'type="date"',
    ),
  );
});

test('las listas bloquean botones, muestran el aviso y limpian listeners en destroy()', () => {
  const fuente = readFileSync('src/features/admin/components/admin-list.js', 'utf8');
  assert.match(fuente, /botones\.forEach\(\(b\) => \(b\.disabled = true\)\)/);
  assert.match(fuente, /if \(ocupado\) return false/);
  assert.match(fuente, /role="alert"/);
  assert.match(fuente, /textoDeAviso\(error\)/);
  assert.match(
    fuente,
    /destroy\(\) \{[\s\S]*removeEventListener\('click', alClic\)[\s\S]*removeEventListener\('submit', alEnviar\)/,
  );
  const dashboard = readFileSync('src/features/admin/pages/dashboard.page.js', 'utf8');
  assert.match(dashboard, /destroy\(\) \{[\s\S]*limpiarGraficas\(\)/);
});

test('el módulo admin no guarda nada en almacenamiento ni escribe en consola', () => {
  for (const archivo of [
    'src/features/admin/admin.service.js',
    'src/features/admin/components/admin-list.js',
    'src/features/admin/components/dialogs.js',
    'src/features/admin/pages/users.page.js',
    'src/features/admin/pages/settings.page.js',
  ]) {
    const fuente = readFileSync(archivo, 'utf8');
    assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(fuente), archivo);
    assert.ok(!/console\.(log|info|debug)/.test(fuente), archivo);
  }
});
