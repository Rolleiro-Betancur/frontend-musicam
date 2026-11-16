/** Descompone milisegundos restantes en días, horas, minutos y segundos (nunca negativos). */
export function partesRestantes(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
    terminado: total === 0,
  };
}

const UNIDADES = [
  ['dias', 'Días'],
  ['horas', 'Horas'],
  ['minutos', 'Min'],
  ['segundos', 'Seg'],
];

/**
 * Cuenta regresiva actualizada cada segundo. El intervalo se limpia en `destroy()`.
 * @param {{objetivo: string, onFin?: () => void}} o `objetivo` es una fecha ISO
 */
export function createCountdown({ objetivo, onFin }) {
  const meta = new Date(objetivo).getTime();
  const el = document.createElement('div');
  el.className = 'countdown';
  el.setAttribute('role', 'timer');
  el.setAttribute('aria-label', 'Cuenta regresiva para el inicio del evento');
  const celdas = {};
  for (const [clave, etiqueta] of UNIDADES) {
    const caja = document.createElement('div');
    caja.className = 'countdown__cell';
    const valor = document.createElement('span');
    valor.className = 'countdown__value';
    const texto = document.createElement('span');
    texto.className = 'countdown__label';
    texto.textContent = etiqueta;
    caja.append(valor, texto);
    el.append(caja);
    celdas[clave] = valor;
  }

  let avisado = false;
  const pintar = () => {
    const partes = partesRestantes(meta - Date.now());
    for (const [clave] of UNIDADES)
      celdas[clave].textContent = String(partes[clave]).padStart(2, '0');
    if (partes.terminado && !avisado) {
      avisado = true;
      clearInterval(temporizador);
      onFin?.();
    }
  };
  const temporizador = setInterval(pintar, 1000);
  pintar();

  return { el, destroy: () => clearInterval(temporizador) };
}
