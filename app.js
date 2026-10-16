// My Aloha Map: client behavior: hamburger nav, category scroller, search→results,
// near-me, image cards, My Spots (localStorage), map, nonprofit finder, form capture.
(function () {
  var KEY = "aloha_spots";
  function getSpots() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function setSpots(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
  function esc(s) { return (s == null ? "" : "" + s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function distMi(a, b, c, d) { var R = 3959, p = Math.PI / 180, x = Math.sin((c - a) * p / 2), y = Math.sin((d - b) * p / 2); var h = x * x + Math.cos(a * p) * Math.cos(c * p) * y * y; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); }

  // ---- GA4 events (My Aloha Town's "My Aloha Map" property). Key events: call_click, directions_click,
  // website_click, claim_submit, add_business_submit. `listing` = the listing slug, never personal data.
  function track(name, params) {
    try { if (window.gtag) gtag("event", name, Object.assign({ listing: window.__LISTING || undefined }, params || {})); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    var href = a.getAttribute("href") || "", host = "";
    var slug = (a.closest("[data-slug]") || {}).dataset ? (a.closest("[data-slug]") || {dataset:{}}).dataset.slug : undefined;
    var base = slug ? { listing: slug } : {};
    if (/^tel:/i.test(href)) return track("call_click", base);
    if (/^mailto:/i.test(href)) return track("email_click", base);
    try { host = new URL(href, location.href).hostname.replace(/^www\./, ""); } catch (err) { return; }
    if (host === location.hostname) return;
    var dir = /google\.[a-z.]+$/.test(host) && /\/maps/.test(href) ? "google" : /maps\.apple\.com$/.test(host) ? "apple"
            : /waze\.com$/.test(host) ? "waze" : "";
    if (dir) return track("directions_click", Object.assign({ app: dir }, base));
    var type = /instagram\.com$/.test(host) ? "instagram" : /facebook\.com$|fb\.com$/.test(host) ? "facebook"
             : /tiktok\.com$/.test(host) ? "tiktok" : /youtube\.com$|youtu\.be$/.test(host) ? "youtube"
             : /yelp\.com$/.test(host) ? "yelp" : "website";
    if (/googletagmanager|tickettailor|myalohatown\.org$/.test(host)) return;
    track("website_click", Object.assign({ type: type, link_domain: host }, base));
  }, true);
  window.__track = track;

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
    if (i > -1) s.splice(i, 1); else { s.push(b.dataset.slug); track("save_spot", { listing: b.dataset.slug }); }
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
    // l.image is a site-root-relative thumbnail (photos/<slug>-480.webp) or a legacy absolute URL
    var isrc = l.image ? (/^https?:\/\//.test(l.image) ? l.image : prefix + l.image) : "";
    var img = isrc ? '<img src="' + isrc + '" width="480" height="300" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="' + esc(l.name) + '" onerror="this.remove()">' : "";
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

  // ---- homepage headline: rotating word every 4s ---------------------
  // The word sits in a fixed-height box (no layout shift); long words shrink to fit the width.
  var rw = document.getElementById("rotateWord");
  if (rw && rw.dataset.words) {
    var words = rw.dataset.words.split("|"), wi = 0, rbox = rw.parentNode;
    var fitWord = function () {
      rw.style.fontSize = "";
      var avail = rbox.clientWidth, need = rw.scrollWidth;
      if (avail && need > avail) rw.style.fontSize = Math.max(55, Math.floor(avail / need * 100) - 1) + "%";
    };
    fitWord();
    window.addEventListener("resize", fitWord);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
    setInterval(function () {
      wi = (wi + 1) % words.length;
      rw.style.opacity = "0";
      setTimeout(function () { rw.textContent = words[wi]; fitWord(); rw.style.opacity = "1"; }, 250);
    }, 2500);
  }

  // ---- listing map: below contact links on phones, sticky right column on desktop ----
  var mapInfo = document.getElementById("mapslot-info"), mapSide = document.getElementById("mapslot-side");
  if (mapInfo && mapSide && mapInfo.firstElementChild) {
    var mq = window.matchMedia("(min-width: 901px)");
    var placeMap = function () {
      var blk = document.querySelector(".mapblock"), dest = mq.matches ? mapSide : mapInfo;
      if (blk && blk.parentNode !== dest) dest.appendChild(blk);
    };
    placeMap();
    if (mq.addEventListener) mq.addEventListener("change", placeMap); else if (mq.addListener) mq.addListener(placeMap);
  }

  // ---- claim modal (listing pages) -----------------------------------
  var claimModal = document.getElementById("claimModal");
  if (claimModal) {
    var openClaim = function () { claimModal.hidden = false; document.body.style.overflow = "hidden"; };
    var closeClaim = function () { claimModal.hidden = true; document.body.style.overflow = ""; };
    [].slice.call(document.querySelectorAll("[data-claim-open]")).forEach(function (b) { b.addEventListener("click", openClaim); });
    [].slice.call(claimModal.querySelectorAll("[data-claim-close]")).forEach(function (x) { x.addEventListener("click", closeClaim); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !claimModal.hidden) closeClaim(); });
  }

  // ---- homepage: category scroller + search + near-me -----------------
  var shelves = document.getElementById("shelves"), resultsSec = document.getElementById("resultsSec");
  if (shelves && (window.__ALL || window.__ALL_URL)) {
    var qT = null, qLast = "";
    if (document.getElementById("q")) document.getElementById("q").addEventListener("input", function (e) {
      clearTimeout(qT); var t = e.target.value.trim().toLowerCase();
      qT = setTimeout(function () { if (t.length > 1 && t !== qLast) { qLast = t; track("search", { search_term: t }); } }, 1200);
    });
    var q = document.getElementById("q"), resultsEl = document.getElementById("results"),
        emptyEl = document.getElementById("empty"), rtitle = document.getElementById("resultsTitle"),
        curCat = "all", allP = null;
    // all-listings data comes from a versioned JSON file (not inlined), fetched after first paint
    // and on demand if someone searches first. Shelves are server-rendered and don't need it.
    function loadAll() {
      if (!allP) allP = (window.__ALL ? Promise.resolve(window.__ALL) :
        fetch(window.__ALL_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (list) {
          list.forEach(function (l) { l.search = (l.name + " " + l.category + " " + (l.kw || "") + " " + (l.city || "") + " " + (l.state || "")).toLowerCase(); });
          return (window.__ALL = list);
        })).catch(function (err) { allP = null; throw err; });
      return allP;
    }
    var warmAll = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(function () { loadAll().catch(function () {}); }); };
    if (document.readyState === "complete") warmAll(); else window.addEventListener("load", warmAll);
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
      var cat = curCat, raw = q ? q.value.trim() : "";
      loadAll().then(function (all) {
        if (cat !== curCat || raw !== (q ? q.value.trim() : "")) return;   // a newer filter is pending
        var list = all.filter(function (l) {
          return (cat === "all" || l.category === cat) && (!t || l.search.indexOf(t) > -1);
        });
        var title = t ? '“' + raw + '”' + (cat !== "all" ? " in " + cat : "") : cat;
        showResults(list, title);
      }).catch(function () {
        rtitle.textContent = "Couldn't load listings. Check your connection and try again.";
        resultsEl.innerHTML = ""; emptyEl.hidden = true; shelves.hidden = true; resultsSec.hidden = false;
      });
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
        loadAll().then(function (all) {
          var near = all.filter(function (l) { return l.lat != null; })
            .map(function (l) { l._d = distMi(la, ln, l.lat, l.lng); return l; })
            .sort(function (a, b) { return a._d - b._d; }).slice(0, 16);
          if (nearShelf) {
            nearShelf.querySelector(".hscroll").innerHTML = near.map(function (l) { return rcard(l, "", l._d); }).join("");
            nearShelf.hidden = false; paintHearts();
            nearShelf.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          nearBtn.textContent = "📍 Near you";
        }).catch(function () { nearBtn.textContent = "📍 Near me"; nearBtn.classList.remove("on"); alert("Couldn't load listings. Try again."); });
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
      if (!list || !list.length) { findsfeed.innerHTML = '<p class="findsloading">No deals right now. Check back soon! 🔥</p>'; return; }
      findsfeed.innerHTML = list.map(function (f) {
        var img = f.photo ? '<div class="find-img"><img src="' + f.photo + '" loading="lazy" referrerpolicy="no-referrer" alt="' + esc(f.item) + '" onerror="this.parentNode.remove()"></div>' : "";
        var price = f.price ? '<div class="find-price">' + esc(f.price) + "</div>" : "";
        var note = f.note ? '<div class="find-note">' + esc(f.note) + "</div>" : "";
        return '<div class="findcard">' + img + '<div class="find-body"><div class="find-item">' + esc(f.item) + "</div>" +
          '<div class="find-where">📍 ' + esc(f.store) + " · " + esc(f.area) + "</div>" + price + note +
          '<div class="find-meta">' + timeAgo(f.ts) + (f.name ? " · " + esc(f.name) : "") +
          ' · <a href="mailto:directory@myalohatown.org?subject=Report%20find">report</a></div></div></div>';
      }).join("");
    }).catch(function () { findsfeed.innerHTML = '<p class="findsloading">Couldn\'t load deals right now. Try again shortly.</p>'; });
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
      if (!list || !list.length) { jobsfeed.innerHTML = '<p class="findsloading">No open roles right now. Check back soon, or post one below. 💼</p>'; return; }
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
    }).catch(function () { jobsfeed.innerHTML = '<p class="findsloading">Couldn\'t load jobs right now. Try again shortly.</p>'; });
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
  // Leaflet + markercluster load with `defer`, so they run after this script; init on DOMContentLoaded.
  function initMap() {
  var mapEl = document.getElementById("map");
  if (!(mapEl && window.__MAPDATA && window.L) || mapEl._init) return;
  mapEl._init = true;
  {
    var LV = [36.1147, -115.1728];
    var m = L.map("map", { minZoom: 9, zoomControl: true }).setView(LV, 11);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri", maxZoom: 19 }).addTo(m);
    var cluster = window.L.markerClusterGroup ? L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 45,
      iconCreateFunction: function (c) {
        return L.divIcon({ className: "clusterwrap", html: '<div class="cluster">' + c.getChildCount() + "</div>", iconSize: [40, 40] });
      } }) : null;
    var markers = [], group = [];
    function dirLinks(p) {                       // open turn-by-turn in the visitor's map app of choice
      var dest = encodeURIComponent(p.a ? p.n + ", " + p.a : p.lat + "," + p.lng), ll = p.lat + "," + p.lng;
      return '<div class="pp-dir" data-slug="' + p.s + '">' +
        '<a href="https://www.google.com/maps/dir/?api=1&destination=' + dest + '" target="_blank" rel="noopener">Google Maps</a>' +
        '<a href="https://maps.apple.com/?daddr=' + dest + '&ll=' + ll + '" target="_blank" rel="noopener">Apple Maps</a>' +
        '<a href="https://waze.com/ul?ll=' + ll + '&navigate=yes" target="_blank" rel="noopener">Waze</a></div>';
    }
    window.__MAPDATA.forEach(function (p) {
      var icon = L.divIcon({ className: "pinwrap",
        html: '<div class="pin' + (p.v ? " v" : "") + '" style="background:' + p.col + '"><span>' + p.e + "</span></div>",
        iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16] });
      var stars = p.r ? '<div class="pp-r">⭐ ' + p.r + (p.rc ? ' <span>(' + p.rc + ")</span>" : "") + "</div>" : "";
      var psrc = p.img ? (/^https?:\/\//.test(p.img) ? p.img : "../" + p.img) : "";
      var img = psrc ? '<div class="pp-img"><img src="' + psrc + '" width="480" height="300" decoding="async" referrerpolicy="no-referrer" alt="" onerror="this.parentNode.remove()"></div>' : "";
      var mk = L.marker([p.lat, p.lng], { icon: icon }).bindPopup(
        '<div class="pp">' + img + '<div class="pp-b"><b>' + esc(p.n) + "</b>" + stars +
        '<div class="pp-c">' + esc(p.c) + (p.v ? " · 🌺 Verified" : "") + "</div>" +
        (p.a ? '<div class="pp-addr">📍 ' + esc(p.a) + "</div>" : "") + dirLinks(p) +
        '<a class="pp-a" href="../' + p.s + '/">View listing →</a></div></div>', { maxWidth: 260, minWidth: 230 });
      (cluster || m).addLayer(mk); markers.push({ mk: mk, cat: p.c }); group.push([p.lat, p.lng]);
    });
    if (cluster) m.addLayer(cluster);
    if (group.length) m.fitBounds(group, { padding: [40, 40], maxZoom: 13 });
    // "my location" button under the zoom controls; the browser asks for permission on the first tap
    var me = null;
    function locate(btn, quiet) {
      if (!quiet && window.__track) window.__track("locate_me");
      if (!navigator.geolocation) { if (!quiet) alert("Your browser doesn't support location."); return; }
      if (btn) btn.classList.add("busy");
      navigator.geolocation.getCurrentPosition(function (pos) {
        if (btn) btn.classList.remove("busy");
        var ll = [pos.coords.latitude, pos.coords.longitude];
        if (me) me.setLatLng(ll); else me = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="mydot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 }).addTo(m);
        if (quiet && distMi(ll[0], ll[1], LV[0], LV[1]) >= 60) return;   // auto-center only for visitors near Vegas
        m.setView(ll, quiet ? 13 : 14);
      }, function () {
        if (btn) btn.classList.remove("busy");
        if (!quiet) alert("Turn on location sharing for this site in your browser settings, then tap the button again.");
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
    var Loc = L.Control.extend({ options: { position: "topleft" }, onAdd: function () {
      var wrap = L.DomUtil.create("div", "leaflet-bar locwrap"), b = L.DomUtil.create("button", "locbtn", wrap);
      b.type = "button"; b.title = "Show my location"; b.setAttribute("aria-label", "Show my location"); b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(b, "click", function () { locate(b, false); });
      return wrap; } });
    m.addControl(new Loc());
    // no surprise permission prompt on load: only auto-center if the visitor already allowed location
    if (navigator.permissions && navigator.permissions.query)
      navigator.permissions.query({ name: "geolocation" }).then(function (r) { if (r.state === "granted") locate(null, true); }).catch(function () {});
    var legItems = [].slice.call(document.querySelectorAll("#maplegend .lgi"));
    var legendToggle = document.getElementById("legendToggle"), maplegend = document.getElementById("maplegend");
    if (legendToggle && maplegend) legendToggle.addEventListener("click", function () {
      legendToggle.setAttribute("aria-expanded", maplegend.classList.toggle("expanded") ? "true" : "false");
    });
    legItems.forEach(function (b) {
      b.addEventListener("click", function () {
        var cat = b.dataset.cat;
        if (window.__track) window.__track("map_filter", { category: cat });
        legItems.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        var layer = cluster || m;
        markers.forEach(function (o) {
          var show = cat === "all" || o.cat === cat;
          if (show && !layer.hasLayer(o.mk)) layer.addLayer(o.mk);
          else if (!show && layer.hasLayer(o.mk)) layer.removeLayer(o.mk);
        });
      });
    });
  }
  }
  if (window.L) initMap(); else document.addEventListener("DOMContentLoaded", initMap);

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
      if (!navigator.geolocation) { alert("Location isn't available. Pick your state instead."); return; }
      geoBtn.textContent = "📍 Locating…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, ln = pos.coords.longitude;
        var wc = NPS.filter(function (n) { return n.lat != null; })
          .map(function (n) { n._d = distMi(la, ln, n.lat, n.lng); return n; })
          .sort(function (a, b) { return a._d - b._d; });
        draw(wc.slice(0, 6), true); geoBtn.textContent = "📍 Nonprofits near you";
        if (stateSel) stateSel.value = "";
      }, function () { geoBtn.textContent = "📍 Use my location"; alert("Couldn't get your location. Pick your state instead."); });
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
      var src = (f.querySelector('input[name="source"]') || {}).value || "";
      var slugIn = (f.querySelector('input[name="listing_slug"]') || {}).value;
      var evt = { claim: "claim_submit", add: "add_business_submit", recommend: "recommend_submit", message: "message_submit",
                  event: "event_submit", job: "job_submit", story: "story_submit", newsletter: "newsletter_submit" }[src];
      if (evt) track(evt, slugIn ? { listing: slugIn } : {});
      if (url) {
        var fd = new FormData(f);
        fd.append("ts", String(Date.now() - (f._loaded || 0)));
        try { fetch(url, { method: "POST", mode: "no-cors", body: fd }); } catch (err) {}
      }
      finishForm(f);
    });
  });
})();
