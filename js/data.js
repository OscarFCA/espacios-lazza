/* Legato Capital — Catálogo de propiedades.
 *
 * VACÍO A PROPÓSITO. Las dieciséis propiedades que vivían aquí eran de
 * demostración —títulos, precios y zonas inventados para poder construir— y
 * se borraron el 25-oct-2026 para no lanzar con datos falsos.
 *
 * De aquí en adelante el catálogo se carga desde el panel, no desde este
 * archivo: Perfil → Propiedades → Publicar propiedad. Con el servidor
 * conectado (ver js/nube.js) lo que se publique lo ve cualquiera; sin él,
 * solo el navegador que lo subió, y el panel lo advierte.
 *
 * Si algún día hace falta volver a sembrar ejemplos, el formato es:
 *   { slug, op, tipo, condicion, negociable, exclusiva, title, zona, price,
 *     terreno, construido, rec, ban, autos, frente, fotosCount, nuevo,
 *     fotos: [{ src, alt }], desc, potencial }
 */
window.EL_DATA = [];

window.EL_CATALOG = {
  tipos: ["Casa", "Departamento", "Terreno", "Casa de descanso"],
  condiciones: ["Lista para habitar", "Para remodelar", "Obra negra", "Terreno libre"],
  ordenes: ["Relevancia", "Más recientes", "Precio menor", "Precio mayor", "Mayor terreno"],
  maxVenta: [
    { label: "Sin límite", value: 0 },
    { label: "$6,000,000", value: 6000000 },
    { label: "$10,000,000", value: 10000000 },
    { label: "$15,000,000", value: 15000000 },
    { label: "$25,000,000", value: 25000000 }
  ],
  maxRenta: [
    { label: "Sin límite", value: 0 },
    { label: "$30,000", value: 30000 },
    { label: "$50,000", value: 50000 },
    { label: "$80,000", value: 80000 }
  ]
};
