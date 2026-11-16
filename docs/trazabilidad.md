# Trazabilidad (§10) y verificación de cierre

Matriz de las verificaciones de interfaz del anteproyecto y cómo se comprueban. «Navegador» es una
verificación manual guiada hecha con Chrome (protocolo DevTools) contra la API real; «Automática» es
una prueba de `npm test`.

| Verificación en la interfaz                                                                               | Valida  | Cómo se comprueba                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un artista se registra, crea y publica un evento sin aprobación ni pantalla de espera                     | C1, RQ1 | **Navegador:** el registro de artista no muestra textos de revisión o aprobación. **Automática:** `tests/auditoria/reglas.test.js` (ningún texto de "cuenta en revisión"), `tests/studio/*`. Verificado contra la API: crear → publicar en una sola secuencia, sin pasos de administrador |
| Ninguna pantalla muestra planes, suscripciones ni cuotas; el formulario aclara "solo comisión por boleto" | C2, RQ2 | **Automática:** `reglas.test.js` (sin planes/suscripciones) y `studio-views.test.js` (texto bajo el precio y en el pie)                                                                                                                                                                   |
| Tras aprobar el pago, el botón cambia a "Ver…" sin pasos extra; un pago rechazado no da acceso            | C3, RQ3 | **Navegador:** Comprar → Continuar → Aprobar pago → "¡Pago aprobado!" y el CTA del detalle pasa a "Comprado · Ver cuando empiece" sin recargar. **Automática:** `tests/checkout/*` (sondeo, duplicada, resultados)                                                                        |
| Un usuario sin compra ve el replay bloqueado; con compra lo reproduce                                     | C4, RQ5 | **Navegador:** sin compra, `#/ver/:id` muestra el candado y no monta reproductor. **Automática:** `tests/watch/watch.test.js`. Verificado contra la API: `entrar` da 403 sin compra y 200 `VIVO`/`REPLAY` con compra                                                                      |
| Iniciar la transmisión con clave incorrecta muestra el error; la clave solo se ve una vez                 | RQ6     | **Automática:** `studio-views.test.js` (la clave no va en el HTML ni en almacenamiento) y `api-client.test.js` (un 401 de negocio no cierra sesión). Verificado contra la API: clave mala → `401 CLAVE_EMISION_INVALIDA`                                                                  |
| El registro no avanza sin aceptar el tratamiento de datos                                                 | RQ7     | **Navegador:** el botón "Crear cuenta" está deshabilitado hasta marcar la casilla                                                                                                                                                                                                         |

## Verificación de la fase 8 (navegador)

- **Recorrido:** 126 pantallas (anónimo, USUARIO, ARTISTA y ADMIN × 375/768/1280 px). Se midió, en cada
  una: desbordamiento horizontal, número de `<h1>`, foco al `<h1>`, título del documento, nombre
  accesible de botones y enlaces, `alt` de imágenes, etiquetas de controles, contraste real de cada
  texto (contra su fondo calculado), áreas táctiles y errores de consola/red. Resultado final: sin
  hallazgos, salvo el 403 esperado de `reproduccion/entrar` para quien no compró (el flujo C4).
- **Interacción:** primer Tab → "Saltar al contenido"; contorno de foco de 3 px; modal con
  `role="dialog"`, `aria-modal`, foco atrapado y devuelto al botón que lo abrió; toasts con
  `aria-live="polite"`; `prefers-reduced-motion`; menú móvil del estudio.
- **Errores encontrados y corregidos:** la tabla equivalente de las gráficas (con `.visually-hidden`
  en la propia `<table>`, que ignora `width: 1px`) provocaba scroll horizontal; los botones
  `btn-outline-danger`/`btn-outline-secondary` de Bootstrap daban 4,1–4,4:1; varias áreas táctiles
  medían 40–42 px; un `opacity` bajaba el contraste de "Pendiente" a 3,4:1; los modales no devolvían
  el foco; el router movía el foco al `<h1>` también en la carga inicial (saltándose el enlace de
  salto); los scrolls con `behavior: 'smooth'` ignoraban `prefers-reduced-motion`.
