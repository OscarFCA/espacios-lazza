# Legato Capital — plataforma inmobiliaria (mobile first)

Implementación del **Design System Legato Capital** como sitio estático, sin
dependencias ni build. Todo el CSS parte del móvil y escala hacia arriba con
`min-width`: el teléfono es el diseño base, no una adaptación.

> Rediseño sobre la base de Espacios Lazza (misma arquitectura de producto,
> identidad y sistema visual nuevos). La versión anterior vive en el historial de git.

```
├── index.html          App shell: header, drawer, bottom nav, main, footer, sheet, toast
├── css/tokens.css      Tokens del design system (§24) + escala fluida y gutters
├── css/app.css         Componentes. Base móvil → 640 / 768 / 1024 / 1280
├── js/data.js          Catálogo base de propiedades y catálogos de filtros
├── js/store.js         Capa de datos: cuentas, sesión, interesados, actividad, catálogo
├── js/admin.js         Panel interno: Kanban, ficha de interesado, alta de propiedades
└── js/app.js           Estado, ruteo por hash, vistas, iconografía y eventos
```

## Correr en local

```bash
python3 -m http.server 8848
# http://localhost:8848
```

No requiere Node ni compilación. Se publica tal cual en GitHub Pages o HostGator (FTP).

## Los dos roles

| | Usuario | Administrador |
|---|---|---|
| **Entra** | **Crear cuenta** (CTA verde del header): nombre completo, correo y teléfono con lada | **Iniciar sesión**, el mismo botón que usa cualquiera |
| **Ve** | Su perfil: oportunidades y guardados | El mismo perfil, con una barra de pestañas extra |
| **Puede** | Buscar, ver fichas, **guardar**, **compartir**, **escribir al equipo** y **pedir una visita** | Publicar y editar propiedades, **leer y contestar los mensajes**, confirmar visitas, mover interesados en el Kanban, ver quién guardó o compartió qué |
| **Sin registro** | Puede navegar y buscar; al intentar guardar o compartir aparece el registro con el contexto de lo que iba a hacer, y al completarlo la acción se ejecuta sola | — |

**Un solo login decide a dónde va cada quien.** Se pide primero el correo o el
teléfono: si la cuenta trae bandera de administrador, pide contraseña y abre el panel;
si es una cuenta común, entra directo a sus propiedades guardadas; si no existe,
ofrece crearla con esos datos. La cuenta del equipo vive en la misma lista de usuarios
marcada con `admin: true`, y nadie puede registrarse con ese correo.

**El panel no es una pantalla aparte: son pestañas del propio perfil.** La cuenta con
bandera de equipo ve en `#/perfil` una barra con *Mi perfil · Mensajes · Interesados ·
Propiedades · Actividad*; sin la bandera esa barra no existe, y forzar
`#/perfil/interesados` por URL no muestra nada del panel.

- **Mensajes**: la bandeja de entrada, con lo que llega por la ficha y por el asistente. Una fila por cliente, ordenada por lo último
  que pasó, con filtros *Todas · Sin leer · Visitas por confirmar*.
- **Interesados**: Kanban de 6 etapas (Nuevo · Contactado · Visita agendada ·
  Negociación · Cerrado · Descartado).
- **Propiedades**: alta, edición, retiro y fotos.
- **Actividad**: quién guardó, compartió, escribió o pidió visita, con fecha.

Cada pestaña tiene su URL (`#/perfil/interesados`), así que el botón atrás las recorre.
`#/admin` sigue funcionando: redirige a la pestaña del tablero.

La ficha de cada interesado guarda teléfono, correo, otros correos, presupuesto,
empresa u ocupación y etapa, y muestra su origen y todo su historial.

El **seguimiento es una bitácora**: cada interesado acumula las notas que haga falta,
con fecha y hora, la más reciente arriba, y se pueden borrar una por una. Se guardan al
agregarlas, sin pasar por *Guardar cambios*, y la tarjeta del Kanban asoma la última y
cuántas lleva.

El Kanban se mueve arrastrando con el ratón y, en táctil y teclado, con el selector de
etapa que lleva cada tarjeta.

### Contacto y visitas: la bandeja es el Kanban

**No hay dos sistemas.** Cada mensaje cuelga de la ficha del interesado, así que la
bandeja y el tablero leen lo mismo: *Mensajes* es el Kanban ordenado por conversación
en vez de por etapa, y una fila abre exactamente la misma ficha que una tarjeta.

