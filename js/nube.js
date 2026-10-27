/* Legato Capital — la nube.
 *
 * Sin librerías ni CDN: la API de Supabase es REST y `fetch` alcanza. Mismo
 * criterio que el resto del proyecto, cero dependencias.
 *
 * Qué resuelve: hasta ahora las propiedades y sus fotos vivían en el
 * localStorage de quien las subía, así que nadie más las veía y a las doce
 * propiedades se llenaba la cuota del navegador. Esto las saca de ahí.
 *
 * Cómo encenderlo, una sola vez:
 *   1. supabase.com → New project. Región: East US (North Virginia) o la más
 *      cercana a México.
 *   2. SQL Editor → pega backend/esquema.sql → Run.
 *   3. Authentication → Users → Add user → correo y contraseña del equipo.
 *      Marca "Auto Confirm User".
 *   4. Project Settings → API → copia "Project URL" y la llave "anon public".
 *   5. Pégalas aquí abajo.
 *
 * La llave anon es pública por diseño: viaja en el navegador de cualquiera que
 * entre. Lo que protege los datos NO es esconderla, son las políticas RLS del
 * esquema: sin sesión solo se puede leer el catálogo publicado. La llave
 * `service_role` —esa sí secreta— no se usa aquí y nunca debe ponerse.
 */
