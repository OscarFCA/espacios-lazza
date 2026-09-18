# Espacios Lazza — plataforma inmobiliaria (mobile first)

Implementación del design system **Espacios Lazza v1.0** como sitio estático, sin
dependencias ni build. Todo el CSS parte del móvil y escala hacia arriba con
`min-width`: el teléfono es el diseño base, no una adaptación.

```
EspaciosLazza/
├── index.html          App shell: header, drawer, main, footer, sheet, toast
├── css/tokens.css      Tokens del design system (§22) + escala fluida y gutters
├── css/app.css         Componentes. Base móvil → 640 / 768 / 1024 / 1280
├── js/data.js          Catálogo de propiedades (13 fichas) y catálogos de filtros
├── js/app.js           Estado, ruteo por hash, vistas y eventos
└── assets/             Lockup y símbolo Lazza
```

## Correr en local

```bash
cd EspaciosLazza
python3 -m http.server 8848
# http://localhost:8848
```

No requiere Node ni compilación. Se publica tal cual en HostGator (FTP) o GitHub Pages.

## Pantallas

| Ruta | Pantalla |
|------|----------|
| `#/` | Home: hero, tabs Comprar/Rentar, buscador, accesos rápidos, selección y pilares |
| `#/resultados?...` | Resultados: toolbar sticky, chips activos, lista o mapa, estados vacío/carga/error |
| `#/propiedad/<slug>` | Ficha: galería, precio, descripción, ¿por qué tiene potencial?, especificaciones, ubicación, similares |

Los filtros viven en la URL (`#/resultados?tipo=Terrenos&max=15000000`), así que una
búsqueda se puede compartir y el botón **atrás** del teléfono funciona entre pantallas.

## Decisiones mobile first

- **Header 56 px** con logo, favoritos y menú; el drawer lateral trae la navegación
  completa. A partir de 1024 px aparece la barra horizontal y el CTA "Publicar propiedad".
- **Buscar en un tap desde Home**: el buscador está desplegado (no oculto tras un botón)
  y los accesos rápidos llevan directo a resultados filtrados.
- **Buscador apilado** en móvil (tres campos de 56 px + botón ancho); a 1024 px se
  convierte en la barra única de 56 px del design system.
- **Filtros en bottom sheet** a pantalla casi completa, con CTA fijo abajo que muestra el
  conteo en vivo (*Ver 8 propiedades*) y valida precio mínimo/máximo antes de aplicar.
  En tablet/desktop el mismo componente se centra como modal.
- **Cards verticales full-width** en móvil → 2 columnas a 640 px → 3 a 1024 px. Toda la
  card es un objetivo táctil (link estirado) y el corazón conserva acción propia.
- **Mapa**: en móvil reemplaza a la lista y muestra una tarjeta asomada al tocar un pin;
  en desktop convive con los resultados en 60/40.
- **Ficha**: galería deslizable con contador, y barra de acción fija abajo con precio
  corto + *Contactar*. En desktop la galería es 2/3 + dos secundarias y el asesor queda
  en una columna sticky.

## Accesibilidad (objetivo WCAG 2.2 AA)

- Objetivos táctiles ≥ 44 × 44 px (los chips crecen en `pointer: coarse`).
- Estado seleccionado nunca depende solo del color: cambia fondo, peso y marca ✓.
- Foco visible, navegación completa por teclado, `Escape` cierra drawer y sheet, foco
  atrapado dentro de ambos y devuelto al control que los abrió.
- Precios duplicados para lector de pantalla ("12,800,000 pesos mexicanos").
- Errores de formulario con `aria-invalid` + `aria-describedby`, no solo color.
- `prefers-reduced-motion` desactiva transiciones y el shimmer de los skeletons.

## Fotografía

Mientras no haya imágenes reales, cada ficha muestra un placeholder que declara qué
falta ("Fotografía 3 de 12"), en lugar de una foto de archivo que altere el estado
percibido del inmueble (§9). Para publicar fotos reales basta agregar el arreglo en
`js/data.js`:

```js
fotos: [
  { src: "assets/fotos/condesa-01.jpg", alt: "Fachada de la casa en Condesa" },
  { src: "assets/fotos/condesa-02.jpg", alt: "Patio central en su estado actual" }
]
```

Ratios: card 4:3, galería 4:3, hero 16:9.

## Pendiente para producción

- Backend o CMS para el catálogo (hoy `js/data.js` es la fuente).
- Mapa real (Mapbox/Google) en lugar del esquemático del prototipo.
- Formularios reales de *Contactar*, *Agendar visita* y *Publicar propiedad*
  (hoy responden con un toast).
- Cuenta, favoritos sincronizados (hoy viven en `localStorage`) y búsquedas guardadas.
- Fotografía de las 13 propiedades.