Desde cualquier propiedad el cliente puede:

- **Hablar con un asesor** — escribe su pregunta y elige por dónde prefiere que le
  contesten: llamada, WhatsApp, **videollamada** o correo.
- **Solicitar una visita** — elige día y uno de cinco bloques de dos horas. El
  calendario no deja elegir días pasados, y la confirmación dice con todas sus letras
  que **todavía no está agendada**: la confirma el equipo.

Sin cuenta, el panel de registro aparece primero y al terminar continúa con el mensaje
que la persona iba a mandar. **Escribir da de alta al interesado si no existía**, así
que nadie se queda fuera del tablero.

Qué pasa del lado del equipo:

- La tarjeta del Kanban se marca, dice cuántos mensajes van sin leer y asoma el último.
- La ficha abre con **la conversación arriba** —antes que los datos comerciales—, con
  botones para llamar, abrir WhatsApp o escribir un correo, y un campo para responder.
  Abrirla la marca como leída.
- Una **visita pendiente** sale destacada con su día y horario. *Confirmar visita*
  mueve la ficha a *Visita agendada* y le avisa al cliente en el mismo hilo. Es lo
  único que cambia una etapa por su cuenta: todo lo demás lo decide el equipo.

El cliente ve el mismo hilo en **Tus mensajes**, dentro de su perfil, y puede seguir
contestando desde ahí. Las notas de *Seguimiento* son otra cosa: son internas y el
cliente no las ve.

### Asistente guiado (el botón de la esquina)

Un **guion**, no un modelo de lenguaje. Vive en un botón fijo abajo a la derecha —como
cualquier widget de chat— y abre una **caja en la esquina**: no oscurece el sitio ni
atrapa el foco, así que se puede seguir navegando con la conversación abierta. El mismo
botón la cierra.

Cada paso ofrece **respuestas establecidas**; solo se escribe cuando hace falta un dato
que nadie puede adivinar (nombre, correo, teléfono, el mensaje).

**Se toma dos segundos antes de cada respuesta**, con los tres puntos de rigor. No es
adorno: una contestación instantánea delata que no hay nadie del otro lado, y la pausa
da tiempo a leer lo que uno acaba de responder. Mientras «escribe» no hay nada que
tocar, así que un doble clic no adelanta el guion. Lo único inmediato son los avisos de
validación: eso no es una respuesta, es un apunte sobre lo que acabas de escribir.

Dos caminos:

1. **Crear mi cuenta** — nombre, correo y teléfono con lada, uno por uno, validando en
   la propia conversación. Al terminar la sesión queda abierta y la cabecera se
   actualiza sin cerrar el asistente.
2. **Hablar con un asesor** — sin cuenta la pide primero, explicando por qué, y al
   terminar **retoma donde se quedó**. Si hay una propiedad en pantalla, la ofrece como
   tema sin preguntar cuál. También agenda visitas, con el mismo día + bloque de dos
   horas.

**Hablar con un asesor exige un WhatsApp**: es por donde se responde. A quien se
registra por ese camino se le pide directamente como WhatsApp; a quien ya tiene cuenta
se le pregunta en un toque si es el mismo número que dio («Sí, ese mismo» / «Mi WhatsApp
es otro número»). Se guarda aparte del teléfono —mucha gente da el fijo y chatea desde
el celular— y pueden ser de países distintos. Se pide **una sola vez**; el panel de
contacto de la ficha lo pide igual si todavía no está.

En el panel del equipo, *Llamar* usa el teléfono y *WhatsApp* usa el WhatsApp, que
aparece con su número cuando es distinto.

El guion **nunca nombra a Jaime**: quien llega no sabe quién es. Habla de *un asesor*;
el nombre es el de la cuenta del equipo, no el de cara al cliente.

Todo lo que manda sale por `Store.enviarMensaje`: **cae en la bandeja y en el Kanban**
igual que si se hubiera escrito desde la ficha. El asistente no guarda nada propio y la
conversación con el bot no se persiste: es un camino, no un historial.

El guion vive en `PASOS`, dentro de `js/bot.js`. Cada paso declara qué dice, qué
opciones da (`opciones`) o qué dato pide (`entrada`), y a qué paso salta. Agregar una
pregunta es agregar una entrada a ese objeto.

> Con la cuenta del equipo el botón no aparece: el asesor no se escribe a sí mismo.

