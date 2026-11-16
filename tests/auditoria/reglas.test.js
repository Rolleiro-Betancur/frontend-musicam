import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { enlaceDeConfig } from '../../src/core/config.js';
import { construirCsp } from '../../csp.config.js';

/** Auditoría de seguridad y reglas (§7, §12): estas pruebas fallan si alguien reintroduce una infracción. */

const archivosDe = (dir, extension) => {
  const lista = [];
  const recorrer = (d) => {
    for (const nombre of readdirSync(d)) {
      const ruta = join(d, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith(extension)) lista.push(ruta.replaceAll('\\', '/'));
    }
  };
  recorrer(dir);
  return lista;
};
const fuentes = archivosDe('src', '.js').map((ruta) => ({
  ruta,
  texto: readFileSync(ruta, 'utf8'),
}));
const donde = (patron, { excepto = [] } = {}) =>
  fuentes.filter((f) => !excepto.includes(f.ruta) && patron.test(f.texto)).map((f) => f.ruta);

test('innerHTML solo en los 3 puntos controlados (plantillas fijas o SafeHtml)', () => {
  assert.deepEqual(donde(/innerHTML|insertAdjacentHTML|outerHTML/).sort(), [
    'src/shared/ui/modal.js',
    'src/shared/ui/toast.js',
    'src/shared/utils/dom.js',
  ]);
  // dom.js solo acepta SafeHtml (rechaza cadenas sueltas)
  const dom = readFileSync('src/shared/utils/dom.js', 'utf8');
  assert.match(dom, /instanceof SafeHtml/);
  assert.match(dom, /throw new TypeError/);
  // toast y modal escapan todo lo que interpolan de fuera
  assert.match(readFileSync('src/shared/ui/toast.js', 'utf8'), /escapeHtml\(mensaje\)/);
  assert.match(readFileSync('src/shared/ui/modal.js', 'utf8'), /escapeHtml\(titulo\)/);
});

