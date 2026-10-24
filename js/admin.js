/* Legato Capital — panel de administración.
 * Vive en #/admin. Tres secciones: Interesados (Kanban), Propiedades y Actividad.
 * Toda la persistencia pasa por Store; aquí solo hay vistas y eventos.
 */
(function () {
  "use strict";

  var UI = null;                       // se resuelve al primer uso (app.js lo publica)
  function ui() { return UI || (UI = window.LegatoUI); }
  function esc(s) { return ui().esc(s); }
  function icon(n, s) { return ui().icon(n, s); }

  var leadAbierto = null;
  var arrastrando = null;

  function dinero(n) {
    if (!n) return "—";
    return "$" + Number(n).toLocaleString("en-US") + " MXN";
  }
  function fecha(iso) {
    try {
      return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return ""; }
  }
  function fechaHora(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) + " · " +
             d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  var ACTO = { guardado: "Guardó", compartido: "Compartió", contacto: "Escribió", visita: "Pidió visita" };
  function acto(t) { return ACTO[t] || t; }

  /* El día de una visita se guarda como AAAA-MM-DD. Pasarlo por Date lo correría
     de zona horaria y mostraría el día anterior. */
  function fechaDia(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    try {
      return new Date(p[0], Number(p[1]) - 1, p[2])
        .toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
    } catch (e) { return iso; }
  }
  function etiqueta(lista, id) {
    var x = (window.Store[lista] || []).filter(function (o) { return o.id === id; })[0];
    return x ? x.label : id;
  }
  function horaLabel(id) { return etiqueta("HORARIOS", id); }
  function canalLabel(id) { return etiqueta("CANALES", id); }

  function tituloDe(slug) {
    var p = window.Store.catalogoCompleto().filter(function (x) { return x.slug === slug; })[0];
    return p ? p.title + " · " + p.zona : slug;
  }

  /* ============================== Kanban ============================== */

  function tarjetaLead(l) {
    var S = window.Store;
    var act = S.actividadDe(l.usuarioId);
    var nuevos = S.sinLeerDe(l.id);
    var ultimo = S.ultimoMensaje(l.id);
    var visita = S.visitaPendiente(l.id);
    var nMsj = S.conversacion(l.id).length;

    /* Lo que manda en la tarjeta es lo último que pasó: si escribió, eso;
       si no, la última nota interna. */
    var asomo = ultimo
      ? '<p class="kcard__note' + (nuevos ? " kcard__note--nuevo" : "") + '">' +
          icon(ultimo.tipo === "visita" ? "calendar" : "chat", 13) +
          '<span>' + (ultimo.de === "equipo" ? "Tú: " : "") +
          esc(ultimo.tipo === "visita" && !ultimo.texto
            ? "Pidió visita el " + fechaDia(ultimo.dia)
            : ultimo.texto) + '</span></p>'
      : (l.seguimiento && l.seguimiento.length
          ? '<p class="kcard__note">' + icon("note", 13) + '<span>' + esc(l.seguimiento[0].texto) + '</span></p>'
          : "");

    return '<article class="kcard' + (nuevos ? " kcard--nuevo" : "") + '" draggable="true" data-lead="' + esc(l.id) + '" tabindex="0" role="button" ' +
        'aria-label="Abrir ficha de ' + esc(l.nombre) + (nuevos ? ", " + nuevos + " sin leer" : "") + '">' +
      '<p class="kcard__name">' + esc(l.nombre) +
        (nuevos ? ' <span class="kcard__nuevo">' + nuevos + ' sin leer</span>' : "") +
        (l.ejemplo ? ' <span class="kcard__tag">ejemplo</span>' : "") + '</p>' +
      (l.empresa ? '<p class="kcard__meta">' + esc(l.empresa) + '</p>' : "") +
      '<p class="kcard__meta">' + esc(S.telMostrar(l) || "sin teléfono") + '</p>' +
      (l.presupuesto ? '<p class="kcard__budget">' + esc(dinero(l.presupuesto)) + '</p>' : "") +
      (visita ? '<p class="kcard__cita">' + icon("calendar", 13) +
        'Visita por confirmar · ' + esc(fechaDia(visita.dia)) + '</p>' : "") +
      asomo +
      '<div class="kcard__foot">' +
        '<span>' + nMsj + (nMsj === 1 ? " mensaje" : " mensajes") +
          ' · ' + (l.seguimiento || []).length + ((l.seguimiento || []).length === 1 ? " nota" : " notas") +
          ' · ' + act.length + (act.length === 1 ? " interacción" : " interacciones") + '</span>' +
        '<span>' + esc(fecha(l.actualizado)) + '</span>' +
      '</div>' +
      // Alternativa táctil y de teclado al arrastre
      '<label class="kcard__move"><span class="sr-only">Mover ' + esc(l.nombre) + ' a otra etapa</span>' +
        '<select data-move="' + esc(l.id) + '">' +
          window.Store.ETAPAS.map(function (e) {
            return '<option value="' + e.id + '"' + (e.id === l.etapa ? " selected" : "") + '>' + esc(e.label) + "</option>";
          }).join("") +
        '</select></label>' +
    '</article>';
  }

  function vistaKanban() {
    var leads = window.Store.leads();
    /* Seis columnas diciendo "Sin interesados" no enseñan nada que una frase no
       diga mejor. El tablero aparece cuando hay a quién mover. */
    if (!leads.length) {
      return ui().vacioHTML("Todavía no hay interesados.",
        "Cuando alguien cree su cuenta o pida información desde una propiedad, su ficha entra aquí " +
        "y se puede mover entre las seis etapas.",
        [{ txt: "Ver las propiedades publicadas", accion: "perfil-tab", tab: "propiedades" }]);
    }
    return '<div class="kanban" role="list">' + window.Store.ETAPAS.map(function (e) {
      var col = leads.filter(function (l) { return l.etapa === e.id; });
      return '<section class="kcol" data-etapa="' + e.id + '" role="listitem">' +
        '<header class="kcol__head"><h2>' + esc(e.label) + '</h2><span class="kcol__count">' + col.length + '</span></header>' +
        '<div class="kcol__body" data-drop="' + e.id + '">' +
          (col.length ? col.map(tarjetaLead).join("") : '<p class="kcol__empty">Sin interesados</p>') +
        '</div>' +
      '</section>';
    }).join("") + '</div>';
  }

  /* ========================= conversación ============================= */
  /* El mismo hilo que el cliente ve en su perfil. Aquí se responde, y desde
     aquí se confirma una visita —lo único que mueve la ficha de etapa sola. */

  function conversacionHTML(l, primero) {
    var S = window.Store;
    var hilo = S.conversacion(l.id);
    var visita = S.visitaPendiente(l.id);
    var tel = String(l.telefono || "").replace(/\D/g, "");

    var directo = '<div class="chat__directo">' +
      (tel ? '<a class="btn btn--quiet btn--sm" href="tel:' + esc(S.telE164(l)) + '">' + icon("phone", 15) + 'Llamar</a>' +
             '<a class="btn btn--quiet btn--sm" href="https://wa.me/' + esc(S.telWa(l)) + '" target="_blank" rel="noopener noreferrer">' +
               'WhatsApp' + (S.waPropio(l) ? ' · ' + esc(S.waMostrar(l)) : "") + '</a>' : "") +
      (l.correo ? '<a class="btn btn--quiet btn--sm" href="mailto:' + esc(l.correo) + '">' + icon("mail", 15) + 'Correo</a>' : "") +
    '</div>';

    return '<div class="admin-block' + (primero ? " admin-block--primero" : "") + '">' +
      '<h3>Conversación (' + hilo.length + ')</h3>' +
      directo +
      (visita
        ? '<div class="citabox">' +
            '<p class="citabox__t">' + icon("calendar", 16) + 'Visita por confirmar</p>' +
            '<p class="citabox__d"><strong>' + esc(fechaDia(visita.dia)) + '</strong>, ' + esc(horaLabel(visita.hora)) +
              ' · ' + esc(tituloDe(visita.slug)) + '</p>' +
            '<p class="small">Prefiere que le contesten por ' + esc(canalLabel(visita.canal).toLowerCase()) + '.</p>' +
            '<button class="btn btn--primary btn--sm" data-action="visita-ok" data-msj="' + esc(visita.id) + '">' +
              'Confirmar visita</button>' +
          '</div>'
        : "") +
      (hilo.length
        ? '<ol class="chat chat--admin">' + hilo.map(burbujaHTML).join("") + '</ol>'
        : '<p class="small" style="color:var(--text-secondary);margin-top:12px">Todavía no hay mensajes con esta persona.</p>') +
      '<div class="notafrm">' +
        '<label class="sr-only" for="lf-chat">Responder al cliente</label>' +
        '<textarea id="lf-chat" rows="2" placeholder="Responder a ' + esc(l.nombre.split(" ")[0]) + '…"></textarea>' +
        '<button class="btn btn--primary btn--sm" data-action="chat-equipo" data-lead="' + esc(l.id) + '">Responder</button>' +
      '</div>' +
    '</div>';
  }

  function burbujaHTML(m) {
    var delEquipo = m.de === "equipo";
    return '<li class="chat__msg chat__msg--' + (delEquipo ? "propio" : "otro") + '">' +
      '<div class="chat__burbuja">' +
        (m.tipo === "visita"
          ? '<p class="chat__cita">' + icon("calendar", 15) + 'Visita · ' + esc(fechaDia(m.dia)) + ', ' + esc(horaLabel(m.hora)) +
            (m.confirmada ? ' · confirmada' : ' · por confirmar') + '</p>'
          : "") +
        (m.slug ? '<p class="chat__sobre">' + esc(tituloDe(m.slug)) + '</p>' : "") +
        (m.texto ? '<p>' + esc(m.texto) + '</p>' : "") +
      '</div>' +
      '<p class="chat__pie">' + (delEquipo ? "Equipo" : "Cliente") + ' · ' + esc(fechaHora(m.fecha)) +
        (m.canal && !delEquipo ? ' · prefiere ' + esc(canalLabel(m.canal).toLowerCase()) : "") + '</p>' +
    '</li>';
  }

  /* =========================== ficha de lead ========================== */

  function fichaLead(l) {
    var S = window.Store;
    var act = S.actividadDe(l.usuarioId);
    return '' +
    '<div class="sheet__head">' +
      '<h2 id="sheet-title">' + esc(l.nombre) + '</h2>' +
      '<button class="icon-btn" data-action="sheet-close" aria-label="Cerrar ficha">' + icon("close", 22) + '</button>' +
    '</div>' +
    '<div class="sheet__body">' +
      conversacionHTML(l, true) +

      '<div class="admin-block">' +
        '<h3>Datos del interesado</h3>' +
      '<form id="lead-form" data-lead="' + esc(l.id) + '" style="display:grid;gap:16px">' +
        '<div class="field"><label for="lf-nombre">Nombre completo</label>' +
          '<input id="lf-nombre" name="nombre" value="' + esc(l.nombre) + '"></div>' +
        '<div class="pair">' +
          '<div class="field"><label for="lf-tel">Teléfono</label>' +
            '<div class="telfield">' +
              '<select id="lf-pais" name="pais" aria-label="País del teléfono">' +
                window.Store.PAISES.map(function (p) {
                  return '<option value="' + p.id + '"' + (p.id === window.Store.paisDe(l.pais).id ? " selected" : "") + '>' +
                    esc(p.nombre) + " +" + p.lada + "</option>";
                }).join("") +
              '</select>' +
              '<input id="lf-tel" name="telefono" inputmode="tel" value="' + esc(l.telefono) + '">' +
            '</div></div>' +
          '<div class="field"><label for="lf-etapa">Etapa</label>' +
            '<select id="lf-etapa" name="etapa">' + window.Store.ETAPAS.map(function (e) {
              return '<option value="' + e.id + '"' + (e.id === l.etapa ? " selected" : "") + '>' + esc(e.label) + "</option>";
            }).join("") + '</select></div>' +
        '</div>' +
        '<div class="field"><label for="lf-wa">WhatsApp' +
          (S.waPropio(l) ? "" : ' <span class="small" style="font-weight:400;color:var(--text-secondary)">(usa el teléfono)</span>') + '</label>' +
          '<div class="telfield">' +
            '<select id="lf-wapais" name="paisWa" aria-label="País del WhatsApp">' +
              window.Store.PAISES.map(function (p) {
                return '<option value="' + p.id + '"' + (p.id === window.Store.paisDe(l.paisWa || l.pais).id ? " selected" : "") + '>' +
                  esc(p.nombre) + " +" + p.lada + "</option>";
              }).join("") +
            '</select>' +
            '<input id="lf-wa" name="whatsapp" inputmode="tel" value="' + esc(l.whatsapp || "") + '" placeholder="' + esc(l.telefono) + '">' +
          '</div></div>' +
        '<div class="field"><label for="lf-correo">Correo</label>' +
          '<input id="lf-correo" name="correo" type="email" value="' + esc(l.correo) + '"></div>' +
        '<div class="field"><label for="lf-correos">Otros correos</label>' +
          '<input id="lf-correos" name="correosExtra" value="' + esc(l.correosExtra || "") + '" placeholder="Separados por coma"></div>' +
        '<div class="pair">' +
          '<div class="field"><label for="lf-pres">Presupuesto (MXN)</label>' +
            '<input id="lf-pres" name="presupuesto" inputmode="numeric" value="' + (l.presupuesto ? Number(l.presupuesto).toLocaleString("en-US") : "") + '" placeholder="Sin definir"></div>' +
          '<div class="field"><label for="lf-emp">Empresa u ocupación</label>' +
            '<input id="lf-emp" name="empresa" value="' + esc(l.empresa || "") + '"></div>' +
        '</div>' +
      '</form>' +
      '</div>' +


      '<div class="admin-block">' +
        '<h3>Seguimiento (' + (l.seguimiento || []).length + ')</h3>' +
        '<p class="small" style="color:var(--text-secondary);margin:-4px 0 8px">Notas internas. El cliente no las ve.</p>' +
        '<div class="notafrm">' +
          '<label class="sr-only" for="lf-nota">Nueva nota de seguimiento</label>' +
          '<textarea id="lf-nota" rows="2" placeholder="Qué se habló, qué se acordó, siguiente paso…"></textarea>' +
          '<button class="btn btn--primary btn--sm" data-action="nota-add" data-lead="' + esc(l.id) + '">Agregar nota</button>' +
        '</div>' +
        ((l.seguimiento || []).length
          ? '<ol class="notas">' + l.seguimiento.map(function (n) {
              return '<li class="nota">' +
                '<div class="nota__head"><time>' + esc(fechaHora(n.fecha)) + '</time>' +
                  '<button class="nota__x" data-action="nota-del" data-lead="' + esc(l.id) + '" data-nota="' + esc(n.id) + '" ' +
                    'aria-label="Eliminar nota del ' + esc(fechaHora(n.fecha)) + '">Eliminar</button></div>' +
                '<p>' + esc(n.texto) + '</p>' +
              '</li>';
            }).join("") + '</ol>'
          : '<p class="small" style="color:var(--text-secondary);margin-top:12px">Sin notas todavía.</p>') +
      '</div>' +

      '<div class="admin-block">' +
        '<h3>Origen</h3>' +
        '<p class="small">' + (l.origen ? esc(tituloDe(l.origen)) : "Registro directo, sin propiedad de origen.") + '</p>' +
        '<p class="small" style="color:var(--text-secondary)">Alta: ' + esc(fecha(l.alta)) + '</p>' +
      '</div>' +

      '<div class="admin-block">' +
        '<h3>Actividad (' + act.length + ')</h3>' +
        (act.length
          ? '<ul class="actlist">' + act.map(function (a) {
              return '<li><span class="actlist__tipo actlist__tipo--' + a.tipo + '">' + esc(acto(a.tipo)) + '</span> ' +
                esc(tituloDe(a.slug)) + ' <time>' + esc(fecha(a.fecha)) + '</time></li>';
            }).join("") + '</ul>'
          : '<p class="small" style="color:var(--text-secondary)">Sin guardados ni compartidas todavía.</p>') +
      '</div>' +
    '</div>' +
    '<div class="sheet__foot">' +
      '<button class="btn btn--link" data-action="lead-delete" data-lead="' + esc(l.id) + '">Eliminar</button>' +
      '<button class="btn btn--primary" data-action="lead-save">Guardar cambios</button>' +
    '</div>';
  }

  /* ========================== disponibilidad ========================== */
  /* La agenda del equipo manda sobre lo que el cliente puede elegir al pedir
     una visita: lo que no esté marcado aquí, allá no aparece. */

  var borradorAgenda = null;

  function agendaBorrador() {
    if (!borradorAgenda) {
      borradorAgenda = {};
      var a = window.Store.agenda();
      window.Store.DIAS.forEach(function (d) { borradorAgenda[d.id] = (a[d.id] || []).slice(); });
    }
    return borradorAgenda;
  }

  /* El botón de guardar refleja si el borrador difiere de lo guardado. */
  function pintarGuardarAgenda() {
    var b = document.querySelector('[data-action="agenda-save"]');
    if (!b) return;
    var sucio = JSON.stringify(normalizar(agendaBorrador())) !== JSON.stringify(normalizar(window.Store.agenda()));
    b.disabled = !sucio;
    b.textContent = sucio ? "Guardar horarios" : "Sin cambios";
  }
  /* Comparar sin que el orden de los bloques cuente como un cambio. */
  function normalizar(a) {
    var out = {};
    window.Store.DIAS.forEach(function (d) {
      out[d.id] = ((a && a[d.id]) || []).slice().sort();
    });
    return out;
  }

  function vistaDisponibilidad() {
    var S = window.Store;
    var a = agendaBorrador();
    var sucio = JSON.stringify(normalizar(a)) !== JSON.stringify(normalizar(S.agenda()));

    var rejilla = '<div class="agenda">' +
      '<div class="agenda__fila agenda__fila--head">' +
        '<span></span>' + S.HORARIOS.map(function (h) {
          return '<span class="agenda__hora">' + esc(h.label) + '</span>';
        }).join("") +
      '</div>' +
      S.DIAS.slice(1).concat([S.DIAS[0]]).map(function (d) {
        var ids = a[d.id] || [];
        return '<div class="agenda__fila">' +
          '<span class="agenda__dia">' + esc(d.label) + '</span>' +
          S.HORARIOS.map(function (h) {
            var on = ids.indexOf(h.id) >= 0;
            return '<button type="button" class="agenda__celda' + (on ? " is-on" : "") + '" ' +
              'data-action="agenda-toggle" data-dia="' + d.id + '" data-hora="' + h.id + '" ' +
              'aria-pressed="' + on + '">' +
              '<span class="sr-only">' + esc(d.label + ", " + h.label) + '</span>' +
              (on ? icon("check", 15) : "") + '</button>';
          }).join("") +
        '</div>';
      }).join("") +
    '</div>';

    return '<section class="admin-seccion">' +
      '<div class="admin-bar">' +
        '<div><h2 class="admin-seccion__t">Horarios de visita</h2>' +
          '<p class="small" style="color:var(--text-secondary)">Marca cuándo pueden agendarse visitas. ' +
          'Lo que apagues aquí deja de aparecerle al cliente.</p></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--quiet btn--sm" data-action="agenda-reset">Restablecer</button>' +
          '<button class="btn btn--primary btn--sm" data-action="agenda-save"' + (sucio ? "" : " disabled") + '>' +
            (sucio ? "Guardar horarios" : "Sin cambios") + '</button>' +
        '</div>' +
      '</div>' +
      rejilla +
      (S.agendaAbierta()
        ? '<p class="agenda__resumen">' + icon("clock", 15) + esc(S.agendaEnPalabras()) + '</p>'
        : '<p class="agenda__resumen agenda__resumen--alerta">' + icon("alert", 15) +
          'Sin ningún bloque marcado, nadie puede pedir una visita: la opción desaparece del sitio.</p>') +
    '</section>' +
    vistaGoogle();
  }

  function vistaGoogle() {
    var S = window.Store;
    var g = S.google();
    var listo = window.GoogleCal.configurado();

    /* Una conexión guardada es un hecho: se muestra aunque falte el ID, para
       poder al menos desconectarla. */
    var cuerpo;
    if (!listo && !g) {
      cuerpo = '<div class="gcal__aviso">' +
        '<p><strong>Falta configurar el acceso a Google.</strong> Es un trámite de una sola vez:</p>' +
        '<ol class="gcal__pasos">' + window.GoogleCal.instrucciones.map(function (t) {
          return "<li>" + esc(t) + "</li>";
        }).join("") + '</ol>' +
      '</div>';
    } else if (!g) {
      cuerpo = '<p class="small" style="color:var(--text-secondary)">Ningún calendario conectado. ' +
        'Al conectar uno, cada visita que confirmes se escribe ahí.</p>' +
        '<button class="btn btn--primary btn--sm" data-action="google-conectar">Conectar calendario</button>';
    } else {
      cuerpo = '<div class="gcal__estado">' +
        '<p class="gcal__cuenta">' + icon("check", 16) + esc(g.cuenta) + '</p>' +
        (listo ? "" : '<p class="field__error">' + icon("alert", 16) +
          'Falta el ID de cliente en js/google.js: la conexión quedó guardada pero no puede escribir.</p>') +
        '<div class="field"><label for="gc-cal">Calendario donde se escriben las visitas</label>' +
          '<select id="gc-cal" data-action="google-calendario">' +
            (g.calendarios || [{ id: g.calendario, nombre: g.calendarioNombre }]).map(function (c) {
              return '<option value="' + esc(c.id) + '"' + (c.id === g.calendario ? " selected" : "") + '>' +
                esc(c.nombre || c.id) + "</option>";
            }).join("") +
          '</select></div>' +
        '<p class="small" style="color:var(--text-secondary)">Conectado el ' + esc(fecha(g.desde)) + '.</p>' +
        '<button class="btn btn--quiet btn--sm" data-action="google-desconectar">Desconectar</button>' +
      '</div>';
    }

    return '<section class="admin-seccion">' +
      '<h2 class="admin-seccion__t">Google Calendar</h2>' +
      '<p class="small" style="color:var(--text-secondary);margin-bottom:12px">' +
        'Conecta una cuenta de Google para que las visitas confirmadas aparezcan en su calendario.</p>' +
      cuerpo +
    '</section>';
  }

  /* ============================== bandeja ============================= */
  /* Una fila por cliente, no por mensaje: tres peticiones de la misma persona
     siguen siendo una conversación. Es el Kanban ordenado por lo último que
     pasó en vez de por etapa, y abre exactamente la misma ficha. */

  var filtroMsj = "todos";
  var FILTROS = [
    { id: "todos", label: "Todas" },
    { id: "nuevos", label: "Sin leer" },
    { id: "visitas", label: "Visitas por confirmar" }
  ];

  function vistaBandeja() {
    var S = window.Store;
    var todas = S.bandeja();
    var filas = todas.filter(function (h) {
      if (filtroMsj === "nuevos") return h.sinLeer > 0;
      if (filtroMsj === "visitas") return !!S.visitaPendiente(h.leadId);
      return true;
    });

    var cuenta = {
      todos: todas.length,
      nuevos: todas.filter(function (h) { return h.sinLeer > 0; }).length,
      visitas: todas.filter(function (h) { return !!S.visitaPendiente(h.leadId); }).length
    };

    var barra = '<div class="chiprow" aria-label="Filtrar conversaciones">' +
      FILTROS.map(function (f) {
        return '<button class="chip' + (filtroMsj === f.id ? " is-on" : "") + '" data-action="msj-filtro" ' +
          'data-filtro="' + f.id + '" aria-pressed="' + (filtroMsj === f.id) + '">' +
          esc(f.label) + ' <span class="filterbtn__count">' + cuenta[f.id] + '</span></button>';
      }).join("") + '</div>';

    if (!filas.length) {
      return barra + '<div class="state"><h3>' +
        (filtroMsj === "todos" ? "Todavía nadie ha escrito."
         : filtroMsj === "nuevos" ? "No queda nada sin leer."
         : "No hay visitas por confirmar.") + '</h3>' +
        '<p>' + (filtroMsj === "todos"
          ? "Cuando alguien pida información o una visita desde una propiedad, su conversación aparece aquí y su ficha entra al Kanban."
          : "Cambia el filtro para ver el resto de las conversaciones.") + '</p>' +
        (filtroMsj === "todos" ? "" : '<button class="btn btn--secondary" data-action="msj-filtro" data-filtro="todos">Ver todas</button>') +
        '</div>';
    }

    return barra + '<ul class="bandeja">' + filas.map(filaBandeja).join("") + '</ul>';
  }

  function filaBandeja(h) {
    var l = h.lead;
    var m = h.ultimo;
    var etapa = etiqueta("ETAPAS", l.etapa);
    var visita = window.Store.visitaPendiente(l.id);
    return '<li><button class="bandeja__fila' + (h.sinLeer ? " is-nuevo" : "") + '" data-action="msj-open" data-lead="' + esc(l.id) + '">' +
      '<span class="bandeja__punto" aria-hidden="true"></span>' +
      '<span class="bandeja__cuerpo">' +
        '<span class="bandeja__alto">' +
          '<strong>' + esc(l.nombre) + '</strong>' +
          '<span class="bandeja__etapa">' + esc(etapa) + '</span>' +
          (h.sinLeer ? '<span class="kcard__nuevo">' + h.sinLeer + ' sin leer</span>' : "") +
          (visita ? '<span class="bandeja__visita">' + icon("calendar", 12) + esc(fechaDia(visita.dia)) + '</span>' : "") +
        '</span>' +
        (m.slug ? '<span class="bandeja__sobre">' + esc(tituloDe(m.slug)) + '</span>' : "") +
        '<span class="bandeja__texto">' + (m.de === "equipo" ? "Tú: " : "") +
          esc(m.texto || (m.tipo === "visita" ? "Pidió visita el " + fechaDia(m.dia) + ", " + horaLabel(m.hora) : "")) + '</span>' +
      '</span>' +
      '<span class="bandeja__fecha">' + esc(fechaHora(m.fecha)) + '</span>' +
    '</button></li>';
  }

  /* ============================ propiedades =========================== */

  /* Lo primero que tiene que saber quien publica: si lo que sube lo verá
     alguien más, o solo él. */
  function bandaNube() {
    var S = window.Store;
    if (S.nubeViva()) {
      return '<p class="nube nube--viva">' + icon("check", 15) +
        'Conectado al servidor: lo que publiques se ve en el sitio al instante, desde cualquier dispositivo.</p>';
    }
    return '<div class="nube nube--falta">' +
      '<p><strong>Lo que publiques aquí solo lo verás tú.</strong> Sin servidor, las propiedades y sus ' +
      'fotos se guardan en este navegador: nadie más las ve y a las doce se llena la cuota.</p>' +
      '<ol class="gcal__pasos">' + (window.Nube ? window.Nube.pasos : []).map(function (t) {
        return "<li>" + esc(t) + "</li>";
      }).join("") + '</ol>' +
    '</div>';
  }

  function vistaPropiedades() {
    var props = window.Store.catalogoCompleto();
    if (!props.length) {
      return bandaNube() + ui().vacioHTML("No hay propiedades publicadas.",
        "Publica la primera y aparece en el sitio al instante: en el catálogo, en el buscador y en la portada.",
        [{ txt: "Publicar propiedad", accion: "prop-new" }]);
    }
    return bandaNube() + '<div class="admin-bar">' +
        '<p class="small">' + props.length + ' propiedades publicadas</p>' +
        '<button class="btn btn--primary btn--sm" data-action="prop-new">Publicar propiedad</button>' +
      '</div>' +
      '<div class="admin-table" role="table">' +
        '<div class="admin-row admin-row--head" role="row">' +
          '<span role="columnheader">Propiedad</span><span role="columnheader">Operación</span>' +
          '<span role="columnheader">Precio</span><span role="columnheader">Interés</span><span></span>' +
        '</div>' +
        props.map(function (p) {
          var act = window.Store.actividadDeSlug(p.slug);
          var g = act.filter(function (a) { return a.tipo === "guardado"; }).length;
          var c = act.filter(function (a) { return a.tipo === "compartido"; }).length;
          var msj = act.filter(function (a) { return a.tipo === "contacto" || a.tipo === "visita"; }).length;
          return '<div class="admin-row" role="row">' +
            '<span role="cell"><strong>' + esc(p.title) + '</strong>' + (p.exclusiva ? ' <span class="kcard__tag">anticipada</span>' : "") +
              '<br><span class="small" style="color:var(--text-secondary)">' + esc(p.tipo) + ' · ' + esc(p.condicion || "—") + ' · ' + esc(p.zona) + '</span></span>' +
            '<span role="cell">' + (p.op === "renta" ? "Renta" : "Venta") + (p.negociable ? '<br><span class="small" style="color:var(--text-secondary)">negociable</span>' : "") + '</span>' +
            '<span role="cell">' + esc(dinero(p.price)) + '</span>' +
            '<span role="cell">' + g + ' guard. · ' + c + ' comp. · ' + msj + ' msj.</span>' +
            '<span role="cell" style="display:flex;gap:4px;justify-content:flex-end">' +
              '<button class="btn btn--quiet btn--sm" data-action="prop-edit" data-slug="' + esc(p.slug) + '">Editar</button>' +
              '<button class="btn btn--link" data-action="prop-del" data-slug="' + esc(p.slug) + '">Quitar</button>' +
            '</span>' +
          '</div>';
        }).join("") +
      '</div>';
  }

  function formPropiedad(p) {
    p = p || { slug: "", op: "venta", tipo: "Casa", condicion: "Lista para habitar",
               negociable: false, exclusiva: false, fotos: [], fotosCount: 1 };
    var tipos = window.EL_CATALOG.tipos;
    var condiciones = window.EL_CATALOG.condiciones;
    var num = function (v) { return v || v === 0 ? v : ""; };
    return '' +
    '<div class="sheet__head">' +
      '<h2 id="sheet-title">' + (p.slug ? "Editar propiedad" : "Publicar propiedad") + '</h2>' +
      '<button class="icon-btn" data-action="sheet-close" aria-label="Cerrar">' + icon("close", 22) + '</button>' +
    '</div>' +
    '<div class="sheet__body">' +
      '<form id="prop-form" data-slug="' + esc(p.slug) + '" style="display:grid;gap:16px">' +
        '<div class="field"><label for="pf-title">Título</label>' +
          '<input id="pf-title" name="title" required value="' + esc(p.title || "") + '" placeholder="Casa para remodelar"></div>' +
        '<div class="field"><label for="pf-zona">Ubicación</label>' +
          '<input id="pf-zona" name="zona" required value="' + esc(p.zona || "") + '" placeholder="Condesa, Cuauhtémoc"></div>' +
        '<div class="pair">' +
          '<div class="field"><label for="pf-op">Operación</label><select id="pf-op" name="op">' +
            '<option value="venta"' + (p.op === "venta" ? " selected" : "") + '>Venta</option>' +
            '<option value="renta"' + (p.op === "renta" ? " selected" : "") + '>Renta</option></select></div>' +
          '<div class="field"><label for="pf-tipo">Tipo</label><select id="pf-tipo" name="tipo">' +
            tipos.map(function (t) { return '<option' + (p.tipo === t ? " selected" : "") + '>' + t + "</option>"; }).join("") +
          '</select></div>' +
        '</div>' +
        '<div class="pair">' +
          '<div class="field"><label for="pf-price">Precio (MXN)</label>' +
            '<input id="pf-price" name="price" inputmode="numeric" required value="' + (p.price ? Number(p.price).toLocaleString("en-US") : "") + '"></div>' +
          '<div class="field"><label for="pf-cond">Condición</label><select id="pf-cond" name="condicion">' +
            condiciones.map(function (c) { return '<option' + (p.condicion === c ? " selected" : "") + '>' + c + "</option>"; }).join("") +
          '</select></div>' +
        '</div>' +
        '<div class="pair">' +
          '<div class="field"><label for="pf-terreno">Terreno (m²)</label>' +
            '<input id="pf-terreno" name="terreno" inputmode="numeric" value="' + num(p.terreno) + '"></div>' +
          '<div class="field"><label for="pf-const">Construido (m²)</label>' +
            '<input id="pf-const" name="construido" inputmode="numeric" value="' + num(p.construido) + '"></div>' +
        '</div>' +
        '<div class="pair">' +
          '<div class="field"><label for="pf-frente">Frente</label>' +
            '<input id="pf-frente" name="frente" value="' + esc(p.frente || "") + '" placeholder="10 m"></div>' +
          '<div class="field"><label for="pf-rec">Recámaras</label>' +
            '<input id="pf-rec" name="rec" inputmode="numeric" value="' + num(p.rec) + '"></div>' +
        '</div>' +
        '<div class="pair">' +
          '<div class="field"><label for="pf-ban">Baños</label>' +
            '<input id="pf-ban" name="ban" inputmode="numeric" value="' + num(p.ban) + '"></div>' +
          '<div class="field"><label for="pf-autos">Estacionamientos</label>' +
            '<input id="pf-autos" name="autos" inputmode="numeric" value="' + num(p.autos) + '"></div>' +
        '</div>' +
        '<div class="switch"><label for="pf-negociable">El precio es negociable</label>' +
          '<input type="checkbox" id="pf-negociable" name="negociable"' + (p.negociable ? " checked" : "") + '></div>' +
        '<div class="switch"><label for="pf-exclusiva">Oportunidad con acceso anticipado</label>' +
          '<input type="checkbox" id="pf-exclusiva" name="exclusiva"' + (p.exclusiva ? " checked" : "") + '></div>' +
        '<div class="field"><label for="pf-desc">Descripción</label>' +
          '<textarea id="pf-desc" name="desc" rows="3">' + esc(p.desc || "") + '</textarea></div>' +
        '<div class="field"><label for="pf-pot">¿Por qué tiene potencial?</label>' +
          '<textarea id="pf-pot" name="potencial" rows="3" placeholder="Posibilidades de intervención, sujetas a normativa."></textarea></div>' +
        '<div class="field"><label for="pf-maps">Enlace de Google Maps (opcional)</label>' +
          '<input id="pf-maps" name="maps" value="' + esc(p.maps || "") + '" placeholder="https://maps.app.goo.gl/…"></div>' +
        '<div class="field"><label for="pf-fotos">Fotografías (hasta ' + (window.Store.nubeViva() ? 8 : 4) + ')</label>' +
          '<input id="pf-fotos" name="fotos" type="file" accept="image/*" multiple>' +
          '<p class="small" style="color:var(--text-secondary)">' + (window.Store.nubeViva()
            ? 'Se reducen a 1600 px y se suben al servidor: las ve cualquiera que entre al sitio.'
            : 'Se reducen a 1200 px y se guardan solo en este navegador. Conecta la nube para que las vea alguien más.') + '</p>' +
          '<div class="thumbs" id="pf-thumbs"></div></div>' +
      '</form>' +
    '</div>' +
    '<div class="sheet__foot">' +
      '<button class="btn btn--link" data-action="sheet-close">Cancelar</button>' +
      '<button class="btn btn--primary" data-action="prop-save">' + (p.slug ? "Guardar" : "Publicar") + '</button>' +
    '</div>';
  }

  /* ============================= actividad ============================ */

  function vistaActividad() {
    var act = window.Store.actividad();
    if (!act.length) return ui().vacioHTML("Sin actividad todavía.",
      "Aquí aparece quién guarda, comparte, escribe o pide una visita, con fecha.");
    return '<div class="admin-table" role="table">' +
      '<div class="admin-row admin-row--head admin-row--act" role="row">' +
        '<span role="columnheader">Persona</span><span role="columnheader">Acción</span>' +
        '<span role="columnheader">Propiedad</span><span role="columnheader">Fecha</span>' +
      '</div>' +
      act.map(function (a) {
        return '<div class="admin-row admin-row--act" role="row">' +
          '<span role="cell"><strong>' + esc(a.nombre) + '</strong></span>' +
          '<span role="cell"><span class="actlist__tipo actlist__tipo--' + a.tipo + '">' + esc(acto(a.tipo)) + '</span></span>' +
          '<span role="cell">' + esc(tituloDe(a.slug)) + '</span>' +
          '<span role="cell">' + esc(fecha(a.fecha)) + '</span>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  /* Secciones que el perfil monta en sus pestañas (solo con bandera de admin). */
  function panel(seccion) {
    if (seccion === "disponibilidad") return vistaDisponibilidad();
    if (seccion === "mensajes") return vistaBandeja();
    if (seccion === "propiedades") return vistaPropiedades();
    if (seccion === "actividad") return vistaActividad();
    return '<div class="kanban-wrap">' + vistaKanban() + '</div>';
  }

  function conteos() {
    var S = window.Store;
    return {
      mensajes: S.bandeja().length,
      interesados: S.leads().length,
      propiedades: S.catalogoCompleto().length,
      actividad: S.actividad().length,
      sinLeer: S.sinLeer(),
      /* Solo las visitas de fichas que siguen existiendo: borrado el interesado,
         anunciar su visita pendiente es anunciar algo que ya no se puede atender. */
      visitas: S.mensajes().filter(function (m) {
        return m.tipo === "visita" && !m.confirmada && !!S.lead(m.leadId);
      }).length,
      nuevos: S.leads().filter(function (l) { return l.etapa === "nuevo"; }).length
    };
  }

  /* ============================== eventos ============================= */

  function leerForm(form) {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      d[el.name] = el.type === "checkbox" ? el.checked : el.value;
    });
    return d;
  }
  function soloNum(v) { return Number(String(v == null ? "" : v).replace(/[^0-9]/g, "")) || 0; }
  function slugify(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }

  var fotosPendientes = null;

  /* Igual que reducirImagen, pero devuelve un archivo para subirlo tal cual:
     mandar base64 al almacenamiento pesaría un tercio más. */
  function reducirArchivo(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var e = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * e);
          c.height = Math.round(img.height * e);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) {
            if (!b) return rej(new Error("No se pudo preparar la imagen."));
            res(new File([b], "foto.jpg", { type: "image/jpeg" }));
          }, "image/jpeg", 0.82);
        };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  function pintarSubiendo(nombre) {
    var box = document.getElementById("pf-thumbs");
    if (!box) return;
    box.insertAdjacentHTML("beforeend",
      '<span class="thumb thumb--subiendo" data-subiendo="1">' +
        '<span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="sr-only">Subiendo ' + esc(nombre) + '…</span></span>');
  }

  function reducirImagen(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * s);
          c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = rej;
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  function handle(action, target, event) {
    var S = window.Store;

    switch (action) {
      case "admin-reset":
        if (confirm("Esto borra los interesados, la actividad y las propiedades dadas de alta en este navegador, y repone los datos de ejemplo. ¿Continuar?")) {
          S.reiniciar(); ui().toast("Datos reiniciados."); ui().render();
        }
        return true;

      case "agenda-toggle": {
        /* Se toca la celda, no se redibuja el panel: marcar varias seguidas
           perdía todas menos la primera porque el re-render las desprendía. */
        var a = agendaBorrador();
        var d = target.getAttribute("data-dia"), h = target.getAttribute("data-hora");
        var on = (a[d] || []).indexOf(h) >= 0;
        a[d] = on ? a[d].filter(function (x) { return x !== h; }) : (a[d] || []).concat([h]);
        target.classList.toggle("is-on", !on);
        target.setAttribute("aria-pressed", String(!on));
        var etiqueta = target.querySelector(".sr-only");
        target.innerHTML = (etiqueta ? etiqueta.outerHTML : "") + (!on ? icon("check", 15) : "");
        pintarGuardarAgenda();
        return true;
      }
      case "agenda-save":
        S.guardarAgenda(agendaBorrador());
        borradorAgenda = null;
        ui().toast("Horarios guardados.");
        ui().render();
        return true;
      case "agenda-reset":
        borradorAgenda = null;
        agendaBorrador();
        ui().render();
        return true;

      case "google-conectar": {
        var btn = target;
        btn.disabled = true;
        btn.textContent = "Abriendo Google…";
        window.GoogleCal.conectar().then(function (g) {
          ui().toast("Calendario conectado: " + g.cuenta + ".");
          ui().render();
        }).catch(function (e) {
          ui().toast(e.message || "No se pudo conectar con Google.");
          ui().render();
        });
        return true;
      }
      case "google-desconectar":
        if (confirm("Las visitas que confirmes dejarán de escribirse en ese calendario. ¿Desconectar?")) {
          window.GoogleCal.desconectar().then(function () {
            ui().toast("Calendario desconectado.");
            ui().render();
          });
        }
        return true;

      case "msj-filtro":
        filtroMsj = target.getAttribute("data-filtro");
        ui().render();
        return true;

      case "msj-open": {
        var idb = target.getAttribute("data-lead");
        abrirFicha(idb);
        return true;
      }

      case "chat-equipo": {
        var idc = target.getAttribute("data-lead");
        var ta = document.getElementById("lf-chat");
        var txt = (ta && ta.value || "").trim();
        if (!txt) { if (ta) ta.focus(); return true; }
        guardarCamposFicha(idc);            // no perder lo capturado arriba
        S.responderMensaje(idc, txt);
        abrirFicha(idc);
        ui().toast("Respuesta enviada.");
        return true;
      }

      case "visita-ok": {
        var m = S.confirmarVisita(target.getAttribute("data-msj"));
        if (!m) return true;
        S.responderMensaje(m.leadId,
          "Visita confirmada para el " + fechaDia(m.dia) + ", de " + horaLabel(m.hora) + ". Te esperamos.");
        abrirFicha(m.leadId);
        ui().toast("Visita confirmada. La ficha pasó a Visita agendada.");
        escribirEnCalendario(m);
        return true;
      }

      case "lead-save": {
        var f = document.getElementById("lead-form");
        var d = leerForm(f);
        S.actualizarLead(f.getAttribute("data-lead"), {
          nombre: d.nombre, telefono: d.telefono, pais: d.pais, whatsapp: d.whatsapp, paisWa: d.paisWa, correo: d.correo, correosExtra: d.correosExtra,
          presupuesto: soloNum(d.presupuesto), empresa: d.empresa, etapa: d.etapa
        });
        ui().closeSheet(); ui().toast("Ficha actualizada."); ui().render();
        return true;
      }
      case "nota-add": {
        var idl = target.getAttribute("data-lead");
        var ta = document.getElementById("lf-nota");
        var txt = (ta && ta.value || "").trim();
        if (!txt) { if (ta) ta.focus(); return true; }
        guardarCamposFicha(idl);            // no perder lo escrito arriba al re-dibujar
        S.agregarNota(idl, txt);
        abrirFicha(idl);
        ui().toast("Nota agregada.");
        return true;
      }
      case "nota-del": {
        var idl2 = target.getAttribute("data-lead");
        guardarCamposFicha(idl2);
        S.borrarNota(idl2, target.getAttribute("data-nota"));
        abrirFicha(idl2);
        return true;
      }
      case "lead-delete": {
        var borrado = S.borrarLead(target.getAttribute("data-lead"));
        ui().closeSheet();
        ui().render();
        ui().toast("Eliminaste a " + (borrado ? borrado.nombre : "el interesado") + ".", {
          accion: "Deshacer",
          alTocar: function () { S.restaurarLead(borrado); ui().toast("Interesado restaurado."); ui().render(); }
        });
        return true;
      }

      case "prop-new":
        fotosPendientes = [];
        ui().openSheet(formPropiedad(null), montarFormProp);
        return true;
      case "prop-edit": {
        var p = S.catalogoCompleto().filter(function (x) { return x.slug === target.getAttribute("data-slug"); })[0];
        fotosPendientes = (p && p.fotos ? p.fotos.slice() : []);
        ui().openSheet(formPropiedad(p), function () {
          montarFormProp();
          var pot = document.getElementById("pf-pot");
          if (pot && p) pot.value = p.potencial || "";
        });
        return true;
      }
      case "prop-del": {
        var slugDel = target.getAttribute("data-slug");
        var copia = S.catalogoCompleto().filter(function (x) { return x.slug === slugDel; })[0];
        S.eliminarPropiedad(slugDel);
        ui().render();
        ui().toast("Retiraste " + (copia ? copia.title : "la propiedad") + ".", {
          accion: "Deshacer",
          alTocar: function () { S.guardarPropiedad(copia); ui().toast("Propiedad restaurada."); ui().render(); }
        });
        return true;
      }
      case "prop-save": {
        var avisoSlug = "";
        var form = document.getElementById("prop-form");
        if (!form.reportValidity()) return true;
        var v = leerForm(form);
        var slug = form.getAttribute("data-slug");
        if (!slug) {
          slug = slugify(v.title + "-" + v.zona.split(",")[0]);
          var base = slug, i = 2;
          // Un slug repetido pisaría otra propiedad sin avisar.
          while (S.existeSlug(slug)) { slug = base + "-" + i; i++; }
          if (slug !== base) avisoSlug = " Ya había una con ese nombre y zona: se publicó como " + slug + ".";
        }
        var fotos = fotosPendientes || [];
        S.guardarPropiedad({
          slug: slug, op: v.op, tipo: v.tipo, condicion: v.condicion,
          negociable: !!v.negociable, exclusiva: !!v.exclusiva,
          title: v.title.trim(), zona: v.zona.trim(), price: soloNum(v.price),
          terreno: soloNum(v.terreno), construido: soloNum(v.construido),
          rec: soloNum(v.rec), ban: soloNum(v.ban), autos: soloNum(v.autos),
          frente: v.frente || "—",
          fotosCount: Math.max(1, fotos.length), fotos: fotos,
          nuevo: 0, x: 50, y: 50,
          desc: v.desc || "", potencial: v.potencial || "", maps: v.maps || ""
        });
        fotosPendientes = null;
        ui().closeSheet();
        ui().toast("Propiedad publicada." + avisoSlug);
        ui().render();
        return true;
      }
    }

    // abrir ficha al tocar una tarjeta del Kanban
    var card = target.closest ? target.closest("[data-lead]") : null;
    if (card && !action && !target.closest("select")) {
      return abrirFicha(card.getAttribute("data-lead"));
    }
    return false;
  }

  /* Abrir la ficha es leer la conversación: el contador vuelve a cero y el
     tablero de atrás se redibuja para que el aviso desaparezca de la tarjeta. */
  function abrirFicha(leadId) {
    var l = window.Store.lead(leadId);
    if (!l) return false;
    window.Store.marcarLeido(leadId);
    leadAbierto = l.id;
    ui().openSheet(fichaLead(l));
    ui().render();
    return true;
  }

  /* Si hay calendario conectado, la visita confirmada se escribe ahí. Si falla,
     se dice: una cita que el equipo cree agendada y no está es peor que un error. */
  function escribirEnCalendario(m) {
    var S = window.Store;
    if (!S.google() || !window.GoogleCal.configurado()) return;
    var l = S.lead(m.leadId);
    var p = S.catalogoCompleto().filter(function (x) { return x.slug === m.slug; })[0];
    var horas = String(m.hora).split("-");
    var zona = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";
    var hhmm = function (h) { return m.dia + "T" + String(h).padStart(2, "0") + ":00:00"; };
    window.GoogleCal.agendarVisita({
      titulo: "Visita · " + (p ? p.title : "propiedad") + " · " + (l ? l.nombre : ""),
      detalle: [l && l.nombre, l && S.telMostrar(l), l && l.correo, m.texto].filter(Boolean).join("\n"),
      lugar: p ? p.zona : "",
      inicio: hhmm(horas[0]), fin: hhmm(horas[1]), zona: zona
    }).then(function () {
      ui().toast("Visita escrita en Google Calendar.");
    }).catch(function (e) {
      ui().toast("No se escribió en Google Calendar: " + (e.message || "falló la conexión") + ".");
    });
  }

  /* Conserva lo escrito en la ficha cuando la bitácora obliga a re-dibujar. */
  function guardarCamposFicha(idl) {
    var f = document.getElementById("lead-form");
    if (!f || f.getAttribute("data-lead") !== idl) return;
    var d = leerForm(f);
    window.Store.actualizarLead(idl, {
      nombre: d.nombre, telefono: d.telefono, pais: d.pais, whatsapp: d.whatsapp, paisWa: d.paisWa, correo: d.correo, correosExtra: d.correosExtra,
      presupuesto: soloNum(d.presupuesto), empresa: d.empresa, etapa: d.etapa
    });
  }

  function montarFormProp() {
    var input = document.getElementById("pf-fotos");
    if (!input) return;
    pintarThumbs();
    input.addEventListener("change", async function () {
      var S = window.Store;
      var form = document.getElementById("prop-form");
      var slug = (form && form.getAttribute("data-slug")) ||
                 slugify((document.getElementById("pf-title") || {}).value || "borrador");
      var files = Array.prototype.slice.call(input.files).slice(0, 8);
      var tope = S.nubeViva() ? 8 : 4;   // sin nube, la cuota del navegador manda
      for (var i = 0; i < files.length && (fotosPendientes || []).length < tope; i++) {
        var alt = files[i].name.replace(/\.[^.]+$/, "");
        try {
          /* Con nube la imagen va al almacenamiento y lo que se guarda es su
             dirección. En base64 dentro del navegador, doce propiedades
             llenaban la cuota y se perdía todo. */
          if (S.nubeViva()) {
            pintarSubiendo(alt);
            var chico = await reducirArchivo(files[i], 1600);
            var subida = await window.Nube.subirFoto(slug, chico, alt);
            fotosPendientes.push(subida);
          } else {
            var src = await reducirImagen(files[i], 1200);
            fotosPendientes.push({ src: src, alt: alt });
          }
        } catch (e) {
          ui().toast(e.message || "No se pudo procesar una imagen.");
        }
        pintarThumbs();
      }
      input.value = "";
    });
  }
  function pintarThumbs() {
    var box = document.getElementById("pf-thumbs");
    if (!box) return;
    box.innerHTML = (fotosPendientes || []).map(function (f, i) {
      return '<span class="thumb"><img src="' + f.src + '" alt=""><button type="button" class="thumb__x" data-thumb="' + i + '" aria-label="Quitar imagen ' + (i + 1) + '">×</button></span>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-thumb]"), function (b) {
      b.addEventListener("click", function () {
        var fuera = fotosPendientes.splice(Number(b.getAttribute("data-thumb")), 1)[0];
        if (fuera && fuera.ruta && window.Store.nubeViva()) window.Nube.borrarFoto(fuera.ruta);
        pintarThumbs();
      });
    });
  }

  /* arrastre entre columnas (ratón) + <select> por tarjeta (táctil y teclado) */
  function bind() {
    document.addEventListener("dragstart", function (e) {
      var c = e.target.closest && e.target.closest("[data-lead]");
      if (!c) return;
      arrastrando = c.getAttribute("data-lead");
      c.classList.add("is-dragging");
    });
    document.addEventListener("dragend", function (e) {
      var c = e.target.closest && e.target.closest("[data-lead]");
      if (c) c.classList.remove("is-dragging");
      arrastrando = null;
    });
    document.addEventListener("dragover", function (e) {
      var z = e.target.closest && e.target.closest("[data-drop]");
      if (!z || !arrastrando) return;
      e.preventDefault();
      z.classList.add("is-over");
    });
    document.addEventListener("dragleave", function (e) {
      var z = e.target.closest && e.target.closest("[data-drop]");
      if (z) z.classList.remove("is-over");
    });
    document.addEventListener("drop", function (e) {
      var z = e.target.closest && e.target.closest("[data-drop]");
      if (!z || !arrastrando) return;
      e.preventDefault();
      z.classList.remove("is-over");
      window.Store.moverLead(arrastrando, z.getAttribute("data-drop"));
      arrastrando = null;
      ui().render();
    });
    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "gc-cal") {
        var opt = e.target.options[e.target.selectedIndex];
        window.Store.guardarGoogle({ calendario: e.target.value, calendarioNombre: opt.text });
        ui().toast("Las visitas se escribirán en " + opt.text + ".");
        return;
      }
      var sel = e.target;
      if (!sel.hasAttribute || !sel.hasAttribute("data-move")) return;
      window.Store.moverLead(sel.getAttribute("data-move"), sel.value);
      ui().toast("Interesado movido a " + sel.options[sel.selectedIndex].text + ".");
      ui().render();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var c = document.activeElement;
      if (!c || !c.hasAttribute || !c.hasAttribute("data-lead")) return;
      e.preventDefault();
      abrirFicha(c.getAttribute("data-lead"));
    });
  }

  window.Admin = { panel: panel, conteos: conteos, handle: handle, bind: bind };
})();
