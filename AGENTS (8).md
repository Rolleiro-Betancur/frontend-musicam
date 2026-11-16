# AGENTS.md — Frontend de la plataforma de transmisión en vivo de conciertos

> Guía operativa para agentes de IA y desarrolladores. **Léela completa antes de escribir código.**
> Complementa al `AGENTS.md` del backend, que es la **fuente de verdad del contrato de la API** (endpoints, roles, reglas RN-xx, códigos de error). Si algo de este documento contradice al del backend, manda el backend.
> Origen: anteproyecto *"Diseño y evaluación de una plataforma digital de transmisión en vivo interactiva para ampliar el acceso a eventos"* (UCC, Grupo 01). Referencias de experiencia: Veeps y Vibenix.

---

## 1. Qué estamos construyendo

Una aplicación web (SPA) para que **artistas musicales independientes en Colombia** vendan y transmitan conciertos virtuales, y para que **espectadores** descubran eventos, compren su entrada y los vean en vivo o en reproducción posterior (replay). Incluye un **panel de administración**.

Las cuatro condiciones del anteproyecto deben ser **visibles y demostrables en la interfaz**:

| Cód. | Condición | Cómo se ve en el frontend |
|------|-----------|---------------------------|
| C1 | Alta autoservicio para vender | Un artista se registra, crea y publica un evento **él solo**, sin pantallas de "en revisión" ni aprobaciones |
| C2 | Sin cuota fija | No hay planes, suscripciones ni cobros mensuales en ninguna pantalla. El formulario de evento dice que solo se cobra una comisión por boleto vendido |
| C3 | Cobro local integrado al acceso | Tras un pago aprobado, el botón pasa a **"Ver ahora"** sin que el usuario haga nada más (sin códigos ni confirmaciones manuales) |
| C4 | Replay restringido a compradores | Quien no compró ve el replay **bloqueado** con invitación a comprar; quien compró lo reproduce |

### Alcance de esta versión
**Dentro:** los 3 roles (`USUARIO`, `ARTISTA`, `ADMIN`) y todo lo que expone el backend v1: catálogo, perfil de artista, favoritos, seguidos, foto de perfil, checkout con Wompi **simulado**, reproducción **simulada**, estudio del artista (eventos, transmisión, estadísticas, saldo y retiros) y panel admin.
**Fuera:** chat en tiempo real (RQ4 queda parcial: se deja el espacio con "Próximamente"), pagos reales, recuperación de contraseña, confirmación de correo, notificaciones push, aplicaciones móviles nativas, modo claro, internacionalización.

