// My Aloha Map — client behavior: hamburger nav, category scroller, search→results,
// near-me, image cards, My Spots (localStorage), map, nonprofit finder, form capture.
(function () {
  var KEY = "aloha_spots";
  function getSpots() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function setSpots(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
  function esc(s) { return (s == null ? "" : "" + s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function distMi(a, b, c, d) { var R = 3959, p = Math.PI / 180, x = Math.sin((c - a) * p / 2), y = Math.sin((d - b) * p / 2); var h = x * x + Math.cos(a * p) * Math.cos(c * p) * y * y; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); }

  // ---- save hearts -----------------------------------------------------
  function paintHearts() {
    var s = getSpots();
    document.querySelectorAll(".save").forEach(function (b) {
      var on = s.indexOf(b.dataset.slug) > -1;
      b.classList.toggle("on", on); b.textContent = on ? "♥" : "♡";
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".save"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var s = getSpots(), i = s.indexOf(b.dataset.slug);
    if (i > -1) s.splice(i, 1); else s.push(b.dataset.slug);
    setSpots(s); paintHearts();
  });

  // ---- shared image-card renderer -------------------------------------
  function rcard(l, prefix, dist) {
    prefix = prefix || "";
    var locbase = (l.city || "") + (l.state ? ", " + l.state : "");
    var distp = (dist != null ? Math.round(dist) + " mi · " : "");
    var locline = l.city ? ("📍 " + distp + esc(locbase))
                : (l.online ? "🌐 Online" : (l.remote ? "💻 Remote" : "📍 " + esc(locbase)));
    var rate = l.rating ? ("⭐ " + l.rating + (l.reviews ? ' <span class="rc">(' + l.reviews + ")</span>" : "")) : (l.reviews ? "⭐ " + l.reviews : "");
    var col = ((window.__CATCOLORS || {})[l.category]) || (window.__DEFPIN || "#0288D1");
    var img = l.image ? '<img src="' + l.image + '" loading="lazy" referrerpolicy="no-referrer" alt="' + esc(l.name) + '" onerror="this.remove()">' : "";
    var v = l.verified ? '<span class="vtag">🌺</span>' : "";
    var pu = l.popup ? '<span class="putag">🎪 Pop-ups</span>' : "";
    var ol = l.online ? '<span class="ontag">🛒 Online</span>' : "";
    var rm = l.remote ? '<span class="rmtag">💻 Remote</span>' : "";
    var badge = l.recs ? '<span class="badge love">❤️ ' + l.recs + " local" + (l.recs != 1 ? "s" : "") + "</span>"
              : (l.fav ? '<span class="badge fav">⭐ Favorite</span>' : "");
    return '<div class="lcard" data-slug="' + l.slug + '"><button class="save" data-slug="' + l.slug + '">♡</button>' + badge +
      '<a class="lcard-body" href="' + prefix + l.slug + '/"><div class="lcard-img" style="background:' + col + '1f">' + img +
      '<span class="lcard-emoji">' + (l.emoji || "🏬") + "</span></div>" +
      '<div class="lcard-txt"><span class="cat">' + esc(l.catlabel || l.category || "") + "</span>" + v + pu + ol + rm +
      "<h3>" + esc(l.name) + '</h3><div class="city">' + locline + (rate ? " · " + rate : "") + "</div></div></a></div>";
  }

  function applyHref(a) {
    a = String(a).trim(); var h;
    if (/^https?:\/\//i.test(a)) h = a;
    else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) h = "mailto:" + a;
    else if (/^[\d()+\-.\s]{7,}$/.test(a)) h = "tel:" + a.replace(/[^\d+]/g, "");
    else return '<span class="japply-txt">Apply: ' + esc(a) + "</span>";
    return '<a class="btn btn-primary japply" href="' + h + '" target="_blank" rel="noopener">Apply →</a>';
  }

  // ---- hamburger dropdown (all pages) ---------------------------------
  var menuBtn = document.getElementById("menuBtn"), dropnav = document.getElementById("dropnav");
  if (menuBtn && dropnav) menuBtn.addEventListener("click", function () {
    var open = dropnav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.textContent = open ? "✕" : "☰";
  });

  // ---- homepage: category scroller + search + near-me -----------------
  var shelves = document.getElementById("shelves"), resultsSec = document.getElementById("resultsSec");
  if (shelves && window.__ALL) {
    var q = document.getElementById("q"), resultsEl = document.getElementById("results"),
        emptyEl = document.getElementById("empty"), rtitle = document.getElementById("resultsTitle"),
        curCat = "all";
    function showShelves() { resultsSec.hidden = true; shelves.hidden = false; }
    function gridOf(list, cap) { return '<div class="listings-grid">' + list.slice(0, cap || 300).map(function (l) { return rcard(l, ""); }).join("") + "</div>"; }
    function showResults(list, title) {
      rtitle.textContent = title + " · " + list.length;
      if (curCat !== "all" || list.length === 0) {
        resultsEl.innerHTML = gridOf(list);                     // one category → flat grid
      } else {
        var groups = {};                                        // cross-category search → group by type
        list.forEach(function (l) { (groups[l.category] = groups[l.category] || []).push(l); });
        resultsEl.innerHTML = Object.keys(groups)
          .sort(function (a, b) { return groups[b].length - groups[a].length; })
          .map(function (cat) {
            return '<div class="resgroup"><h3 class="resgroup-h">' + cat + ' <span>(' + groups[cat].length + ")</span></h3>" + gridOf(groups[cat], 60) + "</div>";
          }).join("");
      }
      emptyEl.hidden = list.length > 0;
      shelves.hidden = true; resultsSec.hidden = false; paintHearts();
    }
    function applyFilter() {
      var t = (q && q.value || "").toLowerCase().trim();
      if (curCat === "all" && !t) { showShelves(); return; }
      var list = window.__ALL.filter(function (l) {
        return (curCat === "all" || l.category === curCat) && (!t || l.search.indexOf(t) > -1);
      });
      var title = t ? '“' + q.value.trim() + '”' + (curCat !== "all" ? " in " + curCat : "") : curCat;
      showResults(list, title);
    }
    if (q) q.addEventListener("input", applyFilter);
    var chips = [].slice.call(document.querySelectorAll(".cchip"));
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on"); curCat = ch.dataset.cat; applyFilter();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    document.querySelectorAll(".shelf-more").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.dataset.cat, chip = null;
        chips.forEach(function (x) { if (x.dataset.cat === cat) chip = x; });
        if (chip) chip.click();
      });
    });
    document.querySelectorAll(".quicks button").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!q) return;
        chips.forEach(function (x) { x.classList.remove("on"); });
        var allChip = document.querySelector('.cchip[data-cat="all"]'); if (allChip) allChip.classList.add("on");
        curCat = "all"; q.value = b.dataset.s; applyFilter();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    var nearBtn = document.getElementById("nearBtn"), nearShelf = document.getElementById("nearshelf");
    if (nearBtn) nearBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { alert("Location isn't available on this device."); return; }
      nearBtn.textContent = "📍 Locating…"; nearBtn.classList.add("on");
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, ln = pos.coords.longitude;
        var near = window.__ALL.filter(function (l) { return l.lat != null; })
          .map(function (l) { l._d = distMi(la, ln, l.lat, l.lng); return l; })
          .sort(function (a, b) { return a._d - b._d; }).slice(0, 16);
        if (nearShelf) {
          nearShelf.querySelector(".hscroll").innerHTML = near.map(function (l) { return rcard(l, "", l._d); }).join("");
          nearShelf.hidden = false; paintHearts();
          nearShelf.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        nearBtn.textContent = "📍 Near you";
      }, function () { nearBtn.textContent = "📍 Near me"; nearBtn.classList.remove("on"); alert("Couldn't get your location."); });
    });
  }
  paintHearts();

  // ---- "Get it While You Can" live finds feed -------------------------
  var findsfeed = document.getElementById("findsfeed");
  if (findsfeed && window.__FINDS_URL) {
    var timeAgo = function (ts) {
      try {
        var s = (Date.now() - new Date(ts).getTime()) / 1000;
        if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
        if (s < 86400) return Math.round(s / 3600) + "h ago";
        return Math.round(s / 86400) + "d ago";
      } catch (e) { return ""; }
    };
    fetch(window.__FINDS_URL).then(function (r) { return r.json(); }).then(function (list) {
      if (!list || !list.length) { findsfeed.innerHTML = '<p class="findsloading">No finds yet — be the first to post one below! 🔥</p>'; return; }
      findsfeed.innerHTML = list.map(function (f) {
        var img = f.photo ? '<div class="find-img"><img src="' + f.photo + '" loading="lazy" referrerpolicy="no-referrer" alt="' + esc(f.item) + '" onerror="this.parentNode.remove()"></div>' : "";
        var price = f.price ? '<div class="find-price">' + esc(f.price) + "</div>" : "";
        var note = f.note ? '<div class="find-note">' + esc(f.note) + "</div>" : "";
        return '<div class="findcard">' + img + '<div class="find-body"><div class="find-item">' + esc(f.item) + "</div>" +
          '<div class="find-where">📍 ' + esc(f.store) + " · " + esc(f.area) + "</div>" + price + note +
          '<div class="find-meta">' + timeAgo(f.ts) + (f.name ? " · " + esc(f.name) : "") +
          ' · <a href="mailto:directory@myalohatown.org?subject=Report%20find">report</a></div></div></div>';
      }).join("");
    }).catch(function () { findsfeed.innerHTML = '<p class="findsloading">Couldn\'t load finds right now — try again shortly.</p>'; });
  }

  // ---- pop-up vendors page: category + search + travels-to-state ------
  var pugrid = document.getElementById("pugrid");
  if (pugrid && window.__POPUPS) {
    var puq = document.getElementById("puq"), pustate = document.getElementById("pustate"),
        puchips = [].slice.call(document.querySelectorAll(".cchip")), pucat = "all",
        puempty = document.getElementById("puempty");
    function purender() {
      var t = (puq && puq.value || "").toLowerCase().trim(), st = pustate ? pustate.value : "all";
      var list = window.__POPUPS.filter(function (l) {
        var okC = pucat === "all" || l.category === pucat;
        var okT = !t || l.search.indexOf(t) > -1;
        var okS = st === "all" || l.travels.indexOf(st) > -1 || l.travels.indexOf("NATIONWIDE") > -1 || (!l.travels && l.state === st);
        return okC && okT && okS;
      });
      pugrid.innerHTML = list.map(function (l) { return rcard(l, "../"); }).join("");
      if (puempty) puempty.hidden = list.length > 0;
      paintHearts();
    }
    if (puq) puq.addEventListener("input", purender);
    if (pustate) pustate.addEventListener("change", purender);
    puchips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        puchips.forEach(function (x) { x.classList.remove("on"); }); ch.classList.add("on"); pucat = ch.dataset.cat; purender();
      });
    });
    purender();
  }

  // ---- online & remote page: category + search + type ----------------
  var ogrid = document.getElementById("ogrid");
  if (ogrid && window.__ONLINE) {
    var oq = document.getElementById("oq"), rtype = document.getElementById("rtype"),
        ochips = [].slice.call(document.querySelectorAll(".cchip")), ocat = "all",
        oempty = document.getElementById("oempty");
    function orender() {
      var t = (oq && oq.value || "").toLowerCase().trim(), ty = rtype ? rtype.value : "all";
      var list = window.__ONLINE.filter(function (l) {
        var okC = ocat === "all" || l.category === ocat;
        var okT = !t || l.search.indexOf(t) > -1;
        var okY = ty === "all" || (ty === "online" && l.online) || (ty === "remote" && l.remote);
        return okC && okT && okY;
      });
      ogrid.innerHTML = list.map(function (l) { return rcard(l, "../"); }).join("");
      if (oempty) oempty.hidden = list.length > 0;
      paintHearts();
    }
    if (oq) oq.addEventListener("input", orender);
    if (rtype) rtype.addEventListener("change", orender);
    ochips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        ochips.forEach(function (x) { x.classList.remove("on"); }); ch.classList.add("on"); ocat = ch.dataset.cat; orender();
      });
    });
    orender();
  }

  // ---- jobs board: live feed (reviewed postings) ---------------------
  var jobsfeed = document.getElementById("jobsfeed");
  if (jobsfeed && window.__JOBS_URL) {
    var jAgo = function (ts) { try { var s = (Date.now() - new Date(ts).getTime()) / 1000; if (s < 86400) return "today"; return Math.round(s / 86400) + "d ago"; } catch (e) { return ""; } };
    fetch(window.__JOBS_URL).then(function (r) { return r.json(); }).then(function (list) {
      if (!list || !list.length) { jobsfeed.innerHTML = '<p class="findsloading">No open roles right now — check back soon, or post one below. 💼</p>'; return; }
      jobsfeed.innerHTML = list.map(function (j) {
        var loc = j.remote ? ("💻 Remote" + (j.location ? " · " + esc(j.location) : "")) : (j.location ? "📍 " + esc(j.location) : "");
        var pay = j.pay ? '<span class="jpay">' + esc(j.pay) + "</span>" : "";
        var ty = j.type ? '<span class="jtype">' + esc(j.type) + "</span>" : "";
        var applyLink = j.apply ? applyHref(j.apply) : "";
        return '<div class="jobcard"><div class="job-top"><div class="job-title">' + esc(j.title) + "</div>" + pay + "</div>" +
          '<div class="job-emp">' + esc(j.employer) + "</div>" +
          '<div class="job-meta">' + ty + (loc ? '<span class="jloc">' + loc + "</span>" : "") + '<span class="jage">' + jAgo(j.ts) + "</span></div>" +
          (j.description ? '<div class="job-desc">' + esc(j.description) + "</div>" : "") +
          (applyLink ? '<div class="job-apply">' + applyLink + "</div>" : "") + "</div>";
      }).join("");
    }).catch(function () { jobsfeed.innerHTML = '<p class="findsloading">Couldn\'t load jobs right now — try again shortly.</p>'; });
  }

  // ---- guides index: search + category filter -------------------------
  var gsearch = document.getElementById("guidesearch");
  if (gsearch) {
    var glinks = [].slice.call(document.querySelectorAll("#gall .glink"));
    var gchips = [].slice.call(document.querySelectorAll(".cchip"));
    var gcat = "all", gpop = document.getElementById("gpopular"), gempty = document.getElementById("gempty");
    function gapply() {
      var t = (gsearch.value || "").toLowerCase().trim(), n = 0;
      glinks.forEach(function (a) {
        var ok = (gcat === "all" || a.dataset.cat === gcat) && (!t || a.dataset.search.indexOf(t) > -1);
        a.style.display = ok ? "" : "none"; if (ok) n++;
      });
      if (gempty) gempty.hidden = n > 0;
      if (gpop) gpop.style.display = (t || gcat !== "all") ? "none" : "";
    }
    gsearch.addEventListener("input", gapply);
    gchips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        gchips.forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on"); gcat = ch.dataset.cat; gapply();
      });
    });
  }

  // ---- My Spots render (saved or shared via ?spots=) -------------------
  var sg = document.getElementById("spotsgrid");
  if (sg && window.__ALL) {
    var params = new URLSearchParams(location.search), shared = params.get("spots");
    var slugs = shared ? shared.split(",").filter(Boolean) : getSpots();
    var byslug = {}; window.__ALL.forEach(function (l) { byslug[l.slug] = l; });
    var html = slugs.map(function (sl) { return byslug[sl] ? rcard(byslug[sl], "../") : ""; }).join("");
    sg.innerHTML = html;
    var empty = document.getElementById("spotsempty"); if (empty) empty.style.display = html ? "none" : "block";
    if (shared) { var h1 = document.querySelector(".ghero h1"); if (h1) h1.innerHTML = '♡ <span class="g">A shared list</span>'; }
    paintHearts();
  }
  var share = document.getElementById("share");
  if (share) share.addEventListener("click", function () {
    var url = location.origin + location.pathname + "?spots=" + encodeURIComponent(getSpots().join(","));
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
      var ok = document.getElementById("shareok"); if (ok) { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2500); }
    }).catch(function () { prompt("Copy your list link:", url); });
  });

  // ---- map -------------------------------------------------------------
  var mapEl = document.getElementById("map");
  if (mapEl && window.__MAPDATA && window.L) {
    var m = L.map("map", { worldCopyJump: false, maxBounds: [[-85, -179.9], [85, 179.9]], maxBoundsViscosity: 1.0, minZoom: 2 }).setView([37.5, -119], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap", maxZoom: 18, noWrap: true, bounds: [[-90, -180], [90, 180]] }).addTo(m);
    var markers = [], group = [];
    window.__MAPDATA.forEach(function (p) {
      var icon = L.divIcon({ className: "pinwrap",
        html: '<div class="pin' + (p.v ? " v" : "") + '" style="background:' + p.col + '"><span>' + p.e + "</span></div>",
        iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16] });
      var mk = L.marker([p.lat, p.lng], { icon: icon }).bindPopup('<b>' + p.n + "</b><br>" + p.c + " · " + p.city +
        (p.v ? " · 🌺 Verified" : "") + '<br><a href="../' + p.s + '/">View listing →</a>');
      mk.addTo(m); markers.push({ mk: mk, cat: p.c }); group.push([p.lat, p.lng]);
    });
    if (group.length) m.fitBounds(group, { padding: [40, 40], maxZoom: 11 });
    if (navigator.geolocation) {                 // auto-zoom to the visitor's city if they allow it
      navigator.geolocation.getCurrentPosition(function (pos) {
        m.setView([pos.coords.latitude, pos.coords.longitude], 11);
      });
    }
    var legItems = [].slice.call(document.querySelectorAll("#maplegend .lgi"));
    var legendToggle = document.getElementById("legendToggle"), maplegend = document.getElementById("maplegend");
    if (legendToggle && maplegend) legendToggle.addEventListener("click", function () {
      legendToggle.setAttribute("aria-expanded", maplegend.classList.toggle("expanded") ? "true" : "false");
    });
    legItems.forEach(function (b) {
      b.addEventListener("click", function () {
        var cat = b.dataset.cat;
        legItems.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        markers.forEach(function (o) {
          var show = cat === "all" || o.cat === cat;
          if (show && !m.hasLayer(o.mk)) o.mk.addTo(m);
          else if (!show && m.hasLayer(o.mk)) m.removeLayer(o.mk);
        });
      });
    });
  }

  // ---- nonprofit finder ("support one near you") ----------------------
  var npf = document.getElementById("npfinder");
  if (npf && window.__NPS) {
    var NPS = window.__NPS, PFX = window.__NPPREFIX || "", box = document.getElementById("npresults");
    function npCard(n, dist) {
      return rcard({ slug: n.slug, name: n.name, city: n.city, state: n.state, emoji: n.e,
                     category: "Non-Profits", catlabel: "Nonprofit" + (n.eth ? " · " + n.eth : "") }, PFX, dist);
    }
    function draw(list, wd) { box.innerHTML = list.map(function (n) { return npCard(n, wd ? n._d : null); }).join(""); paintHearts(); }
    draw(NPS.slice(0, 6), false);
    var geoBtn = document.getElementById("npgeo"), stateSel = document.getElementById("npstate");
    if (geoBtn) geoBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { alert("Location isn't available — pick your state instead."); return; }
      geoBtn.textContent = "📍 Locating…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, ln = pos.coords.longitude;
        var wc = NPS.filter(function (n) { return n.lat != null; })
          .map(function (n) { n._d = distMi(la, ln, n.lat, n.lng); return n; })
          .sort(function (a, b) { return a._d - b._d; });
        draw(wc.slice(0, 6), true); geoBtn.textContent = "📍 Nonprofits near you";
        if (stateSel) stateSel.value = "";
      }, function () { geoBtn.textContent = "📍 Use my location"; alert("Couldn't get your location — pick your state instead."); });
    });
    if (stateSel) stateSel.addEventListener("change", function () {
      var s = stateSel.value;
      if (!s) { draw(NPS.slice(0, 6), false); return; }
      draw(NPS.filter(function (n) { return n.state === s; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 12), false);
    });
  }

  // ---- form submit: capture to endpoint (or demo confirm) -------------
  function finishForm(f) {
    f.querySelectorAll(".fld,button,.consent,input[type=email]").forEach(function (el) { el.style.display = "none"; });
    var ok = f.querySelector(".form-ok"); if (ok) ok.hidden = false;
  }
  document.querySelectorAll("form[data-capture],form[data-demo]").forEach(function (f) {
    // bot guard: hidden honeypot bait field + page-load timestamp
    f.insertAdjacentHTML("afterbegin",
      '<input type="text" name="url_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">');
    f._loaded = Date.now();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var url = f.getAttribute("data-capture");
      if (url) {
        var fd = new FormData(f);
        fd.append("ts", String(Date.now() - (f._loaded || 0)));
        try { fetch(url, { method: "POST", mode: "no-cors", body: fd }); } catch (err) {}
      }
      finishForm(f);
    });
  });
})();
