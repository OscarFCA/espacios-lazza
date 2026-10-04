/* Legato Capital — Catálogo de propiedades (prototipo).
 *
 * Tres ejes distintos, que antes estaban mezclados:
 *   tipo       — qué es: Casa · Departamento · Terreno · Casa de descanso
 *   op         — el trato: venta · renta
 *   condicion  — cómo está: Lista para habitar · Para remodelar · Obra negra · Terreno libre
 * `negociable: true` avisa que el precio admite negociación.
 *
 * `exclusiva: true` marca una oportunidad con acceso anticipado: no aparece en la
 * búsqueda pública y su ficha solo abre con cuenta.
 *
 * Para publicar fotografía real: agrega `fotos: [{ src, alt }, ...]` a la propiedad.
 * Para apuntar la ubicación a un punto exacto, agrega `maps: "https://maps.app.goo.gl/..."`;
 * sin ese campo el enlace busca la zona de la ficha en Google Maps.
 * Si `fotos` está vacío se muestra un placeholder honesto, nunca una imagen
 * que altere el estado percibido del inmueble (Design System §16).
 */
window.EL_DATA = [
  { slug:"condesa-remodelar", op:"venta", tipo:"Casa", condicion:"Para remodelar", negociable:true, title:"Casa para remodelar", zona:"Condesa, Cuauhtémoc", price:12800000, terreno:280, construido:210, rec:3, ban:2, autos:2, frente:"10 m", fotosCount:12, nuevo:6, x:34, y:30, fotos:[],
    desc:"Casa de dos niveles construida en los años cuarenta, con patio central y muros de carga en buen estado. Conserva la carpintería original y los pisos de madera en planta alta.",
    potencial:"Terreno de 280 m² con frente de 10 m en una zona consolidada. La distribución actual permite explorar una remodelación integral o la integración de un tercer nivel, sujeto a normativa." },
  { slug:"del-valle-terreno", op:"venta", tipo:"Terreno", condicion:"Terreno libre", negociable:false, title:"Terreno urbano", zona:"Del Valle Centro, Benito Juárez", price:9400000, terreno:420, construido:0, rec:0, ban:0, autos:0, frente:"14 m", fotosCount:8, nuevo:2, x:52, y:62, fotos:[],
    desc:"Predio regular con frente de 14 m sobre calle secundaria, libre de construcción y con servicios municipales completos.",
    potencial:"Superficie de 420 m² con forma regular y dos accesos posibles. El uso de suelo habitacional permite estudiar vivienda unifamiliar o plurifamiliar, sujeto a validación técnica." },
  { slug:"coyoacan-jardin", op:"venta", tipo:"Casa", condicion:"Lista para habitar", negociable:false, title:"Casa con jardín", zona:"Coyoacán Centro, Coyoacán", price:18500000, terreno:460, construido:320, rec:4, ban:3, autos:2, frente:"16 m", fotosCount:18, nuevo:1, x:66, y:78, fotos:[],
    desc:"Casa de un nivel con jardín arbolado, doble altura en estancia y ventanales orientados al poniente.",
    potencial:"La proporción entre terreno y construcción deja 140 m² libres para ampliación o estudio independiente en planta baja." },
  { slug:"santa-fe-esquina", exclusiva:true, op:"venta", tipo:"Terreno", condicion:"Terreno libre", negociable:false, title:"Terreno en esquina", zona:"Santa Fe, Álvaro Obregón", price:24000000, terreno:1200, construido:0, rec:0, ban:0, autos:0, frente:"28 m", fotosCount:6, nuevo:4, x:14, y:44, fotos:[],
    desc:"Predio en esquina con doble frente y topografía ligeramente inclinada, sobre vialidad con acceso directo.",
    potencial:"1,200 m² en esquina con 28 m de frente. La doble orientación permite estudiar un proyecto de usos mixtos o vivienda en condominio, sujeto a normativa." },
  { slug:"roma-depto", op:"venta", tipo:"Departamento", condicion:"Para remodelar", negociable:false, title:"Departamento para remodelar", zona:"Roma Norte, Cuauhtémoc", price:6950000, terreno:0, construido:96, rec:2, ban:1, autos:1, frente:"—", fotosCount:10, nuevo:3, x:40, y:22, fotos:[],
    desc:"Departamento en tercer nivel de un edificio de 1962, con instalaciones originales y balcón a la calle.",
    potencial:"96 m² sin muros divisorios estructurales al interior, lo que permite reconfigurar por completo la planta." },
  { slug:"san-angel-antigua", exclusiva:true, op:"venta", tipo:"Casa", condicion:"Para remodelar", negociable:true, title:"Casa antigua en venta", zona:"San Ángel, Álvaro Obregón", price:27300000, terreno:620, construido:410, rec:5, ban:4, autos:3, frente:"18 m", fotosCount:22, nuevo:8, x:28, y:70, fotos:[],
    desc:"Casa de cantera con patio empedrado y muros de adobe reforzado. Requiere intervención en cubiertas e instalaciones.",
    potencial:"620 m² de terreno con construcción catalogada en contexto protegido. La intervención debe plantearse como restauración con obra nueva parcial." },
  { slug:"escandon-mixto", op:"venta", tipo:"Terreno", condicion:"Terreno libre", negociable:true, title:"Terreno con uso mixto", zona:"Escandón, Miguel Hidalgo", price:11200000, terreno:340, construido:0, rec:0, ban:0, autos:0, frente:"12 m", fotosCount:5, nuevo:5, x:44, y:40, fotos:[],
    desc:"Predio intermedio sobre avenida secundaria, con demolición reciente y terreno limpio.",
    potencial:"340 m² con uso mixto permitido: planta baja comercial y niveles superiores habitacionales, sujeto a normativa vigente." },
  { slug:"polanco-depto", op:"venta", tipo:"Departamento", condicion:"Lista para habitar", negociable:false, title:"Departamento en Polanco", zona:"Polanco, Miguel Hidalgo", price:14600000, terreno:0, construido:130, rec:2, ban:2, autos:2, frente:"—", fotosCount:14, nuevo:1, x:30, y:14, fotos:[],
    desc:"Departamento con terraza de 18 m², cocina integrada y acabados entregados en obra blanca.",
    potencial:"La terraza puede integrarse a la estancia o cerrarse como estudio, según reglamento del condominio." },
  { slug:"tlalpan-obra-negra", op:"venta", tipo:"Casa", condicion:"Obra negra", negociable:true, title:"Casa en obra negra", zona:"Tlalpan Centro, Tlalpan", price:8100000, terreno:300, construido:180, rec:3, ban:2, autos:2, frente:"11 m", fotosCount:9, nuevo:7, x:58, y:88, fotos:[],
    desc:"Construcción detenida en obra negra con losas terminadas y muros levantados. Se entrega con planos estructurales.",
    potencial:"La estructura existente permite terminar el proyecto original o replantear la distribución interior sin demoler losas." },
  { slug:"xochimilco-arbolado", op:"venta", tipo:"Terreno", condicion:"Terreno libre", negociable:false, title:"Terreno arbolado", zona:"Xochimilco Centro, Xochimilco", price:5400000, terreno:900, construido:0, rec:0, ban:0, autos:0, frente:"22 m", fotosCount:7, nuevo:9, x:78, y:92, fotos:[],
    desc:"Predio con vegetación existente, ligera pendiente y acceso por camino empedrado.",
    potencial:"900 m² que permiten un proyecto de baja densidad conservando el arbolado, sujeto a estudio de impacto y normativa ambiental." },
  { slug:"coyoacan-renta", op:"renta", tipo:"Casa", condicion:"Lista para habitar", negociable:false, title:"Casa con estudio", zona:"Del Carmen, Coyoacán", price:48000, terreno:300, construido:240, rec:3, ban:3, autos:2, frente:"12 m", fotosCount:11, nuevo:2, x:62, y:74, fotos:[],
    desc:"Casa de dos niveles con estudio independiente en la azotea y patio interior con higuera.",
    potencial:"El estudio independiente permite uso profesional sin intervenir la casa principal." },
  { slug:"juarez-renta", op:"renta", tipo:"Departamento", condicion:"Lista para habitar", negociable:false, title:"Departamento amueblado", zona:"Juárez, Cuauhtémoc", price:26500, terreno:0, construido:85, rec:2, ban:1, autos:1, frente:"—", fotosCount:9, nuevo:1, x:38, y:26, fotos:[],
    desc:"Departamento en edificio de 1958 rehabilitado, con doble altura y ventanas originales.",
    potencial:"Contrato flexible que permite adaptar un cuarto como taller o estudio." },
  { slug:"granada-renta", exclusiva:true, op:"renta", tipo:"Terreno", condicion:"Terreno libre", negociable:false, title:"Terreno para proyecto temporal", zona:"Granada, Miguel Hidalgo", price:60000, terreno:700, construido:0, rec:0, ban:0, autos:0, frente:"20 m", fotosCount:4, nuevo:3, x:24, y:34, fotos:[],
    desc:"Predio nivelado con barda perimetral y acometida eléctrica, disponible en renta por periodos de 12 a 36 meses.",
    potencial:"700 m² aptos para instalaciones temporales, pabellones o estacionamiento operado, sujeto a permisos." },
  { slug:"valle-bravo-descanso", op:"venta", tipo:"Casa de descanso", condicion:"Lista para habitar", negociable:true, title:"Casa frente al lago", zona:"Avándaro, Valle de Bravo", price:14900000, terreno:1100, construido:380, rec:4, ban:4, autos:3, frente:"25 m", fotosCount:16, nuevo:2, x:0, y:0, fotos:[],
    desc:"Casa de un nivel con terraza corrida hacia el lago, estructura de madera y piedra de la región. Jardín maduro con acceso directo al muelle compartido.",
    potencial:"1,100 m² en una zona con restricción de densidad: la construcción actual ocupa un tercio del predio y deja margen para una casa de huéspedes, sujeto a reglamento del fraccionamiento." },
  { slug:"tepoztlan-descanso", op:"venta", tipo:"Casa de descanso", condicion:"Para remodelar", negociable:false, title:"Casa de campo para remodelar", zona:"Santo Domingo, Tepoztlán", price:8600000, terreno:800, construido:240, rec:3, ban:3, autos:2, frente:"20 m", fotosCount:11, nuevo:5, x:0, y:0, fotos:[],
    desc:"Construcción de los años setenta con muros de adobe y techos de viga. Conserva el huerto original y una alberca que requiere rehabilitación.",
    potencial:"800 m² con vista al Tepozteco y construcción de un nivel. La estructura permite abrir la planta hacia el jardín sin tocar los muros de carga, sujeto a normativa del pueblo mágico." },
  { slug:"malinalco-renta", op:"renta", tipo:"Casa de descanso", condicion:"Lista para habitar", negociable:true, title:"Casa con huerto en renta", zona:"Malinalco Centro, Malinalco", price:38000, terreno:600, construido:210, rec:3, ban:2, autos:2, frente:"16 m", fotosCount:9, nuevo:1, x:0, y:0, fotos:[],
    desc:"Casa de dos cuerpos unidos por un patio, con huerto en producción y alberca templada. Se renta amueblada por periodos de seis meses en adelante.",
    potencial:"El segundo cuerpo funciona de forma independiente: puede usarse como estudio o alojamiento sin intervenir la casa principal." }
];

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
