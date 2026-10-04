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

  var vista = "kanban";                // kanban | propiedades | actividad
  var errorAcceso = false;
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
  function tituloDe(slug) {
    var p = window.Store.catalogo().filter(function (x) { return x.slug === slug; })[0];
    return p ? p.title + " · " + p.zona : slug;
  }

  /* ============================== acceso ============================== */

  function vistaLogin(error) {
    return '<div class="container admin-login">' +
      '<div class="admin-login__card">' +
        '<p class="eyebrow">Panel interno</p>' +
        '<h1>Administración</h1>' +
        '<p class="lead" style="margin-top:8px">Acceso para el equipo de Legato Capital.</p>' +
        '<form id="admin-login" style="margin-top:24px;display:grid;gap:16px">' +
          '<div class="field"><label for="ad-user">Correo o teléfono</label>' +
            '<input id="ad-user" name="user" type="text" autocomplete="username" placeholder="info@lazza.com.mx"></div>' +
          '<div class="field' + (error ? " field--error" : "") + '"><label for="ad-pass">Contraseña</label>' +
            '<input id="ad-pass" name="pass" type="password" autocomplete="current-password"' +
            (error ? ' aria-invalid="true" aria-describedby="ad-error"' : "") + '></div>' +
          (error ? '<p class="field__error" id="ad-error">' + icon("alert", 16) + 'Usuario o contraseña incorrectos.</p>' : "") +
          '<button class="btn btn--primary btn--block" type="submit">Entrar</button>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  /* ============================== Kanban ============================== */

  function tarjetaLead(l) {
    var act = window.Store.actividadDe(l.usuarioId);
    return '<article class="kcard" draggable="true" data-lead="' + esc(l.id) + '" tabindex="0" role="button" ' +
        'aria-label="Abrir ficha de ' + esc(l.nombre) + '">' +
      '<p class="kcard__name">' + esc(l.nombre) + (l.ejemplo ? ' <span class="kcard__tag">ejemplo</span>' : "") + '</p>' +
      (l.empresa ? '<p class="kcard__meta">' + esc(l.empresa) + '</p>' : "") +
      '<p class="kcard__meta">' + esc(l.telefono || "sin teléfono") + '</p>' +
      (l.presupuesto ? '<p class="kcard__budget">' + esc(dinero(l.presupuesto)) + '</p>' : "") +
      '<div class="kcard__foot">' +
        '<span>' + act.length + (act.length === 1 ? " interacción" : " interacciones") + '</span>' +
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

  /* =========================== ficha de lead ========================== */

  function fichaLead(l) {
    var act = window.Store.actividadDe(l.usuarioId);
    return '' +
    '<div class="sheet__head">' +
      '<h2 id="sheet-title">' + esc(l.nombre) + '</h2>' +
      '<button class="icon-btn" data-action="sheet-close" aria-label="Cerrar ficha">' + icon("close", 22) + '</button>' +
    '</div>' +
    '<div class="sheet__body">' +
      '<form id="lead-form" data-lead="' + esc(l.id) + '" style="display:grid;gap:16px">' +
        '<div class="field"><label for="lf-nombre">Nombre completo</label>' +
          '<input id="lf-nombre" name="nombre" value="' + esc(l.nombre) + '"></div>' +
        '<div class="pair">' +
          '<div class="field"><label for="lf-tel">Teléfono</label>' +
            '<input id="lf-tel" name="telefono" inputmode="tel" value="' + esc(l.telefono) + '"></div>' +
          '<div class="field"><label for="lf-etapa">Etapa</label>' +
            '<select id="lf-etapa" name="etapa">' + window.Store.ETAPAS.map(function (e) {
              return '<option value="' + e.id + '"' + (e.id === l.etapa ? " selected" : "") + '>' + esc(e.label) + "</option>";
            }).join("") + '</select></div>' +
        '</div>' +
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
        '<div class="field"><label for="lf-notas">Notas</label>' +
          '<textarea id="lf-notas" name="notas" rows="4" placeholder="Qué busca, condiciones, siguiente paso…">' + esc(l.notas || "") + '</textarea></div>' +
      '</form>' +

      '<div class="admin-block">' +
        '<h3>Origen</h3>' +
        '<p class="small">' + (l.origen ? esc(tituloDe(l.origen)) : "Registro directo, sin propiedad de origen.") + '</p>' +
        '<p class="small" style="color:var(--text-secondary)">Alta: ' + esc(fecha(l.alta)) + '</p>' +
      '</div>' +

      '<div class="admin-block">' +
        '<h3>Actividad (' + act.length + ')</h3>' +
        (act.length
          ? '<ul class="actlist">' + act.map(function (a) {
              return '<li><span class="actlist__tipo actlist__tipo--' + a.tipo + '">' + (a.tipo === "guardado" ? "Guardó" : "Compartió") + '</span> ' +
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

  /* ============================ propiedades =========================== */

  function vistaPropiedades() {
    var props = window.Store.catalogo();
    return '<div class="admin-bar">' +
        '<p class="small">' + props.length + ' propiedades publicadas</p>' +
        '<button class="btn btn--primary btn--sm" data-action="prop-new">Publicar propiedad</button>' +
      '</div>' +
      '<div class="admin-table" role="table">' +
        '<div class="admin-row admin-row--head" role="row">' +
          '<span role="columnheader">Propiedad</span><span role="columnheader">Operación</span>' +
          '<span role="columnheader">Precio</span><span role="columnheader">Guardados</span><span></span>' +
        '</div>' +
        props.map(function (p) {
          var act = window.Store.actividadDeSlug(p.slug);
          var g = act.filter(function (a) { return a.tipo === "guardado"; }).length;
          var c = act.filter(function (a) { return a.tipo === "compartido"; }).length;
          return '<div class="admin-row" role="row">' +
            '<span role="cell"><strong>' + esc(p.title) + '</strong><br><span class="small" style="color:var(--text-secondary)">' + esc(p.zona) + '</span></span>' +
            '<span role="cell">' + (p.op === "renta" ? "Renta" : "Venta") + '</span>' +
            '<span role="cell">' + esc(dinero(p.price)) + '</span>' +
            '<span role="cell">' + g + ' · ' + c + ' comp.</span>' +
            '<span role="cell" style="display:flex;gap:4px;justify-content:flex-end">' +
              '<button class="btn btn--quiet btn--sm" data-action="prop-edit" data-slug="' + esc(p.slug) + '">Editar</button>' +
              '<button class="btn btn--link" data-action="prop-del" data-slug="' + esc(p.slug) + '">Quitar</button>' +
            '</span>' +
          '</div>';
        }).join("") +
      '</div>';
  }

  function formPropiedad(p) {
    p = p || { slug: "", op: "venta", tipo: "Casas", badge: "NUEVA", fotos: [], fotosCount: 1, remodelar: false };
    var tipos = ["Casas", "Terrenos", "Departamentos"];
    var badges = ["NUEVA", "PARA REMODELAR", "TERRENO", "OPORTUNIDAD"];
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
          '<div class="field"><label for="pf-badge">Distintivo</label><select id="pf-badge" name="badge">' +
            badges.map(function (b) { return '<option' + (p.badge === b ? " selected" : "") + '>' + b + "</option>"; }).join("") +
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
        '<div class="switch"><label for="pf-remodelar">Es para remodelar</label>' +
          '<input type="checkbox" id="pf-remodelar" name="remodelar"' + (p.remodelar ? " checked" : "") + '></div>' +
        '<div class="field"><label for="pf-desc">Descripción</label>' +
          '<textarea id="pf-desc" name="desc" rows="3">' + esc(p.desc || "") + '</textarea></div>' +
        '<div class="field"><label for="pf-pot">¿Por qué tiene potencial?</label>' +
          '<textarea id="pf-pot" name="potencial" rows="3" placeholder="Posibilidades de intervención, sujetas a normativa."></textarea></div>' +
        '<div class="field"><label for="pf-maps">Enlace de Google Maps (opcional)</label>' +
          '<input id="pf-maps" name="maps" value="' + esc(p.maps || "") + '" placeholder="https://maps.app.goo.gl/…"></div>' +
        '<div class="field"><label for="pf-fotos">Fotografías (hasta 4)</label>' +
          '<input id="pf-fotos" name="fotos" type="file" accept="image/*" multiple>' +
          '<p class="small" style="color:var(--text-secondary)">Se reducen a 1200 px antes de guardarse en este navegador.</p>' +
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
    if (!act.length) return '<div class="state"><h3>Sin actividad todavía.</h3><p>Aquí aparece quién guarda y quién comparte cada propiedad.</p></div>';
    return '<div class="admin-table" role="table">' +
      '<div class="admin-row admin-row--head admin-row--act" role="row">' +
        '<span role="columnheader">Persona</span><span role="columnheader">Acción</span>' +
        '<span role="columnheader">Propiedad</span><span role="columnheader">Fecha</span>' +
      '</div>' +
      act.map(function (a) {
        return '<div class="admin-row admin-row--act" role="row">' +
          '<span role="cell"><strong>' + esc(a.nombre) + '</strong></span>' +
          '<span role="cell"><span class="actlist__tipo actlist__tipo--' + a.tipo + '">' + (a.tipo === "guardado" ? "Guardó" : "Compartió") + '</span></span>' +
          '<span role="cell">' + esc(tituloDe(a.slug)) + '</span>' +
          '<span role="cell">' + esc(fecha(a.fecha)) + '</span>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  /* ============================== shell =============================== */

  function view() {
    if (!window.Store.esAdmin()) return vistaLogin(errorAcceso);

    var leads = window.Store.leads();
    var nuevos = leads.filter(function (l) { return l.etapa === "nuevo"; }).length;
    var cuerpo = vista === "propiedades" ? vistaPropiedades()
               : vista === "actividad" ? vistaActividad()
               : vistaKanban();

    return '<div class="admin">' +
      '<div class="container admin__head">' +
        '<div>' +
          '<p class="eyebrow">Panel interno</p>' +
          '<h1>Administración</h1>' +
        '</div>' +
        '<div class="admin__actions">' +
          '<button class="btn btn--quiet btn--sm" data-action="admin-reset">Reiniciar datos</button>' +
          '<button class="btn btn--secondary btn--sm" data-action="admin-out">Salir</button>' +
        '</div>' +
      '</div>' +
      '<div class="container admin__tabs" role="tablist">' +
        tab("kanban", "Interesados", leads.length) +
        tab("propiedades", "Propiedades", window.Store.catalogo().length) +
        tab("actividad", "Actividad", window.Store.actividad().length) +
        (nuevos ? '<span class="admin__hint">' + nuevos + ' sin contactar</span>' : "") +
      '</div>' +
      '<div class="' + (vista === "kanban" ? "admin__board" : "container admin__panel") + '">' + cuerpo + '</div>' +
    '</div>';
  }

  function tab(id, label, n) {
    return '<button class="chip' + (vista === id ? " is-on" : "") + '" role="tab" aria-selected="' + (vista === id) + '" data-admin-tab="' + id + '">' +
      esc(label) + '<span class="filterbtn__count">' + n + '</span></button>';
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

    if (target.hasAttribute("data-admin-tab")) {
      vista = target.getAttribute("data-admin-tab");
      leadAbierto = null;
      ui().render();
      return true;
    }

    switch (action) {
      case "admin-out": S.salirAdmin(); ui().go("home"); return true;
      case "admin-reset":
        if (confirm("Esto borra los interesados, la actividad y las propiedades dadas de alta en este navegador, y repone los datos de ejemplo. ¿Continuar?")) {
          S.reiniciar(); ui().toast("Datos reiniciados."); ui().render();
        }
        return true;

      case "lead-save": {
        var f = document.getElementById("lead-form");
        var d = leerForm(f);
        S.actualizarLead(f.getAttribute("data-lead"), {
          nombre: d.nombre, telefono: d.telefono, correo: d.correo, correosExtra: d.correosExtra,
          presupuesto: soloNum(d.presupuesto), empresa: d.empresa, notas: d.notas, etapa: d.etapa
        });
        ui().closeSheet(); ui().toast("Ficha actualizada."); ui().render();
        return true;
      }
      case "lead-delete": {
        if (confirm("¿Eliminar a este interesado del tablero?")) {
          S.borrarLead(target.getAttribute("data-lead"));
          ui().closeSheet(); ui().toast("Interesado eliminado."); ui().render();
        }
        return true;
      }

      case "prop-new":
        fotosPendientes = [];
        ui().openSheet(formPropiedad(null), montarFormProp);
        return true;
      case "prop-edit": {
        var p = S.catalogo().filter(function (x) { return x.slug === target.getAttribute("data-slug"); })[0];
        fotosPendientes = (p && p.fotos ? p.fotos.slice() : []);
        ui().openSheet(formPropiedad(p), function () {
          montarFormProp();
          var pot = document.getElementById("pf-pot");
          if (pot && p) pot.value = p.potencial || "";
        });
        return true;
      }
      case "prop-del":
        if (confirm("¿Quitar esta propiedad del sitio?")) {
          S.eliminarPropiedad(target.getAttribute("data-slug"));
          ui().toast("Propiedad retirada."); ui().render();
        }
        return true;
      case "prop-save": {
        var form = document.getElementById("prop-form");
        if (!form.reportValidity()) return true;
        var v = leerForm(form);
        var slug = form.getAttribute("data-slug") || slugify(v.title + "-" + v.zona.split(",")[0]);
        var fotos = fotosPendientes || [];
        S.guardarPropiedad({
          slug: slug, op: v.op, tipo: v.tipo, remodelar: !!v.remodelar,
          title: v.title.trim(), zona: v.zona.trim(), price: soloNum(v.price),
          terreno: soloNum(v.terreno), construido: soloNum(v.construido),
          rec: soloNum(v.rec), ban: soloNum(v.ban), autos: soloNum(v.autos),
          frente: v.frente || "—", badge: v.badge,
          fotosCount: Math.max(1, fotos.length), fotos: fotos,
          nuevo: 0, x: 50, y: 50,
          desc: v.desc || "", potencial: v.potencial || "", maps: v.maps || ""
        });
        fotosPendientes = null;
        ui().closeSheet(); ui().toast("Propiedad publicada."); ui().render();
        return true;
      }
    }

    // abrir ficha al tocar una tarjeta del Kanban
    var card = target.closest ? target.closest("[data-lead]") : null;
    if (card && !action && !target.closest("select")) {
      var l = S.lead(card.getAttribute("data-lead"));
      if (l) { leadAbierto = l.id; ui().openSheet(fichaLead(l)); return true; }
    }
    return false;
  }

  function montarFormProp() {
    var input = document.getElementById("pf-fotos");
    if (!input) return;
    pintarThumbs();
    input.addEventListener("change", async function () {
      var files = Array.prototype.slice.call(input.files).slice(0, 4);
      for (var i = 0; i < files.length && (fotosPendientes || []).length < 4; i++) {
        try {
          var src = await reducirImagen(files[i], 1200);
          fotosPendientes.push({ src: src, alt: files[i].name.replace(/\.[^.]+$/, "") });
        } catch (e) { ui().toast("No se pudo procesar una imagen."); }
      }
      pintarThumbs();
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
        fotosPendientes.splice(Number(b.getAttribute("data-thumb")), 1);
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
      var l = window.Store.lead(c.getAttribute("data-lead"));
      if (l) ui().openSheet(fichaLead(l));
    });
  }

  async function login(form) {
    var d = leerForm(form);
    var r = await window.Store.entrarAdmin(d.user, d.pass);
    if (!r.ok) {
      errorAcceso = true;
      ui().render();                       // re-render para reconectar el formulario
      var u = document.getElementById("ad-user");
      if (u) { u.value = d.user; document.getElementById("ad-pass").focus(); }
      return;
    }
    errorAcceso = false;
    ui().toast("Sesión de administrador iniciada.");
    ui().render();
  }

  window.Admin = { view: view, handle: handle, bind: bind, login: login };
})();