test('el contenido de plantillas `html` nunca se marca como confiable con raw() con datos', () => {
  const usos = fuentes.filter(
    (f) => f.ruta !== 'src/shared/utils/html.js' && /\braw\(/.test(f.texto),
  );
  assert.deepEqual(
    usos.map((f) => f.ruta),
    [],
  );
});

test('sin eval, new Function, document.write ni temporizadores con cadenas', () => {
  assert.deepEqual(
    donde(/\beval\(|new Function|document\.write|set(Timeout|Interval)\(\s*['"`]/),
    [],
  );
});

test('fetch, XMLHttpRequest y sendBeacon solo en core/http/api-client.js', () => {
  assert.deepEqual(
    donde(/\bfetch\(|XMLHttpRequest|sendBeacon/, { excepto: ['src/core/http/api-client.js'] }),
    [],
  );
});

test('solo el refresh token toca sessionStorage; nada usa localStorage, cookies ni IndexedDB', () => {
  assert.deepEqual(donde(/localStorage|indexedDB|document\.cookie/), []);
  assert.deepEqual(donde(/sessionStorage/), ['src/core/session/session-store.js']);
  const almacen = readFileSync('src/core/session/session-store.js', 'utf8');
  assert.equal([...almacen.matchAll(/(set|get|remove)Item\(/g)].length, 3);
  assert.equal(
    [...almacen.matchAll(/(set|get|remove)Item\(([A-Z_]+)/g)].every(
      (m) => m[2] === 'CLAVE_REFRESH',
    ),
    true,
  );
  // el access token vive solo en una variable del módulo
  assert.match(almacen, /let accessToken = null/);
});

test('ni contraseñas, tokens ni stream_key llegan a la consola', () => {
  const consolas = fuentes.filter((f) => /console\./.test(f.texto));
  // única excepción: el router, en desarrollo, registra el error de render (no datos de la sesión)
  assert.deepEqual(
    consolas.map((f) => f.ruta),
    ['src/app/router.js'],
  );
  const router = readFileSync('src/app/router.js', 'utf8');
  assert.match(router, /if \(config\.isDev\) console\.error\(error\)/);
  assert.ok(!/console\.(log|info|debug|warn)/.test(router));
});

test('capas: shared y core no importan de features ni de app; features no importan de app', () => {
  const infracciones = [];
  for (const { ruta, texto } of fuentes) {
    const capa = ruta.split('/')[1];
    for (const m of texto.matchAll(/from '((?:\.\.?\/)+)([^']+)'/g)) {
      const destino = join(ruta.split('/').slice(0, -1).join('/'), m[1] + m[2]).replaceAll(
        '\\',
        '/',
      );
      const objetivo = destino.split('/')[1];
      if (
        (capa === 'shared' || capa === 'core') &&
        (objetivo === 'features' || objetivo === 'app')
      ) {
        infracciones.push(`${ruta} → ${destino}`);
      }
      if (capa === 'core' && objetivo === 'shared') infracciones.push(`${ruta} → ${destino}`);
      if (capa === 'features' && objetivo === 'app') infracciones.push(`${ruta} → ${destino}`);
    }
  }
  assert.deepEqual(infracciones, []);
});

test('una feature solo importa archivos de otra a través de su index.js', () => {
  const infracciones = [];
  for (const { ruta, texto } of fuentes) {
    const partes = ruta.split('/');
    if (partes[1] !== 'features') continue;
    for (const m of texto.matchAll(/from '((?:\.\.?\/)+[^']+)'/g)) {
      const destino = join(partes.slice(0, -1).join('/'), m[1]).replaceAll('\\', '/').split('/');
      if (destino[1] !== 'features' || destino[2] === partes[2]) continue;
      if (destino.slice(3).join('/') !== 'index.js')
        infracciones.push(`${ruta} → ${destino.join('/')}`);
    }
  }
  assert.deepEqual(infracciones, []);
});

test('el dinero viene siempre del servidor: sin cálculos de comisión, saldo ni centavos en el cliente', () => {
  // Ninguna operación aritmética con campos *_cop ni con precio/monto/neto/comisión/saldo.
  const aritmetica = /\b\w*(_cop|monto|precio|neto|comision|saldo|ingresos?)\w*\s*[-+*/]\s*[\w(]/i;
  const sospechosos = [];
  for (const { ruta, texto } of fuentes) {
    for (const [i, linea] of texto.split('\n').entries()) {
      const limpia = linea.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      if (
        /['"`].*(_cop|monto|precio)[^'"`]*['"`]/.test(limpia) &&
        !aritmetica.test(limpia.replace(/(['"`]).*?\1/g, ''))
      )
        continue;
      if (
        aritmetica.test(limpia.replace(/(['"`]).*?\1/g, '')) &&
        !/\.\.\.|=>\s*\w+\.\w+\s*$/.test(limpia)
      ) {
        sospechosos.push(`${ruta}:${i + 1}: ${linea.trim()}`);
      }
    }
  }
  assert.deepEqual(sospechosos, []);
  assert.deepEqual(donde(/\*\s*100\b|\/\s*100\b|toFixed\(/), []);
});

test('toda URL externa se valida y los enlaces target="_blank" llevan rel="noopener noreferrer"', () => {
  for (const { ruta, texto } of fuentes) {
    for (const m of texto.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
      assert.match(m[0], /rel="noopener noreferrer"/, `${ruta}: ${m[0]}`);
    }
  }
  // portadas y fotos: solo https (o http://localhost) o rutas del propio backend
  assert.match(
    readFileSync('src/shared/ui/cover.js', 'utf8'),
    /esUrlExternaSegura\(evento\.portada_url\)/,
  );
  assert.match(readFileSync('src/shared/utils/media-url.js', 'utf8'), /esUrlExternaSegura/);
  // el hash de política viene del entorno y se valida
  assert.equal(enlaceDeConfig('javascript:alert(1)', '#/politica-datos'), '#/politica-datos');
  assert.equal(enlaceDeConfig('data:text/html,x', '#/politica-datos'), '#/politica-datos');
  assert.equal(enlaceDeConfig('//malo.com', '#/politica-datos'), '#/politica-datos');
  assert.equal(enlaceDeConfig('#//malo.com', '#/politica-datos'), '#/politica-datos');
  assert.equal(enlaceDeConfig('http://malo.com/p', '#/politica-datos'), '#/politica-datos');
  assert.equal(enlaceDeConfig('https://sitio.co/politica', '#/x'), 'https://sitio.co/politica');
  assert.equal(enlaceDeConfig('#/politica-datos', '#/x'), '#/politica-datos');
  assert.equal(enlaceDeConfig(undefined, '#/x'), '#/x');
});

test('las redirecciones internas empiezan por #/ y la de login se valida', () => {
  for (const { ruta, texto } of fuentes) {
    for (const m of texto.matchAll(/location\.(hash|href)\s*=\s*([^;\n]+)/g)) {
      const valor = m[2];
      const seguro =
        /^['"`]#\//.test(valor) || // literal interno
        /destinoTrasAutenticar|loginHref|\bhash\b|`#\/login\?redirect=/.test(valor) ||
        /^['"`]#\/eventos/.test(valor);
      assert.ok(seguro, `${ruta}: location.${m[1]} = ${valor}`);
    }
    assert.ok(!/location\.href\s*=/.test(texto), `${ruta} usa location.href`);
    assert.ok(!/window\.open\(/.test(texto), `${ruta} usa window.open`);
  }
  assert.match(
    readFileSync('src/features/auth/auth.service.js', 'utf8'),
    /esRedirectSeguro\(redirect\)/,
  );
});

test('ningún texto menciona planes, suscripciones ni "cuenta en revisión" (C1/C2)', () => {
  const prohibidos =
    /\bplanes?\b|mensualidad|cuenta (est[aá] )?en revisi[oó]n|ser[aá] revisada|aprobaci[oó]n manual|plan (premium|b[aá]sico|pro)/i;
  const hallazgos = [];
  for (const { ruta, texto } of fuentes) {
    for (const [i, linea] of texto.split('\n').entries()) {
      if (prohibidos.test(linea) && !/sin planes|ni planes|no hay planes/i.test(linea)) {
        hallazgos.push(`${ruta}:${i + 1}: ${linea.trim()}`);
      }
    }
    // "suscripción" solo se admite negada ("sin cuota fija ni suscripción") o como evento del bus
    for (const [i, linea] of texto.split('\n').entries()) {
      if (
        /suscrip/i.test(linea) &&
        !/ni suscripci[oó]n|cancelar la suscripci[oó]n|suscripciones/.test(linea) &&
        !/^\s*(\/\/|\*|\/\*\*)/.test(linea)
      ) {
        hallazgos.push(`${ruta}:${i + 1}: ${linea.trim()}`);
      }
    }
  }
  assert.deepEqual(hallazgos, []);
  // el texto de C2 sigue en el formulario de evento y en el pie
  assert.match(
    readFileSync('src/features/studio/components/event-form-view.js', 'utf8'),
    /Sin cuota fija ni suscripción/,
  );
  assert.match(readFileSync('src/shared/ui/footer.js', 'utf8'), /Sin cuota fija/);
});

test('sin TODO(Fase …) pendientes ni mocks (VITE_USE_MOCKS)', () => {
  assert.deepEqual(donde(/TODO\(Fase|FIXME|VITE_USE_MOCKS|src\/mocks/), []);
  assert.deepEqual(
    archivosDe('src', '.js').filter((r) => r.includes('/mocks/')),
    [],
  );
  assert.ok(!readFileSync('.env.example', 'utf8').includes('MOCKS'));
});

test('la CSP del build limita los scripts al propio origen y permite solo la API configurada', () => {
  const csp = construirCsp('http://localhost:8000/api/v1');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self' http:\/\/localhost:8000(;|$)/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline|\*/.test(csp));
  // sin API válida, solo el propio origen
  assert.match(construirCsp('no-es-url'), /connect-src 'self'(;|$)/);
  assert.match(construirCsp(undefined), /connect-src 'self'(;|$)/);
});

test('index.html: idioma es-CO, tema oscuro, enlace "Saltar al contenido" y sin scripts en línea', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<html lang="es-CO" data-bs-theme="dark">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /name="viewport"/);
  assert.ok(!/<script(?![^>]*\bsrc=)/.test(html), 'hay un script en línea');
  assert.ok(!/\son\w+=/.test(html), 'hay manejadores en línea');
});
