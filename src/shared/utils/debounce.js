export function debounce(fn, espera = 300) {
  let temporizador;
  const envuelta = (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), espera);
  };
  envuelta.cancel = () => clearTimeout(temporizador);
  return envuelta;
}