### La regla: sin datos de contacto no hay conversación

**Para abrir una conversación hay que dejar cómo contestarte; con la sesión abierta se
puede escribir cuando sea, desde donde sea.** Rige en las seis puertas —*Contactar* de
la ficha y de la barra del teléfono, *Agendar visita*, *Hablar con un asesor* de la
portada, y los dos caminos del asistente— y además en `js/store.js`: `enviarMensaje`
devuelve `sin-sesion` y no escribe nada, así que la regla no depende de que la pantalla
la respete.

Con sesión no vuelve a preguntar nada: se escribe desde la ficha, desde la portada, desde
el asistente en cualquier pantalla, y desde **Tus mensajes** en el perfil —ahí el campo
está siempre, haya hilo o no, para poder empezar uno. Si la sesión se cae a media
conversación, el asistente pide los datos y retoma en el punto donde iba.

### Teléfono con lada

El teléfono se captura como **país + número**, con **México (+52) preseleccionado**
porque es el mercado. Se guarda el país, no solo la lada, porque Estados Unidos y
Canadá comparten el +1.

- Cada país trae **cuántos dígitos espera** y la validación usa esa regla: diez para
  México, nueve para España. El texto de ayuda cambia al cambiar de país.
- Pegar `+52 55 1234 5678` **no guarda la lada dos veces**: si el número trae su propio
  código delante, se descarta.
- Se puede **iniciar sesión con o sin lada**: `5531650560`, `525531650560` y
  `+52 55 3165 0560` llegan a la misma cuenta.
- *Llamar* y *WhatsApp* en la ficha del interesado **usan la lada guardada**, no un +52
  fijo.
- Cada país **agrupa sus dígitos como le toca**: `+52 55 3165 0560` pero
  `+1 415 553 8217`. Si la cantidad de dígitos no cuadra con el patrón del país, se
  parte de tres en tres antes que mentir con un formato que no es.

La lista de países vive en `PAISES`, dentro de `js/store.js`: son doce y agregar uno es
agregar un renglón. Nada más depende de ella.

### Oportunidades con acceso anticipado

Tres propiedades llevan `exclusiva: true` en `js/data.js`. Eso las saca de la búsqueda
pública y las manda a `#/oportunidades`:

- **Sin cuenta:** se ven las fotografías con candado, sin ubicación, superficie ni
  precio, y la ficha no abre (entrar por URL directa tampoco funciona). Dos botones:
  crear cuenta o iniciar sesión.
- **Con cuenta:** tarjetas completas y fichas abiertas, también listadas en el perfil.

Es el beneficio concreto de registrarse, y la razón por la que el registro tiene sentido
para el usuario y no solo para el equipo.

### Perfil

`#/perfil` es la pantalla del usuario: retrato (el símbolo de Legato sobre olivo), sus
datos, **Tus mensajes** (la conversación con el equipo), **Oportunidades antes que
nadie** y **Tus guardados**. Se llega tocando el
retrato del header, o *Perfil* en la barra inferior del teléfono. Si la cuenta es del
equipo, el perfil ofrece además entrar al panel.

### Cuentas de prueba

| | Entra con | Qué ve |
|---|---|---|
| **Usuario común** — Elías Rico | `demo@legato.mx` (sin contraseña) | Su perfil: una conversación abierta con el equipo, oportunidades reservadas y sus 3 guardados |
| **Equipo** — Jaime Lavín | `info@lazza.com.mx` o `5522504642` + contraseña | El mismo perfil, más la bandeja y el Kanban, con tres conversaciones de ejemplo |

Las dos cuentas usan la misma pantalla de perfil; la del equipo solo agrega la barra
de pestañas. Con la sesión del equipo, *Contactar* y *Agendar visita* no abren el
formulario: avisan que esa es la vista del cliente, para no crearse una ficha a sí
mismo en el Kanban.

La cuenta de prueba aparece anotada en la propia pantalla de acceso. Para quitarla
antes de salir a producción: borra `DEMO` y `asegurarDemo` en `js/store.js` y la línea
de la cuenta de prueba en `loginHTML` de `js/app.js`.