### Qué sí se tomó de Veeps (y qué no)
Patrones de experiencia observables en fuentes públicas de Veeps, adaptados a este producto: sección **"Mis eventos"** (equivale a *My Shows*), **búsqueda por artista**, eventos destacados/*trending*, **ticket por show**, evento en vivo y luego **bajo demanda** con ventanas definidas por el artista, chat opcional (aquí diferido) y misma pantalla para ver vivo y replay. De Vibenix y tu planteamiento inicial: **Gestor de Transmisión**, perfil de canal, **Mis Eventos / Mi Calendario / Mis Favoritos**.

> ⚠️ **No se copia la marca ni los activos de Veeps** (logo, imágenes, textos, nombre). La identidad visual de §6 es **propia** y es una propuesta basada en convenciones de plataformas de streaming premium (tema oscuro, pósters grandes, filas horizontales); no pude verificar los colores ni la tipografía exactos de Veeps. Si adjuntas capturas de Veeps/Vibenix, el agente debe usarlas para afinar **composición y jerarquía**, no para replicar la marca.

---

## 2. Stack tecnológico

| Aspecto | Decisión |
|---------|----------|
| Lenguaje | **JavaScript ES2022 (módulos ES)**, sin TypeScript. Tipos documentados con **JSDoc** (`// @ts-check` opcional) |
| UI | **HTML5 + CSS3 + Bootstrap 5.3** (instalado por npm, no por CDN) con `data-bs-theme="dark"` |
| Iconos | **Bootstrap Icons** |
| Gráficas | **Chart.js** (solo en estadísticas) |
| Video | **hls.js** cargado de forma diferida, solo en la pantalla de ver |
| Fuentes | `@fontsource-variable/inter` (texto) y `@fontsource-variable/space-grotesk` (titulares), autoalojadas |
| Empaquetado / servidor de desarrollo | **Vite** (ya lo usaste en `frontend-alojamientos`) |
| Calidad | **ESLint** + **Prettier** |
| Pruebas | **Node test runner** (`node --test`) para utilidades y cliente HTTP; Playwright opcional (P2) |
| Framework JS | **Ninguno** (Vanilla JS). Prohibido añadir React/Vue/Angular/jQuery |

**Versiones verificadas en npm** (fíjalas en `package.json` con `npm install --save-exact` en el primer arranque): Vite 8.3, Bootstrap 5.3.8, Bootstrap Icons 1.13, Chart.js 4.6, hls.js 1.7, ESLint 10, Prettier 3.9, fuentes `@fontsource-variable/*` 5.3. Requiere **Node 22 LTS**.

---

## 3. Arquitectura por features

### 3.1 Principios
1. **Feature-based:** el código se agrupa por **capacidad de negocio**, no por tipo de archivo. Todo lo de "checkout" vive junto.
2. **Dependencias en un solo sentido:** `app → features → shared → core`. Un nivel inferior **nunca** importa de uno superior.
3. **Una feature no importa los archivos internos de otra.** Solo puede usar su `index.js` (API pública) o comunicarse por `shared`/`core` (store, bus de eventos).
4. **Capas dentro de cada feature:** `pages` (vistas) → `service` (lógica) → `api` (llamadas HTTP) → `core/http`.
5. **El servidor es la autoridad.** El frontend valida para dar buena experiencia; las reglas reales (RN-xx) las aplica el backend y el frontend muestra sus errores.

### 3.2 Estructura de carpetas

```
frontend/
├── AGENTS.md · README.md
├── index.html                      # único HTML; <div id="app"> + <script type="module" src="/src/main.js">
├── package.json · vite.config.js · .env.example · .eslintrc / eslint.config.js · .prettierrc
├── public/                         # favicon, og-image
├── docs/                           # copia de openapi.json del backend (contrato)
├── tests/                          # pruebas con node --test (espejo de src/)
└── src/
    ├── main.js                     # arranque: estilos, sesión, router
    ├── app/                        # composición de la aplicación (conoce a todas las features)
    │   ├── routes.js               # tabla de rutas → carga diferida de cada feature
    │   ├── router.js               # router por hash (#/...)
    │   ├── guards.js               # requiereSesion, requiereRol
    │   └── layouts/                # public.layout.js · studio.layout.js · admin.layout.js
    ├── core/                       # infraestructura sin lógica de negocio
    │   ├── config.js               # lee import.meta.env.VITE_*
    │   ├── http/
    │   │   ├── api-client.js       # fetch + Bearer + refresh + errores normalizados
    │   │   └── api-error.js        # class ApiError {status, codigo, mensaje, detalles}
    │   ├── session/
    │   │   ├── session.js          # tokens, usuario actual, login/logout
    │   │   └── session-store.js
    │   ├── store.js                # store observable mínimo (get/set/subscribe)
    │   └── event-bus.js            # eventos entre features (p. ej. 'session:cambio')
    ├── shared/                     # reutilizable por todas las features
    │   ├── ui/                     # componentes: navbar, footer, toast, modal, confirm-dialog,
    │   │                           # pagination, skeleton, empty-state, form-field, spinner,
    │   │                           # event-card, artist-card, live-badge, countdown, rail, avatar
    │   ├── utils/                  # html.js (plantilla con escape), dom.js, format-money.js,
    │   │                           # format-date.js, validators.js, query-string.js, debounce.js,
    │   │                           # media-url.js, category-gradient.js
    │   └── styles/                 # tokens.css · base.css · components.css · bootstrap-overrides.css
    └── features/
        ├── auth/                   # login, registro (con consentimiento)
        ├── catalog/                # home, catálogo, detalle de evento, artistas, perfil de artista
        ├── checkout/               # compra y checkout simulado de Wompi
        ├── watch/                  # reproductor, estados de acceso, vivo/replay
        ├── account/                # perfil+foto, mis eventos/calendario, favoritos, siguiendo
        ├── studio/                 # Gestor de Transmisión (artista): eventos, transmisión, stats, finanzas
        └── admin/                  # panel de administración
```

Cada feature sigue esta forma (solo crea los archivos que necesite):
```
features/<nombre>/
├── index.js                # API pública: exporta `routes` y lo que otras features puedan usar
├── <nombre>.api.js         # funciones que llaman a la API (una por endpoint); sin lógica
├── <nombre>.service.js     # reglas de UI, transformación, orquestación de varias llamadas
├── pages/                  # una vista por pantalla: xxx.page.js
├── components/             # componentes propios de la feature
└── <nombre>.css            # (opcional) estilos propios
```

### 3.3 Reglas de dependencia
- `pages` pueden usar `service`, `components`, `shared` y `core/session`.
- `service` puede usar `api` de su feature y `shared/utils`. **No** toca el DOM.
- `api` solo usa `core/http/api-client`. **No** transforma datos de negocio.
- `shared` **no** importa de `features` ni de `app`.
- Si dos features necesitan lo mismo (p. ej. el botón de favorito en catálogo y en cuenta), el componente va a `shared/ui` o se exporta por el `index.js` de la feature dueña (`catalog` es dueña de `event-card` y del botón de favorito si depende de su lógica).

### 3.4 Modelo de páginas y renderizado (sin framework)
Cada página es una función asíncrona que recibe el contexto de ruta y devuelve un objeto con su ciclo de vida:

```js
/** @param {{params: Record<string,string>, query: URLSearchParams, signal: AbortSignal}} ctx */
export async function eventDetailPage(ctx) {
  const el = document.createElement('section');
  // ... construir DOM con html`...` o createElement
  return {
    title: 'Detalle del evento',   // actualiza document.title
    el,                            // nodo a insertar en #outlet
    destroy() { /* quitar listeners, timers, polling, detener reproductor */ },
  };
}
```
- El **router** monta `el`, llama a `destroy()` de la página anterior y **aborta** (`AbortController`) las peticiones en curso de la ruta que se abandona.
- Para construir HTML se usa **siempre** la plantilla etiquetada `html` de `shared/utils/html.js`, que **escapa por defecto** todo valor interpolado. Para insertar HTML ya confiable hay que marcarlo explícitamente con `raw()`.
- Eventos con **delegación** (`el.addEventListener('click', e => e.target.closest('[data-action]')...)`); acciones nombradas con `data-action="..."`.
- Estado local de página en variables de closure; estado compartido (sesión, favoritos en pantalla) en `core/store.js`.

### 3.5 Router
- **Por hash** (`#/eventos/123`): funciona con cualquier servidor estático sin configuración.
- Tabla de rutas en `app/routes.js`; cada entrada: `{ path, loader: () => import('../features/...'), layout, guard }`. Carga **diferida** (`import()`) por feature.
- Parámetros `:id`, query string, ruta 404, scroll al inicio y foco al `<h1>` al navegar (accesibilidad), `document.title` por página.
- Redirección tras login: `#/login?redirect=%23%2Fmis-eventos`. Validar que `redirect` empiece por `#/` (evita *open redirect*).

---

## 4. Contrato con la API

La API vive en `VITE_API_URL` (por defecto `http://localhost:5000/api/v1`). **Antes de integrar cada endpoint, contrástalo con `/api/openapi.json` (copia en `docs/openapi.json`)**; si un campo no coincide con este documento, gana el OpenAPI y se avisa.

