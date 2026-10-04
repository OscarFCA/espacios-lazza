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
      return Object.assign(vacio(), d);
    } catch (e) { return vacio(); }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn("No se pudo guardar: almacenamiento lleno o bloqueado", e); }
  }

  /* Semilla: sin ella el Kanban nace vacío y no se puede evaluar el flujo.
     Son interesados de ejemplo, marcados como tales. */
  function sembrar(d) {
    var base = [
      { nombre: "María Fernanda Ruiz", correo: "mf.ruiz@gmail.com", telefono: "5544120987",
        etapa: "contactado", presupuesto: 15000000, empresa: "Arquitecta independiente",
        notas: "Busca terreno en Del Valle o Condesa para proyecto propio. Puede esperar hasta el primer trimestre.",
        propiedad: "del-valle-terreno" },
      { nombre: "Jorge Alcántara", correo: "jalcantara@grupovertiz.mx", telefono: "5531887744",
        etapa: "visita", presupuesto: 28000000, empresa: "Grupo Vértiz · Desarrollo",
        notas: "Interesado en Santa Fe por la doble orientación. Pidió uso de suelo por escrito.",
        propiedad: "santa-fe-esquina" },
      { nombre: "Claudia Benítez", correo: "claudia.benitez@outlook.com", telefono: "5518230055",
        etapa: "nuevo", presupuesto: 0, empresa: "",
        notas: "", propiedad: "condesa-remodelar" },
      { nombre: "Ricardo Lemus", correo: "rlemus@estudiolemus.com", telefono: "5569014488",
        etapa: "negociacion", presupuesto: 9500000, empresa: "Estudio Lemus · Arquitectura",
        notas: "Oferta verbal por el terreno de Escandón. Falta avalúo.",
        propiedad: "escandon-mixto" }
    ];
    base.forEach(function (b, i) {
      var u = { id: uid("usr"), nombre: b.nombre, correo: b.correo, telefono: b.telefono, alta: hoy(), ejemplo: true };
      d.usuarios.push(u);
      d.leads.push({
        id: uid("lead"), usuarioId: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono,
        correosExtra: "", presupuesto: b.presupuesto, empresa: b.empresa, notas: b.notas,
        etapa: b.etapa, origen: b.propiedad, alta: hoy(), actualizado: hoy(), ejemplo: true
      });
      d.actividad.push({
        id: uid("act"), tipo: i % 3 === 0 ? "compartido" : "guardado",
        usuarioId: u.id, nombre: u.nombre, slug: b.propiedad, fecha: hoy(), ejemplo: true
      });
    });
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
        presupuesto: 0, empresa: "", notas: "", etapa: "nuevo",
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
  function borrarLead(id) {
    db.leads = db.leads.filter(function (l) { return l.id !== id; });
    save();
  }

  /* ---------------------------- propiedades ----------------------------- */
  /* El catálogo que ve el sitio = base (js/data.js) + altas y ediciones del
     administrador, que mandan sobre la base cuando comparten slug. */

  function catalogo() {
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
    var id = String(identificador || "").trim().toLowerCase();
    var idOk = ADMIN_IDS.indexOf(id) >= 0 || ADMIN_IDS.indexOf(normTel(id)) >= 0;
    var passOk = (await sha256(ADMIN_SALT + String(password || ""))) === ADMIN_HASH;
    if (!idOk || !passOk) return { ok: false };
    db.admin = true;
    save();
    return { ok: true };
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
    usuarios: function () { return db.usuarios.slice(); },
    favoritos: favoritos, alternarFavorito: alternarFavorito,
    registrarActividad: registrarActividad, actividad: function () { return db.actividad.slice(); },
    actividadDe: actividadDe, actividadDeSlug: actividadDeSlug,
    leads: leads, lead: lead, actualizarLead: actualizarLead, moverLead: moverLead, borrarLead: borrarLead,
    catalogo: catalogo, propiedadesPropias: function () { return (db.propiedades || []).slice(); },
    guardarPropiedad: guardarPropiedad, eliminarPropiedad: eliminarPropiedad,
    entrarAdmin: entrarAdmin, esAdmin: esAdmin, salirAdmin: salirAdmin,
    reiniciar: reiniciar
  };
})();
