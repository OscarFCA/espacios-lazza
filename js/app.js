/* Legato Capital — aplicación mobile first.
 * Vanilla JS, sin dependencias. Ruteo por hash para que el botón "atrás"
 * del teléfono funcione y las búsquedas se puedan compartir.
 */
(function () {
  "use strict";

  var DATA = window.EL_DATA || [];
  var CAT = window.EL_CATALOG || {};
  var main = document.getElementById("main");
  var sheet = document.getElementById("sheet");
  var drawer = document.getElementById("drawer");
  var overlay = document.getElementById("overlay");
  var toastEl = document.getElementById("toast");
  var bottomnav = document.getElementById("bottomnav");

  var DEFAULTS = {
    op: "venta", q: "", tipo: "Todos", remodelar: false,
    min: 0, max: 0, terrenoMin: 0, constMin: 0, rec: 0, ban: 0, autos: 0,
    sort: "Relevancia"
  };

  var state = Object.assign({}, DEFAULTS, {
    screen: "home", sel: null, favs: loadFavs(),
    loading: false, error: false
  });

  var draft = null;          // copia de filtros mientras el bottom sheet está abierto
  var lastFocus = null;      // foco previo a abrir drawer/sheet
  var toastTimer = null;
  var loadTimer = null;

  /* ============================ iconografía (§15) ============================ */
  /* Trazo lineal 1.6–1.8, sin relleno, geométrica. */
  function icon(name, size) {
    var s = size || 18;
    var paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>',
      filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
      home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
      pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
      land: '<path d="M3 17 9 5l6 7 3-4 3 9z"/>',
      ruler: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
      bed: '<path d="M3 18v-7h14a4 4 0 0 1 4 4v3M3 11V7M3 18h18"/><circle cx="7.5" cy="14" r="1.6"/>',
      bath: '<path d="M4 11h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M7 11V6a2 2 0 0 1 4 0"/>',
      car: '<path d="M5 16v2M19 16v2M4 16h16v-3l-2-5H6l-2 5z"/><circle cx="7.5" cy="13" r="1"/><circle cx="16.5" cy="13" r="1"/>',
      image: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="9.5" r="1.3"/>',
      external: '<path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7.5A1.5 1.5 0 0 1 6 6h4"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'
    };
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + "</svg>";
  }

  /* ============================ utilidades ============================ */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n, op) {
    var s = "$" + Number(n).toLocaleString("en-US");
    return op === "renta" ? s + " MXN / mes" : s + " MXN";
  }
  function shortMoney(n, op) {
    if (op === "renta") return "$" + Math.round(n / 1000) + "k";
    return "$" + (n / 1000000).toFixed(1).replace(".0", "") + "M";
  }
  function priceLabel(n, op) {
    // Legible por lector de pantalla: evita que "$12,800,000" se lea como dígitos sueltos.
    if (op === "renta") return Number(n).toLocaleString("es-MX") + " pesos mexicanos por mes";
    return Number(n).toLocaleString("es-MX") + " pesos mexicanos";
  }
  function tipoLabel(p) {
    if (p.remodelar) return p.tipo.replace(/s$/, "") + " para remodelar";
    if (p.tipo === "Terrenos") return "Terreno";
    return p.tipo.replace(/s$/, "");
  }
  function opLabel(p) { return p.op === "renta" ? "En renta" : "En venta"; }

  /* Datos clave de la card con iconografía lineal (§14). */
  function facts(p) {
    var out = [];
    if (p.terreno) out.push([ "ruler", p.terreno.toLocaleString("en-US") + " m² terreno" ]);
    if (p.construido) out.push([ "land", p.construido + " m² const." ]);
    if (p.rec) out.push([ "bed", p.rec + " rec" ]);
    // El icono solo no basta: cada dato lleva su unidad en texto.
    if (p.ban) out.push([ "bath", p.ban + (p.ban === 1 ? " baño" : " baños") ]);
    if (p.autos) out.push([ "car", p.autos + (p.autos === 1 ? " auto" : " autos") ]);
    if (!p.rec && p.frente && p.frente !== "—") out.push([ "pin", "Frente " + p.frente ]);
    return out;
  }
  function factsHTML(p) {
    var f = facts(p);
    if (!f.length) return "";
    return '<div class="card__facts">' + f.map(function (x) {
      return '<span class="fact">' + icon(x[0], 16) + esc(x[1]) + "</span>";
    }).join("") + "</div>";
  }
  function metaLine(p) {
    return facts(p).map(function (x) { return x[1]; }).join(" · ");
  }

  function mapsUrl(p) {
    if (p.maps) return p.maps;
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(p.zona + ", Ciudad de México");
  }

  function loadFavs() {
    try { return JSON.parse(localStorage.getItem("legato:favs") || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveFavs() {
    try { localStorage.setItem("legato:favs", JSON.stringify(state.favs)); } catch (e) {}
  }
  function favCount() { return Object.keys(state.favs).length; }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2600);
  }

  /* ============================ filtrado ============================ */

  function matches(p, f) {
    if (p.op !== f.op) return false;
    var q = (f.q || "").trim().toLowerCase();
    if (q && (p.zona + " " + p.title).toLowerCase().indexOf(q) === -1) return false;
    if (f.tipo === "Para remodelar") { if (!p.remodelar) return false; }
    else if (f.tipo !== "Todos" && p.tipo !== f.tipo) return false;
    if (f.remodelar && !p.remodelar) return false;
    if (f.min && p.price < f.min) return false;
    if (f.max && p.price > f.max) return false;
    if (f.terrenoMin && p.terreno < f.terrenoMin) return false;
    if (f.constMin && p.construido < f.constMin) return false;
    if (f.rec && p.rec < f.rec) return false;
    if (f.ban && p.ban < f.ban) return false;
    if (f.autos && p.autos < f.autos) return false;
    return true;
  }

  function filtered(f) {
    var out = DATA.filter(function (p) { return matches(p, f); });
    var by = {
      "Precio menor": function (a, b) { return a.price - b.price; },
      "Precio mayor": function (a, b) { return b.price - a.price; },
      "Mayor terreno": function (a, b) { return b.terreno - a.terreno; },
      "Más recientes": function (a, b) { return a.nuevo - b.nuevo; }
    }[f.sort];
    return by ? out.slice().sort(by) : out;
  }

  function activeFilterCount(f) {
    var n = 0;
    if (f.tipo !== "Todos") n++;
    if (f.remodelar) n++;
    if (f.min || f.max) n++;
    if (f.terrenoMin) n++;
    if (f.constMin) n++;
    if (f.rec) n++;
    if (f.ban) n++;
    if (f.autos) n++;
    return n;
  }

  function chips(f) {
    var c = [];
    if (f.q.trim()) c.push({ key: "q", label: f.q.trim() });
    if (f.tipo !== "Todos") c.push({ key: "tipo", label: f.tipo });
    if (f.remodelar) c.push({ key: "remodelar", label: "Para remodelar" });
    if (f.min && f.max) c.push({ key: "precio", label: "$" + f.min.toLocaleString("en-US") + " – $" + f.max.toLocaleString("en-US") });
    else if (f.max) c.push({ key: "precio", label: "Hasta $" + f.max.toLocaleString("en-US") });
    else if (f.min) c.push({ key: "precio", label: "Desde $" + f.min.toLocaleString("en-US") });
    if (f.terrenoMin) c.push({ key: "terrenoMin", label: "Terreno " + f.terrenoMin + " m²+" });
    if (f.constMin) c.push({ key: "constMin", label: "Construido " + f.constMin + " m²+" });
    if (f.rec) c.push({ key: "rec", label: f.rec + "+ recámaras" });
    if (f.ban) c.push({ key: "ban", label: f.ban + "+ baños" });
    if (f.autos) c.push({ key: "autos", label: f.autos + "+ autos" });
    return c;
  }

  /* ============================ ruteo ============================ */

  var QUERY_KEYS = ["op", "q", "tipo", "remodelar", "min", "max", "terrenoMin", "constMin", "rec", "ban", "autos", "sort"];

  function toQuery() {
    var qs = [];
    QUERY_KEYS.forEach(function (k) {
      var v = state[k];
      if (v === DEFAULTS[k] || v === "" || v === 0 || v === false) return;
      qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(v === true ? "1" : v));
    });
    return qs.length ? "?" + qs.join("&") : "";
  }

  function applyQuery(qs) {
    var f = Object.assign({}, DEFAULTS);
    (qs || "").replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = decodeURIComponent(i < 0 ? "" : pair.slice(i + 1));
      if (QUERY_KEYS.indexOf(k) === -1) return;
      if (typeof DEFAULTS[k] === "number") f[k] = Number(v) || 0;
      else if (typeof DEFAULTS[k] === "boolean") f[k] = v === "1" || v === "true";
      else f[k] = v;
    });
    Object.assign(state, f);
  }

  function hashFor(screen) {
    if (screen === "results") return "#/resultados" + toQuery();
    if (screen === "detail") return "#/propiedad/" + state.sel;
    if (screen === "saved") return "#/guardados";
    return "#/";
  }

  function go(screen, patch, opts) {
    if (patch) Object.assign(state, patch);
    state.screen = screen;
    var h = hashFor(screen);
    if (location.hash === h) { route(true); }
    else if (opts && opts.replace) { history.replaceState(null, "", h); route(true); }
    else { location.hash = h; }
  }

  function route(forced) {
    var h = location.hash || "#/";
    var qi = h.indexOf("?");
    var path = qi < 0 ? h : h.slice(0, qi);
    var qs = qi < 0 ? "" : h.slice(qi);

    closeDrawer(true);
    closeSheet(true);

    if (path.indexOf("#/propiedad/") === 0) {
      var slug = decodeURIComponent(path.slice("#/propiedad/".length));
      if (!DATA.some(function (p) { return p.slug === slug; })) { location.replace("#/"); return; }
      state.screen = "detail";
      state.sel = slug;
      render();
      return;
    }

    if (path.indexOf("#/resultados") === 0) {
      applyQuery(qs);
      state.screen = "results";
      startLoading();
      return;
    }

    if (path.indexOf("#/guardados") === 0) {
      state.screen = "saved";
      render();
      return;
    }

    state.screen = "home";
    render();
    if (!forced) window.scrollTo(0, 0);
  }

  function startLoading() {
    state.loading = true;
    state.error = !Array.isArray(DATA) || DATA.length === 0;
    render();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      state.loading = false;
      render();
    }, 320);
  }

  /* ============================ piezas de vista ============================ */

  function photoHTML(p, index, hint) {
    var foto = (p.fotos || [])[index];
    if (foto) return '<img class="photo" src="' + esc(foto.src) + '" alt="' + esc(foto.alt || (p.title + " en " + p.zona)) + '" loading="lazy" decoding="async">';
    var n = index + 1, total = p.fotosCount || 1;
    return '<div class="photo photo--ph" role="img" aria-label="Fotografía ' + n + ' de ' + total + ' · ' + esc(p.title + ", " + p.zona) + ' (pendiente de publicación)">' +
      icon("image", 26) + '<span>' + esc(hint || p.title) + "</span></div>";
  }

  function favIcon(on, size) {
    var s = size || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" fill="' + (on ? "currentColor" : "none") + '" aria-hidden="true">' +
      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  }

  function cardHTML(p, variant) {
    var fav = !!state.favs[p.slug];
    var compact = variant === "compact";
    return '' +
      '<article class="card' + (compact ? " card--compact" : "") + '" data-slug="' + esc(p.slug) + '">' +
        '<div class="card__media">' + photoHTML(p, 0) +
          '<p class="card__badge">' + esc(p.badge) + '</p>' +
          (compact ? "" : '<p class="card__count">1/' + p.fotosCount + '</p>') +
          '<button class="icon-btn fav" data-action="fav" data-slug="' + esc(p.slug) + '" aria-pressed="' + fav + '" aria-label="' + (fav ? "Quitar de guardados" : "Guardar propiedad") + ': ' + esc(p.title) + '">' + favIcon(fav) + '</button>' +
        '</div>' +
        '<div class="card__body">' +
          '<p class="card__tipo">' + esc(opLabel(p)) + '</p>' +
          '<h3 class="card__title"><a href="#/propiedad/' + esc(p.slug) + '" data-action="open" data-slug="' + esc(p.slug) + '">' + esc(p.title) + '</a></h3>' +
          '<p class="card__zona">' + esc(p.zona) + '</p>' +
          '<p class="card__price"><span aria-hidden="true">' + esc(money(p.price, p.op)) + '</span><span class="sr-only">' + esc(priceLabel(p.price, p.op)) + '</span></p>' +
          (compact ? "" : factsHTML(p)) +
        '</div>' +
      '</article>';
  }

  function skeletonHTML(n) {
    var out = "";
    for (var i = 0; i < n; i++) {
      out += '<div class="skeleton" aria-hidden="true">' +
        '<div class="skeleton__media shimmer"></div>' +
        '<div class="skeleton__body">' +
          '<div class="skeleton__line skeleton__line--short"></div>' +
          '<div class="skeleton__line skeleton__line--mid"></div>' +
          '<div class="skeleton__line"></div>' +
        '</div></div>';
    }
    return out;
  }

  function optionsHTML(list, selected) {
    return list.map(function (o) {
      var label = typeof o === "string" ? o : o.label;
      var value = typeof o === "string" ? o : o.value;
      return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? " selected" : "") + '>' + esc(label) + "</option>";
    }).join("");
  }

  function maxOptions() { return state.op === "renta" ? CAT.maxRenta : CAT.maxVenta; }

  /* ---------- Home ---------- */

  function viewHome() {
    var destacadas = DATA.filter(function (p) { return p.op === state.op; }).slice(0, 3);
    return '' +
    '<section class="container hero">' +
      '<p class="eyebrow">Patrimonio · Inversión · Arquitectura</p>' +
      '<h1>Encuentra el potencial de tu patrimonio.</h1>' +
      '<p class="hero__sub">Propiedades, terrenos y oportunidades de inversión en los lugares que importan.</p>' +

      '<div class="tabs" role="tablist" aria-label="Operación">' +
        '<button class="tab" role="tab" aria-selected="' + (state.op === "venta") + '" data-action="set-op" data-op="venta">Comprar</button>' +
        '<button class="tab" role="tab" aria-selected="' + (state.op === "renta") + '" data-action="set-op" data-op="renta">Rentar</button>' +
      '</div>' +

      '<form class="searchbar" id="home-search" role="search">' +
        '<div class="searchbar__field searchbar__field--wide">' +
          '<label class="searchbar__label" for="q-home">¿Dónde buscas?</label>' +
          '<input id="q-home" name="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Colonia, alcaldía o ciudad" value="' + esc(state.q) + '">' +
        '</div>' +
        '<div class="searchbar__field">' +
          '<label class="searchbar__label" for="tipo-home">Tipo de propiedad</label>' +
          '<select id="tipo-home" name="tipo">' + optionsHTML(CAT.tipos, state.tipo) + '</select>' +
        '</div>' +
        '<div class="searchbar__field">' +
          '<label class="searchbar__label" for="max-home">Precio máximo</label>' +
          '<select id="max-home" name="max">' + optionsHTML(maxOptions(), state.max) + '</select>' +
        '</div>' +
        '<button class="searchbar__submit" type="submit">Buscar</button>' +
      '</form>' +

      '<div class="chiprow" aria-label="Búsquedas rápidas">' +
        quick("Casas", { tipo: "Casas" }) +
        quick("Terrenos", { tipo: "Terrenos" }) +
        quick("Para remodelar", { remodelar: true, tipo: "Todos" }) +
        quick("Departamentos", { tipo: "Departamentos" }) +
        quick("Inversión", { tipo: "Todos", sort: "Mayor terreno" }) +
      '</div>' +

      '<div class="herophoto">' +
        '<div class="photo photo--ph" role="img" aria-label="Fotografía de portada pendiente de publicación">' +
          icon("image", 28) + '<span>Arquitectura contemporánea · luz natural · piedra y vegetación</span>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="container section">' +
      '<div class="section__head">' +
        '<h2>Selección con potencial</h2>' +
        '<button class="btn btn--link" data-action="search">Ver todas</button>' +
      '</div>' +
      '<div class="grid">' + destacadas.map(function (p) { return cardHTML(p); }).join("") + '</div>' +
    '</section>' +

    '<section class="section--soft">' +
      '<div class="container">' +
        '<p class="eyebrow">Cómo leemos una propiedad</p>' +
        '<div class="pillars">' +
          pillar("01", "Datos para decidir", "Cada ficha publica superficie de terreno, construcción y frente: lo que se necesita para evaluar un proyecto.") +
          pillar("02", "Estado real", "Las propiedades para remodelar se muestran como están, sin tratamientos que cambien su condición.") +
          pillar("03", "Potencial explicado", "Las posibilidades de intervención se presentan como posibilidades, sujetas a normativa.") +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="container" id="nosotros" tabindex="-1">' +
      '<div class="editorial">' +
        '<div>' +
          '<p class="eyebrow">Nosotros</p>' +
          '<p class="editorial__quote">Patrimonio que trasciende.</p>' +
        '</div>' +
        '<div style="display:grid;gap:16px">' +
          '<p>Legato Capital acompaña decisiones de largo plazo: compra, renta e inversión en propiedades y terrenos con valor hoy y potencial para mañana.</p>' +
          '<p>Trabajamos con información verificable —superficie, frente, uso de suelo y estado real— para que cada decisión se tome con claridad y no con urgencia.</p>' +
          '<div><button class="btn btn--olive" data-action="contact">Hablar con un asesor</button></div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function quick(label, patch) {
    return '<button class="chip" data-action="quick" data-patch=\'' + esc(JSON.stringify(patch)) + '\'>' + esc(label) + "</button>";
  }
  function pillar(n, title, text) {
    return '<div class="pillar"><p class="pillar__num">' + n + '</p><h3>' + esc(title) + '</h3><p>' + esc(text) + "</p></div>";
  }

  /* ---------- Resultados ---------- */

  function viewResults() {
    var results = filtered(state);
    var n = activeFilterCount(state);
    var cs = chips(state);

    var toolbar = '' +
    '<div class="toolbar">' +
      '<div class="container toolbar__inner">' +
        '<div class="searchline">' +
          '<div class="toolbar__desktop" role="tablist" aria-label="Operación">' +
            '<button class="chip' + (state.op === "venta" ? " is-on" : "") + '" role="tab" aria-selected="' + (state.op === "venta") + '" data-action="set-op" data-op="venta">Comprar</button>' +
            '<button class="chip' + (state.op === "renta" ? " is-on" : "") + '" role="tab" aria-selected="' + (state.op === "renta") + '" data-action="set-op" data-op="renta">Rentar</button>' +
          '</div>' +
          '<form class="searchline__input" id="results-search" role="search">' +
            icon("search", 18) +
            '<label class="sr-only" for="q-results">Buscar por colonia, alcaldía o ciudad</label>' +
            '<input id="q-results" name="q" type="search" enterkeyhint="search" placeholder="Colonia, alcaldía o ciudad" value="' + esc(state.q) + '">' +
          '</form>' +
          '<button class="chip' + (n ? " is-on" : "") + '" data-action="filters-open" aria-haspopup="dialog">' +
            icon("filter", 17) + 'Filtros' + (n ? '<span class="filterbtn__count">' + n + "</span>" : "") +
          '</button>' +
        '</div>' +

        (cs.length ? '<div class="chiprow" aria-label="Filtros activos">' +
          cs.map(function (c) {
            return '<button class="chip chip--removable" data-action="chip-clear" data-key="' + c.key + '" aria-label="Quitar filtro ' + esc(c.label) + '">' + esc(c.label) + ' ×</button>';
          }).join("") +
          '<button class="btn btn--link" data-action="clear-all" style="font-size:13px;color:var(--text-secondary)">Limpiar filtros</button>' +
        '</div>' : "") +

        '<div class="resultline">' +
          '<p class="resultline__count" aria-live="polite">' + esc(countLine(results)) + '</p>' +
          '<label class="sortline">Ordenar' +
            '<select id="sort" name="sort">' + optionsHTML(CAT.ordenes, state.sort) + '</select>' +
          '</label>' +
        '</div>' +
      '</div>' +
    '</div>';

    var body;
    if (state.error) {
      body = '<div class="state"><h3>No pudimos cargar las propiedades.</h3><p>Revisa tu conexión e inténtalo otra vez.</p>' +
        '<button class="btn btn--primary" data-action="retry">Intentar de nuevo</button></div>';
    } else if (state.loading) {
      body = '<div class="grid">' + skeletonHTML(6) + "</div>";
    } else if (!results.length) {
      body = '<div class="state"><h3>No encontramos propiedades con esos filtros.</h3>' +
        '<p>Prueba ampliando la zona o el rango de precio.</p>' +
        '<button class="btn btn--primary" data-action="filters-open">Modificar filtros</button></div>';
    } else {
      body = '<div class="grid">' + results.map(function (p) { return cardHTML(p); }).join("") + "</div>";
    }

    return toolbar + '<div class="container results">' + body + '</div>';
  }

  function countLine(results) {
    var where = state.q.trim() ? " en " + state.q.trim() : " en Ciudad de México";
    return results.length + (results.length === 1 ? " propiedad" : " propiedades") + where;
  }

  /* ---------- Guardados ---------- */

  function viewSaved() {
    var saved = DATA.filter(function (p) { return state.favs[p.slug]; });
    return '<div class="container results">' +
      '<p class="eyebrow">Tu selección</p>' +
      '<h1 style="margin-top:12px">Guardados</h1>' +
      (saved.length
        ? '<p class="lead" style="margin-top:12px">' + saved.length + (saved.length === 1 ? " propiedad guardada" : " propiedades guardadas") + ' en este dispositivo.</p>' +
          '<div class="grid" style="margin-top:32px">' + saved.map(function (p) { return cardHTML(p); }).join("") + "</div>"
        : '<div class="state" style="margin-top:24px"><h3>Aún no guardas propiedades.</h3>' +
          '<p>Toca el marcador de una propiedad para conservarla aquí y compararla después.</p>' +
          '<button class="btn btn--primary" data-action="search">Explorar propiedades</button></div>') +
    '</div>';
  }

  /* ---------- Detalle ---------- */

  function viewDetail() {
    var p = DATA.filter(function (x) { return x.slug === state.sel; })[0];
    if (!p) return '<div class="container results"><div class="state"><h3>Esta propiedad ya no está disponible.</h3><p>Puede haberse retirado del catálogo.</p><button class="btn btn--primary" data-action="search">Ver propiedades</button></div></div>';

    var fav = !!state.favs[p.slug];
    var total = Math.max(1, p.fotosCount || 1);
    var slides = "";
    for (var i = 0; i < total; i++) {
      slides += '<div class="gallery__slide">' + photoHTML(p, i, i === 0 ? "Fachada o contexto · " + p.title : "Fotografía " + (i + 1) + " de " + total) + "</div>";
    }

    var specs = [
      ["Operación", p.op === "renta" ? "Renta" : "Venta"],
      ["Superficie de terreno", p.terreno ? p.terreno.toLocaleString("en-US") + " m²" : "—"],
      ["Superficie construida", p.construido ? p.construido + " m²" : "—"],
      ["Frente", p.frente],
      ["Recámaras", p.rec || "—"],
      ["Baños", p.ban || "—"],
      ["Estacionamientos", p.autos || "—"],
      ["Estado", p.remodelar ? "Para remodelar" : "Habitable / libre"]
    ];

    var similares = DATA.filter(function (x) { return x.slug !== p.slug && x.tipo === p.tipo && x.op === p.op; }).slice(0, 3);
    if (!similares.length) similares = DATA.filter(function (x) { return x.slug !== p.slug && x.op === p.op; }).slice(0, 3);

    return '' +
    '<div class="container detail">' +
      '<nav class="breadcrumb" aria-label="Ruta">' +
        '<button data-action="home">Inicio</button><span aria-hidden="true">/</span>' +
        '<button data-action="search">Resultados</button><span aria-hidden="true">/</span>' +
        '<span class="breadcrumb__current" aria-current="page">' + esc(p.title) + '</span>' +
      '</nav>' +

      '<div class="gallery" id="gallery">' +
        '<div class="gallery__track" id="gallery-track" tabindex="0" role="region" aria-label="Galería de ' + esc(p.title) + ' — desliza para ver más">' + slides + '</div>' +
        '<p class="gallery__counter" id="gallery-counter" aria-live="polite">1 / ' + total + '</p>' +
        '<div class="gallery__side" aria-hidden="true">' +
          '<div>' + photoHTML(p, 1, "Fachada o contexto") + '</div>' +
          '<div>' + photoHTML(p, 2, "Interior / estado actual") + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="detail__head">' +
        '<div>' +
          '<p class="eyebrow">' + esc(tipoLabel(p)) + ' · ' + esc(p.badge) + '</p>' +
          '<h1>' + esc(p.title) + '</h1>' +
          '<p class="detail__zona">' + esc(p.zona) + '</p>' +
        '</div>' +
        '<div class="detail__actions">' +
          '<button class="btn btn--quiet btn--sm" data-action="share">Compartir</button>' +
          '<button class="btn btn--quiet btn--sm" data-action="fav" data-slug="' + esc(p.slug) + '" aria-pressed="' + fav + '">' + favIcon(fav, 17) + (fav ? "Guardada" : "Guardar") + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="detail__layout">' +
        '<div>' +
          '<p class="detail__price"><span aria-hidden="true">' + esc(money(p.price, p.op)) + '</span><span class="sr-only">' + esc(priceLabel(p.price, p.op)) + '</span></p>' +
          '<p class="detail__pricemeta">' + esc(metaLine(p)) + '</p>' +
          '<hr class="rule" style="margin-top:32px">' +

          '<h2>Descripción</h2>' +
          '<p class="body">' + esc(p.desc) + '</p>' +

          '<div class="potential">' +
            '<h2>¿Por qué tiene potencial?</h2>' +
            '<p class="body">' + esc(p.potencial) + '</p>' +
            '<p class="potential__note">Las posibilidades arquitectónicas se presentan como posibilidades, sujetas a normativa y validación técnica.</p>' +
          '</div>' +

          '<h2>Terreno y construcción</h2>' +
          '<dl class="specs">' + specs.map(function (s) {
            return '<div class="spec"><dt>' + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd></div>";
          }).join("") + '</dl>' +

          '<h2>Ubicación</h2>' +
          '<div class="location">' +
            icon("pin", 20) +
            '<p class="location__zona">' + esc(p.zona) + '</p>' +
            '<a class="btn btn--quiet" href="' + esc(mapsUrl(p)) + '" target="_blank" rel="noopener noreferrer">' +
              'Ver en Google Maps<span class="sr-only"> (se abre en una pestaña nueva)</span>' + icon("external", 16) +
            '</a>' +
          '</div>' +
        '</div>' +

        '<aside class="aside">' +
          '<p class="aside__label">Asesor patrimonial</p>' +
          '<p class="aside__name">Legato Capital · ' + esc(p.zona.split(",")[0]) + '</p>' +
          '<button class="btn btn--primary btn--block" data-action="contact">Contactar</button>' +
          '<button class="btn btn--olive btn--block" data-action="visita">Agendar visita</button>' +
          '<button class="btn btn--link btn--block" data-action="save-search">Guardar búsqueda</button>' +
          '<p class="aside__note">Respondemos con información verificable sobre superficie, uso de suelo y estado del inmueble.</p>' +
        '</aside>' +
      '</div>' +

      '<hr class="rule" style="margin-top:64px">' +
      '<h2 style="margin-block:48px 24px">Propiedades similares</h2>' +
      '<div class="scroller">' + similares.map(function (s) { return cardHTML(s, "compact"); }).join("") + '</div>' +
    '</div>' +

    '<div class="actionbar">' +
      '<div class="actionbar__price"><span>' + (p.op === "renta" ? "Renta mensual" : "Precio") + '</span>' +
        '<strong aria-hidden="true">' + esc(shortMoney(p.price, p.op)) + ' MXN</strong>' +
        '<span class="sr-only">' + esc(priceLabel(p.price, p.op)) + '</span></div>' +
      '<button class="btn btn--primary" data-action="contact">Contactar</button>' +
    '</div>';
  }

  /* ---------- Navegación ---------- */

  function navItems() {
    return [
      { label: "Comprar", on: state.screen === "results" && state.op === "venta", patch: { op: "venta", tipo: "Todos", remodelar: false } },
      { label: "Rentar", on: state.op === "renta", patch: { op: "renta", tipo: "Todos", remodelar: false } },
      { label: "Terrenos", on: state.tipo === "Terrenos", patch: { tipo: "Terrenos" } },
      { label: "Inversión", on: state.sort === "Mayor terreno", patch: { tipo: "Todos", sort: "Mayor terreno" } }
    ];
  }

  function renderNav() {
    var items = navItems();
    var desktop = items.map(function (n) {
      return '<button class="navlink' + (n.on ? " is-active" : "") + '" data-action="quick" data-patch=\'' + esc(JSON.stringify(n.patch)) + '\'>' + esc(n.label) + "</button>";
    }).join("") + '<button class="navlink" data-action="nosotros">Nosotros</button>';
    document.getElementById("nav-desktop").innerHTML = desktop;

    document.getElementById("nav-mobile").innerHTML = items.map(function (n) {
      return '<button class="drawer__link" data-action="quick" data-patch=\'' + esc(JSON.stringify(n.patch)) + '\'>' + esc(n.label) +
        (n.on ? '<span class="sr-only"> (activo)</span>' : "") + "</button>";
    }).join("") + '<button class="drawer__link" data-action="nosotros">Nosotros</button>';

    var tabs = [
      { key: "home", label: "Inicio", ico: "home", action: "home" },
      { key: "results", label: "Buscar", ico: "search", action: "search" },
      { key: "saved", label: "Guardados", ico: "bookmark", action: "favs" },
      { key: "perfil", label: "Perfil", ico: "user", action: "cuenta" }
    ];
    var fc = favCount();
    bottomnav.innerHTML = tabs.map(function (t) {
      var current = state.screen === t.key || (t.key === "results" && state.screen === "detail");
      return '<button class="bottomnav__item" data-action="' + t.action + '"' + (current ? ' aria-current="page"' : "") + '>' +
        icon(t.ico, 22) +
        (t.key === "saved" && fc ? '<span class="bottomnav__badge" aria-hidden="true">' + fc + "</span>" : "") +
        '<span>' + t.label + "</span></button>";
    }).join("");
  }

  /* ============================ render ============================ */

  function render() {
    var html = state.screen === "results" ? viewResults()
             : state.screen === "detail" ? viewDetail()
             : state.screen === "saved" ? viewSaved()
             : viewHome();
    main.innerHTML = html;
    renderNav();
    document.body.classList.toggle("has-actionbar", state.screen === "detail");
    document.title = state.screen === "detail"
      ? ((DATA.filter(function (p) { return p.slug === state.sel; })[0] || {}).title || "Propiedad") + " · Legato Capital"
      : state.screen === "results" ? "Resultados · Legato Capital"
      : state.screen === "saved" ? "Guardados · Legato Capital"
      : "Legato Capital · Patrimonio que trasciende";
    bindViewEvents();
  }

  function bindViewEvents() {
    var homeForm = document.getElementById("home-search");
    if (homeForm) {
      homeForm.addEventListener("submit", function (e) {
        e.preventDefault();
        state.q = homeForm.q.value;
        state.tipo = homeForm.tipo.value;
        state.max = Number(homeForm.max.value) || 0;
        go("results");
      });
      homeForm.tipo.addEventListener("change", function () { state.tipo = this.value; });
      homeForm.max.addEventListener("change", function () { state.max = Number(this.value) || 0; });
    }

    var resultsForm = document.getElementById("results-search");
    if (resultsForm) {
      resultsForm.addEventListener("submit", function (e) {
        e.preventDefault();
        state.q = resultsForm.q.value;
        resultsForm.q.blur();
        go("results", null, { replace: true });
      });
    }

    var sort = document.getElementById("sort");
    if (sort) sort.addEventListener("change", function () {
      state.sort = this.value;
      go("results", null, { replace: true });
    });

    var track = document.getElementById("gallery-track");
    if (track) {
      var counter = document.getElementById("gallery-counter");
      var total = track.children.length;
      track.addEventListener("scroll", function () {
        var i = Math.round(track.scrollLeft / track.clientWidth) + 1;
        counter.textContent = Math.min(Math.max(i, 1), total) + " / " + total;
      }, { passive: true });
    }
  }

  /* ============================ drawer ============================ */

  function openDrawer() {
    lastFocus = document.activeElement;
    drawer.hidden = false; overlay.hidden = false;
    requestAnimationFrame(function () {
      drawer.classList.add("is-open");
      overlay.classList.add("is-open");
    });
    document.body.classList.add("is-locked");
    setExpanded(true);
    focusFirst(drawer);
  }
  function closeDrawer(silent) {
    if (drawer.hidden) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setExpanded(false);
    setTimeout(function () { drawer.hidden = true; if (sheet.hidden) overlay.hidden = true; }, 320);
    if (!silent && lastFocus) lastFocus.focus();
  }
  function setExpanded(v) {
    var btn = document.querySelector('[data-action="menu-open"]');
    if (btn) btn.setAttribute("aria-expanded", String(v));
  }

  /* ============================ bottom sheet de filtros ============================ */

  function optionChips(name, value, opts) {
    return '<div class="optionrow" role="group" aria-label="' + esc(name) + '">' + opts.map(function (o) {
      return '<button type="button" class="chip' + (Number(value) === o.v ? " is-on" : "") + '" data-draft="' + esc(name) + '" data-value="' + o.v + '" aria-pressed="' + (Number(value) === o.v) + '">' + esc(o.l) + "</button>";
    }).join("") + "</div>";
  }

  function sheetHTML() {
    var count = filtered(draft).length;
    var priceError = draft.min && draft.max && draft.max < draft.min;
    var rooms = [{ v: 0, l: "Indistinto" }, { v: 1, l: "1+" }, { v: 2, l: "2+" }, { v: 3, l: "3+" }, { v: 4, l: "4+" }];

    return '' +
    '<div class="sheet__head">' +
      '<h2 id="sheet-title">Filtros</h2>' +
      '<button class="icon-btn" data-action="filters-close" aria-label="Cerrar filtros">' + icon("close", 22) + '</button>' +
    '</div>' +

    '<div class="sheet__body">' +
      '<fieldset class="fieldset">' +
        '<legend>Operación</legend>' +
        '<div class="optionrow">' +
          '<button type="button" class="chip' + (draft.op === "venta" ? " is-on" : "") + '" data-draft="op" data-value="venta" aria-pressed="' + (draft.op === "venta") + '">Comprar</button>' +
          '<button type="button" class="chip' + (draft.op === "renta" ? " is-on" : "") + '" data-draft="op" data-value="renta" aria-pressed="' + (draft.op === "renta") + '">Rentar</button>' +
        '</div>' +
      '</fieldset>' +

      '<fieldset class="fieldset">' +
        '<legend>Tipo de propiedad</legend>' +
        '<div class="field">' +
          '<label class="sr-only" for="f-tipo">Tipo de propiedad</label>' +
          '<select id="f-tipo" data-draft="tipo">' + optionsHTML(CAT.tipos, draft.tipo) + '</select>' +
        '</div>' +
        '<div class="switch" style="margin-top:12px">' +
          '<label for="f-remodelar">Solo propiedades para remodelar</label>' +
          '<input type="checkbox" id="f-remodelar" data-draft="remodelar"' + (draft.remodelar ? " checked" : "") + '>' +
        '</div>' +
      '</fieldset>' +

      '<fieldset class="fieldset">' +
        '<legend>' + (draft.op === "renta" ? "Renta mensual (MXN)" : "Precio (MXN)") + '</legend>' +
        '<div class="pair">' +
          '<div class="field"><label for="f-min">Mínimo</label>' +
            '<input type="text" inputmode="numeric" id="f-min" data-draft="min" value="' + (draft.min ? draft.min.toLocaleString("en-US") : "") + '" placeholder="Sin mínimo"></div>' +
          '<div class="field' + (priceError ? " field--error" : "") + '"><label for="f-max">Máximo</label>' +
            '<input type="text" inputmode="numeric" id="f-max" data-draft="max" value="' + (draft.max ? draft.max.toLocaleString("en-US") : "") + '" placeholder="Sin máximo"' +
            (priceError ? ' aria-invalid="true" aria-describedby="f-max-error"' : "") + '></div>' +
        '</div>' +
        (priceError ? '<p class="field__error" id="f-max-error">' + icon("alert", 16) + 'El precio máximo debe ser mayor al mínimo.</p>' : "") +
      '</fieldset>' +

      '<fieldset class="fieldset">' +
        '<legend>Superficie</legend>' +
        '<div class="pair">' +
          '<div class="field"><label for="f-terreno">Terreno mínimo (m²)</label>' +
            '<input type="text" inputmode="numeric" id="f-terreno" data-draft="terrenoMin" value="' + (draft.terrenoMin || "") + '" placeholder="Indistinto"></div>' +
          '<div class="field"><label for="f-const">Construido mínimo (m²)</label>' +
            '<input type="text" inputmode="numeric" id="f-const" data-draft="constMin" value="' + (draft.constMin || "") + '" placeholder="Indistinto"></div>' +
        '</div>' +
      '</fieldset>' +

      '<fieldset class="fieldset"><legend>Recámaras</legend>' + optionChips("rec", draft.rec, rooms) + '</fieldset>' +
      '<fieldset class="fieldset"><legend>Baños</legend>' + optionChips("ban", draft.ban, rooms) + '</fieldset>' +
      '<fieldset class="fieldset"><legend>Estacionamientos</legend>' + optionChips("autos", draft.autos, rooms) + '</fieldset>' +
    '</div>' +

    '<div class="sheet__foot">' +
      '<button class="btn btn--link" data-action="filters-clear">Limpiar</button>' +
      '<button class="btn btn--primary" data-action="filters-apply"' + (priceError ? " disabled" : "") + '>' +
        (count === 1 ? "Ver 1 propiedad" : "Ver " + count + " propiedades") + '</button>' +
    '</div>';
  }

  function openSheet() {
    lastFocus = document.activeElement;
    draft = Object.assign({}, state);
    sheet.innerHTML = sheetHTML();
    sheet.hidden = false; overlay.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add("is-open");
      overlay.classList.add("is-open");
    });
    document.body.classList.add("is-locked");
    focusFirst(sheet);
  }
  function refreshSheet() {
    var scroll = sheet.querySelector(".sheet__body");
    var top = scroll ? scroll.scrollTop : 0;
    var activeId = document.activeElement && document.activeElement.id;
    sheet.innerHTML = sheetHTML();
    var body = sheet.querySelector(".sheet__body");
    if (body) body.scrollTop = top;
    if (activeId) {
      var el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (el.setSelectionRange) {
          try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
        }
      }
    }
  }
  function closeSheet(silent) {
    if (sheet.hidden) return;
    sheet.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(function () { sheet.hidden = true; if (drawer.hidden) overlay.hidden = true; }, 320);
    draft = null;
    if (!silent && lastFocus) lastFocus.focus();
  }

  function focusFirst(root) {
    var el = root.querySelector("button, input, select, a[href], [tabindex]:not([tabindex='-1'])");
    if (el) el.focus();
  }

  function trapFocus(e, root) {
    if (e.key !== "Tab") return;
    var els = root.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]");
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ============================ eventos ============================ */

  function numFrom(v) { return Number(String(v).replace(/[^0-9]/g, "")) || 0; }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action], [data-draft], .card");
    if (!t) return;

    // Botones dentro del bottom sheet que editan el borrador
    if (t.hasAttribute("data-draft") && t.tagName === "BUTTON") {
      var key = t.getAttribute("data-draft");
      var val = t.getAttribute("data-value");
      draft[key] = key === "op" ? val : Number(val);
      if (key === "op") { draft.min = 0; draft.max = 0; }
      refreshSheet();
      return;
    }

    var action = t.getAttribute("data-action");

    // Card completa clicable, pero el marcador conserva acción propia.
    if (!action && t.classList.contains("card")) {
      go("detail", { sel: t.getAttribute("data-slug") });
      return;
    }

    switch (action) {
      case "home": e.preventDefault(); go("home"); break;
      case "menu-open": openDrawer(); break;
      case "menu-close": closeDrawer(); break;
      case "favs": closeDrawer(true); go("saved"); break;
      case "nosotros": {
        closeDrawer(true);
        if (state.screen !== "home") go("home");
        setTimeout(function () {
          var el = document.getElementById("nosotros");
          if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus({ preventScroll: true }); }
        }, 60);
        break;
      }
      case "publicar": toast("Publicar propiedad estará disponible en la siguiente fase."); closeDrawer(); break;
      case "cuenta": toast("El acceso a Cuenta estará disponible en la siguiente fase."); closeDrawer(); break;
      case "set-op":
        state.op = t.getAttribute("data-op");
        state.max = 0; state.min = 0;
        if (state.screen === "results") go("results", null, { replace: true }); else render();
        break;
      case "search": e.preventDefault(); go("results"); break;
      case "quick": {
        var patch = JSON.parse(t.getAttribute("data-patch"));
        closeDrawer(true);
        go("results", patch);
        break;
      }
      case "open": e.preventDefault(); go("detail", { sel: t.getAttribute("data-slug") }); break;
      case "fav": {
        e.preventDefault(); e.stopPropagation();
        var slug = t.getAttribute("data-slug");
        var on = !state.favs[slug];
        if (on) state.favs[slug] = true; else delete state.favs[slug];
        saveFavs();
        toast(on ? "Propiedad guardada." : "Propiedad quitada de Guardados.");
        render();
        break;
      }
      case "chip-clear": {
        var k = t.getAttribute("data-key");
        if (k === "precio") { state.min = 0; state.max = 0; }
        else if (k === "q") state.q = "";
        else if (k === "tipo") state.tipo = "Todos";
        else if (k === "remodelar") state.remodelar = false;
        else state[k] = 0;
        go("results", null, { replace: true });
        break;
      }
      case "clear-all":
        Object.assign(state, DEFAULTS, { op: state.op, sort: state.sort });
        go("results", null, { replace: true });
        break;
      case "filters-open": openSheet(); break;
      case "filters-close": closeSheet(); break;
      case "filters-clear":
        draft = Object.assign({}, draft, DEFAULTS, { op: draft.op, sort: draft.sort, q: draft.q });
        refreshSheet();
        break;
      case "filters-apply":
        Object.assign(state, draft);
        closeSheet();
        go("results", null, { replace: true });
        break;
      case "retry": startLoading(); break;
      case "share": {
        var url = location.href;
        if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Enlace copiado."); });
        else toast(url);
        break;
      }
      case "contact": toast("Un asesor de Legato Capital te contactará para dar seguimiento."); break;
      case "visita": toast("Agenda de visitas disponible en la siguiente fase."); break;
      case "save-search": toast("Búsqueda guardada."); break;
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el.hasAttribute || !el.hasAttribute("data-draft") || !draft) return;
    var key = el.getAttribute("data-draft");
    if (el.type === "checkbox") { draft[key] = el.checked; refreshSheet(); return; }
    if (el.tagName === "SELECT") { draft[key] = el.value; refreshSheet(); return; }
    draft[key] = numFrom(el.value);
    // Actualiza el conteo del CTA sin reconstruir el campo que se está escribiendo.
    var cta = sheet.querySelector('[data-action="filters-apply"]');
    var bad = draft.min && draft.max && draft.max < draft.min;
    if (cta) {
      var c = filtered(draft).length;
      cta.textContent = c === 1 ? "Ver 1 propiedad" : "Ver " + c + " propiedades";
      cta.disabled = !!bad;
    }
    var hasError = !!sheet.querySelector("#f-max-error");
    if (!!bad !== hasError) refreshSheet();
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute("data-draft") && draft && el.tagName === "SELECT") {
      draft[el.getAttribute("data-draft")] = el.value;
      refreshSheet();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!sheet.hidden) { closeSheet(); return; }
      if (!drawer.hidden) { closeDrawer(); return; }
    }
    if (!sheet.hidden) trapFocus(e, sheet);
    else if (!drawer.hidden) trapFocus(e, drawer);
  });

  overlay.addEventListener("click", function () {
    if (!sheet.hidden) closeSheet();
    else closeDrawer();
  });

  window.addEventListener("hashchange", function () {
    route();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });

  // Arranque
  if (!location.hash) history.replaceState(null, "", "#/");
  route(true);
})();