### 4.1 Convenciones que el frontend debe respetar
| Tema | Regla |
|------|-------|
| Campos | Se usan **tal cual llegan** (snake_case en español: `precio_cop`, `fecha_inicio`, `nombre_artistico`). No se renombran; las variables propias van en camelCase |
| IDs | UUID (cadenas). Nunca se asumen enteros ni se ordenan por ID |
| Dinero | Enteros en **COP** (`*_cop`). Formato con `Intl.NumberFormat('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})`. Nunca `float` ni cálculos de comisión en el cliente |
| Fechas | ISO 8601 en UTC. Se muestran en **`America/Bogota`** con `Intl.DateTimeFormat('es-CO', {timeZone:'America/Bogota', ...})`. Al enviar fechas (crear evento) se convierte desde la hora local de Bogotá a ISO UTC |
| Paginación | `?page=1&page_size=20` → `{items, page, page_size, total}` |
| Errores | `{codigo, mensaje, detalles}` con HTTP 400/401/403/404/409/422/429/500. `detalles` trae errores por campo en 422 |
| Auth | `Authorization: Bearer <access_token>` |
| Idempotencia | `PUT`/`DELETE` de favoritos y seguidos devuelven `204` aunque no cambie nada |

### 4.2 Cliente HTTP (`core/http/api-client.js`)
- Prefija `VITE_API_URL`, envía `Content-Type: application/json` (excepto `FormData`, donde **no** se fija: lo pone el navegador).
- Añade el `Authorization` si hay sesión. Las rutas públicas funcionan con y sin token (el detalle de evento devuelve `es_favorito` y `comprado` solo con sesión, así que **siempre se envía el token si existe**).
- **Renovación automática:** ante `401` en un endpoint que no sea de auth, intenta **una vez** `POST /auth/refresh` (con *single-flight*: si varias peticiones fallan a la vez, hay un solo refresh) y reintenta. Si falla → cierra sesión y redirige a login conservando `redirect`.
- `403 CUENTA_SUSPENDIDA` → cierra sesión y muestra el mensaje.
- Lanza `ApiError` con `status`, `codigo`, `mensaje`, `detalles`. Los errores de red y el `429` tienen mensajes amigables propios.
- Tiempo máximo por petición: 15 s (`AbortController`), combinado con la señal de la ruta.
- **Ninguna página llama a `fetch` directamente.**

### 4.2.1 Notas de contrato verificadas contra `docs/openapi.json`
- `POST /auth/refresh`: el **refresh token se envía como `Authorization: Bearer`**, sin cuerpo, y responde solo `{access_token}`.
- `POST /auth/registro` responde `201` con el **`Usuario`** (sin tokens): tras registrarse hay que llamar a `POST /auth/login`.
- `POST /auth/login` responde `{access_token, refresh_token, usuario}`.
- `PUT/DELETE /usuarios/me/foto` responden `200` con el `Usuario` actualizado (no `204`).
- Errores `422`: `detalles` llega como `{campo: [mensajes]}`. `401` por defecto es `NO_AUTENTICADO`; `403` por rol, `ROL_NO_PERMITIDO`.

### 4.3 Sesión (`core/session`)
- **Access token: solo en memoria** (variable del módulo).
- **Refresh token: `sessionStorage`** (sobrevive a recargar la página, se borra al cerrar la pestaña). Es una decisión de MVP; la limitación (no hay revocación en el servidor) se documenta en el README.
- Al arrancar: si hay refresh token → `POST /auth/refresh` → `GET /usuarios/me` para recuperar el usuario. Mientras tanto se muestra un *skeleton*, no la pantalla de login.
- El rol del usuario sirve para **mostrar u ocultar navegación**; la seguridad real la aplica el backend (un botón oculto no es un permiso).
- Nunca guardar contraseñas, `stream_key` ni datos de pago en ningún almacenamiento del navegador.

### 4.4 Pantallas ↔ endpoints

**Público**
| Ruta | Pantalla | Endpoints |
|------|----------|-----------|
| `#/` | Inicio: hero + filas "En vivo ahora", "Próximos", "Reproducciones disponibles", categorías | `GET /eventos?estado=EN_VIVO`, `?estado=PROGRAMADO`, `?estado=FINALIZADO` |
| `#/eventos` | Catálogo con búsqueda y filtros (`q`, `categoria`, `estado`, `desde`, `hasta`) y paginación | `GET /eventos` |
| `#/eventos/:id` | Detalle del evento, favorito, comprar/ver, tarjeta del artista | `GET /eventos/{id}`, `PUT/DELETE /usuarios/me/favoritos/{id}` |
| `#/artistas` | Directorio de artistas con búsqueda por nombre | `GET /artistas?q=` |
| `#/artistas/:id` | Perfil del artista: foto, bio, seguidores, próximos eventos, seguir | `GET /artistas/{id}`, `PUT/DELETE /usuarios/me/seguidos/{id}` |
| `#/login` · `#/registro` | Acceso y alta (elige "Quiero ver conciertos" / "Soy artista") | `POST /auth/login`, `POST /auth/registro` |

**Cuenta (USUARIO y ARTISTA)**
| Ruta | Pantalla | Endpoints |
|------|----------|-----------|
| `#/mis-eventos` | **Mis eventos** (pestañas Próximos · Historial · Calendario) | `GET /usuarios/me/compras` (`proximos=true`, `estado`) |
| `#/favoritos` | **Mis favoritos** | `GET /usuarios/me/favoritos` |
| `#/siguiendo` | Artistas que sigo | `GET /usuarios/me/seguidos` |
| `#/perfil` | Editar datos y foto | `GET/PATCH /usuarios/me`, `PUT/DELETE /usuarios/me/foto` |
| `#/ver/:eventoId` | Pantalla de reproducción (vivo o replay) | `POST /eventos/{id}/reproduccion/entrar` y `/salir` |
| (modal) | Checkout simulado | `POST /eventos/{id}/compras`, `POST /pagos/wompi/simulador/{ref}`, `GET /compras/{id}` |

