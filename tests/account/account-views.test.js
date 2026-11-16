import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ticketCard } from '../../src/features/account/components/ticket-card.js';
import { vistaCalendario } from '../../src/features/account/components/calendar-view.js';
import { agruparPorDia } from '../../src/features/account/tickets.service.js';

const normal = (s) => String(s).replace(/\s+/g, ' ');
const compra = (estado, evento = {}, extra = {}) => ({
  id: 'c1',
  estado,
  monto_cop: 20000,
  evento: {
    id: 'e1',
    titulo: 'Concierto',
    categoria: 'ROCK',
    portada_url: null,
    precio_cop: 20000,
    estado: 'PROGRAMADO',
    replay_disponible: false,
    fecha_inicio: '2026-12-05T01:00:00+00:00',
    artista: { id: 'a1', nombre_artistico: 'Los Cumbieros' },
    ...evento,
  },
  ...extra,
});

test('la entrada muestra título, artista, fecha de Bogotá, estado de la compra y monto pagado', () => {
  const salida = normal(ticketCard(compra('APROBADA')));
  assert.ok(salida.includes('Concierto') && salida.includes('Los Cumbieros'));
  assert.ok(salida.includes('4 de dic de 2026, 08:00 p. m.'));
  assert.ok(salida.includes('Pagada'));
  assert.ok(salida.includes('Pagaste <strong>$ 20.000</strong>'));
  assert.ok(salida.includes('href="#/eventos/e1"'));
});

test('la entrada ofrece Ver ahora / Ver cuando empiece / Ver replay enlazando a #/ver/:id', () => {
  const casos = [
    [compra('APROBADA', { estado: 'EN_VIVO' }), 'Ver ahora'],
    [compra('APROBADA'), 'Ver cuando empiece'],
    [compra('APROBADA', { estado: 'FINALIZADO', replay_disponible: true }), 'Ver replay'],
  ];
  for (const [c, texto] of casos) {
    const salida = normal(ticketCard(c));
    assert.ok(salida.includes(texto), texto);
    assert.ok(salida.includes('href="#/ver/e1"'), texto);
  }
});

test('un pago pendiente ofrece Completar pago, que abre el checkout', () => {
  const salida = String(ticketCard(compra('PENDIENTE')));
  assert.ok(salida.includes('data-action="completar-pago"'));
  assert.ok(salida.includes('data-compra="c1"'));
  assert.ok(normal(salida).includes('Pago pendiente'));
  assert.ok(normal(salida).includes('Monto <strong>'));
});

test('rechazadas, anuladas y reembolsadas no tienen botón de acción', () => {
  for (const estado of ['RECHAZADA', 'ANULADA', 'REEMBOLSADA']) {
    const salida = String(ticketCard(compra(estado)));
    assert.ok(!salida.includes('<button'), estado);
    assert.ok(!salida.includes('href="#/ver/'), estado);
  }
});

test('la entrada escapa los datos que vienen de la API', () => {
  const salida = String(
    ticketCard(
      compra('APROBADA', {
        titulo: '<script>x</script>',
        artista: { id: 'a1', nombre_artistico: '"><img src=x onerror=alert(1)>' },
      }),
    ),
  );
  assert.ok(!salida.includes('<script>') && !salida.includes('<img src=x'));
});

test('el calendario marca los días con evento, el día de hoy y el día elegido', () => {
  const dias = agruparPorDia([
    compra('APROBADA', { id: 'a', fecha_inicio: '2026-12-05T06:00:00+00:00' }),
    compra('APROBADA', { id: 'b', fecha_inicio: '2026-12-05T20:00:00+00:00' }),
    compra('APROBADA', { id: 'c', fecha_inicio: '2026-12-20T20:00:00+00:00' }),
  ]);
  const salida = String(
    vistaCalendario({
      mes: { anio: 2026, mes: 12 },
      dias,
      seleccionado: '2026-12-05',
      hoy: '2026-12-10',
    }),
  );
  assert.ok(salida.includes('aria-label="5 de diciembre: 2 eventos"'));
  assert.ok(salida.includes('aria-label="20 de diciembre: 1 evento"'));
  assert.ok(salida.includes('aria-label="6 de diciembre, sin eventos"'));
  assert.ok(salida.includes('aria-label="10 de diciembre, sin eventos, hoy"'));
  assert.match(
    salida,
    /data-fecha="2026-12-05"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-fecha="2026-12-05"/s,
  );
  assert.equal((salida.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.ok(normal(salida).includes('diciembre de 2026'));
  assert.equal((salida.match(/<th scope="col"/g) ?? []).length, 7);
  assert.ok(
    salida.includes('data-action="mes-anterior"') && salida.includes('data-action="mes-siguiente"'),
  );
});

test('las celdas fuera del mes no son botones', () => {
  const salida = String(
    vistaCalendario({
      mes: { anio: 2026, mes: 11 },
      dias: new Map(),
      seleccionado: null,
      hoy: '2026-11-03',
    }),
  );
  assert.equal((salida.match(/data-action="dia"/g) ?? []).length, 30);
  assert.ok(salida.includes('class="cal__out" aria-hidden="true"'));
});

test('una feature solo importa de otra por su index.js (§3.1)', () => {
  const infracciones = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) {
        const propia = ruta.replaceAll('\\', '/').split('/')[2]; // src/features/<nombre>/...
        const fuente = readFileSync(ruta, 'utf8');
        for (const m of fuente.matchAll(
          /from '((?:\.\.\/)+)features\/([a-z-]+)\/([^']*)'|from '(?:\.\.\/)+([a-z-]+)\/([^']*)'/g,
        )) {
          const otra = m[2] ?? m[4];
          const resto = m[3] ?? m[5];
          if (!otra || otra === propia) continue;
          if (
            !['auth', 'catalog', 'checkout', 'watch', 'account', 'studio', 'admin'].includes(otra)
          )
            continue;
          if (resto !== 'index.js') infracciones.push(`${ruta} → ${otra}/${resto}`);
        }
      }
    }
  };
  recorrer('src/features');
  assert.deepEqual(infracciones, []);
});

test('account no duplica la lógica de favoritos y seguir: usa los componentes de catalog', () => {
  const archivos = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.push(ruta);
    }
  };
  recorrer('src/features/account');
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8');
    assert.ok(
      !/favoritos\/\$\{|seguidos\/\$\{/.test(fuente),
      `${archivo} llama a PUT/DELETE directamente`,
    );
    assert.ok(!/api\.(put|delete)\([^)]*(favoritos|seguidos)/s.test(fuente), archivo);
  }
  const favoritos = readFileSync('src/features/account/pages/favorites.page.js', 'utf8');
  assert.ok(favoritos.includes("from '../../catalog/index.js'"));
  assert.ok(favoritos.includes('activarFavoritos') && favoritos.includes('eventCardConFavorito'));
  const siguiendo = readFileSync('src/features/account/pages/following.page.js', 'utf8');
  assert.ok(siguiendo.includes('activarSeguir') && siguiendo.includes('artistCardConSeguir'));
});

test('las pantallas con listeners los quitan en destroy()', () => {
  for (const pagina of ['my-events', 'social-list']) {
    const fuente = readFileSync(
      `src/features/account/pages/${pagina}.page.js`.replace('social-list.page', 'social-list'),
      'utf8',
    );
    assert.match(
      fuente,
      /destroy\(\) \{[\s\S]*(removeEventListener|quitarClic|quitarToggle)/,
      pagina,
    );
  }
});
