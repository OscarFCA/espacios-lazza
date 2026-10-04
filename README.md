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
├── js/data.js          Catálogo de propiedades (13 fichas) y catálogos de filtros
└── js/app.js           Estado, ruteo por hash, vistas, iconografía y eventos
```

## Correr en local

```bash
python3 -m http.server 8848
# http://localhost:8848
```

No requiere Node ni compilación. Se publica tal cual en GitHub Pages o HostGator (FTP).

## Pantallas

| Ruta | Pantalla |
|------|----------|
| `#/` | Home: hero editorial, buscador, selección, "cómo leemos una propiedad" y Nosotros |
| `#/resultados?...` | Resultados: toolbar sticky, chips activos, estados vacío/carga/error |
| `#/propiedad/<slug>` | Ficha: galería, precio, potencial, especificaciones, ubicación, similares |
| `#/guardados` | Guardados: selección del dispositivo, con estado vacío |

Los filtros viven en la URL (`#/resultados?tipo=Terrenos&max=15000000`), así que una
búsqueda se puede compartir y el botón **atrás** del teléfono funciona entre pantallas.

## Sistema visual aplicado

- **Color** — hueso `#F8F6F1` de fondo, carbón para texto y CTA primario, olivo como
  acento (iconos, estado activo, CTA secundario), arena para fotografía y superficies
  editoriales. Sin gradientes fuertes ni sombras duras.
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

1. **Blanco sobre olivo `#687A58` da 3.8:1.** Las superficies olivo que llevan texto
   (botón olivo, chip activo) usan `--color-dark-olive #4F6045` → 6.8:1. El olivo claro
   queda para iconos, bordes y acentos gráficos, donde basta 3:1.
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

El header usa un **wordmark tipográfico provisional** (Plus Jakarta Sans, tracking .08em):
el logotipo de Legato es personalizado y el documento pide no reconstruirlo con una
fuente estándar. Se sustituye en `index.html` cuando exista el archivo.

## Ubicación

Cada ficha enlaza a Google Maps en pestaña nueva. Por omisión busca la zona; para un
punto exacto, agrega el enlace corto a la propiedad en `js/data.js`:

```js
maps: "https://maps.app.goo.gl/xxxxxxxx"
```

## Pendiente para producción

- Logotipo de Legato Capital (lockup y símbolo) y favicon.
- Backend o CMS para el catálogo (hoy `js/data.js` es la fuente).
- Formularios reales de *Contactar*, *Agendar visita* y *Publicar propiedad*.
- Cuenta, guardados sincronizados (hoy en `localStorage`) y búsquedas guardadas.
- Fotografía de las 13 propiedades.