**Estudio del artista — "Gestor de Transmisión" (ARTISTA)**
| Ruta | Pantalla | Endpoints |
|------|----------|-----------|
| `#/estudio` | Resumen: KPIs, gráfica de ventas, saldo, próximos eventos | `GET /artistas/me/estadisticas` |
| `#/estudio/eventos` | Mis eventos por estado, con acciones según estado | `GET /artistas/me/eventos` |
| `#/estudio/eventos/nuevo` · `/:id/editar` | Formulario de evento | `POST /eventos`, `PATCH /eventos/{id}`, `DELETE`, `POST .../publicar`, `POST .../cancelar` |
| `#/estudio/eventos/:id/transmision` | **Sala de control** (ver §5.4) | `POST .../transmision/credenciales`, `/iniciar`, `/finalizar`, `GET .../transmision` |
| `#/estudio/eventos/:id/estadisticas` | Métricas del evento | `GET /artistas/me/eventos/{id}/estadisticas` |
| `#/estudio/finanzas` | Saldo, solicitar retiro, historial | `GET /artistas/me/saldo`, `POST/GET /artistas/me/retiros` |

**Administración (ADMIN)**
| Ruta | Pantalla | Endpoints |
|------|----------|-----------|
| `#/admin` | Dashboard de métricas | `GET /admin/dashboard` |
| `#/admin/usuarios` | Lista, filtros, suspender/activar, crear admin | `GET/POST /admin/usuarios`, `PATCH .../estado` |
| `#/admin/eventos` | Todos los eventos, suspender (con motivo) / reactivar | `GET /admin/eventos`, `POST .../suspender`, `.../reactivar` |
| `#/admin/compras` | Compras con filtros | `GET /admin/compras` |
| `#/admin/retiros` | Cola de retiros: aprobar / rechazar (motivo) | `GET /admin/retiros`, `POST .../aprobar`, `.../rechazar` |
| `#/admin/configuracion` | Parámetros en solo lectura | `GET /admin/configuracion` |

**Navegación por rol:** público (Descubrir · Artistas · buscar · Iniciar sesión · Registrarme) · usuario (+ Mis eventos · Favoritos · menú de avatar con Perfil, Siguiendo, Salir) · artista (+ **Estudio**) · admin (+ **Administración**). Rutas protegidas con `guards.js`; un rol incorrecto redirige a una pantalla "No tienes acceso" (403), y sin sesión a login.

---

## 5. Flujos clave

### 5.1 Registro (RQ1, RQ7, C1)
- Dos tarjetas de elección de rol: **Quiero ver conciertos** (`USUARIO`) / **Soy artista** (`ARTISTA`, pide `nombre_artistico`).
- Casilla **obligatoria** de aceptación del tratamiento de datos (enlace a la política); sin marcarla el botón queda deshabilitado y se envía `acepta_tratamiento_datos: true`.
- Validación de contraseña espejo del servidor (≥ 8, letra y dígito). Errores `422` del servidor se pintan junto a cada campo usando `detalles`; `409 EMAIL_YA_REGISTRADO` y `NOMBRE_ARTISTICO_EN_USO` en el campo correspondiente.
- Tras registrarse, inicia sesión automáticamente y lleva al artista a `#/estudio` y al usuario a `#/`.
- **Sin** mensajes de "tu cuenta será revisada" (C1).

### 5.2 Compra y checkout simulado (RQ3, C3)
1. En el detalle, **"Comprar entrada · $20.000"** abre el modal de checkout (requiere sesión; si no hay, lleva a login con `redirect`).
2. Elegir método: **Tarjeta / PSE / Nequi** → `POST /eventos/{id}/compras`.
3. Se muestra un **panel con aspecto de pasarela** y una franja visible *"Entorno de pruebas · no se cobra dinero real"*, con el resumen (evento, monto en COP, referencia) y tres acciones: **Aprobar pago**, **Rechazar pago**, **Cancelar** → `POST /pagos/wompi/simulador/{referencia}` con `APPROVED` / `DECLINED` / `VOIDED`.
4. **Sondeo** de `GET /compras/{id}` cada 1,5 s (máx. 30 s) hasta que el estado deje de ser `PENDIENTE`.
5. Resultado:
   - `APROBADA` → pantalla de éxito con **"Ver ahora"** (si el evento está en vivo) o **"Ver cuando empiece"** + enlace a Mis eventos. El botón del detalle cambia solo (C3).
   - `RECHAZADA` → mensaje claro y botón **Reintentar**.
   - `ANULADA` → informa y permite volver a comprar.
6. `409 COMPRA_DUPLICADA`: buscar la compra existente (`GET /usuarios/me/compras?estado=PENDIENTE`) y **retomarla**; si ya está `APROBADA`, ofrecer "Ver ahora".
7. El botón de pago se **bloquea mientras hay una petición en curso** (evita doble envío).
> El monto y la referencia salen **siempre de la respuesta del servidor**, nunca se calculan en el cliente.

### 5.3 Ver un evento (RQ5, C4)
`#/ver/:eventoId` llama a `POST /eventos/{id}/reproduccion/entrar` y reacciona al resultado:
| Respuesta | Qué se muestra |
|-----------|----------------|
| `200 {tipo: VIVO\|REPLAY, url, token, expira_en}` | Reproductor con insignia **EN VIVO** o **REPLAY** |
| `403 ACCESO_NO_AUTORIZADO` | Póster difuminado con candado: *"Este contenido es solo para quienes compraron su entrada"* + botón **Comprar** (C4) |
| `403 EVENTO_SUSPENDIDO` | *"Este evento no está disponible por el momento"* |
| Evento `PROGRAMADO` (aún no inicia) | Sala de espera con **cuenta regresiva** a `fecha_inicio`; reintenta al llegar la hora y cada 30 s después |
| `404` | Pantalla de evento no encontrado |

Reglas del reproductor:
- Interfaz `PlayerAdapter { mount(el, {url, tipo}), destroy() }` con dos implementaciones, elegidas por `VITE_PLAYER_MODE`:
  - `simulated` (por defecto): **reproductor simulado** (póster del evento, animación de ecualizador, insignia, contador de tiempo). Es lo que se usa mientras el backend entregue URLs ficticias.
  - `hls`: `<video>` con **hls.js** (importación diferida) y, en Safari, HLS nativo. Se activa cuando el backend integre MediaMTX.
