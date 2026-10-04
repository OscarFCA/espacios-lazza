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
| **Entra** | Se registra con nombre completo, correo y teléfono | *Acceso equipo*, al pie del sitio y al final del menú → correo o teléfono + contraseña (o directo en `#/admin`) |
| **Puede** | Buscar, ver fichas, **guardar** y **compartir** | Publicar y editar propiedades, mover interesados en el Kanban, ver quién guardó o compartió qué |
| **Sin registro** | Puede navegar y buscar; al intentar guardar o compartir aparece el registro con el contexto de lo que iba a hacer, y al completarlo la acción se ejecuta sola | — |

El panel tiene tres secciones: **Interesados** (Kanban de 6 etapas: Nuevo · Contactado ·
Visita agendada · Negociación · Cerrado · Descartado), **Propiedades** (alta, edición,
retiro y fotos) y **Actividad** (quién guardó y quién compartió, con fecha).

La ficha de cada interesado guarda teléfono, correo, otros correos, presupuesto,
empresa u ocupación y etapa, y muestra su origen y todo su historial.

El **seguimiento es una bitácora**: cada interesado acumula las notas que haga falta,
con fecha y hora, la más reciente arriba, y se pueden borrar una por una. Se guardan al
agregarlas, sin pasar por *Guardar cambios*, y la tarjeta del Kanban asoma la última y
cuántas lleva.

El Kanban se mueve arrastrando con el ratón y, en táctil y teclado, con el selector de
etapa que lleva cada tarjeta.

> ### Límites de esta versión
>
> No hay servidor: **todo vive en el `localStorage` del navegador**. En la práctica:
> una cuenta creada en un teléfono no existe en otro, y el panel solo ve la actividad
> ocurrida en ese mismo navegador (por eso trae cuatro interesados de ejemplo).
> La contraseña del panel está como hash en `js/store.js`, pero **en un sitio estático
> ningún control de acceso es real**: cualquiera puede saltárselo desde el navegador.
> Es una maqueta funcional para validar el flujo, no un sistema en operación.
>
> Toda la persistencia está aislada en `js/store.js`: conectar un backend es cambiar
> ese archivo, no las vistas.

## Pantallas

| Ruta | Pantalla |
|------|----------|
| `#/` | Home: hero editorial, buscador, selección, "cómo leemos una propiedad" y Nosotros |
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
- Objetivos táctiles ≥ 44 × 44 px; los chips crecen en `pointer: coarse`.
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
- Formularios reales de *Contactar* y *Agendar visita*.
- Aviso de privacidad: el registro ya pide datos personales (LFPDPPP).
- Cuenta, guardados sincronizados (hoy en `localStorage`) y búsquedas guardadas.
- Fotografía de las 13 propiedades.
