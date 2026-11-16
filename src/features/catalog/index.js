// API pública de la feature `catalog`.
export { homePage } from './pages/home.page.js';
export { eventsPage } from './pages/events.page.js';
export { eventDetailPage } from './pages/event-detail.page.js';
export { artistsPage } from './pages/artists.page.js';
export { artistDetailPage } from './pages/artist-detail.page.js';

// Botones de favorito y seguir (cambio optimista), para reutilizarlos en otras features.
export {
  activarFavoritos,
  eventCardConFavorito,
  favoriteButton,
} from './components/favorite-button.js';
export { activarSeguir, artistCardConSeguir, followButton } from './components/follow-button.js';
export {
  favoritos as favoritosDelUsuario,
  seguidos as seguidosDelUsuario,
} from './social.service.js';