- Al salir de la pantalla (`destroy`) y en `pagehide` se llama a `POST /reproduccion/salir` (con `keepalive: true`). Se evita llamar a `entrar` repetidamente: cada llamada cuenta como una vista en el backend. Si el token expira (`expira_en`), se ofrece un botón **"Reanudar"** en lugar de reintentar en bucle.
- Panel lateral de chat: **placeholder "El chat llegará pronto"** (deshabilitado), para no perder el espacio de diseño.

### 5.4 Sala de control del artista (RQ6)
Asistente de cuatro pasos para un evento `PROGRAMADO`:
1. **Credenciales** → `POST .../transmision/credenciales`. Muestra `rtmp_url` y `stream_key` con botones **Copiar**, y un aviso fuerte: *"Esta clave se muestra una sola vez. Guárdala en OBS."* La clave vive **solo en memoria** de la página y se descarta al salir. Volver a generar pide confirmación (invalida la anterior).
2. **Iniciar** → pide la clave (precargada si está en memoria) → `POST .../iniciar`. `401 CLAVE_EMISION_INVALIDA` se muestra bajo el campo.
3. **En vivo** → sondeo de `GET .../transmision` cada 5 s: `estado`, `espectadores_actuales`, `pico_espectadores`, duración transcurrida. Se detiene el sondeo al salir de la pantalla o al finalizar.
4. **Finalizar** → diálogo de confirmación → `POST .../finalizar`. Muestra un resumen y el enlace a las estadísticas.
- Con `VITE_ENABLE_DEV_TOOLS=true` aparece un botón **"Simular audiencia"** (`POST /dev/eventos/{id}/audiencia-simulada`) para poblar estadísticas en demos. Nunca visible en producción.

### 5.5 Formulario de evento (RQ2, C2)
Campos: título, descripción, categoría, portada (URL), precio, fecha y hora (hora de Bogotá), duración estimada, "permitir reproducción posterior". Debajo del precio, un texto fijo: *"Sin cuota fija ni suscripción. Solo se cobra una comisión por cada boleto vendido."* (sin cifra; no se inventa la comisión en el cliente).
- Acciones según estado: `BORRADOR` → Guardar · Publicar · Eliminar; `PROGRAMADO` → Editar (campos limitados; si hay ventas, precio/fecha/replay quedan deshabilitados con una explicación) · Cancelar; `EN_VIVO`/`FINALIZADO`/`CANCELADO` → solo lectura.
- **Cancelar** pide confirmación explicando que las entradas vendidas se reembolsarán.
- Errores del servidor (`MONTO_FUERA_DE_RANGO`, `422` de fecha, límite de eventos para artistas nuevos) se muestran junto al campo o en una alerta.

### 5.6 Finanzas y retiros
- Tarjetas: **Disponible · Retenido · En proceso · Retirado** (con una ayuda breve: *retenido = ventas de eventos que aún no terminan*).
- Formulario de retiro: monto (COP), banco, tipo de cuenta y **solo los últimos 4 dígitos** de la cuenta (el campo acepta exactamente 4 dígitos; **no se pide ni se envía el número completo**).
- Tabla de retiros con estado (`PENDIENTE`, `PAGADO`, `RECHAZADO` + motivo).
- `422 SALDO_INSUFICIENTE` / `MONTO_FUERA_DE_RANGO` junto al campo del monto.

### 5.7 Admin
Acciones destructivas o sensibles (suspender usuario/evento, rechazar retiro) usan un **diálogo de confirmación**; suspender evento y rechazar retiro exigen **motivo** (campo obligatorio). Los errores `RN-20` (no suspenderse a sí mismo, último admin) se muestran tal cual en un aviso.

---

## 6. Sistema de diseño

**Dirección:** oscuro, cinematográfico y enfocado en el contenido: pósters grandes, mucho aire, tipografía clara y un solo color de acento. Es una **identidad propia** (ver §1). Marca provisional: el nombre se lee de `VITE_APP_NAME` y el logotipo es solo texto con el acento; no se usa ningún activo de Veeps.

### 6.1 Tokens (en `shared/styles/tokens.css`)
```css
:root {
  /* Superficies */
  --bg: #0A0A0F;  --surface: #13131A;  --surface-2: #1B1B25;  --surface-3: #252532;
  --border: rgba(255,255,255,.10);
  /* Texto */
  --text: #F4F4F8;  --text-muted: #A3A3B2;
  /* Marca */
  --accent: #6D4AFF;  --accent-hover: #5A38E6;  --accent-soft: #A898FF;   /* soft = texto/enlaces sobre oscuro */
  /* Estado */
  --live: #D91E32;  --live-dot: #FF3B4E;  --success: #2ECC8F;  --warning: #FFB020;  --danger: #FF6B7A;
  /* Forma y espacio */
  --radius-card: 14px;  --radius-pill: 999px;  --space: 8px;
  /* Movimiento */
  --t-fast: 150ms;  --t-base: 250ms;
}
```
**Contrastes verificados (WCAG, calculados):** texto/fondo 18,0:1 · gris/fondo 7,9:1 · blanco sobre acento 5,2:1 · acento suave/fondo 8,1:1 · blanco sobre `--live` 5,0:1 · éxito 9,6:1 · aviso 10,8:1 · peligro 7,2:1. **No uses `--accent` como color de texto sobre fondo oscuro (3,8:1): usa `--accent-soft`.** Si cambias un color, vuelve a comprobar que cumpla ≥ 4,5:1 en texto normal.

Se sobreescriben las variables de Bootstrap (`--bs-body-bg`, `--bs-body-color`, `--bs-primary`, `--bs-border-color`…) en `bootstrap-overrides.css` en vez de reescribir sus clases.

### 6.2 Tipografía y escala
Titulares: **Space Grotesk** (700). Texto e interfaz: **Inter** (400/500/600). Escala: 12 · 14 · 16 · 20 · 24 · 32 · 48. Etiquetas pequeñas en mayúsculas con `letter-spacing: .08em`. Interlineado 1,5 en texto corrido.

