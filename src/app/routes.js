import { requiereRol, requiereSesion } from './guards.js';

/**
 * Tabla de rutas. `load` hace la carga diferida de la feature y devuelve la función de página.
 * `*` al final captura cualquier subruta. Lo que aún no existe apunta a "Próximamente".
 * @typedef {{path: string, layout?: 'public'|'studio'|'admin', guard?: import('./guards.js').Guard,
 *   guestOnly?: boolean, load: () => Promise<Function>}} Route
 */

const proximamente = () => import('./pages/system.pages.js').then((m) => m.comingSoonPage);
const cuenta = requiereRol('USUARIO', 'ARTISTA');
const soloArtista = requiereRol('ARTISTA');
const soloAdmin = requiereRol('ADMIN');

/** @type {Route[]} */
export const routes = [
  { path: '/', load: () => import('../features/catalog/index.js').then((m) => m.homePage) },
  {
    path: '/login',
    guestOnly: true,
    load: () => import('../features/auth/index.js').then((m) => m.loginPage),
  },
  {
    path: '/registro',
    guestOnly: true,
    load: () => import('../features/auth/index.js').then((m) => m.registerPage),
  },
  {
    path: '/eventos',
    load: () => import('../features/catalog/index.js').then((m) => m.eventsPage),
  },
  {
    path: '/eventos/:id',
    load: () => import('../features/catalog/index.js').then((m) => m.eventDetailPage),
  },
  {
    path: '/artistas',
    load: () => import('../features/catalog/index.js').then((m) => m.artistsPage),
  },
  {
    path: '/artistas/:id',
    load: () => import('../features/catalog/index.js').then((m) => m.artistDetailPage),
  },
  {
    path: '/ver/:eventoId',
    guard: requiereSesion,
    load: () => import('../features/watch/index.js').then((m) => m.watchPage),
  },
  {
    path: '/perfil',
    guard: requiereSesion,
    load: () => import('../features/account/index.js').then((m) => m.profilePage),
  },
  {
    path: '/sin-acceso',
    load: () => import('./pages/system.pages.js').then((m) => m.forbiddenPage),
  },

  // Cuenta (USUARIO y ARTISTA): entradas, favoritos y artistas que sigo
  ...[
    ['/mis-eventos', 'misEventosPage'],
    ['/favoritos', 'favoritesPage'],
    ['/siguiendo', 'followingPage'],
  ].map(([path, pagina]) => ({
    path,
    guard: cuenta,
    load: () => import('../features/account/index.js').then((m) => m[pagina]),
  })),

  // Próximamente
  { path: '/politica-datos', load: proximamente },
  ...[
    ['/estudio', 'studioHomePage'],
    ['/estudio/eventos', 'myEventsPage'],
    ['/estudio/eventos/nuevo', 'eventFormPage'],
    ['/estudio/eventos/:id/editar', 'eventFormPage'],
    ['/estudio/eventos/:id/transmision', 'controlRoomPage'],
    ['/estudio/eventos/:id/estadisticas', 'eventStatsPage'],
    ['/estudio/finanzas', 'financePage'],
  ].map(([path, pagina]) => ({
    path,
    layout: 'studio',
    guard: soloArtista,
    load: () => import('../features/studio/index.js').then((m) => m[pagina]),
  })),

  // Administración: todas las rutas exigen ADMIN (otro rol va a "No tienes acceso").
  ...[
    ['/admin', 'dashboardPage'],
    ['/admin/usuarios', 'usersPage'],
    ['/admin/eventos', 'adminEventsPage'],
    ['/admin/compras', 'purchasesPage'],
    ['/admin/retiros', 'withdrawalsPage'],
    ['/admin/configuracion', 'settingsPage'],
  ].map(([path, pagina]) => ({
    path,
    layout: 'admin',
    guard: soloAdmin,
    load: () => import('../features/admin/index.js').then((m) => m[pagina]),
  })),
];

export const notFoundRoute = {
  path: '*',
  load: () => import('./pages/system.pages.js').then((m) => m.notFoundPage),
};
