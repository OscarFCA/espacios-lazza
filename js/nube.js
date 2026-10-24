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

  var URL_PROYECTO = "";   // ← https://xxxxxxxx.supabase.co
  var LLAVE_ANON   = "";   // ← la llave "anon public"

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
      if (r.status === 204) return null;
      return r.json().then(function (d) {
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

  window.Nube = {
    configurada: configurada,
    entrar: entrar, salir: salir, hayEquipo: hayEquipo, correoEquipo: correoEquipo, renovar: renovar,
    traerPropiedades: traerPropiedades, guardarPropiedad: guardarPropiedad, borrarPropiedad: borrarPropiedad,
    subirFoto: subirFoto, borrarFoto: borrarFoto,
    pasos: [
      "Crea un proyecto en supabase.com (región East US o la más cercana a México).",
      "SQL Editor → pega backend/esquema.sql → Run.",
      "Authentication → Users → Add user con el correo y la contraseña del equipo, marcando Auto Confirm.",
      "Project Settings → API → copia Project URL y la llave anon public.",
      "Pégalas en URL_PROYECTO y LLAVE_ANON, dentro de js/nube.js."
    ]
  };
})();