### 6.3 Componentes (en `shared/ui`)
| Componente | Descripción |
|------------|-------------|
| **Hero** | Imagen/gradiente a todo el ancho con degradado inferior, título grande, meta (artista · fecha), insignia y un CTA principal tipo píldora |
| **Fila (rail)** | Título + "Ver todo", scroll horizontal con `scroll-snap`, flechas en escritorio, arrastre/táctil en móvil |
| **Tarjeta de evento** | Póster 16:9 con insignias (EN VIVO pulsante, REPLAY, fecha), título, artista, precio y corazón de favorito. Hover: leve elevación y zoom de la imagen |
| **Tarjeta de artista** | Avatar circular, nombre, seguidores y botón Seguir |
| **Insignia EN VIVO** | Fondo `--live`, texto blanco, punto `--live-dot` con pulso (se desactiva con `prefers-reduced-motion`) |
| **Cuenta regresiva** | Días · horas · min · seg, actualizada cada segundo con `setInterval` limpiado en `destroy` |
| **Chips de categoría** | Píldoras seleccionables para filtrar |
| **KPI card** | Cifra grande, etiqueta, variación opcional |
| **Esqueletos** | Para cada lista y detalle mientras carga |
| **Estados vacíos** | Ilustración simple + mensaje + acción (p. ej. "Aún no sigues a ningún artista") |
| **Toast / Modal / Confirm** | Bootstrap con `aria-live` y gestión de foco |

**Portadas sin imagen:** `portada_url` puede ser `null` o fallar. `category-gradient.js` genera un **degradado determinista por categoría** (y variación por ID) para que ninguna tarjeta quede vacía; las imágenes que fallan (`onerror`) caen a ese degradado.

**Fotos de perfil:** `foto_url` es una ruta relativa del backend; `media-url.js` la convierte en URL absoluta con el origen de la API. Si no hay foto, se muestra el avatar con iniciales.

### 6.4 Páginas: composición orientativa
- **Inicio:** hero con el próximo evento en vivo (o el más cercano) → fila "En vivo ahora" (si hay) → "Próximos conciertos" → "Reproducciones disponibles" → categorías → llamada a artistas: *"¿Eres artista? Vende tu concierto sin cuotas fijas"* (C1/C2).
- **Detalle de evento:** póster/hero, título, artista (enlace), fecha en hora de Bogotá, descripción, precio y **un único bloque de acción** cuyo estado cambia: *Iniciar sesión para comprar · Comprar entrada · Comprado — Ver ahora / Ver cuando empiece · Ver replay · Gestionar (si eres el dueño) · No disponible*.
- **Estudio:** barra lateral fija (escritorio) / menú inferior o *offcanvas* (móvil) con Resumen · Eventos · Finanzas.
- **Admin:** misma estructura que el estudio con tablas densas, filtros arriba y paginación abajo.

### 6.5 Responsive y accesibilidad
- **Mobile-first** con la rejilla de Bootstrap. Puntos de control: 375 · 768 · 1280 px. Sin scroll horizontal de página (solo en las filas).
- HTML semántico (`header`, `nav`, `main`, `section`, `footer`), un `<h1>` por pantalla, enlace "Saltar al contenido", `lang="es-CO"`.
- Todos los controles accesibles con teclado y con `:focus-visible` bien visible; el modal atrapa el foco y lo devuelve al cerrar.
- `alt` en imágenes informativas, `aria-label` en botones solo-icono, `aria-live="polite"` en toasts y en cambios de estado del pago.
- Color nunca como única señal (las insignias llevan texto). Respeta `prefers-reduced-motion`.
- Áreas táctiles ≥ 44 px.

---

## 7. Seguridad en el cliente

- **XSS:** todo texto que venga de la API (títulos, descripciones, biografías, nombres, motivos) se inserta con `html` (escapa) o `textContent`. **Prohibido** `innerHTML` con datos no escapados, `eval` y `document.write`.
- **URLs externas:** `portada_url` y cualquier enlace del usuario solo se aceptan si empiezan por `https://` (o `http://localhost` en desarrollo); se usan con `rel="noopener noreferrer"` y `referrerpolicy="no-referrer"`.
- **Redirecciones:** solo a rutas internas (`#/...`).
- **Tokens y secretos:** nada de claves de Wompi ni secretos en el frontend. El access token no se escribe en almacenamiento; el refresh en `sessionStorage`; la `stream_key` solo en memoria.
- **Datos personales:** el frontend muestra solo lo que la API entrega; nunca se registran en consola contraseñas, tokens ni la `stream_key`.
- **Doble envío:** botones de compra, retiro y acciones de admin se deshabilitan mientras la petición está en curso.
- **Confirmaciones** en acciones destructivas o con dinero.
- **CSP recomendada** (meta o cabecera del servidor): `default-src 'self'; img-src 'self' https: data:; media-src 'self' https: blob:; connect-src 'self' <origen de la API>; style-src 'self' 'unsafe-inline'; script-src 'self'`.
- **Subida de foto:** validar tipo (JPEG/PNG/WebP) y tamaño (≤ 2 MB) antes de enviar, con vista previa; el servidor vuelve a validar y es la autoridad.

---

## 8. Convenciones de código

- **Idioma:** textos de interfaz y comentarios en **español (es-CO)**; identificadores técnicos en inglés cuando sean genéricos (`render`, `mount`, `store`); términos del dominio en español para coincidir con la API (`evento`, `compra`, `retiro`).
- **Archivos:** `kebab-case`. Sufijos: `.page.js`, `.api.js`, `.service.js`, `.component.js`, `.css`. Un componente por archivo, exportado por nombre (sin `export default` salvo `index.js` cuando convenga).
- **Estilo:** Prettier (comillas simples, punto y coma, ancho 100) y ESLint sin avisos. Funciones cortas; sin variables globales (`window.x`); sin lógica de negocio dentro de plantillas HTML.
- **Async:** `async/await`, nunca promesas anidadas. Todo `await` de red dentro de `try/catch` que muestre feedback (toast o mensaje en la página). Nunca dejar un error silenciado.
- **Estados de carga/vacío/error:** **toda** pantalla que dependa de la red implementa los tres, además del estado con datos.
- **CSS:** clases de Bootstrap primero; clases propias con prefijo de la feature (`.catalog-hero`, `.studio-kpi`); colores y espacios solo con variables de §6.1; nada de estilos en línea salvo valores dinámicos.
- **JSDoc:** tipos de entidades (`Evento`, `Compra`, `Retiro`, `Usuario`) definidos con `@typedef` en un archivo por feature, derivados del OpenAPI.
- **Git:** ramas `feature/<feature>-<descripción>`, *Conventional Commits* (`feat(checkout): sondeo del estado de la compra`), un cambio lógico por commit.

