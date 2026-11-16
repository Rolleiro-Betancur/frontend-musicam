import { config } from '../../../core/config.js';
import { HlsPlayer } from './hls-player.js';
import { SimulatedPlayer } from './simulated-player.js';

/**
 * Contrato de los reproductores.
 * @typedef {object} PlayerAdapter
 * @property {(el: HTMLElement, opciones: {url: string, tipo: 'VIVO'|'REPLAY', evento: object,
 *   onError?: (mensaje: string) => void}) => Promise<void>} mount
 * @property {() => void} destroy
 */

/**
 * Elige la implementación según `VITE_PLAYER_MODE`: `simulated` (por defecto) o `hls`.
 * @param {string} [modo]
 * @returns {PlayerAdapter}
 */
export function crearPlayer(modo = config.playerMode) {
  return modo === 'hls' ? new HlsPlayer() : new SimulatedPlayer();
}