> ### Límites de esta versión
>
> No hay servidor: **todo vive en el `localStorage` del navegador**. En la práctica:
> una cuenta creada en un teléfono no existe en otro, el panel solo ve la actividad
> ocurrida en ese mismo navegador (por eso trae cuatro interesados de ejemplo) y
> **los mensajes no salen a ningún lado**: no se manda correo ni WhatsApp, la
> conversación vive en el navegador de cada quien. Los botones *Llamar*, *WhatsApp* y
> *Correo* de la ficha sí son reales: abren la app del teléfono con los datos del
> interesado.
> La contraseña del panel está como hash en `js/store.js`, pero **en un sitio estático
> ningún control de acceso es real**: cualquiera puede saltárselo desde el navegador.
> Es una maqueta funcional para validar el flujo, no un sistema en operación.
>
> Toda la persistencia está aislada en `js/store.js`: conectar un backend es cambiar
> ese archivo, no las vistas.

## Categorías: tres ejes que no se mezclan

Antes *tipo* mezclaba la categoría con la condición ("Casas", "Terrenos", "Para
remodelar" convivían en el mismo selector). Ahora son tres ejes independientes:

| Eje | Valores | Dónde se elige |
|---|---|---|
| **Tipo** — qué es | Casa · Departamento · Terreno · Casa de descanso | Filtros (selección múltiple) y accesos rápidos |
| **Operación** — el trato | En venta · En renta | Pestañas del buscador y del nav |
| **Condición** — cómo está | Lista para habitar · Para remodelar · Obra negra · Terreno libre | Filtros (selección múltiple) |

Además, `negociable: true` marca que el precio admite negociación: se muestra junto al
precio, no entre las categorías, porque no es una categoría.

**Etiquetas de color.** Cada tipo tiene su par fondo/texto, todos verificados por encima
de 4.5:1 a 11 px: Casa (olivo), Departamento (gris cálido), Terreno (ocre), Casa de
descanso (verde azulado), Para remodelar (terracota), Obra negra (piedra), Acceso
anticipado (carbón).

Sobre la fotografía va **una sola**: la categoría. La condición y el acceso anticipado
viajan en el cuerpo, junto a la operación ("EN VENTA · PARA REMODELAR"), donde pueden
fluir sin tapar la imagen. Con dos encima, en tarjetas angostas saltaban a un segundo
renglón.

El nav se simplificó a **Comprar · Rentar · Oportunidades · Nosotros**: los tipos viven
en los filtros, no duplicados en la navegación. *Inversión* desapareció porque no
filtraba nada — era la misma lista reordenada.

## Auditoría de heurísticas (Nielsen)

Lo que se encontró y se corrigió:

| Heurística | Hallazgo | Corrección |
|---|---|---|
| 1 · Visibilidad del estado | El conteo decía el lugar pero no la operación; en el teléfono no se veía si estabas en venta o renta | "10 propiedades **en venta** en Ciudad de México" y las pestañas de operación visibles desde 320 px |
| 3 · Control y libertad | Eliminar un interesado o retirar una propiedad era irreversible | Ambos avisan con **Deshacer** durante 7 segundos y restauran el registro completo |
| 4 · Consistencia | Los tipos mezclaban plural y singular, y la condición vivía dentro del tipo | Tres ejes con nombres en singular |
| 5 · Prevención de errores | Publicar dos veces el mismo título y zona **sobrescribía** la propiedad anterior sin avisar | Se numera el identificador y el aviso dice cómo quedó publicada |
| 9 · Recuperarse de errores | El estado vacío no decía qué filtro lo causaba; y si el navegador bloquea el almacenamiento, guardar fallaba en silencio | El vacío nombra los filtros activos y ofrece quitarlos; el almacenamiento bloqueado ahora avisa |
| 10 · Ayuda | "Obra negra" o "Terreno libre" son términos del gremio sin explicación | Glosa de las cuatro condiciones dentro del panel de filtros |

Un defecto encontrado al probar la corrección de la heurística 3: el aviso tenía
`pointer-events: none` y al mostrarse nunca lo recuperaba, así que **su botón era
inalcanzable**. Afectaba a cualquier acción dentro de un aviso.

## Pantallas

| Ruta | Pantalla |
|------|----------|
| `#/` | Home: hero editorial, buscador, **6 propiedades**, "cómo leemos una propiedad" y Nosotros |
| `#/resultados?...` | Resultados: toolbar sticky, chips activos, estados vacío/carga/error |
| `#/propiedad/<slug>` | Ficha: galería, precio, potencial, especificaciones, ubicación, similares |
| `#/guardados` | Guardados: selección de la cuenta, con estado vacío |
| `#/admin` | Panel interno: Interesados (Kanban), Propiedades y Actividad |

Los filtros viven en la URL (`#/resultados?tipo=Terrenos&max=15000000`), así que una
búsqueda se puede compartir y el botón **atrás** del teléfono funciona entre pantallas.

## Sistema visual aplicado

- **Color** — hueso `#F8F6F1` de fondo, carbón para texto, **olivo como acción
  principal** (CTA, pestaña activa, chips activos, foco) y arena para fotografía y
  superficies editoriales. Sin gradientes fuertes ni sombras duras.

  Jerarquía de acción: olivo sólido (principal) → contorno olivo (CTA de marca, como
  *Publicar propiedad*) → contorno carbón (secundario, como *Agendar visita*) → enlace.
  Es una decisión de marca sobre el §12, que proponía carbón como primario.
- **Tipografía** — Plus Jakarta Sans como única familia; Display XL 64 / H1 48 / H2 36 /
  H3 28 / H4 22 / Body 16 / Label 12 con `letter-spacing` .14em en mayúsculas.
- **Espaciado** — base 8 px; márgenes laterales 20 → 32 → 80 px, contenedor 1440 / 1280.
- **Radios** — 4 inputs pequeños, 6 botones, 8 cards, 12 cards principales, 16 imágenes.
- **Motion** — 120 / 180 / 240 / 320 ms con `cubic-bezier(.22,1,.36,1)`.
- **Iconografía** — set lineal propio (trazo 1.7, sin relleno) en vez de una librería
  externa, para no cargar dependencias: búsqueda, filtro, marcador, ubicación, terreno,
  superficie, recámara, baño, auto, perfil.

### Dos ajustes de contraste sobre el documento

El §23 pide 4.5:1 en texto normal y el propio sistema no lo alcanza en dos pares:

1. **Blanco sobre olivo `#687A58` da 3.8:1.** Toda superficie olivo con texto
   (CTA principal, pestaña y chips activos) usa `--color-dark-olive #4F6045` → 6.8:1.
   El olivo claro queda para iconos, bordes y acentos gráficos, donde basta 3:1.
2. **Stone `#6B6B66` sobre arena suave da 4.37:1.** Sobre hueso y blanco sí pasa
   (4.9 / 5.3), así que solo las secciones en arena usan un tono más profundo.

`css/tokens.css` documenta ambos en el lugar donde se definen.

## Escalera responsive

Tres patrones, no uno estirado:

| Rango | Navegación | Buscador | Resultados | Ficha |
|---|---|---|---|---|
| **< 768** teléfono | Barra inferior (Inicio · Buscar · Guardados · Perfil) + menú lateral | Campos apilados | 1 col (2 desde 640) | 1 col + barra de acción fija |
| **768–1023** tablet | Nav en el header + menú para Cuenta/Publicar | Rejilla 2×2 | 2 col | 2 col, galería 2/3 + 1/3, asesor sticky |
| **≥ 1024** escritorio | Nav + Cuenta + CTA | Barra horizontal única (§20) | 3 col | 2 col con más aire |

Verificado en 320, 360, 390, 430, 768, 820, 1024, 1180 y 1440 px, más teléfono en
horizontal (844×390), que reduce la altura del cromo para no comerse la pantalla.
Ninguna pantalla produce scroll horizontal.

## Mobile first

- **Bottom nav** (§21): Inicio · Buscar · Guardados · Perfil, con contador de guardados.
  El menú lateral conserva la navegación completa (Comprar, Rentar, Terrenos, Inversión,
  Nosotros) y el CTA de publicar.
- **Buscar en un tap desde Home**: el buscador está desplegado y los accesos rápidos
  llevan directo a resultados filtrados.
- **Sin fotografía de portada.** El catálogo es lo primero que se ve: en el teléfono el
  buscador hace una sola pregunta (dónde) y tipo y precio viven en Filtros, así la
  primera propiedad entra en la pantalla inicial.
- **Buscador apilado** en móvil; a 1024 px se convierte en la barra horizontal única.
- **Filtros en bottom sheet** con CTA fijo que muestra el conteo en vivo y valida
  precio mínimo/máximo. En tablet/desktop el mismo componente se centra como modal.
- **Cards full-width** en móvil → 2 columnas a 640 px → 3 a 1024 px. Toda la card es
  objetivo táctil; el marcador conserva acción propia.
- **Ficha**: galería deslizable con contador y barra de acción fija apoyada sobre el
  bottom nav. Desde tablet, galería 2/3 + dos secundarias y asesor en columna sticky.
- **Objetivo táctil real**: los campos del buscador son `<label>` que envuelven al
  control, así que tocar el rótulo o el icono enfoca; antes solo respondía el input
  (28 px de alto). Ningún control baja de 44 px en `pointer: coarse`.

## Accesibilidad (WCAG 2.2 AA)

- Todo el texto renderizado pasa 4.5:1 (3:1 en texto grande); hay una auditoría
  automatizada de contraste sobre las cinco pantallas.
- **Objetivos táctiles por token.** `--target` vale 44 px (mínimo de Apple y piso de
  la WCAG) y sube a **48 px en `pointer: coarse`**, la recomendación de Material; el
  icono dentro pasa de 20 a **24 px**, que es lo que hace que un botón se *vea* del
  tamaño que mide. Lo usan los botones de icono, el retrato, el marcador de las
  tarjetas, los chips, los botones pequeños y los enlaces.
- En los interruptores la etiqueta ocupa toda la fila: antes el único objetivo era la
  casilla de 24 px.
- **Los botones del header llevan superficie** (fondo blanco, borde fino, esquina
  recta) e icono de 26 px con trazo 1.8. Sin ella se leían pequeños junto a un
  logotipo de 30 px, aunque midieran 48. De paso empatan con el contorno de
  *Iniciar sesión*.
- Estado seleccionado nunca depende solo del color: cambia fondo, peso y marca ✓.
- Foco visible con halo olivo, navegación por teclado, `Escape` cierra drawer y sheet,
  foco atrapado dentro de ambos y devuelto al control que los abrió.
- Precios duplicados para lector de pantalla; iconos con su unidad en texto.
- `prefers-reduced-motion` desactiva transiciones y el shimmer de los skeletons.

## Fotografía y marca

Las fotos son placeholders que declaran qué falta ("Fotografía 3 de 12"), no imágenes de
archivo que alteren el estado percibido del inmueble. Para publicar fotos reales:

```js
fotos: [
  { src: "assets/fotos/condesa-01.jpg", alt: "Fachada de la casa en Condesa" }
]
```

Dirección: arquitectura contemporánea, piedra, madera, olivos, luz cálida, saturación
contenida. Ratios: card 4:3, galería 4:3, hero 16:9 / 2:1.

### Logotipo

Los archivos de marca están en `assets/`, recortados al contenido y exportados a 3x
desde los originales:

| Archivo | Uso |
|---|---|
| `logo-lockup.png` | Lockup negro (LEGATO + CAPITAL). Header 30 → 34 px, menú 26 px, pie 34 px |
| `logo-lockup-white.png` | El mismo lockup en blanco, para superficies carbón u olivo |
| `logo-mark.png` / `logo-mark-white.png` | Símbolo "L" suelto, para espacios cuadrados |
| `favicon-32.png`, `apple-touch-icon.png` | Símbolo negro sobre hueso, con aire alrededor |
| `og-image.png` | 1200×630 para compartir, lockup centrado sobre hueso |

El lockup se escala **por altura** (`height` en CSS, `width: auto`); nunca se deforma
ni se reconstruye con una fuente, como pide el §4 del documento.

## Ubicación

Cada ficha enlaza a Google Maps en pestaña nueva. Por omisión busca la zona; para un
punto exacto, agrega el enlace corto a la propiedad en `js/data.js`:

```js
maps: "https://maps.app.goo.gl/xxxxxxxx"
```

## Pendiente para producción

- Backend o CMS para el catálogo (hoy `js/data.js` es la fuente).
- Backend real: cuentas con contraseña, datos compartidos entre dispositivos y un
  panel con acceso de verdad. Hoy `js/store.js` es el único archivo a sustituir.
- Que los mensajes **salgan del navegador**: hoy *Contactar* y *Agendar visita*
  guardan la conversación en local. Falta el envío real (correo o WhatsApp) y la
  notificación al equipo.
- Teléfono y WhatsApp públicos de Legato en la ficha y el pie: hoy el único canal es
  el formulario.
- Aviso de privacidad: el registro ya pide datos personales (LFPDPPP).
- Cuenta, guardados sincronizados (hoy en `localStorage`) y búsquedas guardadas.
- Fotografía de las 13 propiedades.