---

## 9. Configuración y comandos

### 9.1 Variables (`.env.example`)
```ini
VITE_API_URL=http://localhost:5000/api/v1
VITE_APP_NAME=NombreProvisional
VITE_PLAYER_MODE=simulated        # simulated | hls
VITE_ENABLE_DEV_TOOLS=true        # false en producción
VITE_POLITICA_DATOS_URL=#/politica-datos
```
> ⚠️ **Coordinación con el backend:** el servidor de desarrollo de Vite corre en `http://localhost:5173`. Ese origen debe estar en `CORS_ORIGINS` del `.env` del backend (el ejemplo del backend trae `5500` y `3000`). Si ves errores de CORS en la consola, es esto.

### 9.2 Scripts (`package.json`)
```bash
npm install
npm run dev        # vite --port 5173
npm run build      # vite build → dist/ (sitio estático)
npm run preview    # sirve dist/ para probar el build
npm run lint       # eslint .
npm run format     # prettier --write .
npm test           # node --test tests/
```
**Primer arranque:** backend en marcha con `make seed` → `cp .env.example .env` → `npm install` → `npm run dev` → abrir `http://localhost:5173` e iniciar sesión con las credenciales de demo que imprime el seed.

---

## 10. Pruebas y calidad

- **Unitarias (`node --test`):** `format-money`, `format-date` (zona de Bogotá), `validators`, `html` (escape), `query-string`, `media-url`, `category-gradient`, y el **cliente HTTP** con `fetch` simulado (refresh *single-flight*, normalización de errores, `FormData`, cancelación).
- **Manual guiado (obligatoria al cerrar cada fase):** recorrer el flujo en escritorio y en 375 px, con teclado y con cada rol.
- **Opcional (P2):** Playwright para el flujo completo.
- **Rendimiento:** carga diferida por feature, `loading="lazy"` en imágenes, búsqueda con *debounce* de 300 ms, cancelación de peticiones al cambiar de ruta. Objetivo orientativo: Lighthouse ≥ 90 en Accesibilidad y ≥ 80 en Rendimiento.

### Trazabilidad con el anteproyecto
| Verificación en la interfaz | Valida |
|-----------------------------|--------|
| Un artista se registra, crea y publica un evento sin ninguna aprobación ni pantalla de espera | C1, RQ1 |
| Ninguna pantalla muestra planes, suscripciones ni cuotas; el formulario aclara "solo comisión por boleto" | C2, RQ2 |
| Tras aprobar el pago, el botón cambia a "Ver ahora" sin pasos extra; un pago rechazado no da acceso | C3, RQ3 |
| Un usuario sin compra ve el replay bloqueado; con compra lo reproduce | C4, RQ5 |
| Iniciar la transmisión con clave incorrecta muestra el error; la clave solo se ve una vez | RQ6 |
| El registro no avanza sin aceptar el tratamiento de datos | RQ7 |

### Tareas de usabilidad (para la evaluación con SUS del anteproyecto)
La interfaz debe permitir completar **sin ayuda** estas tareas; si alguna exige explicación, es un defecto de diseño:
1. Registrarse como artista y crear un evento. 2. Publicarlo. 3. Registrarse como espectador y encontrar ese evento. 4. Comprar la entrada. 5. Ver el evento. 6. (Artista) Consultar sus ventas y solicitar un retiro.

---

## 11. Orden de implementación

Cada fase termina con la **checklist de §10** y sin errores de `npm run lint`. La columna *Requiere backend* indica desde qué fase del backend se puede probar contra la API real.

| Fase | Contenido | Requiere backend |
|------|-----------|:---:|
| 0 | Esqueleto: Vite, estructura, tokens y estilos base, router, cliente HTTP, sesión, layouts, utilidades, toasts/modal, pruebas de utilidades | Fase 0 |
| 1 | `auth`: login, registro con consentimiento, guards, navbar por rol, perfil y foto | Fase 1 |
| 2 | `catalog`: inicio, catálogo con filtros, detalle de evento (con CTA por estado), directorio y perfil de artista | Fases 2 y 6 |
| 3 | `checkout`: modal, simulador de Wompi, sondeo y resultados | Fase 3 |
| 4 | `watch`: reproductor simulado/HLS, estados de acceso, cuenta regresiva | Fase 4 |
| 5 | `studio`: eventos del artista, formulario, sala de control, estadísticas, finanzas y retiros | Fases 2, 4 y 5 |
| 6 | `account`: Mis eventos/Calendario, favoritos, siguiendo; botones de favorito y seguir en todo el sitio | Fases 3 y 6 |
| 7 | `admin`: dashboard, usuarios, eventos, compras, retiros, configuración | Fase 7 |
| 8 | Pulido: accesibilidad, responsive, estados vacíos/error, README, build y revisión de la trazabilidad | Fase 8 |

Si una fase del backend aún no existe, puedes avanzar con datos de ejemplo en `src/mocks/` activados con una variable `VITE_USE_MOCKS=true`, **usando exactamente el formato del contrato de §4**, y retirarlos al integrar. Si el tiempo aprieta, prioriza: **2 → 3 → 4 → 1 → 5 → 7 → 6**, y dentro de cada fase recorta lo secundario antes que dejar flujos a medias.

---

## 12. Reglas para agentes de IA

