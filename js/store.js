/* Legato Capital — capa de datos.
 *
 * TODA la lectura y escritura del producto pasa por aquí. Hoy persiste en
 * localStorage (prototipo: los datos viven en el navegador de cada persona);
 * al conectar un backend solo cambia este archivo, no las vistas.
 *
 * Qué guarda:
 *   usuarios    — quien se registró (nombre, correo, teléfono)
 *   sesion      — la cuenta activa en este navegador
 *   leads       — ficha comercial de cada interesado, con su etapa en el Kanban
 *   mensajes    — bandeja del equipo: peticiones de contacto y de visita
 *   actividad   — cada guardado, compartida, contacto y visita, con fecha
 *   propiedades — altas y ediciones del administrador sobre el catálogo base
 */
(function () {
  "use strict";

  /* v2 añade la bandeja de mensajes. Subir la versión repone la base sembrada:
     en un prototipo con datos de ejemplo vale más que todo el mundo vea las
     conversaciones de muestra a conservar una base a medias. */
  var KEY = "legato:db:v2";
  var ADMIN_SALT = "legato.capital.2026";
  // SHA-256 de la contraseña del administrador. NO es una medida de seguridad:
  // en un sitio estático el navegador puede saltarse cualquier validación.
  // Sirve para que la contraseña no viaje en claro en el repositorio.
  var ADMIN_HASH = "fb39b9bcbdbb74d09f46eab5751b6cabff6e266e1d93ad0c880b638d5e658c5a";
  var ADMIN_IDS = ["info@lazza.com.mx", "5522504642"];
  var ADMIN_NOMBRE = "Jaime Lavín";
  // Cuenta común de prueba, para ver el lado del usuario sin registrarse.
  var DEMO = {
    nombre: "Elías Rico", correo: "demo@legato.mx", telefono: "5531650560",
    guardados: ["condesa-remodelar", "del-valle-terreno", "coyoacan-jardin"],
    compartida: "del-valle-terreno"
  };

  // Nombres de versiones anteriores de las cuentas sembradas; se corrigen al cargar.
  var NOMBRES_VIEJOS = ["Equipo Legato", "Daniela Ortega"];

  var ETAPAS = [
    { id: "nuevo", label: "Nuevo" },
    { id: "contactado", label: "Contactado" },
    { id: "visita", label: "Visita agendada" },
    { id: "negociacion", label: "Negociación" },
    { id: "cerrado", label: "Cerrado" },
    { id: "descartado", label: "Descartado" }
  ];

  function hoy() { return new Date().toISOString(); }
  /* "Hoy" en el reloj de quien usa el sitio, no en UTC: en México (UTC-6) el
     día cambia seis horas antes en UTC y el calendario adelantaba un día
     desde las 18:00. */
  function hoyLocal() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Horarios en los que se puede pedir una visita. Bloques de dos horas: nadie
     puede comprometer una hora exacta sin confirmar con el propietario. */
  var HORARIOS = [
    { id: "09-11", label: "9:00 a 11:00" },
    { id: "11-13", label: "11:00 a 13:00" },
    { id: "13-15", label: "13:00 a 15:00" },
    { id: "15-17", label: "15:00 a 17:00" },
    { id: "17-19", label: "17:00 a 19:00" }
  ];
  var CANALES = [
    { id: "telefono", label: "Llamada" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "videollamada", label: "Videollamada" },
    { id: "correo", label: "Correo" }
  ];

  /* Lada por país. El mercado es la Ciudad de México, así que México va primero
     y es el predeterminado, pero hay compradores fuera. Se guarda el país y no
     solo la lada porque el +1 lo comparten Estados Unidos y Canadá.
     Agregar un país es agregar un renglón aquí: nada más depende de la lista. */
  var PAISES = [
    { id: "MX", lada: "52", nombre: "México",          min: 10, max: 10, fmt: [2, 4, 4] },
    { id: "US", lada: "1",  nombre: "Estados Unidos",  min: 10, max: 10, fmt: [3, 3, 4] },
    { id: "CA", lada: "1",  nombre: "Canadá",          min: 10, max: 10, fmt: [3, 3, 4] },
    { id: "ES", lada: "34", nombre: "España",          min: 9,  max: 9,  fmt: [3, 3, 3] },
    { id: "CO", lada: "57", nombre: "Colombia",        min: 10, max: 10, fmt: [3, 3, 4] },
    { id: "AR", lada: "54", nombre: "Argentina",       min: 10, max: 11, fmt: [2, 4, 4] },
    { id: "CL", lada: "56", nombre: "Chile",           min: 9,  max: 9,  fmt: [1, 4, 4] },
    { id: "PE", lada: "51", nombre: "Perú",            min: 9,  max: 9,  fmt: [3, 3, 3] },
    { id: "BR", lada: "55", nombre: "Brasil",          min: 10, max: 11, fmt: [2, 5, 4] },
    { id: "GB", lada: "44", nombre: "Reino Unido",     min: 10, max: 10, fmt: [4, 3, 3] },
    { id: "FR", lada: "33", nombre: "Francia",         min: 9,  max: 9,  fmt: [1, 2, 2, 2, 2] },
    { id: "DE", lada: "49", nombre: "Alemania",        min: 10, max: 11, fmt: [3, 3, 4] }
  ];
  var PAIS_DEF = "MX";

  function vacio() {
    return { usuarios: [], sesion: null, admin: false, leads: [], mensajes: [], actividad: [], propiedades: [], seed: false };
  }

  var db = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return sembrar(vacio());
      var d = JSON.parse(raw);
      return migrar(Object.assign(vacio(), d));
    } catch (e) {
      console.warn("No se pudo leer lo guardado; se repone la base sembrada.", e);
      return sembrar(vacio());
    }
  }

  /* El campo `notas` era un texto único; ahora el seguimiento es una bitácora.
     Lo que ya estuviera escrito se conserva como la primera entrada. */
  function migrar(d) {
    asegurarAdmin(d);
    asegurarDemo(d);
    /* El teléfono no llevaba país. Todo lo que ya existía es de México. */
    (d.usuarios || []).forEach(function (u) { if (!u.pais) u.pais = PAIS_DEF; });
    (d.leads || []).forEach(function (l) { if (!l.pais) l.pais = PAIS_DEF; });
    (d.leads || []).forEach(function (l) {
      if (!Array.isArray(l.seguimiento)) {
        l.seguimiento = [];
        if (typeof l.notas === "string" && l.notas.trim()) {
          l.seguimiento.push({ id: uid("nota"), texto: l.notas.trim(), fecha: l.alta || hoy() });
        }
      }
      delete l.notas;
    });
    return d;
  }

  /* La cuenta del equipo vive en la misma lista de usuarios, marcada con
     `admin: true`. El login la reconoce por esa bandera, no por un caso especial. */
  function asegurarAdmin(d) {
    var ya = (d.usuarios || []).filter(function (u) { return u.admin; })[0];
    if (ya) {
      if (NOMBRES_VIEJOS.indexOf(ya.nombre) >= 0) ya.nombre = ADMIN_NOMBRE;
      return d;
    }
    (d.usuarios = d.usuarios || []).push({
      id: uid("usr"), nombre: ADMIN_NOMBRE, correo: ADMIN_IDS[0], telefono: ADMIN_IDS[1],
      pais: PAIS_DEF, admin: true, alta: hoy()
    });
    return d;
  }

  /* Usuario común de prueba: entra solo con su correo (sin bandera, sin
     contraseña) y ya trae propiedades guardadas para que la pantalla se vea. */
  function asegurarDemo(d) {
    var prev = (d.usuarios || []).filter(function (u) { return u.demo; })[0];
    if (prev) {
      if (NOMBRES_VIEJOS.indexOf(prev.nombre) >= 0) {
        prev.nombre = DEMO.nombre;
        prev.telefono = DEMO.telefono;
        (d.leads || []).forEach(function (l) {
          if (l.usuarioId !== prev.id) return;
          l.nombre = DEMO.nombre;
          l.telefono = DEMO.telefono;
        });
        (d.actividad || []).forEach(function (a) {
          if (a.usuarioId === prev.id) a.nombre = DEMO.nombre;
        });
      }
      return d;
    }
    var u = { id: uid("usr"), nombre: DEMO.nombre, correo: DEMO.correo, telefono: DEMO.telefono,
              pais: PAIS_DEF, whatsapp: DEMO.telefono, paisWa: PAIS_DEF, demo: true, alta: hoy() };
    (d.usuarios = d.usuarios || []).push(u);
    var idLead = uid("lead");
    (d.leads = d.leads || []).push({
      id: idLead, usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
      pais: u.pais, whatsapp: u.whatsapp, paisWa: u.paisWa,
      correosExtra: "", presupuesto: 0, empresa: "", seguimiento: [], etapa: "nuevo",
      origen: DEMO.guardados[0], alta: hoy(), actualizado: hoy(), demo: true
    });
    /* La cuenta de prueba ya trae una conversación abierta: así se ve de los
       dos lados —bandeja del equipo y perfil del cliente— desde el minuto uno. */
    d.mensajes = d.mensajes || [];
    d.mensajes.unshift({
      id: uid("msg"), leadId: idLead, usuarioId: u.id, de: "cliente", tipo: "contacto",
      slug: DEMO.compartida, texto: "Me interesa el terreno de Del Valle. ¿Cuánto mide el frente y qué se puede construir ahí?",
      canal: "whatsapp", dia: "", hora: "", fecha: new Date(Date.now() - 2 * 86400000).toISOString(), leido: true, demo: true
    });
    d.mensajes.unshift({
      id: uid("msg"), leadId: idLead, usuarioId: u.id, de: "equipo", tipo: "respuesta",
      slug: "", texto: "Con gusto. El terreno de Del Valle tiene 14 m de frente y uso de suelo H3. ¿Te late que lo veamos esta semana?",
      canal: "", dia: "", hora: "", fecha: new Date(Date.now() - 86400000).toISOString(), leido: true, demo: true
    });
    d.favoritos = d.favoritos || {};
    d.favoritos[u.id] = {};
    DEMO.guardados.forEach(function (slug, i) {
      var f = new Date(Date.now() - (DEMO.guardados.length - i) * 86400000).toISOString();
      d.favoritos[u.id][slug] = f;
      (d.actividad = d.actividad || []).unshift({
        id: uid("act"), tipo: "guardado", usuarioId: u.id, nombre: u.nombre, slug: slug, fecha: f, demo: true
      });
    });
    d.actividad.unshift({
      id: uid("act"), tipo: "compartido", usuarioId: u.id, nombre: u.nombre,
      slug: DEMO.compartida, fecha: hoy(), demo: true
    });
    return d;
  }

  /* Si el navegador bloquea el almacenamiento (modo privado, cuota llena), hay que
     decirlo: en silencio la persona cree que guardó y pierde su trabajo. */
  var avisar = null, yaAviso = false;
  function alAvisar(fn) { avisar = fn; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) {
      console.warn("No se pudo guardar", e);
      if (!yaAviso && avisar) {
        yaAviso = true;
        avisar("Este navegador no permite guardar: lo que hagas se perderá al cerrar.");
      }
      return false;
    }
  }

  /* Semilla: sin ella el Kanban nace vacío y no se puede evaluar el flujo.
     Son interesados de ejemplo, marcados como tales. */
  function sembrar(d) {
    var base = [
      { nombre: "María Fernanda Ruiz", correo: "mf.ruiz@gmail.com", telefono: "5544120987",
        etapa: "contactado", presupuesto: 15000000, empresa: "Arquitecta independiente",
        propiedad: "del-valle-terreno",
        notas: [
          "Llamada inicial. Busca terreno en Del Valle o Condesa para proyecto propio.",
          "Pidió el plano del predio por correo. Puede esperar hasta el primer trimestre."
        ] },
      { nombre: "Jorge Alcántara", correo: "jalcantara@grupovertiz.mx", telefono: "5531887744",
        etapa: "visita", presupuesto: 28000000, empresa: "Grupo Vértiz · Desarrollo",
        propiedad: "santa-fe-esquina",
        notas: [
          "Interesado en Santa Fe por la doble orientación.",
          "Pidió uso de suelo por escrito. Se lo mandamos el martes.",
          "Visita confirmada para el viernes a las 11:00 con su socio."
        ],
        chat: [
          { de: "cliente", tipo: "visita", canal: "telefono", dias: 5, enDias: 3, hora: "11-13", confirmada: true,
            texto: "Voy con mi socio. Si se puede, nos gustaría ver también el acceso de servicio." },
          { de: "equipo", tipo: "respuesta", dias: 4,
            texto: "Confirmada la visita. Nos vemos en la entrada principal; llevamos el plano del predio impreso." }
        ] },
      { nombre: "Claudia Benítez", correo: "claudia.benitez@outlook.com", telefono: "5518230055",
        etapa: "nuevo", presupuesto: 0, empresa: "", propiedad: "condesa-remodelar", notas: [],
        chat: [
          { de: "cliente", tipo: "contacto", canal: "whatsapp", dias: 2,
            texto: "Vi la casa de la Condesa. ¿Se puede ampliar hacia el patio? Me interesa saber qué permite el uso de suelo antes de agendar nada." },
          { de: "cliente", tipo: "visita", canal: "whatsapp", dias: 1, enDias: 2, hora: "09-11",
            texto: "Mejor la veo en persona. ¿Puede ser esta semana?" }
        ] },
      { nombre: "Ricardo Lemus", correo: "rlemus@estudiolemus.com", telefono: "4155538217", pais: "US",
        etapa: "negociacion", presupuesto: 9500000, empresa: "Estudio Lemus · Arquitectura",
        propiedad: "escandon-mixto",
        notas: [
          "Oferta verbal por el terreno de Escandón.",
          "Falta avalúo; lo entrega su banco la próxima semana."
        ] }
    ];
    base.forEach(function (b, i) {
      var u = { id: uid("usr"), nombre: b.nombre, correo: b.correo, telefono: b.telefono,
                pais: b.pais || PAIS_DEF, alta: hoy(), ejemplo: true };
      d.usuarios.push(u);
      var idLead = uid("lead");
      d.leads.push({
        id: idLead, usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
        pais: u.pais, correosExtra: "", presupuesto: b.presupuesto, empresa: b.empresa,
        seguimiento: b.notas.map(function (t, k) {
          var f = new Date(Date.now() - (b.notas.length - k) * 86400000 * 2).toISOString();
          return { id: uid("nota"), texto: t, fecha: f };
        }).reverse(),
        etapa: b.etapa, origen: b.propiedad, alta: hoy(), actualizado: hoy(), ejemplo: true
      });
      /* Conversaciones de ejemplo: sin ellas la bandeja nace vacía y no se
         puede evaluar el flujo de mensajes. */
      (b.chat || []).forEach(function (c) {
        d.mensajes.unshift({
          id: uid("msg"), leadId: idLead, usuarioId: u.id, de: c.de,
          tipo: c.tipo, slug: c.de === "cliente" ? b.propiedad : "",
          texto: c.texto, canal: c.canal || "",
          dia: c.enDias ? new Date(Date.now() + c.enDias * 86400000).toISOString().slice(0, 10) : "",
          hora: c.hora || "",
          fecha: new Date(Date.now() - c.dias * 86400000).toISOString(),
          confirmada: !!c.confirmada,
          leido: c.de === "equipo" || b.etapa !== "nuevo", ejemplo: true
        });
      });
      d.actividad.push({
        id: uid("act"), tipo: i % 3 === 0 ? "compartido" : "guardado",
        usuarioId: u.id, nombre: u.nombre, slug: b.propiedad, fecha: hoy(), ejemplo: true
      });
    });
    asegurarAdmin(d);
    asegurarDemo(d);
    d.seed = true;
    return d;
  }

  async function sha256(txt) {
    var buf = new TextEncoder().encode(txt);
    var hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  /* ------------------------------ usuarios ------------------------------ */

  function normCorreo(c) { return String(c || "").trim().toLowerCase(); }
  function normTel(t) { return String(t || "").replace(/\D/g, ""); }

  /* ------------------------------ teléfono ------------------------------ */

  function paisDe(id) {
    return PAISES.filter(function (p) { return p.id === id; })[0] ||
           PAISES.filter(function (p) { return p.id === PAIS_DEF; })[0];
  }
  /* Acepta un usuario, un lead o un id de país: en todos los casos devuelve
     el país con el que hay que leer ese teléfono. */
  function paisDeQuien(x) {
    return paisDe(x && typeof x === "object" ? x.pais : x);
  }

  /* Quien pega "+52 55 1234 5678" está escribiendo su número, no uno de doce
     dígitos. Si el número trae su propia lada delante, se le quita. */
  function limpiarTel(valor, p) {
    var t = normTel(valor);
    if (p.lada && t.length > p.max && t.indexOf(p.lada) === 0) {
      var sin = t.slice(p.lada.length);
      if (sin.length >= p.min && sin.length <= p.max) return sin;
    }
    return t;
  }

  function telNacional(x) { return normTel(x && x.telefono); }
  function telE164(x) { return "+" + paisDeQuien(x).lada + telNacional(x); }

  /* WhatsApp puede ser otro número: mucha gente da el fijo de casa y chatea
     desde el celular. Si no lo dieron aparte, se usa el teléfono. */
  function waNacional(x) { return normTel(x && x.whatsapp) || telNacional(x); }
  function paisWaDe(x) {
    return paisDe(x && x.whatsapp ? x.paisWa : (x && x.pais));
  }
  function telWa(x) { return paisWaDe(x).lada + waNacional(x); }
  function waPropio(x) { return !!(x && x.whatsapp); }
  function waMostrar(x) {
    return telMostrar({ telefono: waNacional(x), pais: paisWaDe(x).id });
  }

  /* "+52 55 3165 0560": agrupado para que se lea, no para que se copie. Cada
     país agrupa distinto —el mismo número en Estados Unidos es 415 553 8217—,
     y si la cantidad de dígitos no cuadra con su patrón, se parte de tres en
     tres antes que mentir con un formato que no es. */
  function agrupar(t, p) {
    var suma = (p.fmt || []).reduce(function (a, b) { return a + b; }, 0);
    if (!p.fmt || suma !== t.length) return t.replace(/(\d{3})(?=\d)/g, "$1 ");
    var out = [], i = 0;
    p.fmt.forEach(function (n) { out.push(t.slice(i, i + n)); i += n; });
    return out.join(" ");
  }
  function telMostrar(x) {
    var t = telNacional(x);
    if (!t) return "";
    var p = paisDeQuien(x);
    return "+" + p.lada + " " + agrupar(t, p);
  }

  function errorTel(p, tel) {
    if (tel.length >= p.min && tel.length <= p.max) return "";
    return p.min === p.max
      ? "El teléfono de " + p.nombre + " debe tener " + p.min + " dígitos."
      : "El teléfono de " + p.nombre + " debe tener entre " + p.min + " y " + p.max + " dígitos.";
  }

  function validarRegistro(datos) {
    var err = {};
    if (!String(datos.nombre || "").trim() || String(datos.nombre).trim().split(/\s+/).length < 2)
      err.nombre = "Escribe tu nombre y apellido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normCorreo(datos.correo)))
      err.correo = "Revisa el correo: no tiene un formato válido.";
    var p = paisDe(datos.pais);
    var e = errorTel(p, limpiarTel(datos.telefono, p));
    if (e) err.telefono = e;
    return err;
  }

  function registrar(datos) {
    var err = validarRegistro(datos);
    if (Object.keys(err).length) return { ok: false, errores: err };

    var correo = normCorreo(datos.correo);
    var dueño = usuarioPorId(correo);
    if (dueño && dueño.admin) {
      return { ok: false, errores: { correo: "Ese correo es del equipo. Usa Iniciar sesión." } };
    }
    var p = paisDe(datos.pais);
    var tel = limpiarTel(datos.telefono, p);
    var existente = db.usuarios.filter(function (u) { return u.correo === correo; })[0];

    if (existente) {
      existente.nombre = String(datos.nombre).trim();
      existente.telefono = tel;
      existente.pais = p.id;
    } else {
      existente = { id: uid("usr"), nombre: String(datos.nombre).trim(), correo: correo,
                    telefono: tel, pais: p.id, alta: hoy() };
      db.usuarios.push(existente);
    }

    var lead = db.leads.filter(function (l) { return l.usuarioId === existente.id; })[0];
    if (!lead) {
      db.leads.push({
        id: uid("lead"), usuarioId: existente.id, nombre: existente.nombre,
        correo: existente.correo, telefono: existente.telefono, pais: existente.pais, correosExtra: "",
        presupuesto: 0, empresa: "", seguimiento: [], etapa: "nuevo",
        origen: datos.origen || "", alta: hoy(), actualizado: hoy()
      });
    } else {
      lead.nombre = existente.nombre;
      lead.telefono = existente.telefono;
      lead.pais = existente.pais;
    }

    db.sesion = existente.id;
    save();
    return { ok: true, usuario: existente };
  }

  function usuarioPorId(identificador) {
    var correo = normCorreo(identificador);
    var tel = normTel(identificador);
    return db.usuarios.filter(function (u) {
      if (u.correo === correo) return true;
      if (tel.length < 7 || !u.telefono) return false;
      return u.telefono === tel || (paisDeQuien(u).lada + u.telefono) === tel;
    })[0] || null;
  }

  /* El login pregunta primero por el correo: si la cuenta trae bandera de
     administrador pide contraseña; si no, entra directo. */
  function buscarCuenta(identificador) {
    var u = usuarioPorId(identificador);
    if (!u) return { existe: false };
    return { existe: true, admin: !!u.admin, nombre: u.nombre };
  }

  async function iniciarSesion(identificador, password) {
    var u = usuarioPorId(identificador);
    if (!u) return { ok: false, motivo: "no-existe" };
    if (u.admin) {
      var passOk = (await sha256(ADMIN_SALT + String(password || ""))) === ADMIN_HASH;
      if (!passOk) return { ok: false, motivo: "password" };
      db.sesion = u.id; db.admin = true; save();
      return { ok: true, admin: true, usuario: u };
    }
    db.sesion = u.id; db.admin = false; save();
    return { ok: true, admin: false, usuario: u };
  }

  function sesion() {
    if (!db.sesion) return null;
    return db.usuarios.filter(function (u) { return u.id === db.sesion; })[0] || null;
  }
  function salir() { db.sesion = null; db.admin = false; save(); }

  /* ------------------------------ actividad ----------------------------- */

  function registrarActividad(tipo, slug) {
    var u = sesion();
    if (!u) return;
    db.actividad.unshift({ id: uid("act"), tipo: tipo, usuarioId: u.id, nombre: u.nombre, slug: slug, fecha: hoy() });
    var lead = db.leads.filter(function (l) { return l.usuarioId === u.id; })[0];
    if (lead) lead.actualizado = hoy();
    save();
  }

  function actividadDe(usuarioId) {
    return db.actividad.filter(function (a) { return a.usuarioId === usuarioId; });
  }
  function actividadDeSlug(slug) {
    return db.actividad.filter(function (a) { return a.slug === slug; });
  }

  /* --------------------------- favoritos ------------------------------- */
  /* Los guardados cuelgan del usuario: al cerrar sesión dejan de verse. */

  function favoritos() {
    var u = sesion();
    if (!u) return {};
    return (db.favoritos || {})[u.id] || {};
  }
  function alternarFavorito(slug) {
    var u = sesion();
    if (!u) return { ok: false, motivo: "sin-sesion" };
    db.favoritos = db.favoritos || {};
    var f = db.favoritos[u.id] || {};
    var activo = !f[slug];
    if (activo) { f[slug] = hoy(); registrarActividad("guardado", slug); }
    else { delete f[slug]; }
    db.favoritos[u.id] = f;
    save();
    return { ok: true, activo: activo };
  }

  /* ------------------------------- leads -------------------------------- */

  function leads() { return db.leads.slice(); }
  function lead(id) { return db.leads.filter(function (l) { return l.id === id; })[0] || null; }

  function actualizarLead(id, campos) {
    var l = lead(id);
    if (!l) return null;
    Object.keys(campos).forEach(function (k) { l[k] = campos[k]; });
    l.actualizado = hoy();
    // el usuario y su lead comparten contacto
    var u = db.usuarios.filter(function (x) { return x.id === l.usuarioId; })[0];
    if (u) {
      if (campos.nombre) u.nombre = campos.nombre;
      if (campos.correo) u.correo = normCorreo(campos.correo);
      if (campos.pais) u.pais = paisDe(campos.pais).id;
      if (campos.telefono) u.telefono = limpiarTel(campos.telefono, paisDe(campos.pais || l.pais));
      if (campos.paisWa) u.paisWa = paisDe(campos.paisWa).id;
      if ("whatsapp" in campos) u.whatsapp = limpiarTel(campos.whatsapp, paisDe(campos.paisWa || l.paisWa || l.pais));
    }
    save();
    return l;
  }
  function moverLead(id, etapa) { return actualizarLead(id, { etapa: etapa }); }

  /* Bitácora de seguimiento: varias entradas por interesado, la más reciente arriba. */
  function agregarNota(leadId, texto) {
    var l = lead(leadId);
    if (!l || !String(texto || "").trim()) return null;
    l.seguimiento = l.seguimiento || [];
    var nota = { id: uid("nota"), texto: String(texto).trim(), fecha: hoy() };
    l.seguimiento.unshift(nota);
    l.actualizado = hoy();
    save();
    return nota;
  }
  function borrarNota(leadId, notaId) {
    var l = lead(leadId);
    if (!l) return;
    l.seguimiento = (l.seguimiento || []).filter(function (n) { return n.id !== notaId; });
    l.actualizado = hoy();
    save();
  }
  /* Devuelve lo borrado para poder deshacerlo: un borrado accidental no debe
     ser definitivo (heurística de control y libertad). */
  function borrarLead(id) {
    var l = lead(id);
    db.leads = db.leads.filter(function (x) { return x.id !== id; });
    save();
    return l;
  }
  function restaurarLead(l) {
    if (!l) return;
    db.leads.push(l);
    save();
  }
  function existeSlug(slug) {
    return catalogoCompleto().some(function (p) { return p.slug === slug; });
  }

  /* ------------------------------ mensajes ------------------------------ */
  /* Bandeja del equipo y conversación del cliente son la MISMA lista: cada
     mensaje cuelga de una ficha del Kanban. Por eso escribir desde el sitio
     da de alta al interesado si todavía no existía: el tablero nunca se
     entera tarde de que alguien escribió. */

  function leadDe(usuarioId) {
    return db.leads.filter(function (l) { return l.usuarioId === usuarioId; })[0] || null;
  }

  function asegurarLead(u, origen) {
    var l = leadDe(u.id);
    if (l) {
      if (!l.origen && origen) l.origen = origen;
      return l;
    }
    l = {
      id: uid("lead"), usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
      pais: u.pais, correosExtra: "", presupuesto: 0, empresa: "", seguimiento: [], etapa: "nuevo",
      origen: origen || "", alta: hoy(), actualizado: hoy()
    };
    db.leads.push(l);
    return l;
  }

  /* Una visita sin día no es una visita; un mensaje vacío no es un mensaje. */
  function validarMensaje(d) {
    var err = {};
    var esVisita = d.tipo === "visita";
    if (esVisita) {
      if (!d.dia) err.dia = "Elige el día que te viene bien.";
      else if (d.dia < hoyLocal()) err.dia = "Esa fecha ya pasó. Elige una a partir de hoy.";
      if (!d.hora) err.hora = "Elige un horario.";
    } else if (String(d.texto || "").trim().length < 4) {
      err.texto = "Cuéntanos qué necesitas saber.";
    }
    return err;
  }

  /* Lo manda el cliente desde una ficha (o desde "Hablar con un asesor"). */
  function enviarMensaje(d) {
    var u = sesion();
    if (!u) return { ok: false, motivo: "sin-sesion" };
    var err = validarMensaje(d);
    if (Object.keys(err).length) return { ok: false, errores: err };

    var l = asegurarLead(u, d.slug);
    var m = {
      id: uid("msg"), leadId: l.id, usuarioId: u.id, de: "cliente",
      tipo: d.tipo === "visita" ? "visita" : "contacto",
      slug: d.slug || "", texto: String(d.texto || "").trim(),
      canal: d.canal || "telefono", dia: d.dia || "", hora: d.hora || "",
      fecha: hoy(), leido: false
    };
    db.mensajes.unshift(m);
    l.actualizado = hoy();
    registrarActividad(m.tipo, m.slug);   // también guarda
    save();
    return { ok: true, mensaje: m, lead: l };
  }

  /* Lo manda el equipo desde la bandeja o desde la ficha del interesado. */
  function responderMensaje(leadId, texto) {
    var l = lead(leadId);
    if (!l || !String(texto || "").trim()) return null;
    var m = {
      id: uid("msg"), leadId: l.id, usuarioId: l.usuarioId, de: "equipo",
      tipo: "respuesta", slug: "", texto: String(texto).trim(),
      canal: "", dia: "", hora: "", fecha: hoy(), leido: true
    };
    db.mensajes.unshift(m);
    l.actualizado = hoy();
    save();
    return m;
  }

  /* Confirmar una visita es lo único que mueve una ficha de etapa sola: el
     equipo acaba de comprometer un día, y el tablero tiene que reflejarlo. */
  function confirmarVisita(mensajeId) {
    var m = db.mensajes.filter(function (x) { return x.id === mensajeId; })[0];
    if (!m || m.tipo !== "visita" || m.confirmada) return null;
    m.confirmada = true;
    m.leido = true;
    var l = lead(m.leadId);
    if (l) {
      l.etapa = "visita";
      l.actualizado = hoy();
    }
    save();
    return m;
  }
  function visitaPendiente(leadId) {
    return db.mensajes.filter(function (m) {
      return m.leadId === leadId && m.tipo === "visita" && !m.confirmada;
    }).sort(porFecha).pop() || null;
  }

  /* --------------------------- WhatsApp --------------------------- */
  /* Abrir conversación con un asesor exige un WhatsApp: es por donde se
     responde. Se guarda una vez y no se vuelve a preguntar. */

  function tieneWhatsApp() {
    var u = sesion();
    return !!(u && u.whatsapp);
  }

  function guardarWhatsApp(valor, paisId) {
    var u = sesion();
    if (!u) return { ok: false, error: "Primero hay que crear la cuenta." };
    var p = paisDe(paisId);
    var n = limpiarTel(valor, p);
    var e = errorTel(p, n);
    if (e) return { ok: false, error: e };
    u.whatsapp = n;
    u.paisWa = p.id;
    var l = leadDe(u.id);
    if (l) { l.whatsapp = n; l.paisWa = p.id; l.actualizado = hoy(); }
    save();
    return { ok: true, muestra: waMostrar(u) };
  }

  /* Cuando el WhatsApp es el mismo teléfono que ya dio. */
  function mismoWhatsApp() {
    var u = sesion();
    if (!u) return { ok: false };
    return guardarWhatsApp(u.telefono, u.pais);
  }

  /* ------------------- aviso directo al equipo ------------------- */
  /* Un sitio estático no puede mandar un WhatsApp por su cuenta: eso exige un
     token y un servidor. Lo que sí puede es abrirle al cliente su propio
     WhatsApp con el resumen escrito, para que el equipo se entere al momento
     en lugar de esperar a que alguien abra la bandeja.
     El número sale de la cuenta del equipo; si el WhatsApp de Lazza llega a
     ser otro, se cambia WA_EQUIPO y ya. */
  var WA_EQUIPO = "";     // vacío = usa el de la cuenta del equipo

  function whatsappEquipo() {
    if (WA_EQUIPO) return normTel(WA_EQUIPO);
    var a = db.usuarios.filter(function (u) { return u.admin; })[0];
    return a ? telWa(a) : "";
  }

  function diaLargo(iso) {
    var p = String(iso).split("-");
    try {
      return new Date(p[0], Number(p[1]) - 1, p[2])
        .toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    } catch (e) { return iso; }
  }

  /* El resumen tiene que bastarse solo: el equipo lo lee en su teléfono, sin
     la plataforma enfrente. */
  function resumenWa(m) {
    var u = sesion();
    var quien = u ? u.nombre : (m && m.nombre) || "";
    var p = catalogoCompleto().filter(function (x) { return x.slug === m.slug; })[0];
    var donde = p ? p.title + " (" + p.zona + ")" : "";
    var texto = String(m.texto || "").trim().slice(0, 400);

    if (m.tipo === "visita") {
      var h = HORARIOS.filter(function (x) { return x.id === m.hora; })[0];
      return "Hola, soy " + quien + ". Acabo de pedir una visita por la plataforma" +
        (donde ? " a " + donde : "") + " el " + diaLargo(m.dia) +
        (h ? ", de " + h.label : "") + "." + (texto ? " " + texto : "");
    }
    return "Hola, soy " + quien + ". Acabo de escribirles por la plataforma" +
      (donde ? " sobre " + donde : "") + "." + (texto ? " " + texto : "");
  }

  function enlaceWaEquipo(m) {
    var n = whatsappEquipo();
    if (!n) return "";
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(resumenWa(m));
  }

  function mensajes() { return db.mensajes.slice(); }
  /* La conversación se lee del más viejo al más nuevo, como cualquier chat.
     Ordena por fecha y no por posición: el orden del arreglo no es un contrato. */
  function porFecha(a, b) { return new Date(a.fecha) - new Date(b.fecha); }
  function conversacion(leadId) {
    return db.mensajes.filter(function (m) { return m.leadId === leadId; }).sort(porFecha);
  }
  function conversacionDe(usuarioId) {
    return db.mensajes.filter(function (m) { return m.usuarioId === usuarioId; }).sort(porFecha);
  }
  function sinLeerDe(leadId) {
    return db.mensajes.filter(function (m) {
      return m.leadId === leadId && m.de === "cliente" && !m.leido;
    }).length;
  }
  function sinLeer() {
    return db.mensajes.filter(function (m) { return m.de === "cliente" && !m.leido; }).length;
  }
  function marcarLeido(leadId) {
    db.mensajes.forEach(function (m) { if (m.leadId === leadId) m.leido = true; });
    save();
  }
  function ultimoMensaje(leadId) {
    var c = conversacion(leadId);
    return c.length ? c[c.length - 1] : null;
  }

  /* La bandeja es una fila por cliente, no una lista de mensajes sueltos:
     una conversación con tres peticiones sigue siendo una conversación. */
  function bandeja() {
    var porLead = {};
    db.mensajes.forEach(function (m) {
      if (!porLead[m.leadId]) porLead[m.leadId] = { leadId: m.leadId, total: 0, sinLeer: 0, ultimo: m };
      var h = porLead[m.leadId];
      h.total++;
      if (m.de === "cliente" && !m.leido) h.sinLeer++;
      if (new Date(m.fecha) > new Date(h.ultimo.fecha)) h.ultimo = m;
    });
    return Object.keys(porLead).map(function (k) {
      var h = porLead[k];
      h.lead = lead(k);
      return h;
    }).filter(function (h) { return !!h.lead; })
      .sort(function (a, b) { return new Date(b.ultimo.fecha) - new Date(a.ultimo.fecha); });
  }

  /* ---------------------------- propiedades ----------------------------- */
  /* El catálogo que ve el sitio = base (js/data.js) + altas y ediciones del
     administrador, que mandan sobre la base cuando comparten slug. */

  /* `catalogoCompleto` es todo lo que existe (lo usa el panel y la ficha);
     `catalogo` es lo que ve la búsqueda pública; `oportunidades` son las de
     acceso anticipado, que solo se abren con cuenta. */
  function catalogoCompleto() {
    var base = (window.EL_DATA || []).slice();
    var propias = db.propiedades || [];
    var fuera = {};
    propias.forEach(function (p) { if (p.eliminada) fuera[p.slug] = true; });
    var mapa = {};
    base.concat(propias).forEach(function (p) {
      if (fuera[p.slug] || p.eliminada) { delete mapa[p.slug]; return; }
      mapa[p.slug] = p;
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  function catalogo() {
    return catalogoCompleto().filter(function (p) { return !p.exclusiva; });
  }
  function oportunidades() {
    return catalogoCompleto().filter(function (p) { return p.exclusiva; });
  }
  function esExclusiva(slug) {
    return catalogoCompleto().some(function (p) { return p.slug === slug && p.exclusiva; });
  }

  function guardarPropiedad(p) {
    db.propiedades = db.propiedades || [];
    var i = -1;
    db.propiedades.forEach(function (x, idx) { if (x.slug === p.slug) i = idx; });
    if (i >= 0) db.propiedades[i] = p; else db.propiedades.push(p);
    save();
    return p;
  }
  function eliminarPropiedad(slug) {
    db.propiedades = db.propiedades || [];
    var propia = db.propiedades.filter(function (p) { return p.slug === slug; })[0];
    if (propia && !(window.EL_DATA || []).some(function (b) { return b.slug === slug; })) {
      db.propiedades = db.propiedades.filter(function (p) { return p.slug !== slug; });
    } else {
      guardarPropiedad({ slug: slug, eliminada: true });
    }
    save();
  }

  /* ------------------------------- admin -------------------------------- */

  async function entrarAdmin(identificador, password) {
    var r = await iniciarSesion(identificador, password);
    return { ok: !!(r.ok && r.admin) };
  }
  function esAdmin() { return !!db.admin; }
  function salirAdmin() { db.admin = false; save(); }

  function reiniciar() {
    db = sembrar(vacio());
    save();
  }

  window.Store = {
    ETAPAS: ETAPAS, HORARIOS: HORARIOS, CANALES: CANALES, PAISES: PAISES, PAIS_DEF: PAIS_DEF,
    hoyLocal: hoyLocal, paisDe: paisDe, telMostrar: telMostrar, telE164: telE164, telWa: telWa,
    waMostrar: waMostrar, waPropio: waPropio, tieneWhatsApp: tieneWhatsApp,
    enlaceWaEquipo: enlaceWaEquipo, whatsappEquipo: whatsappEquipo,
    guardarWhatsApp: guardarWhatsApp, mismoWhatsApp: mismoWhatsApp,
    enviarMensaje: enviarMensaje, responderMensaje: responderMensaje, validarMensaje: validarMensaje,
    mensajes: mensajes, conversacion: conversacion, conversacionDe: conversacionDe,
    bandeja: bandeja, sinLeer: sinLeer, sinLeerDe: sinLeerDe,
    confirmarVisita: confirmarVisita, visitaPendiente: visitaPendiente,
    marcarLeido: marcarLeido, ultimoMensaje: ultimoMensaje,
    registrar: registrar, validarRegistro: validarRegistro, sesion: sesion, salir: salir,
    buscarCuenta: buscarCuenta, iniciarSesion: iniciarSesion, DEMO: DEMO, alAvisar: alAvisar,
    usuarios: function () { return db.usuarios.slice(); },
    favoritos: favoritos, alternarFavorito: alternarFavorito,
    registrarActividad: registrarActividad, actividad: function () { return db.actividad.slice(); },
    actividadDe: actividadDe, actividadDeSlug: actividadDeSlug,
    leads: leads, lead: lead, actualizarLead: actualizarLead, moverLead: moverLead,
    borrarLead: borrarLead, restaurarLead: restaurarLead, existeSlug: existeSlug,
    agregarNota: agregarNota, borrarNota: borrarNota,
    catalogo: catalogo, catalogoCompleto: catalogoCompleto,
    oportunidades: oportunidades, esExclusiva: esExclusiva, propiedadesPropias: function () { return (db.propiedades || []).slice(); },
    guardarPropiedad: guardarPropiedad, eliminarPropiedad: eliminarPropiedad,
    entrarAdmin: entrarAdmin, esAdmin: esAdmin, salirAdmin: salirAdmin,
    reiniciar: reiniciar
  };
})();
