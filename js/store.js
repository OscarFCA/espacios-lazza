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
 *   actividad   — cada guardado y cada compartida, con fecha
 *   propiedades — altas y ediciones del administrador sobre el catálogo base
 */
(function () {
  "use strict";

  var KEY = "legato:db:v1";
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
  function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function vacio() {
    return { usuarios: [], sesion: null, admin: false, leads: [], actividad: [], propiedades: [], seed: false };
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
      admin: true, alta: hoy()
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
    var u = { id: uid("usr"), nombre: DEMO.nombre, correo: DEMO.correo, telefono: DEMO.telefono, demo: true, alta: hoy() };
    (d.usuarios = d.usuarios || []).push(u);
    (d.leads = d.leads || []).push({
      id: uid("lead"), usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
      correosExtra: "", presupuesto: 0, empresa: "", seguimiento: [], etapa: "nuevo",
      origen: DEMO.guardados[0], alta: hoy(), actualizado: hoy(), demo: true
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
        ] },
      { nombre: "Claudia Benítez", correo: "claudia.benitez@outlook.com", telefono: "5518230055",
        etapa: "nuevo", presupuesto: 0, empresa: "", propiedad: "condesa-remodelar", notas: [] },
      { nombre: "Ricardo Lemus", correo: "rlemus@estudiolemus.com", telefono: "5569014488",
        etapa: "negociacion", presupuesto: 9500000, empresa: "Estudio Lemus · Arquitectura",
        propiedad: "escandon-mixto",
        notas: [
          "Oferta verbal por el terreno de Escandón.",
          "Falta avalúo; lo entrega su banco la próxima semana."
        ] }
    ];
    base.forEach(function (b, i) {
      var u = { id: uid("usr"), nombre: b.nombre, correo: b.correo, telefono: b.telefono, alta: hoy(), ejemplo: true };
      d.usuarios.push(u);
      d.leads.push({
        id: uid("lead"), usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
        correosExtra: "", presupuesto: b.presupuesto, empresa: b.empresa,
        seguimiento: b.notas.map(function (t, k) {
          var f = new Date(Date.now() - (b.notas.length - k) * 86400000 * 2).toISOString();
          return { id: uid("nota"), texto: t, fecha: f };
        }).reverse(),
        etapa: b.etapa, origen: b.propiedad, alta: hoy(), actualizado: hoy(), ejemplo: true
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

  function validarRegistro(datos) {
    var err = {};
    if (!String(datos.nombre || "").trim() || String(datos.nombre).trim().split(/\s+/).length < 2)
      err.nombre = "Escribe tu nombre y apellido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normCorreo(datos.correo)))
      err.correo = "Revisa el correo: no tiene un formato válido.";
    if (normTel(datos.telefono).length !== 10)
      err.telefono = "El teléfono debe tener 10 dígitos.";
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
    var tel = normTel(datos.telefono);
    var existente = db.usuarios.filter(function (u) { return u.correo === correo; })[0];

    if (existente) {
      existente.nombre = String(datos.nombre).trim();
      existente.telefono = tel;
    } else {
      existente = { id: uid("usr"), nombre: String(datos.nombre).trim(), correo: correo, telefono: tel, alta: hoy() };
      db.usuarios.push(existente);
    }

    var lead = db.leads.filter(function (l) { return l.usuarioId === existente.id; })[0];
    if (!lead) {
      db.leads.push({
        id: uid("lead"), usuarioId: existente.id, nombre: existente.nombre,
        correo: existente.correo, telefono: existente.telefono, correosExtra: "",
        presupuesto: 0, empresa: "", seguimiento: [], etapa: "nuevo",
        origen: datos.origen || "", alta: hoy(), actualizado: hoy()
      });
    } else {
      lead.nombre = existente.nombre;
      lead.telefono = existente.telefono;
    }

    db.sesion = existente.id;
    save();
    return { ok: true, usuario: existente };
  }

  function usuarioPorId(identificador) {
    var correo = normCorreo(identificador);
    var tel = normTel(identificador);
    return db.usuarios.filter(function (u) {
      return u.correo === correo || (tel.length >= 10 && u.telefono === tel);
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
      if (campos.telefono) u.telefono = normTel(campos.telefono);
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
    ETAPAS: ETAPAS,
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
