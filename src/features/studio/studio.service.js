import { bogotaLocalToIso, isoToBogotaLocal } from '../../shared/utils/format-date.js';
import { esUrlExternaSegura } from '../../shared/utils/validators.js';
import { esCategoriaValida } from '../../shared/utils/categorias.js';
import * as studioApi from './studio.api.js';

export const PAGE_SIZE = 10;

export const ETIQUETA_ESTADO = {
  BORRADOR: 'Borrador',
  PROGRAMADO: 'Programado',
  EN_VIVO: 'En vivo',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
export const ESTADOS_FILTRO = [['', 'Todos'], ...Object.entries(ETIQUETA_ESTADO)];

/** Campos del evento que se pueden editar (§5.5 / RN-04). */
const BASICOS = ['titulo', 'descripcion', 'portada_url', 'categoria'];
const RESTRINGIDOS = ['precio_cop', 'fecha_inicio', 'duracion_estimada_min', 'replay_habilitado'];
export const CAMPOS = [...BASICOS, ...RESTRINGIDOS];

/**
 * Acciones de una fila del listado según el estado (§5.5).
 * BORRADOR: editar · publicar · eliminar. PROGRAMADO: editar · sala de control · estadísticas ·
 * cancelar. EN_VIVO: sala de control · estadísticas. FINALIZADO: estadísticas. CANCELADO: solo ver.
 * @returns {string[]}
 */
export function accionesDeEvento(estado) {
  switch (estado) {
    case 'BORRADOR':
      return ['editar', 'publicar', 'eliminar'];
    case 'PROGRAMADO':
      return ['editar', 'transmision', 'estadisticas', 'cancelar'];
    case 'EN_VIVO':
      return ['transmision', 'estadisticas', 'ver'];
    case 'FINALIZADO':
      return ['estadisticas', 'ver'];
    default:
      return ['ver'];
  }
}

/**
 * Qué campos se pueden editar. En PROGRAMADO, precio, fecha, duración y replay solo si no hay
 * compras aprobadas; en el resto de estados nada (solo lectura).
 * @returns {Set<string>}
 */
export function camposEditables(estado, hayVentas) {
  if (estado === 'BORRADOR') return new Set(CAMPOS);
  if (estado === 'PROGRAMADO') return new Set(hayVentas ? BASICOS : CAMPOS);
  return new Set();
}

/** Valores del formulario (todos como texto/booleano) a partir de un evento. */
export function valoresIniciales(evento) {
  if (!evento) {
    return {
      titulo: '',
      descripcion: '',
      categoria: 'OTRO',
      portada_url: '',
      precio_cop: '',
      fecha_inicio: '',
      duracion_estimada_min: '60',
      replay_habilitado: true,
    };
  }
  return {
    titulo: evento.titulo,
    descripcion: evento.descripcion ?? '',
    categoria: evento.categoria,
    portada_url: evento.portada_url ?? '',
    precio_cop: String(evento.precio_cop),
    fecha_inicio: isoToBogotaLocal(evento.fecha_inicio), // hora de Bogotá, para el input
    duracion_estimada_min: String(evento.duracion_estimada_min),
    replay_habilitado: Boolean(evento.replay_habilitado),
  };
}

/** Valida en el cliente solo para dar buena experiencia; el servidor decide (RN-04). */
export function validarEvento(valores, editables = new Set(CAMPOS)) {
  const errores = {};
  const titulo = valores.titulo.trim();
  if (editables.has('titulo')) {
    if (!titulo) errores.titulo = 'El título es obligatorio.';
    else if (titulo.length > 150) errores.titulo = 'El título admite máximo 150 caracteres.';
  }
  if (editables.has('portada_url')) {
    const portada = valores.portada_url.trim();
    if (portada.length > 255) errores.portada_url = 'La URL admite máximo 255 caracteres.';
    else if (portada && !esUrlExternaSegura(portada)) {
      errores.portada_url = 'Usa una dirección que empiece por https://.';
    }
  }
  if (editables.has('categoria') && !esCategoriaValida(valores.categoria)) {
    errores.categoria = 'Elige una categoría.';
  }
  if (editables.has('precio_cop')) {
    const precio = Number(valores.precio_cop);
    if (valores.precio_cop === '' || !Number.isInteger(precio) || precio <= 0) {
      errores.precio_cop = 'Escribe un precio en pesos, sin decimales.';
    }
  }
  if (editables.has('fecha_inicio') && !bogotaLocalToIso(valores.fecha_inicio)) {
    errores.fecha_inicio = 'Elige la fecha y la hora de inicio.';
  }
  if (editables.has('duracion_estimada_min')) {
    const d = Number(valores.duracion_estimada_min);
    if (!Number.isInteger(d) || d < 15 || d > 240) {
      errores.duracion_estimada_min = 'La duración va de 15 a 240 minutos.';
    }
  }
  return errores;
}

/** Valor de un campo tal como lo espera la API (fecha: hora de Bogotá → ISO UTC). */
function valorParaApi(campo, valores) {
  switch (campo) {
    case 'titulo':
      return valores.titulo.trim();
    case 'descripcion':
      return valores.descripcion.trim() || null;
    case 'portada_url':
      return valores.portada_url.trim() || null;
    case 'precio_cop':
      return Number(valores.precio_cop);
    case 'fecha_inicio':
      return bogotaLocalToIso(valores.fecha_inicio);
    case 'duracion_estimada_min':
      return Number(valores.duracion_estimada_min);
    case 'replay_habilitado':
      return Boolean(valores.replay_habilitado);
    default:
      return valores[campo];
  }
}

/** Cuerpo de `POST /eventos` (omite opcionales vacíos). */
export function construirCreacion(valores) {
  const cuerpo = {};
  for (const campo of CAMPOS) {
    const valor = valorParaApi(campo, valores);
    if ((campo === 'descripcion' || campo === 'portada_url') && valor === null) continue;
    cuerpo[campo] = valor;
  }
  return cuerpo;
}

/**
 * Cuerpo de `PATCH`: solo lo que cambió y que se pueda editar. Así un campo restringido sin
 * tocar no dispara `EVENTO_NO_EDITABLE`.
 */
export function construirCambios(evento, valores, editables) {
  const original = valoresIniciales(evento);
  const cambios = {};
  for (const campo of CAMPOS) {
    if (!editables.has(campo)) continue;
    if (String(original[campo]) === String(valores[campo])) continue;
    cambios[campo] = valorParaApi(campo, valores);
  }
  return cambios;
}

const CAMPO_POR_CODIGO = {
  MONTO_FUERA_DE_RANGO: 'precio_cop',
  FECHA_INICIO_INVALIDA: 'fecha_inicio',
};

function primerMensaje(valor) {
  if (Array.isArray(valor)) return primerMensaje(valor[0]);
  if (valor && typeof valor === 'object') return primerMensaje(Object.values(valor)[0]);
  return valor ? String(valor) : '';
}

/**
 * Errores del servidor → mensajes junto a cada campo; lo que no tenga campo va a una alerta.
 * @returns {{campos: Record<string, string>, general: string}}
 */
export function erroresDeServidor(error) {
  const campos = {};
  if (error.status === 422 && error.detalles) {
    for (const [campo, valor] of Object.entries(error.detalles)) {
      campos[campo] = primerMensaje(valor);
    }
  }
  const porCodigo = CAMPO_POR_CODIGO[error.codigo];
  if (porCodigo) campos[porCodigo] = error.mensaje;
  const general = Object.keys(campos).length ? '' : error.mensaje;
  return { campos, general };
}

/**
 * ¿Hay compras aprobadas? Se consulta solo en PROGRAMADO; si falla, no se restringe de
 * antemano (el servidor responderá `EVENTO_NO_EDITABLE` si hiciera falta).
 */
export async function hayVentas(evento, signal, api = studioApi) {
  if (evento.estado !== 'PROGRAMADO') return false;
  try {
    return (await api.obtenerVentasDeEvento(evento.id, signal)).entradas_vendidas > 0;
  } catch (error) {
    if (error.cancelada) throw error;
    return false;
  }
}

/**
 * Crea el evento y lo publica. Si publicar falla, el evento queda en BORRADOR y se devuelve
 * junto con el error para que la persona lo corrija.
 * @returns {Promise<{evento: object, errorPublicar: Error|null}>}
 */
export async function crearYPublicar(valores, signal, api = studioApi) {
  const creado = await api.crearEvento(construirCreacion(valores), signal);
  try {
    return { evento: await api.publicarEvento(creado.id, signal), errorPublicar: null };
  } catch (error) {
    if (error.cancelada) throw error;
    return { evento: creado, errorPublicar: error };
  }
}

// --- Sala de control -------------------------------------------------------------------

/** Estado de cada uno de los 4 pasos según el estado del evento (§5.4). */
export function estadoDePasos(estado) {
  const paso = (activo, hecho) => (hecho ? 'hecho' : activo ? 'activo' : 'bloqueado');
  const programado = estado === 'PROGRAMADO';
  const enVivo = estado === 'EN_VIVO';
  const finalizado = estado === 'FINALIZADO';
  return {
    credenciales: paso(programado, enVivo || finalizado),
    iniciar: paso(programado, enVivo || finalizado),
    enVivo: paso(enVivo, finalizado),
    finalizar: paso(enVivo, finalizado),
  };
}

/** ¿La sala de control aplica a este estado? (BORRADOR y CANCELADO no transmiten). */
export function puedeTransmitir(estado) {
  return ['PROGRAMADO', 'EN_VIVO', 'FINALIZADO'].includes(estado);
}

/** "1 min", "45 min", "1 h 05 min". */
export function textoDuracion(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

// --- Operaciones que usan las páginas (la página no habla directamente con la api) -------

export const listarEventos = (filtros, signal) =>
  studioApi.listarMisEventos(
    { estado: filtros.estado, page: filtros.page, page_size: filtros.pageSize ?? PAGE_SIZE },
    signal,
  );
export const cargarEvento = (id, signal) => studioApi.obtenerEvento(id, signal);
export const crear = (valores, signal) => studioApi.crearEvento(construirCreacion(valores), signal);
export const guardarCambios = (id, cambios, signal) =>
  studioApi.actualizarEvento(id, cambios, signal);
export const publicar = (id, signal) => studioApi.publicarEvento(id, signal);
export const eliminar = (id, signal) => studioApi.eliminarEvento(id, signal);
export const cancelar = (id, signal) => studioApi.cancelarEvento(id, signal);
export const generarCredenciales = (id, signal) => studioApi.generarCredenciales(id, signal);
export const iniciar = (id, clave, signal) => studioApi.iniciarTransmision(id, clave, signal);
export const finalizar = (id, signal) => studioApi.finalizarTransmision(id, signal);
export const estadoTransmision = (id, signal) => studioApi.obtenerEstadoTransmision(id, signal);
export const simularAudiencia = (id, n, signal) => studioApi.simularAudiencia(id, n, signal);