**Haz siempre**
1. Lee §3, §4 y §5 antes de tocar código. Contrasta cada endpoint con `docs/openapi.json`.
2. Para cada pantalla: **`api` → `service` → `page` → componentes → estilos → prueba/verificación manual**.
3. Implementa **carga, vacío, error y éxito** en toda pantalla con red.
4. Escapa todo dato externo (usa `html`); valida URLs externas.
5. Limpia en `destroy()`: listeners, `setInterval`, sondeos, reproductor y peticiones.
6. Muestra los mensajes de error del backend (`mensaje`, `detalles`) y mapea `codigo` a textos amigables cuando convenga.
7. Mantén la interfaz en español (es-CO), fechas en hora de Bogotá y dinero en COP con separador de miles.
8. Ejecuta `npm run lint` y `npm test`, y haz la revisión manual de §10 antes de dar la tarea por terminada.
9. Actualiza este archivo si cambia una ruta, un flujo o el contrato.

**Nunca hagas**
- ❌ Añadir un framework (React/Vue/Angular/jQuery) ni TypeScript sin que el usuario lo pida.
- ❌ Llamar a `fetch` fuera de `core/http/api-client.js`.
- ❌ Importar archivos internos de otra feature (solo su `index.js`) o hacer que `shared`/`core` importen de `features`.
- ❌ Usar `innerHTML` con datos de la API sin escapar.
- ❌ Guardar contraseñas, tokens de acceso, `stream_key` o datos de pago en `localStorage`/`sessionStorage` (solo el refresh token en `sessionStorage`).
- ❌ Calcular comisiones, saldos ni montos en el cliente; todo dinero viene del servidor.
- ❌ Mostrar planes, suscripciones o cuotas fijas (rompe C2) ni "cuenta en revisión" para artistas (rompe C1).
- ❌ Mostrar un replay o enlace de reproducción sin pasar por `reproduccion/entrar` (rompe C4).
- ❌ Copiar el logo, las imágenes o los textos de Veeps/Vibenix.
- ❌ Fiarse de que un botón oculto equivale a un permiso: el backend decide.
- ❌ Ampliar el alcance (chat real, pagos reales, modo claro, i18n) sin que el usuario lo pida.

**Si algo es ambiguo:** elige la opción más simple que respete C1–C4 y el contrato del backend, anótala como supuesto al final de tu respuesta y continúa.

**Definición de terminado (DoD) de una pantalla:** funciona con los cuatro estados (carga/vacío/error/éxito) · usa los tokens y componentes compartidos · se ve bien en 375 px y 1280 px · es utilizable con teclado · sin errores de lint · prueba o verificación manual hecha · AGENTS.md actualizado si cambió el contrato.

---

## 13. Estado de implementación y decisiones (cierre de la fase 8)

Las fases 0–8 de §11 están implementadas. Lo que no estaba escrito arriba y conviene respetar:

**Rutas reales.** Público: `#/`, `#/eventos`, `#/eventos/:id`, `#/artistas`, `#/artistas/:id`, `#/login`,
`#/registro`, `#/politica-datos` (provisional), `#/sin-acceso`. Cuenta (USUARIO y ARTISTA): `#/perfil`,
`#/mis-eventos` (`?tab=proximos|historial|calendario`), `#/favoritos`, `#/siguiendo`, `#/ver/:eventoId`.
Estudio (ARTISTA): `#/estudio`, `/eventos`, `/eventos/nuevo`, `/eventos/:id/editar`,
`/eventos/:id/transmision`, `/eventos/:id/estadisticas`, `/finanzas`. Administración (ADMIN): `#/admin`,
`/usuarios`, `/eventos`, `/compras`, `/retiros` (abre en PENDIENTE; `?estado=TODOS` = sin filtro),
`/configuracion`. Las subrutas inexistentes de `/estudio` y `/admin` dan 404 (no hay comodines).

**Contrato (verificado contra `docs/openapi.json`).** `POST /auth/refresh` recibe el refresh token como
Bearer y devuelve solo `access_token`; `POST /auth/registro` devuelve el `Usuario` (hay que llamar a
`/auth/login`); la foto responde `200` con el `Usuario`; en los `422`, `detalles` es `{campo: [mensajes]}`.
Un `401` con un código distinto de `NO_AUTENTICADO` (p. ej. `CLAVE_EMISION_INVALIDA`) es una regla de
negocio: no renueva ni cierra la sesión. `GET /usuarios/me/compras?proximos=true` solo trae `APROBADA` de
eventos `PROGRAMADO`/`EN_VIVO`; el Historial se arma en el cliente con el resto.

**Convenciones que surgieron.**
- Una feature pasa datos a otra por su `index.js` y por el bus de eventos (`compra:aprobada`).
- `shared/ui` no conoce a las features: las tarjetas reciben el botón de favorito/seguir como parámetro
  (`eventCard(e, {favorito})`, `artistCard(a, {accion})`); la lógica vive en `catalog`.
- `chart.js` se importa solo en `shared/ui/bar-chart.js` y `hls.js` solo en `watch/player/hls-player.js`,
  siempre con `import()`. Toda gráfica lleva descripción accesible y una tabla equivalente dentro de un
  `div.visually-hidden` (nunca `.visually-hidden` sobre la `<table>`: ignora `width: 1px` y desborda).
- Modales: se abren con `openModal`, que devuelve el foco a quien los abrió (Bootstrap no lo hace cuando
  el modal se abre por código). En la carga inicial el router NO mueve el foco al `<h1>` (así el primer
  Tab llega al enlace "Saltar al contenido"); en cada navegación posterior sí.
- Scroll por JS: usa `comportamientoDeScroll()`/`irAlInicioDe()` (respetan `prefers-reduced-motion`).
- Contraste: los botones `outline-danger` y `outline-secondary` se redefinen con los tokens (los de
  Bootstrap dan < 4,5:1). No uses `opacity` para "atenuar" bloques con texto.
- Los enlaces que vienen del entorno (`VITE_POLITICA_DATOS_URL`) pasan por `enlaceDeConfig`.
- El build inyecta una CSP (`csp.config.js`); el servidor de desarrollo no.

**Pendiente de negocio (no de código).** El texto de la política de tratamiento de datos y su pantalla.

**Auditoría.** `tests/auditoria/reglas.test.js` falla si alguien reintroduce `innerHTML` con datos, `fetch`
fuera de `core/http`, almacenamiento distinto del refresh token, importaciones entre capas o features
fuera de `index.js`, cálculos de dinero, textos de planes/revisión, `TODO(Fase …)` o mocks.
