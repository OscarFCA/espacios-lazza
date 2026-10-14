/* Legato Capital — asistente guiado.
 *
 * No es un modelo de lenguaje: es un guion. Cada paso ofrece respuestas
 * establecidas y solo pide escribir cuando hace falta un dato que nadie puede
 * adivinar (nombre, correo, teléfono, el mensaje). Sirve para dos cosas:
 *
 *   1. crear la cuenta sin sacar a nadie de donde está, y
 *   2. abrir conversación con un asesor.
 *
 * Lo que manda cae en el mismo sitio que el resto: Store.enviarMensaje, así
 * que aparece en la bandeja del equipo y en su ficha del Kanban. Aquí no hay
 * persistencia propia.
 */
(function () {
  "use strict";

  /* DORMIDO. Por decisión de producto el sitio ofrece un botón directo al
     WhatsApp del equipo en lugar del asistente. El guion se conserva entero:
     para volver a encenderlo basta poner ACTIVO en true y quitar el enlace
     #fab-wa de index.html. */
  var ACTIVO = false;

  var UI = null;
  function ui() { return UI || (UI = window.LegatoUI); }
  function esc(s) { return ui().esc(s); }
  function icon(n, s) { return ui().icon(n, s); }
  function S() { return window.Store; }

  /* El asistente se toma dos segundos antes de cada respuesta. No es adorno:
     una respuesta instantánea delata que no hay nadie del otro lado, y además
     da tiempo a leer lo que uno acaba de contestar. */
  var DEMORA = 2000;
  var caja = null, tCerrar = null, tPensar = null;
  var pensando = false;
  var hilo = [];        // lo dicho en esta conversación (no se guarda)
  var paso = "inicio";
  var datos = {};       // lo que se va recogiendo
  var errorActual = "";
  var abierto = false;
  /* "guion" sigue el árbol de preguntas; "chat" es la conversación de verdad
     con el equipo, la misma que vive en el perfil. */
  var modo = "guion";

  function diceBot(t) { (Array.isArray(t) ? t : [t]).forEach(function (x) { hilo.push({ de: "bot", texto: x }); }); }
  function diceYo(t) { hilo.push({ de: "yo", texto: t }); }

  function nombrePila() {
    var u = S().sesion();
    return u ? u.nombre.split(" ")[0] : "";
  }

  /* La propiedad que se está viendo entra sola en la conversación: preguntarla
     cuando ya está en pantalla es hacer trabajar a la persona de más. */
  function propiedadEnPantalla() {
    var c = ui().contexto();
    if (c.screen !== "detail" || !c.sel) return null;
    return S().catalogoCompleto().filter(function (p) { return p.slug === c.sel; })[0] || null;
  }

  /* ============================== el guion ============================== */

  var PASOS = {
    inicio: {
      dice: function () {
        var n = nombrePila();
        var p = propiedadEnPantalla();
        var u = S().sesion();
        var hilo = u ? S().conversacionDe(u.id) : [];
        if (hilo.length && hilo[hilo.length - 1].de === "equipo") {
          return ["Hola, " + n + ". Tienes una respuesta del equipo esperándote."];
        }
        return n
          ? ["Hola, " + n + ". ¿En qué te ayudo?"]
          : ["Hola. Soy el asistente de Legato Capital.",
             p ? "Veo que estás en " + p.title + ". ¿Qué te gustaría hacer?" : "¿Qué te gustaría hacer?"];
      },
      opciones: function () {
        var u = S().sesion();
        var hilo = u ? S().conversacionDe(u.id).length : 0;
        var o = [];
        if (hilo) o.push({ txt: "Continuar mi conversación", va: "chat" });
        if (!u) o.push({ txt: "Crear mi cuenta", va: "alta_nombre" });
        if (!hilo) o.push({ txt: "Hablar con un asesor", va: "asesor" });
        o.push({ txt: "Agendar una visita", va: "visita" });
        return o;
      }
    },

    /* ---------- alta de cuenta ---------- */

    alta_nombre: {
      dice: function () {
        return datos.volverA === "asesor"
          ? ["Para que un asesor te escriba por WhatsApp necesito tres datos.",
             "¿Cómo te llamas? Nombre y apellido."]
          : datos.volverA === "visita"
            ? ["Para apartar la visita necesito tus datos. Son tres.",
               "¿Cómo te llamas? Nombre y apellido."]
            : ["Va. ¿Cómo te llamas? Nombre y apellido."];
      },
      entrada: { id: "bot-nombre", tipo: "text", ph: "María Fernanda Ruiz", auto: "name", boton: "Continuar" },
      recibe: function (v) {
        var n = String(v || "").trim();
        if (n.split(/\s+/).length < 2) return { error: "Me falta el apellido para poder registrarte." };
        datos.nombre = n;
        return { va: "alta_correo", eco: n };
      }
    },

    alta_correo: {
      dice: ["¿A qué correo te escribimos?"],
      entrada: { id: "bot-correo", tipo: "email", ph: "nombre@correo.com", auto: "email", boton: "Continuar" },
      recibe: function (v) {
        var c = String(v || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.toLowerCase()))
          return { error: "Ese correo no se ve bien. ¿Lo revisas?" };
        datos.correo = c;
        return { va: "alta_tel", eco: c };
      }
    },

    alta_tel: {
      dice: function () {
        return datos.volverA === "asesor"
          ? ["Y tu WhatsApp: es por donde te contesta el asesor.",
             "Si escribes desde fuera de México, cambia el país."]
          : ["Y tu teléfono. Si llamas desde fuera de México, cambia el país."];
      },
      entrada: { id: "bot-tel", tipo: "tel", boton: "Crear mi cuenta" },
      recibe: function (v, extra) {
        var r = S().registrar({
          nombre: datos.nombre, correo: datos.correo,
          telefono: v, pais: extra,
          origen: (propiedadEnPantalla() || {}).slug || ""
        });
        if (!r.ok) {
          return { error: r.errores.telefono || r.errores.correo || r.errores.nombre || "Algo no cuadró. Inténtalo otra vez." };
        }
        datos.pais = extra;
        /* Si llegó por el asesor, el número que acaba de dar es su WhatsApp:
           no tiene sentido pedírselo otra vez en el paso siguiente. */
        if (datos.volverA === "asesor") S().mismoWhatsApp();
        ui().render();
        return { va: datos.volverA || "alta_ok", eco: S().telMostrar(r.usuario) };
      }
    },

    alta_ok: {
      dice: function () {
        return ["Listo, " + nombrePila() + ". Tu cuenta quedó creada.",
                "Ya puedes guardar propiedades, ver las oportunidades de acceso anticipado y escribirle al equipo."];
      },
      opciones: [
        { txt: "Hablar con un asesor", va: "asesor" },
        { txt: "Ver oportunidades", accion: "oportunidades" },
        { txt: "Gracias, eso era todo", va: "despedida" }
      ]
    },

    /* ---------- conversación con un asesor ---------- */

    asesor: {
      antes: function () {
        if (!S().sesion()) { datos.volverA = "asesor"; return "alta_nombre"; }
        /* Sin WhatsApp no hay por dónde responder: se pide una vez y queda. */
        if (!S().tieneWhatsApp()) { datos.trasWa = "asesor"; return "wa_confirma"; }
        return null;
      },
      dice: ["Te atiende un asesor patrimonial de Legato. ¿De qué quieres hablar?"],
      opciones: function () {
        var p = propiedadEnPantalla();
        var o = [];
        if (p) o.push({ txt: "De " + p.title, va: "msg_texto", pone: { slug: p.slug, tema: "Sobre " + p.title } });
        o.push({ txt: "De una propiedad del catálogo", va: "msg_texto", pone: { tema: "Sobre una propiedad" } });
        o.push({ txt: "Busco algo que no veo aquí", va: "msg_texto", pone: { tema: "Busca algo que no está publicado" } });
        o.push({ txt: "Quiero vender o rentar mi propiedad", va: "msg_texto", pone: { tema: "Quiere vender o rentar" } });
        return o;
      }
    },

    msg_texto: {
      dice: function () {
        return datos.tema === "Busca algo que no está publicado"
          ? ["Cuéntame qué buscas: zona, superficie y presupuesto si lo tienes."]
          : datos.tema === "Quiere vender o rentar"
            ? ["Cuéntame qué tienes: dónde está, cuánto mide y en qué estado."]
            : ["Cuéntame qué quieres saber."];
      },
      entrada: { id: "bot-texto", tipo: "textarea", ph: "¿Se puede ampliar? ¿Cuál es el uso de suelo?", boton: "Continuar" },
      recibe: function (v) {
        var t = String(v || "").trim();
        if (t.length < 4) return { error: "Escríbeme un poco más y se lo paso completo." };
        datos.texto = t;
        return { va: "canal", eco: t };
      }
    },

    /* ---------- conversación libre, dentro del mismo widget ---------- */

    chat: {
      antes: function () {
        if (!S().sesion()) { datos.volverA = "chat"; return "alta_nombre"; }
        if (!S().tieneWhatsApp()) { datos.trasWa = "chat"; return "wa_confirma"; }
        modo = "chat";
        return null;
      },
      dice: []
    },

    /* ---------- el WhatsApp del asesor ---------- */

    wa_confirma: {
      dice: function () {
        var u = S().sesion();
        return ["El asesor te responde por WhatsApp.",
                "¿Te escribimos al " + S().telMostrar(u) + "?"];
      },
      opciones: [
        { txt: "Sí, ese mismo", va: "wa_mismo" },
        { txt: "Mi WhatsApp es otro número", va: "wa_otro" }
      ]
    },

    /* Paso puente: si copiar el teléfono no pasa la validación —un número
       viejo, mal capturado por el equipo— pide uno en vez de dar vueltas. */
    wa_mismo: {
      antes: function () {
        return S().mismoWhatsApp().ok ? (datos.trasWa || "asesor") : "wa_otro";
      },
      dice: []
    },

    wa_otro: {
      dice: ["¿A qué número con WhatsApp te escribimos?"],
      entrada: { id: "bot-wa", tipo: "tel", boton: "Guardar" },
      recibe: function (v, extra) {
        var r = S().guardarWhatsApp(v, extra);
        if (!r.ok) return { error: r.error };
        ui().render();
        return { va: datos.trasWa || "asesor", eco: r.muestra };
      }
    },

    /* ---------- agenda de visita ---------- */

    visita: {
      antes: function () {
        if (!S().sesion()) { datos.volverA = "visita"; return "alta_nombre"; }
        var p = propiedadEnPantalla();
        if (p) { datos.slug = p.slug; return null; }
        return "visita_cual";
      },
      dice: function () {
        var p = S().catalogoCompleto().filter(function (x) { return x.slug === datos.slug; })[0];
        return ["Vamos a apartar la visita" + (p ? " a " + p.title : "") + ". ¿Qué día te viene bien?"];
      },
      entrada: { id: "bot-dia", tipo: "date", boton: "Continuar" },
      recibe: function (v) {
        if (!v) return { error: "Necesito una fecha para apartarla." };
        if (v < S().hoyLocal()) return { error: "Esa fecha ya pasó. Elige una a partir de hoy." };
        datos.dia = v;
        return { va: "visita_hora", eco: fechaLarga(v) };
      }
    },

    /* Sin propiedad en pantalla no hay nada que visitar: se elige una. */
    visita_cual: {
      dice: ["¿Cuál te gustaría visitar?"],
      opciones: function () {
        return S().catalogo().slice(0, 5).map(function (p) {
          return { txt: p.title + " · " + p.zona.split(",")[0], va: "visita", pone: { slug: p.slug } };
        }).concat([{ txt: "Prefiero verlas primero", accion: "resultados" }]);
      }
    },

    visita_hora: {
      dice: ["¿En qué horario?"],
      opciones: function () {
        return S().HORARIOS.map(function (h) {
          return { txt: h.label, va: "visita_nota", pone: { hora: h.id } };
        });
      }
    },

    visita_nota: {
      dice: ["¿Algo que debamos saber? Si no, pasa de largo."],
      entrada: { id: "bot-nota", tipo: "textarea", ph: "Voy con mi arquitecto…", boton: "Continuar", opcional: true },
      recibe: function (v) {
        datos.texto = String(v || "").trim();
        return { va: "canal", eco: datos.texto || "Nada en particular" };
      }
    },

    /* ---------- cierre común: por dónde contestamos ---------- */

    canal: {
      dice: ["¿Por dónde prefieres que te contestemos?"],
      opciones: function () {
        return S().CANALES.map(function (c) {
          return { txt: c.label, va: "enviar", pone: { canal: c.id } };
        });
      }
    },

    enviar: {
      antes: function () {
        var r = S().enviarMensaje({
          tipo: datos.dia ? "visita" : "contacto",
          slug: datos.slug || "",
          texto: [datos.tema, datos.texto].filter(Boolean).join(" — "),
          canal: datos.canal, dia: datos.dia || "", hora: datos.hora || ""
        });
        /* Sin sesión no hay a quién contestarle: se piden los datos y se
           vuelve aquí. Es la misma regla en todas las puertas del sitio. */
        if (!r.ok && r.motivo === "sin-sesion") {
          datos.volverA = "enviar";
          return "alta_nombre";
        }
        datos.enviado = !!r.ok;
        datos.msj = r.mensaje || null;
        datos.falla = r.ok ? "" : (r.errores ? Object.keys(r.errores).map(function (k) { return r.errores[k]; })[0] : "");
        ui().render();
        return null;
      },
      dice: function () {
        if (!datos.enviado) return ["No pude mandarlo: " + (datos.falla || "algo falló") + ".", "¿Lo intentamos otra vez?"];
        var canal = S().CANALES.filter(function (c) { return c.id === datos.canal; })[0];
        return datos.dia
          ? ["Pedí la visita para el " + fechaLarga(datos.dia) + ".",
             "Todavía no está confirmada: tu asesor la revisa con el propietario y te avisa por " +
             canal.label.toLowerCase() + " en menos de 24 horas hábiles."]
          : ["Listo, tu mensaje ya está con el equipo.",
             "Un asesor te responde por " + canal.label.toLowerCase() + " en menos de 24 horas hábiles. La conversación te queda guardada en tu perfil."];
      },
      opciones: function () {
        if (!datos.enviado) return [{ txt: "Intentar otra vez", va: "canal" }, { txt: "Mejor después", va: "despedida" }];
        var o = [];
        /* Atajo honesto mientras no haya servidor: el aviso lo manda el propio
           cliente desde su WhatsApp, y así el equipo se entera al momento. */
        var url = S().enlaceWaEquipo(datos.msj || {});
        if (url) o.push({ txt: "Avisarles por WhatsApp ahora", enlace: url });
        return o.concat([
          { txt: "Seguir escribiendo aquí", va: "chat" },
          { txt: "Ver la conversación completa", accion: "perfil" },
          { txt: "Seguir viendo propiedades", accion: "resultados" },
          { txt: "Gracias, eso era todo", va: "despedida" }
        ]);
      }
    },

    /* ---------- salidas ---------- */

    despedida: {
      dice: ["Aquí ando si necesitas algo más."],
      opciones: [{ txt: "Cerrar", accion: "cerrar" }]
    }
  };

  function fechaLarga(iso) {
    var p = String(iso).split("-");
    try {
      return new Date(p[0], Number(p[1]) - 1, p[2])
        .toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    } catch (e) { return iso; }
  }

  function valor(x) { return typeof x === "function" ? x() : x; }

  /* ============================== motor ============================== */

  function entrar(id) {
    paso = id;
    errorActual = "";
    var def = PASOS[id];
    if (def.antes) {
      var salto = def.antes();
      if (salto) { entrar(salto); return; }
    }
    diceBot(valor(def.dice));
  }

  function elegir(i) {
    if (pensando) return;                 // un doble clic no debe adelantar el guion
    var def = PASOS[paso];
    var op = valor(def.opciones)[i];
    if (!op) return;
    diceYo(op.txt);
    if (op.pone) Object.keys(op.pone).forEach(function (k) { datos[k] = op.pone[k]; });
    if (op.hace) op.hace();
    if (op.accion) { salir(op.accion); return; }
    pensar(op.va);
  }

  /* En modo libre no hay guion que esperar: el mensaje sale y aparece. Fingir
     que alguien escribe del otro lado sería mentir —ahí no hay nadie todavía. */
  function enviarLibre() {
    var ta = document.getElementById("bot-chat");
    var txt = (ta && ta.value || "").trim();
    if (!txt) { if (ta) ta.focus(); return; }
    var p = propiedadEnPantalla();
    var r = S().enviarMensaje({
      tipo: "contacto", slug: p ? p.slug : "", texto: txt,
      canal: datos.canal || "whatsapp"
    });
    if (!r.ok) {
      if (r.motivo === "sin-sesion") { modo = "guion"; datos.volverA = "chat"; pensar("alta_nombre"); return; }
      errorActual = (r.errores && r.errores.texto) || "No se pudo enviar. Inténtalo otra vez.";
      pintar();
      return;
    }
    errorActual = "";
    datos.msj = r.mensaje;
    ui().render();
    pintar();
    /* Sin aviso flotante: la burbuja apareciendo en el hilo ya dice que salió,
       y el aviso tapaba justo los botones de abajo. */
  }

  /* Muestra los tres puntos, espera y recién entonces contesta. */
  function pensar(id) {
    pensando = true;
    pintar();
    clearTimeout(tPensar);
    tPensar = setTimeout(function () {
      pensando = false;
      entrar(id);
      pintar();
    }, DEMORA);
  }

  function responder() {
    if (pensando) return;
    var def = PASOS[paso];
    var campo = document.getElementById(def.entrada.id);
    if (!campo) return;
    var v = campo.value;
    if (!String(v || "").trim() && !def.entrada.opcional) {
      errorActual = "Me falta este dato para seguir.";
      pintar();
      return;
    }
    var extra = def.entrada.tipo === "tel"
      ? (document.getElementById("bot-pais") || {}).value
      : null;
    var r = def.recibe(v, extra);
    if (r.error) { errorActual = r.error; pintar(); return; }
    diceYo(r.eco);
    pensar(r.va);
  }

  /* Las salidas llevan a una pantalla del sitio y cierran el asistente: el
     chat no es un sitio aparte, es una puerta al mismo. */
  function salir(accion) {
    cerrar(true);
    if (accion === "cerrar") return;
    if (accion === "oportunidades") ui().go("oportunidades");
    else if (accion === "perfil") ui().go("perfil");
    else if (accion === "resultados") ui().go("results");
  }

  /* ============================== pintado ============================== */

  function burbujasHTML() {
    return '<ol class="chat chat--bot" id="bot-hilo">' + hilo.map(function (m) {
      return '<li class="chat__msg chat__msg--' + (m.de === "yo" ? "propio" : "otro") + '">' +
        '<div class="chat__burbuja"><p>' + esc(m.texto) + '</p></div>' +
      '</li>';
    }).join("") +
    (pensando
      ? '<li class="chat__msg chat__msg--otro">' +
          '<div class="chat__burbuja chat__burbuja--puntos">' +
            '<span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>' +
            '<span class="sr-only">Escribiendo…</span>' +
          '</div>' +
        '</li>'
      : "") +
    '</ol>';
  }

  function entradaHTML(e) {
    if (e.tipo === "textarea") {
      return '<textarea id="' + e.id + '" rows="2" placeholder="' + esc(e.ph || "") + '"></textarea>';
    }
    if (e.tipo === "date") {
      return '<input id="' + e.id + '" type="date" min="' + S().hoyLocal() + '">';
    }
    if (e.tipo === "tel") {
      return '<div class="telfield">' +
        '<select id="bot-pais" aria-label="País del teléfono">' +
          S().PAISES.map(function (p) {
            return '<option value="' + p.id + '"' + (p.id === S().PAIS_DEF ? " selected" : "") + '>' +
              esc(p.nombre) + " +" + p.lada + "</option>";
          }).join("") +
        '</select>' +
        '<input id="' + e.id + '" type="tel" inputmode="tel" autocomplete="tel" placeholder="10 dígitos">' +
      '</div>';
    }
    return '<input id="' + e.id + '" type="' + e.tipo + '"' +
      (e.auto ? ' autocomplete="' + e.auto + '"' : "") +
      ' placeholder="' + esc(e.ph || "") + '">';
  }

  /* En modo libre el cuerpo es el hilo real del Store, no el guion. */
  function hiloRealHTML() {
    var u = S().sesion();
    var hilo = u ? S().conversacionDe(u.id) : [];
    if (!hilo.length) {
      return '<p class="bot__nota">Escribe lo que necesites. Un asesor te responde en menos de 24 horas hábiles.</p>';
    }
    return '<div class="bot__hilo">' + ui().hiloHTML(hilo) + '</div>';
  }

  function composerHTML() {
    var p = propiedadEnPantalla();
    var u = S().sesion();
    var mios = (u ? S().conversacionDe(u.id) : []).filter(function (m) { return m.de === "cliente"; });
    /* El atajo de avisar al equipo también vive aquí: si no, quien ya tenía
       conversación abierta se quedaba sin él. */
    var url = mios.length ? S().enlaceWaEquipo(mios[mios.length - 1]) : "";
    return '<div class="bot__campo">' +
      (errorActual ? '<p class="field__error">' + icon("alert", 16) + esc(errorActual) + '</p>' : "") +
      (p ? '<p class="bot__sobre">' + icon("pin", 13) + 'Sobre ' + esc(p.title) + '</p>' : "") +
      '<label class="sr-only" for="bot-chat">Escribir al equipo</label>' +
      '<textarea id="bot-chat" rows="2" placeholder="Escribe tu mensaje…"></textarea>' +
      '<div class="bot__accion">' +
        '<button class="btn btn--link btn--sm" data-bot="menu">Ver opciones</button>' +
        '<button class="btn btn--primary btn--sm" data-bot="chat-enviar">Enviar</button>' +
      '</div>' +
      (url
        ? '<a class="bot__aviso" data-bot="enlace" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
            icon("chat", 14) + 'Avisarles por WhatsApp' +
            '<span class="sr-only"> (se abre WhatsApp en otra pestaña)</span></a>'
        : "") +
    '</div>';
  }

  function pieHTML() {
    if (pensando) return '<p class="bot__espera" aria-hidden="true">…</p>';
    if (modo === "chat") return composerHTML();
    var def = PASOS[paso];
    if (def.entrada) {
      return '<div class="bot__campo">' +
        (errorActual ? '<p class="field__error">' + icon("alert", 16) + esc(errorActual) + '</p>' : "") +
        entradaHTML(def.entrada) +
        '<button class="btn btn--primary btn--block" data-bot="enviar">' + esc(def.entrada.boton) + '</button>' +
      '</div>';
    }
    var ops = valor(def.opciones) || [];
    return '<div class="bot__ops">' + ops.map(function (o, i) {
      if (o.enlace) {
        return '<a class="bot__op bot__op--wa" data-bot="enlace" href="' + esc(o.enlace) + '" ' +
          'target="_blank" rel="noopener noreferrer">' + icon("chat", 16) + esc(o.txt) +
          '<span class="sr-only"> (se abre WhatsApp en otra pestaña)</span></a>';
      }
      return '<button class="bot__op" data-bot="op" data-i="' + i + '">' + esc(o.txt) + '</button>';
    }).join("") + '</div>';
  }

  function cabezaHTML() {
    return '<div class="bot__head">' +
      '<span class="avatar" aria-hidden="true"><img src="assets/logo-mark-white.png" alt=""></span>' +
      '<div class="bot__quien">' +
        '<h2 id="chat-title">Asistente de Legato</h2>' +
        '<p>Respondo al instante · Un asesor contesta en menos de 24 h</p>' +
      '</div>' +
      '<button class="icon-btn" data-bot="cerrar" aria-label="Cerrar el asistente">' + icon("close", 22) + '</button>' +
    '</div>';
  }

  function pintar() {
    var cuerpo = caja.querySelector(".bot__body");
    var pie = caja.querySelector(".bot__foot");
    if (!cuerpo || !pie) return;
    cuerpo.innerHTML = (modo === "chat" && !pensando) ? hiloRealHTML() : burbujasHTML();
    pie.innerHTML = pieHTML();
    cuerpo.scrollTop = cuerpo.scrollHeight;
    if (pensando) return;
    if (modo === "chat") {
      var ta = document.getElementById("bot-chat");
      if (ta) ta.focus({ preventScroll: true });
      return;
    }
    var def = PASOS[paso];
    var foco = def.entrada ? document.getElementById(def.entrada.id) : pie.querySelector(".bot__op");
    if (foco) foco.focus({ preventScroll: true });
  }

  /* Se abre en la esquina, no como panel de pantalla completa: el sitio sigue
     ahí detrás y se puede seguir navegando con la conversación abierta. Por eso
     tampoco atrapa el foco ni oscurece el fondo —no es una ventana modal. */
  function abrir() {
    if (abierto) { cerrar(); return; }
    clearTimeout(tCerrar);
    hilo = [];
    datos = {};
    paso = "inicio";
    modo = "guion";
    abierto = true;
    caja.innerHTML = cabezaHTML() + '<div class="bot__body"></div><div class="bot__foot"></div>';
    caja.hidden = false;
    requestAnimationFrame(function () { caja.classList.add("is-open"); });
    pensar("inicio");          // también el saludo se hace esperar
    marcarBoton();
  }

  function cerrar(sinFoco) {
    if (!abierto) return;
    abierto = false;
    pensando = false;
    clearTimeout(tPensar);
    caja.classList.remove("is-open");
    clearTimeout(tCerrar);
    tCerrar = setTimeout(function () { caja.hidden = true; }, 240);
    marcarBoton();
    var b = document.getElementById("fab-chat");
    if (!sinFoco && b && !b.hidden) b.focus();
  }

  /* El lanzador es el mismo botón que cierra, como en cualquier widget de chat. */
  function marcarBoton() {
    var b = document.getElementById("fab-chat");
    if (!b) return;
    b.setAttribute("aria-expanded", String(abierto));
    b.classList.toggle("is-on", abierto);
    document.getElementById("fab-txt").textContent = abierto ? "Cerrar" : "¿Te ayudo?";
    document.getElementById("fab-ico").innerHTML = abierto
      ? icon("close", 22)
      : icon("chat", 22);
  }

  /* ============================== lanzador ============================== */

  /* El botón no existe para la cuenta del equipo: el asesor no se escribe a sí mismo. */
  function sincronizarBoton() {
    if (!ACTIVO) return;
    var b = document.getElementById("fab-chat");
    if (!b) return;
    b.hidden = S().esAdmin();
    document.body.classList.toggle("has-fab", !b.hidden);
    if (b.hidden && abierto) cerrar(true);
  }

  function montar() {
    if (!ACTIVO) return;
    caja = document.getElementById("chat");
    var b = document.getElementById("fab-chat");
    if (b) b.addEventListener("click", abrir);

    caja.addEventListener("click", function (e) {
      var t = e.target.closest("[data-bot]");
      if (!t) return;
      var que = t.getAttribute("data-bot");
      if (que === "enlace") return;      // es un enlace de verdad: que lo abra el navegador
      e.preventDefault();
      if (que === "op") elegir(Number(t.getAttribute("data-i")));
      else if (que === "cerrar") cerrar();
      else if (que === "chat-enviar") enviarLibre();
      else if (que === "menu") { modo = "guion"; hilo = []; pensar("inicio"); }
      else responder();
    });

    caja.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); cerrar(); return; }
      /* Enter manda la respuesta, salvo en el área de texto larga. */
      if (e.key !== "Enter" || e.shiftKey || e.target.tagName === "TEXTAREA") return;
      if (modo === "chat" || !PASOS[paso].entrada) return;
      e.preventDefault();
      responder();
    });

    /* Abrir un panel del sitio (filtros, registro) tapa el asistente: que se
       quite solo en vez de quedar debajo. */
    document.addEventListener("click", function (e) {
      if (!abierto) return;
      var t = e.target.closest("[data-action]");
      if (!t || caja.contains(t)) return;
      var a = t.getAttribute("data-action");
      if (a === "filters-open" || a === "login" || a === "signup" || a === "contact" || a === "visita") cerrar(true);
    });

    sincronizarBoton();
    marcarBoton();
  }

  window.Bot = { montar: montar, abrir: abrir, sincronizar: sincronizarBoton };
})();