(function () {
  "use strict";

  var URL_PROYECTO = "https://wmrtzwugmxlugqtzqujo.supabase.co";
  var LLAVE_ANON   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcnR6d3VnbXhsdWdxdHpxdWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODYxNzUsImV4cCI6MjEwODU2MjE3NX0.Sc8829FZ-0gU15LTsq5mEMuQMX7jwixArJsMmAqVJXw";

  var BUCKET = "propiedades";
  var SESION = "legato:nube:sesion";

  var sesion = null;       // { access_token, refresh_token, expira, correo }

  function configurada() { return !!(URL_PROYECTO && LLAVE_ANON); }

  /* ------------------------------ sesión ------------------------------ */

  function leerSesion() {
    if (sesion) return sesion;
    try {
      var s = JSON.parse(localStorage.getItem(SESION) || "null");
      if (s && s.access_token) sesion = s;
    } catch (e) {}
    return sesion;
  }
  function guardarSesion(s) {
    sesion = s;
    try {
      if (s) localStorage.setItem(SESION, JSON.stringify(s));
      else localStorage.removeItem(SESION);
    } catch (e) {}
  }
  function hayEquipo() {
    var s = leerSesion();
    return !!(s && s.expira > Date.now());
  }
  function correoEquipo() {
    var s = leerSesion();
    return s ? s.correo : "";
  }

  function cabeceras(extra) {
    var h = { apikey: LLAVE_ANON, "Content-Type": "application/json" };
    var s = leerSesion();
    h.Authorization = "Bearer " + (s && s.expira > Date.now() ? s.access_token : LLAVE_ANON);
    return Object.assign(h, extra || {});
  }

  function guardarDeRespuesta(d, correo) {
    guardarSesion({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expira: Date.now() + (d.expires_in || 3600) * 1000 - 60000,
      correo: (d.user && d.user.email) || correo || ""
    });
    return sesion;
  }

  function entrar(correo, password) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return fetch(URL_PROYECTO + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: LLAVE_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password: password })
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error_description || d.msg || "Correo o contraseña incorrectos.");
        return guardarDeRespuesta(d, correo);
      });
    });
  }

  /* El token dura una hora; se renueva solo antes de que haga falta. */
  function renovar() {
    var s = leerSesion();
    if (!s || !s.refresh_token) return Promise.reject(new Error("Sin sesión."));
    if (s.expira > Date.now()) return Promise.resolve(s);
    return fetch(URL_PROYECTO + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: LLAVE_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { guardarSesion(null); throw new Error("La sesión del equipo expiró."); }
        return guardarDeRespuesta(d, s.correo);
      });
    });
  }

  function salir() {
    var s = leerSesion();
    guardarSesion(null);
    if (!s || !configurada()) return Promise.resolve();
    return fetch(URL_PROYECTO + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: LLAVE_ANON, Authorization: "Bearer " + s.access_token }
    }).catch(function () {});
  }

  /* ---------------------------- propiedades ---------------------------- */
  /* En la base la columna es `descripcion` porque `desc` es palabra reservada
     en SQL; de este lado se sigue llamando `desc`, como en todo el código. */

  function aFila(p) {
    return {
      slug: p.slug, op: p.op, tipo: p.tipo, condicion: p.condicion || "Lista para habitar",
      negociable: !!p.negociable, exclusiva: !!p.exclusiva, publicada: p.publicada !== false,
      title: p.title, zona: p.zona, price: Number(p.price) || 0,
      terreno: Number(p.terreno) || 0, construido: Number(p.construido) || 0,
      rec: Number(p.rec) || 0, ban: Number(p.ban) || 0, autos: Number(p.autos) || 0,
      frente: p.frente || "—",
      descripcion: p.desc || "", potencial: p.potencial || "", maps: p.maps || "",
      fotos: p.fotos || [], orden: Number(p.orden) || 0
    };
  }
  function aPropiedad(f) {
    return {
      slug: f.slug, op: f.op, tipo: f.tipo, condicion: f.condicion,
      negociable: f.negociable, exclusiva: f.exclusiva, publicada: f.publicada,
      title: f.title, zona: f.zona, price: f.price,
      terreno: f.terreno, construido: f.construido,
      rec: f.rec, ban: f.ban, autos: f.autos, frente: f.frente,
      desc: f.descripcion, potencial: f.potencial, maps: f.maps,
      fotos: Array.isArray(f.fotos) ? f.fotos : [],
      fotosCount: Math.max(1, (f.fotos || []).length),
      orden: f.orden, nuevo: 0, x: 50, y: 50, deNube: true
    };
  }

  function rest(ruta, opciones) {
    return fetch(URL_PROYECTO + "/rest/v1/" + ruta, opciones).then(function (r) {
      if (r.status === 204 || r.status === 205) return null;
      /* Con `return=minimal` PostgREST contesta 201 y cuerpo vacío: pedirle
         json a eso lanza un SyntaxError y hacía fallar escrituras que en el
         servidor habían salido bien. */
      return r.text().then(function (txt) {
        if (!txt) {
          if (!r.ok) throw new Error("La nube respondió " + r.status + ".");
          return null;
        }
        var d;
        try { d = JSON.parse(txt); }
        catch (e) { if (!r.ok) throw new Error("La nube respondió " + r.status + "."); return null; }
        if (!r.ok) throw new Error(d.message || d.hint || ("La nube respondió " + r.status + "."));
        return d;
      });
    });
  }

  function traerPropiedades() {
    if (!configurada()) return Promise.resolve(null);
    var filtro = hayEquipo() ? "" : "&publicada=eq.true";
    return rest("propiedades?select=*&order=orden.asc,creada.desc" + filtro, { headers: cabeceras() })
      .then(function (filas) { return (filas || []).map(aPropiedad); });
  }

  function guardarPropiedad(p) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return renovar().then(function () {
      return rest("propiedades?on_conflict=slug", {
        method: "POST",
        headers: cabeceras({ Prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(aFila(p))
      });
    }).then(function (d) { return d && d[0] ? aPropiedad(d[0]) : p; });
  }

  function borrarPropiedad(slug) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return renovar().then(function () {
      return rest("propiedades?slug=eq." + encodeURIComponent(slug), {
        method: "DELETE", headers: cabeceras({ Prefer: "return=minimal" })
      });
    });
  }

  /* ---------------------------- fotografías ---------------------------- */
  /* Van al bucket, no a la base: una foto en base64 dentro del navegador
     llenaba la cuota a las doce propiedades. */

  function subirFoto(slug, archivo, alt) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    var ext = (archivo.type || "image/jpeg").split("/")[1].replace("jpeg", "jpg");
    var nombre = slug + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "." + ext;
    return renovar().then(function () {
      var s = leerSesion();
      return fetch(URL_PROYECTO + "/storage/v1/object/" + BUCKET + "/" + nombre, {
        method: "POST",
        headers: {
          apikey: LLAVE_ANON,
          Authorization: "Bearer " + s.access_token,
          "Content-Type": archivo.type || "image/jpeg",
          "x-upsert": "true"
        },
        body: archivo
      });
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("No se pudo subir la imagen. " + t.slice(0, 120)); });
      return { src: URL_PROYECTO + "/storage/v1/object/public/" + BUCKET + "/" + nombre,
               alt: alt || "", ruta: nombre };
    });
  }

  function borrarFoto(ruta) {
    if (!configurada() || !ruta) return Promise.resolve();
    return renovar().then(function () {
      var s = leerSesion();
      return fetch(URL_PROYECTO + "/storage/v1/object/" + BUCKET + "/" + ruta, {
        method: "DELETE",
        headers: { apikey: LLAVE_ANON, Authorization: "Bearer " + s.access_token }
      });
    }).catch(function () {});
  }

  /* =============================== el CRM =============================== */
  /* Segunda ronda: interesados, mensajes, actividad y la agenda salen del
   * navegador. La asimetría que manda aquí, y que explica todo lo demás:
   *
   *   el cliente ESCRIBE pero no puede LEER.
   *
   * No tiene cuenta de Supabase —se registra con nombre, correo y teléfono,
   * sin contraseña—, así que escribe con la llave anon, que es pública. Si
   * pudiera leer, cualquiera que abriera el sitio se bajaría la lista entera
   * de interesados con sus teléfonos. Por eso:
   *
   *   - Sus envíos van con `return=minimal`. No es un detalle de estilo:
   *     PostgREST, al devolver la fila, hace un RETURNING, y un RETURNING
   *     necesita permiso de lectura. Con representación el insert FALLA.
   *   - El cliente sigue viendo su propia conversación desde la copia de su
   *     navegador, igual que antes. La del servidor es la del equipo.
   */

  /* Los nombres en la base van en minúsculas y con guion bajo —es la
     convención de SQL—; los del código siguen como estaban. Aquí se traducen,
     igual que `desc` ↔ `descripcion` en el catálogo. */

  function aFilaCliente(u) {
    return { id: u.id, nombre: u.nombre || "", correo: u.correo || "",
             telefono: u.telefono || "", pais: u.pais || "MX",
             whatsapp: u.whatsapp || "", pais_wa: u.paisWa || "" };
  }
  function aUsuario(f) {
    return { id: f.id, nombre: f.nombre, correo: f.correo, telefono: f.telefono,
             pais: f.pais, whatsapp: f.whatsapp, paisWa: f.pais_wa,
             alta: f.creado, deNube: true };
  }

  function aFilaLead(l) {
    return { id: l.id, cliente_id: l.usuarioId || null, nombre: l.nombre || "",
             correo: l.correo || "", correos_extra: l.correosExtra || "",
             telefono: l.telefono || "", pais: l.pais || "MX",
             whatsapp: l.whatsapp || "", pais_wa: l.paisWa || "",
             empresa: l.empresa || "", presupuesto: Number(l.presupuesto) || 0,
             etapa: l.etapa || "nuevo", propiedad: l.propiedad || "",
             notas: l.seguimiento || [], origen: l.origen || "" };
  }
  function aLead(f) {
    return { id: f.id, usuarioId: f.cliente_id, nombre: f.nombre, correo: f.correo,
             correosExtra: f.correos_extra, telefono: f.telefono, pais: f.pais,
             whatsapp: f.whatsapp, paisWa: f.pais_wa, empresa: f.empresa,
             presupuesto: f.presupuesto, etapa: f.etapa, propiedad: f.propiedad,
             seguimiento: Array.isArray(f.notas) ? f.notas : [],
             origen: f.origen, alta: f.creado, actualizado: f.actualizado, deNube: true };
  }

  function aFilaMensaje(m) {
    return { id: m.id, lead_id: m.leadId || null, cliente_id: m.usuarioId || null,
             de: m.de === "equipo" ? "equipo" : "cliente", tipo: m.tipo || "contacto",
             canal: m.canal || "", texto: m.texto || "", slug: m.slug || "",
             dia: m.dia || "", hora: m.hora || "",
             confirmada: !!m.confirmada, leido: !!m.leido,
             fecha: m.fecha || new Date().toISOString() };
  }
  function aMensaje(f) {
    return { id: f.id, leadId: f.lead_id, usuarioId: f.cliente_id, de: f.de,
             tipo: f.tipo, canal: f.canal, texto: f.texto, slug: f.slug,
             dia: f.dia, hora: f.hora, confirmada: f.confirmada, leido: f.leido,
             fecha: f.fecha, deNube: true };
  }

  function aFilaActividad(a) {
    return { id: a.id, tipo: a.tipo, cliente_id: a.usuarioId || null,
             nombre: a.nombre || "", slug: a.slug || "",
             fecha: a.fecha || new Date().toISOString() };
  }
  function aActividad(f) {
    return { id: f.id, tipo: f.tipo, usuarioId: f.cliente_id, nombre: f.nombre,
             slug: f.slug, fecha: f.fecha, deNube: true };
  }

  /* ---- lo que escribe el cliente: a ciegas y sin pedir nada de vuelta ---- */

  /* Dos cosas aquí no son estilo, son obligatorias, y las dos cuestan un rato
     de depuración si se olvidan:
     1. `return=minimal`. Sin él PostgREST hace RETURNING, y un RETURNING pide
        permiso de lectura. El insert falla entero.
     2. INSERT pelado, sin `on_conflict`. Cualquier upsert —incluso con
        `ignore-duplicates`— se va por la ruta ON CONFLICT DO UPDATE, que pide
        permiso de ACTUALIZACIÓN. Dárselo al público sería dejar que cualquiera
        pisara la ficha de otro adivinando su id, así que no se le da: se manda
        un insert normal y el choque se trata abajo. */
  function mandarAnon(tabla, filas) {
    if (!configurada()) return Promise.resolve(null);
    return fetch(URL_PROYECTO + "/rest/v1/" + tabla, {
      method: "POST",
      headers: {
        apikey: LLAVE_ANON,
        Authorization: "Bearer " + LLAVE_ANON,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(filas)
    }).then(function (r) {
      /* 409 = ya existía. Pasa cada vez que alguien manda su segundo mensaje:
         su ficha se creó con el primero. No es un fallo, es el final feliz. */
      if (r.status === 409) return "ya-estaba";
      if (!r.ok) return r.text().then(function (t) {
        throw new Error("No se pudo registrar (" + r.status + "). " + t.slice(0, 120));
      });
      return true;
    });
  }

  /* Un contacto completo en un viaje: quién es, su ficha y lo que escribió.
     Si falla no se le dice al cliente —ya tiene su copia y su mensaje se ve
     en su pantalla—, pero se avisa por consola para no perderlo en silencio. */
  function registrarContacto(d) {
    if (!configurada()) return Promise.resolve(null);
    /* Se guardan FUNCIONES, no promesas. Una promesa ya creada no espera a
       nadie: los cuatro envíos salían a la vez y el mensaje llegaba antes que
       la ficha de la que cuelga, así que la llave foránea lo rechazaba. */
    var pasos = [];
    if (d.usuario)   pasos.push(function () { return mandarAnon("clientes",  [aFilaCliente(d.usuario)]); });
    if (d.lead)      pasos.push(function () { return mandarAnon("leads",     [aFilaLead(d.lead)]); });
    if (d.mensaje)   pasos.push(function () { return mandarAnon("mensajes",  [aFilaMensaje(d.mensaje)]); });
    if (d.actividad) pasos.push(function () { return mandarAnon("actividad", [aFilaActividad(d.actividad)]); });
    return pasos.reduce(function (cadena, paso) {
      return cadena.then(paso);
    }, Promise.resolve()).catch(function (e) {
      console.warn("No se pudo mandar el contacto al servidor.", e);
      return null;
    });
  }

  /* ------------------------- el aviso al equipo ------------------------- */
  /* La función vive en backend/aviso/index.ts, desplegada en Supabase. La
     llave de SendGrid se queda allá: si estuviera aquí, cualquiera que abriera
     el código podría mandar correo en nombre de Lazza. Lo que impide el abuso
     no es esconder la llamada —se ve en el navegador— sino que esa función
     solo sepa escribirle al equipo: no acepta destinatario.

     Si falla, el cliente no se entera. Su mensaje ya quedó guardado; el aviso
     es comodidad del equipo, no parte de lo que la persona pidió. */
  function avisarEquipo(d) {
    if (!configurada()) return Promise.resolve(null);
    return fetch(URL_PROYECTO + "/functions/v1/aviso", {
      method: "POST",
      headers: {
        apikey: LLAVE_ANON,
        Authorization: "Bearer " + LLAVE_ANON,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(d)
    }).then(function (r) {
      if (r.status === 404) return null;      // todavía sin desplegar
      return r.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  /* ------------------- lo que lee y escribe el equipo ------------------- */

  function traerCrm() {
    if (!configurada() || !hayEquipo()) return Promise.resolve(null);
    return Promise.all([
      rest("clientes?select=*", { headers: cabeceras() }),
      rest("leads?select=*&order=actualizado.desc", { headers: cabeceras() }),
      rest("mensajes?select=*&order=fecha.asc", { headers: cabeceras() }),
      rest("actividad?select=*&order=fecha.desc&limit=500", { headers: cabeceras() })
    ]).then(function (r) {
      return {
        usuarios:  (r[0] || []).map(aUsuario),
        leads:     (r[1] || []).map(aLead),
        mensajes:  (r[2] || []).map(aMensaje),
        actividad: (r[3] || []).map(aActividad)
      };
    });
  }

  function guardarEnNube(tabla, filas) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return renovar().then(function () {
      return rest(tabla + "?on_conflict=id", {
        method: "POST",
        headers: cabeceras({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(filas)
      });
    });
  }

  function guardarLead(l)     { return guardarEnNube("leads", [aFilaLead(l)]); }
  function guardarMensaje(m)  { return guardarEnNube("mensajes", [aFilaMensaje(m)]); }
  function guardarCliente(u)  { return guardarEnNube("clientes", [aFilaCliente(u)]); }

  function borrarLeadNube(id) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return renovar().then(function () {
      return rest("leads?id=eq." + encodeURIComponent(id), {
        method: "DELETE", headers: cabeceras({ Prefer: "return=minimal" })
      });
    });
  }

  function marcarLeidos(leadId) {
    if (!configurada() || !hayEquipo()) return Promise.resolve(null);
    return renovar().then(function () {
      return rest("mensajes?lead_id=eq." + encodeURIComponent(leadId) + "&leido=is.false", {
        method: "PATCH",
        headers: cabeceras({ Prefer: "return=minimal" }),
        body: JSON.stringify({ leido: true })
      });
    }).catch(function () { return null; });
  }

  /* ------------------------------ la agenda ------------------------------ */
  /* Esta sí la lee cualquiera: sin los horarios, el cliente no puede saber
     qué visitas puede pedir. */

  function traerAgenda() {
    if (!configurada()) return Promise.resolve(null);
    return rest("ajustes?select=valor&clave=eq.agenda", { headers: cabeceras() })
      .then(function (f) { return f && f[0] ? f[0].valor : null; })
      .catch(function () { return null; });
  }

  function guardarAgendaNube(valor) {
    if (!configurada()) return Promise.reject(new Error("La nube no está configurada."));
    return renovar().then(function () {
      return rest("ajustes?on_conflict=clave", {
        method: "POST",
        headers: cabeceras({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify([{ clave: "agenda", valor: valor }])
      });
    });
  }

  window.Nube = {
    configurada: configurada,
    entrar: entrar, salir: salir, hayEquipo: hayEquipo, correoEquipo: correoEquipo, renovar: renovar,
    traerPropiedades: traerPropiedades, guardarPropiedad: guardarPropiedad, borrarPropiedad: borrarPropiedad,
    subirFoto: subirFoto, borrarFoto: borrarFoto,
    registrarContacto: registrarContacto, traerCrm: traerCrm, avisarEquipo: avisarEquipo,
    guardarLead: guardarLead, guardarMensaje: guardarMensaje, guardarCliente: guardarCliente,
    borrarLeadNube: borrarLeadNube, marcarLeidos: marcarLeidos,
    traerAgenda: traerAgenda, guardarAgendaNube: guardarAgendaNube,
    pasos: [
      "Crea un proyecto en supabase.com (región East US o la más cercana a México).",
      "SQL Editor → pega backend/esquema.sql → Run.",
      "Authentication → Users → Add user con el correo y la contraseña del equipo, marcando Auto Confirm.",
      "Project Settings → API → copia Project URL y la llave anon public.",
      "Pégalas en URL_PROYECTO y LLAVE_ANON, dentro de js/nube.js."
    ]
  };
})();
