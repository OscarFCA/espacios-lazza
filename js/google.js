/* Legato Capital — conexión con Google Calendar.
 *
 * Un sitio estático SÍ puede hablar con Google: el flujo de token de Google
 * Identity Services usa un client_id público (no hay secreto que esconder) y
 * Google restringe su uso al origen que se registró en la consola.
 *
 * Qué hace falta para encenderlo, una sola vez:
 *   1. console.cloud.google.com → proyecto nuevo → habilitar "Google Calendar API".
 *   2. Pantalla de consentimiento OAuth. Mientras no esté verificada por Google,
 *      agrega la cuenta de Legato como "usuario de prueba".
 *   3. Credenciales → ID de cliente de OAuth → tipo "Aplicación web".
 *      Orígenes autorizados de JavaScript:
 *        https://oscarfca.github.io
 *        http://localhost:8777   (para probar en local)
 *   4. Pega el ID aquí abajo.
 *
 * El token de acceso NO se guarda en el navegador: vive en memoria y se vuelve
 * a pedir —sin molestar a nadie— cuando hace falta. Lo que sí se guarda es a
 * qué cuenta y a qué calendario quedó conectado.
 */
(function () {
  "use strict";

  var CLIENT_ID = "";   // ← pega aquí el ID de cliente de OAuth
  var SCOPES = "https://www.googleapis.com/auth/calendar.readonly " +
               "https://www.googleapis.com/auth/calendar.events";
  var GSI = "https://accounts.google.com/gsi/client";

  var token = null;       // solo en memoria
  var cliente = null;     // token client de GIS
  var cargando = null;    // promesa de carga del script

  function configurado() { return !!CLIENT_ID; }

  /* El script de Google se carga cuando de verdad se necesita, no en cada
     visita: nadie que entre a ver una casa tiene por qué cargar a Google. */
  function cargarGSI() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (cargando) return cargando;
    cargando = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = GSI;
      s.async = true;
      s.onload = res;
      s.onerror = function () { rej(new Error("No se pudo cargar Google.")); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  function pedirToken(silencioso) {
    return cargarGSI().then(function () {
      return new Promise(function (res, rej) {
        if (!cliente) {
          cliente = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: function (r) {
              if (r && r.access_token) { token = r.access_token; res(token); }
              else rej(new Error("No se obtuvo el permiso."));
            },
            error_callback: function (e) {
              rej(new Error(e && e.type === "popup_closed"
                ? "Se cerró la ventana de Google sin terminar."
                : "Google no concedió el permiso."));
            }
          });
        } else {
          cliente.callback = function (r) {
            if (r && r.access_token) { token = r.access_token; res(token); }
            else rej(new Error("No se obtuvo el permiso."));
          };
        }
        cliente.requestAccessToken({ prompt: silencioso ? "" : "consent" });
      });
    });
  }

  function api(ruta, opciones) {
    return fetch("https://www.googleapis.com/calendar/v3" + ruta, Object.assign({
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
    }, opciones || {})).then(function (r) {
      if (r.status === 401) { token = null; throw new Error("La sesión de Google expiró."); }
      if (!r.ok) throw new Error("Google respondió " + r.status + ".");
      return r.json();
    });
  }

  /* Conectar = dar permiso y traer la lista de calendarios de esa cuenta.
     El calendario principal lleva el correo como id, así que de ahí sale la
     cuenta sin pedir un permiso extra solo para saber el correo. */
  function conectar() {
    if (!configurado()) {
      return Promise.reject(new Error("Falta el ID de cliente de Google en js/google.js."));
    }
    return pedirToken(false)
      .then(function () { return api("/users/me/calendarList?minAccessRole=writer"); })
      .then(function (d) {
        var lista = (d.items || []).map(function (c) {
          return { id: c.id, nombre: c.summary, principal: !!c.primary };
        });
        var principal = lista.filter(function (c) { return c.principal; })[0] || lista[0];
        if (!principal) throw new Error("Esa cuenta no tiene calendarios donde escribir.");
        window.Store.guardarGoogle({
          cuenta: principal.id,
          calendario: principal.id,
          calendarioNombre: principal.nombre,
          calendarios: lista,
          desde: new Date().toISOString()
        });
        return window.Store.google();
      });
  }

  function desconectar() {
    var g = window.Store.google();
    window.Store.desconectarGoogle();
    var t = token;
    token = null;
    cliente = null;
    if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try { window.google.accounts.oauth2.revoke(t); } catch (e) {}
    }
    return Promise.resolve(g);
  }

  /* Al recargar la página el token se perdió: se vuelve a pedir en silencio.
     Si Google ya no lo da sin interacción, se avisa en vez de fallar callado. */
  function asegurarToken() {
    if (token) return Promise.resolve(token);
    if (!configurado() || !window.Store.google()) {
      return Promise.reject(new Error("No hay un calendario conectado."));
    }
    return pedirToken(true);
  }

  /* Una visita confirmada se escribe en el calendario conectado. Es la razón
     de conectarlo: si no, el botón no sirve para nada. */
  function agendarVisita(datos) {
    var g = window.Store.google();
    if (!g || !g.calendario) return Promise.reject(new Error("No hay un calendario conectado."));
    return asegurarToken().then(function () {
      return api("/calendars/" + encodeURIComponent(g.calendario) + "/events", {
        method: "POST",
        body: JSON.stringify({
          summary: datos.titulo,
          description: datos.detalle || "",
          location: datos.lugar || "",
          start: { dateTime: datos.inicio, timeZone: datos.zona },
          end: { dateTime: datos.fin, timeZone: datos.zona }
        })
      });
    });
  }

  window.GoogleCal = {
    configurado: configurado,
    conectar: conectar,
    desconectar: desconectar,
    agendarVisita: agendarVisita,
    instrucciones: [
      "Crea un proyecto en console.cloud.google.com y habilita Google Calendar API.",
      "Configura la pantalla de consentimiento y agrega la cuenta de Legato como usuario de prueba.",
      "Credenciales → ID de cliente de OAuth → Aplicación web, con https://oscarfca.github.io como origen autorizado.",
      "Pega el ID en CLIENT_ID, dentro de js/google.js."
    ]
  };
})();
