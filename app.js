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
    if (a.dataset.tt) return track("ticket_click", { event_name: a.dataset.tt });
    if (a.classList.contains("order-link")) return track("order_click", { platform: a.dataset.platform || "" });
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

  // ---- search: synonyms, so a search matches what people mean, not just the exact word (Kaj, 2026-10-17).
  // Each word in the query must match; a word matches if the listing contains it OR any of its synonyms.
  var SYN = {
    contractor: ["contractor", "plumb", "hvac", "air condition", "heating", "furnace", "electric", "roof", "landscap", "pool",
                 "remodel", "construct", "handyman", "tree service", "painting", "painter", "flooring", "concrete", "masonry", "fenc", "solar",
                 "drywall", "cabinet", "water heater", "leak repair", "pipe replacement", "epoxy", "carpent", "property maintenance", "general contractor"],
    plumber: ["plumb", "leak", "pipe replacement", "drainage", "water heater", "toilet replacement", "faucet", "water softener"],
    handyman: ["handyman", "handyworks", "property maintenance", "general contractor"],
    landscaping: ["landscap", "tree", "yard", "lawn"], landscaper: ["landscap", "tree", "yard", "lawn"],
    mechanic: ["mechanic", "auto repair", "car repair", "truck repair", "brake", "motorcycle repair"],
    auto: ["auto", "car", "truck", "mechanic", "detail", "towing", "tire"], car: ["auto", "car", "truck", "mechanic", "detail", "towing"],
    food: ["restaurant", "food", "poke", "bbq", "plate", "cafe", "bakery", "grill", "kitchen", "caterer", "food truck"],
    restaurant: ["restaurant", "food", "poke", "bbq", "grill", "kitchen", "cafe"], grinds: ["restaurant", "food", "poke", "bbq", "plate", "grill"],
    breakfast: ["breakfast", "pancake", "brunch", "loco moco", "omelet", "waffle"],
    dessert: ["dessert", "shave ice", "shaved ice", "malasada", "ice cream", "bakery", "cake", "cookie", "candy", "sweet"],
    coffee: ["coffee", "cafe", "espresso", "kona", "kava"],
    barber: ["barber", "fade", "beard trim"], haircut: ["barber", "hair", "salon", "fade"], hair: ["hair", "salon", "barber", "braid"],
    nails: ["nail"], makeup: ["makeup", "mua", "beauty"],
    dentist: ["dent", "teeth", "whitening"], doctor: ["doctor", "physician", "medical", "clinic", "family practice"],
    venue: ["venue", "banquet", "hall", "event center", "conference", "ballroom"], wedding: ["wedding", "venue", "banquet", "lei"],
    party: ["event", "banquet", "venue", "dj", "caterer", "photo booth", "shave ice", "party"],
    dj: ["dj", "mc", "sound", "entertainment"], catering: ["cater", "food truck", "event"],
    lei: ["lei", "floral", "florist", "flower"], flowers: ["lei", "floral", "florist", "flower"],
    hula: ["hula", "halau", "polynesian dance"], dance: ["dance", "hula", "halau"],
    tattoo: ["tattoo", "tatau"], realtor: ["real estate", "realt", "property"], photographer: ["photo"], photography: ["photo"],
    clothing: ["clothing", "apparel", "shirt", "fashion", "hat", "headwear"], gifts: ["gift", "jewelry", "craft", "lei", "souvenir"],
    cleaning: ["clean", "maid", "janitorial"], moving: ["moving", "hauling", "junk", "trucking"],
    pets: ["pet", "groom", "dog"], fitness: ["fitness", "gym", "yoga", "pilates", "trainer"]
  };
  function synsFor(w) {
    var stem = w.length > 4 && /s$/.test(w) ? w.slice(0, -1) : w;
    return SYN[w] || SYN[stem] || (stem !== w ? [w, stem] : [w]);
  }
  var reCache = {};
  function startsWord(text, x) {     // synonyms match at the start of a word ("dent" -> dental, never "student")
    var re = reCache[x] || (reCache[x] = new RegExp("(^|[^a-z])" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    return re.test(text);
  }
  // Hawaiian and other marks don't block a match (Kaj, 2026-10-22): "pa" finds "Pā", "kamalii" finds "Kamaliʻi",
  // "paina" finds "Pa'ina". Kahakō and accents drop away; ʻokina and apostrophes are removed on both sides.
  var foldCache = {};
  function fold(s) {
    s = s == null ? "" : String(s);
    if (foldCache[s] != null) return foldCache[s];
    var f = s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
    return (foldCache[s] = f.replace(/[\u02bb\u02bc\u2018\u2019'`]/g, "").toLowerCase());
  }
  window.__fold = fold;
  function searchHit(text, q) {
    text = fold(text);
    var words = fold(q).split(/\s+/).filter(Boolean);
    return words.every(function (w) {
      return text.indexOf(w) > -1 || synsFor(w).some(function (x) { return x !== w && startsWord(text, x); });
    });
  }
  window.__searchHit = searchHit;
  // results order: names with a word starting with the search first ("pa" -> Ka Pā Hula), then other name
  // matches, then matches on category/keywords; ties keep the per-visit fair rotation
  function nameTier(name, q) {
    var n = " " + fold(name).replace(/[^a-z0-9]+/g, " "), w = fold(q).trim();
    if (!w) return 0;
    return n.indexOf(" " + w) > -1 ? 0 : (n.indexOf(w) > -1 ? 1 : 2);
  }

  // ---- fair rotation (Kaj, 2026-10-19): nobody gets more traffic for being alphabetically first.
  // Each visit shuffles every shelf and listing grid once; search results use the same per-visit order.
  function shuffleKids(el) { for (var i = el.children.length - 1; i > 0; i--) el.appendChild(el.children[Math.floor(Math.random() * (i + 1))]); }
  document.querySelectorAll(".shelf .hscroll, .listings-grid").forEach(function (el) {
    if (!el.closest("#nearshelf") && !el.closest("#spotsgrid") && el.id !== "spotsgrid") shuffleKids(el);
  });
  var visitRank = {};
  function rankOf(l) { return visitRank[l.slug] == null ? (visitRank[l.slug] = Math.random()) : visitRank[l.slug]; }
  window.__rankOf = rankOf;

  // ---- save hearts -----------------------------------------------------
  // ---- open / closed label on every card that has Google hours (Kaj, 2026-10-23) ----
  function openState(oh) {
    if (!oh) return null;
    var p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var g = function (t) { return (p.filter(function (x) { return x.type === t; })[0] || {}).value; };
    var d = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday")), m = (parseInt(g("hour"), 10) % 24) * 60 + parseInt(g("minute"), 10);
    var today = (oh[d] || []).some(function (s) { return s[0] <= m && m < s[1]; });
    var spill = (oh[(d + 6) % 7] || []).some(function (s) { return s[1] > 1440 && m < s[1] - 1440; });   // last night's late close
    return today || spill ? "open" : "closed";
  }
  function paintOpen() {
    document.querySelectorAll(".lcard[data-oh]").forEach(function (c) {
      if (c._oh) return; c._oh = 1;
      var st; try { st = openState(JSON.parse(c.dataset.oh)); } catch (e) { return; }
      var city = c.querySelector(".city"); if (!st || !city) return;
      var tag = document.createElement("span"); tag.className = "ostat " + st; tag.textContent = st === "open" ? "● Open" : "Closed";
      city.insertBefore(tag, city.firstChild);
    });
  }
  function paintHearts() {
    paintOpen();
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
    return '<div class="lcard" data-slug="' + l.slug + '"' + (l.oh ? " data-oh='" + JSON.stringify(l.oh) + "'" : "") + '><button class="save" data-slug="' + l.slug + '">♡</button>' + badge +
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
  function setMenu(open) {
    dropnav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.textContent = open ? "✕" : "☰";
  }
  if (menuBtn && dropnav) {
    menuBtn.addEventListener("click", function (e) { e.stopPropagation(); setMenu(!dropnav.classList.contains("open")); });
    // the menu floats over the page (Kaj, 2026-10-23); tapping outside it or pressing Esc closes it
    document.addEventListener("click", function (e) { if (dropnav.classList.contains("open") && !e.target.closest("#dropnav")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

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
    }, 1500);   // Kaj, 2026-10-23: 1.5 seconds
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
    var openClaim = function () {
      var bf = claimModal.querySelector(".book-frame");
      if (bf && !bf.src) bf.src = bf.dataset.src;   // load the booking calendar only when someone opens it
      claimModal.hidden = false; document.body.style.overflow = "hidden";
      track("claim_open");
    };
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
    // ---- mini map: small map under the search bar, pins follow the current search / category (Kaj, 2026-10-19).
    // Leaflet loads after first paint; zooms to the visitor if they've already allowed location or tap Near me.
    var mini = null, miniLayer = null, miniMe = null, miniEl = document.getElementById("miniMap");
    function loadCss(h) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = h; document.head.appendChild(l); }
    function loadJs(src) { return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
    function miniInit() {
      if (!miniEl || mini) return Promise.resolve();
      loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      return loadJs("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js").then(function () {
        // one-finger drag works on phones too (Kaj, 2026-10-19); the page still scrolls above and below the map
        mini = L.map(miniEl, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: true })
          .setView([36.1147, -115.1728], 10);
        L.control.zoom({ position: "topleft" }).addTo(mini);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(mini);
        miniLayer = L.layerGroup().addTo(mini);
        if (navigator.permissions && navigator.permissions.query)
          navigator.permissions.query({ name: "geolocation" }).then(function (r) {
            if (r.state === "granted") navigator.geolocation.getCurrentPosition(function (p) { miniCenter(p.coords.latitude, p.coords.longitude); });
          }).catch(function () {});
      });
    }
    function miniPins(list) {
      if (!mini || !miniLayer) return;
      miniLayer.clearLayers(); var pts = [];
      (list || []).forEach(function (l) {
        if (l.lat == null || l.lat < 35.85 || l.lat > 36.4 || l.lng < -115.45 || l.lng > -114.8) return;
        var col = (window.__CATCOLORS || {})[l.category] || window.__DEFPIN || "#0288D1";
        L.circleMarker([l.lat, l.lng], { radius: 6, color: "#fff", weight: 2, fillColor: col, fillOpacity: 1 })
          .bindPopup('<div class="mm-pop"><b>' + esc(l.name) + "</b><br>" + esc(l.category) + '<br><a href="' + l.slug + '/">View listing →</a></div>')
          .addTo(miniLayer);
        pts.push([l.lat, l.lng]);
      });
      if (miniMe) return;                                   // keep the visitor's own view once we know where they are
      if (pts.length) mini.fitBounds(pts, { padding: [18, 18], maxZoom: 13 });      // all of Vegas (Kaj, 2026-10-19)
    }
    function miniCenter(la, ln) {
      if (!mini) return;
      if (miniMe) miniMe.setLatLng([la, ln]);
      else miniMe = L.circleMarker([la, ln], { radius: 7, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(mini);
      mini.setView([la, ln], 12);
    }
    // mini map filter: same categories as the chip row (colour + emoji); picking one clicks that chip,
    // so the pins, shelves and results all follow the same filter
    var mmF = document.getElementById("mmFilter"), mmM = document.getElementById("mmMenu");
    if (mmF && mmM) {
      var cats = [].slice.call(document.querySelectorAll(".cchip.ico"));
      mmM.innerHTML = cats.map(function (ch) {
        var c = ch.dataset.cat, col = c === "all" ? "linear-gradient(90deg,#0288D1,#F57C00)" : ((window.__CATCOLORS || {})[c] || "#0288D1");
        return '<button type="button" data-cat="' + esc(c) + '"><i style="background:' + col + '">' + ch.querySelector(".ci").textContent + "</i>" +
               esc(c === "all" ? "All categories" : (ch.getAttribute("title") || c)) + "</button>";
      }).join("");
      mmF.addEventListener("click", function (e) { e.stopPropagation(); mmM.hidden = !mmM.hidden; mmF.setAttribute("aria-expanded", !mmM.hidden); });
      mmM.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        var chip = document.querySelector('.cchip.ico[data-cat="' + b.dataset.cat + '"]'); if (chip) { var y = window.scrollY; chip.click(); window.scrollTo(0, y); }
        [].forEach.call(mmM.querySelectorAll("button"), function (x) { x.classList.toggle("on", x === b); });
        mmM.hidden = true; mmF.firstChild.textContent = (b.dataset.cat === "all" ? "🎨 Filter " : b.querySelector("i").textContent + " " + (b.dataset.cat.split(" ")[0]) + " ");
        track("map_filter", { category: b.dataset.cat, where: "mini" });
      });
      document.addEventListener("click", function (e) { if (!mmM.hidden && !e.target.closest("#mmMenu")) mmM.hidden = true; });
    }
    var warmMini = function () { miniInit().then(function () { return loadAll(); }).then(miniPins).catch(function () {}); };
    if (miniEl) { if (document.readyState === "complete") setTimeout(warmMini, 200); else window.addEventListener("load", function () { setTimeout(warmMini, 200); }); }
    var warmAll = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(function () { loadAll().catch(function () {}); }); };
    if (document.readyState === "complete") warmAll(); else window.addEventListener("load", warmAll);
    function showShelves() { resultsSec.hidden = true; shelves.hidden = false; loadAll().then(miniPins).catch(function () {}); }
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
      shelves.hidden = true; resultsSec.hidden = false; paintHearts(); miniPins(list);
    }
    function applyFilter() {
      var t = (q && q.value || "").toLowerCase().trim();
      if (curCat === "all" && !t) { showShelves(); return; }
      var cat = curCat, raw = q ? q.value.trim() : "";
      loadAll().then(function (all) {
        if (cat !== curCat || raw !== (q ? q.value.trim() : "")) return;   // a newer filter is pending
        var list = all.filter(function (l) {
          return (cat === "all" || l.category === cat) && (!t || searchHit(l.search, t));
        }).sort(function (a, b) { return nameTier(a.name, t) - nameTier(b.name, t) || rankOf(a) - rankOf(b); });
        var title = t ? '“' + raw + '”' + (cat !== "all" ? " in " + cat : "") : cat;
        showResults(list, title);
      }).catch(function () {
        rtitle.textContent = "Couldn't load listings. Check your connection and try again.";
        resultsEl.innerHTML = ""; emptyEl.hidden = true; shelves.hidden = true; resultsSec.hidden = false;
      });
    }
    if (q) q.addEventListener("input", applyFilter);
    // after a category tap, park the sticky category bar at the top with results right under it
    // (Kaj, 2026-10-23: it used to jump to the top of the page, so on phones the categories scrolled away)
    function keepCatbar() {
      var anchor = document.getElementById("shelves"), bar = document.querySelector(".catbar"), hd = document.querySelector(".hd");
      if (!anchor || !bar) return;
      var y = anchor.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - (hd ? hd.offsetHeight : 0);
      if (Math.abs(window.scrollY - y) > 4) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
    var chips = [].slice.call(document.querySelectorAll(".cchip"));
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on"); curCat = ch.dataset.cat; applyFilter();
        keepCatbar();
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
    function nearFrom(la, ln, label) {
      loadAll().then(function (all) {
        var near = all.filter(function (l) { return l.lat != null; })
          .map(function (l) { l._d = distMi(la, ln, l.lat, l.lng); return l; })
          .sort(function (a, b) { return a._d - b._d; }).slice(0, 16);
        if (nearShelf) {
          var h = nearShelf.querySelector("h2"); if (h && label) h.textContent = "📍 Near " + label;
          nearShelf.querySelector(".hscroll").innerHTML = near.map(function (l) { return rcard(l, "", l._d); }).join("");
          nearShelf.hidden = false; paintHearts();
          nearShelf.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        nearBtn.textContent = label ? "📍 " + label : "📍 Near you"; nearBtn.classList.add("on"); miniCenter(la, ln);
      }).catch(function () { nearBtn.textContent = "📍 Near me"; nearBtn.classList.remove("on"); });
    }
    function nearHelp(code) {
      var old = document.getElementById("nearHelp"); if (old) old.remove();
      var ua = navigator.userAgent || "", inApp = /FBAN|FBAV|Instagram|Line\//.test(ua), ios = /iPhone|iPad|iPod/.test(ua);
      var steps = inApp ? "<p>You're viewing this inside Facebook or Instagram, which blocks location. Open the page in Safari or Chrome to use it, or enter your ZIP below.</p>"
        : code === 1 ? (ios
          ? "<p>Location is turned off for this site. To turn it on:</p><ol><li>Tap <b>aA</b> (or the ⋯ menu) in the address bar</li><li>Tap <b>Website Settings</b> › <b>Location</b> › <b>Allow</b></li><li>If that's not there: Settings › Privacy &amp; Security › Location Services › Safari Websites › <b>While Using</b></li></ol>"
          : "<p>Location is blocked for this site. Click the 🔒 or ⓘ icon left of the web address, set <b>Location</b> to <b>Allow</b>, then try again.</p>")
        : "<p>We couldn't get your location just now. Make sure Location is on for your phone, then try again.</p>";
      var d = document.createElement("div"); d.className = "nearhelp"; d.id = "nearHelp";
      d.innerHTML = '<div class="box"><h3>📍 Find spots near you</h3>' + steps +
        '<div class="row"><button class="btn2" id="nhRetry" type="button">Try again</button><button class="btn2 ghost" id="nhClose" type="button">Close</button></div>' +
        '<p style="margin:16px 0 0">Or use a ZIP code:</p><div class="row"><input id="nhZip" inputmode="numeric" maxlength="5" placeholder="e.g. 89123">' +
        '<button class="btn2" id="nhGo" type="button">Go</button></div><div class="err" id="nhErr"></div></div>';
      document.body.appendChild(d);
      d.addEventListener("click", function (e) { if (e.target === d) d.remove(); });
      document.getElementById("nhClose").onclick = function () { d.remove(); };
      document.getElementById("nhRetry").onclick = function () { d.remove(); askLocation(); };
      document.getElementById("nhGo").onclick = function () {
        var z = (document.getElementById("nhZip").value || "").trim(), c = (window.__ZIPS || {})[z];
        if (!/^\d{5}$/.test(z)) { document.getElementById("nhErr").textContent = "Enter a 5-digit ZIP code."; return; }
        if (!c) { document.getElementById("nhErr").textContent = "We don't have listings around that ZIP yet. Try a nearby one."; return; }
        d.remove(); nearFrom(c[0], c[1], z); track("near_me", { method: "zip" });
      };
    }
    function askLocation() {
      if (!navigator.geolocation) { nearHelp(2); return; }
      nearBtn.textContent = "📍 Locating…"; nearBtn.classList.add("on");
      navigator.geolocation.getCurrentPosition(function (pos) {
        track("near_me", { method: "gps" }); nearFrom(pos.coords.latitude, pos.coords.longitude);
      }, function (err) {
        nearBtn.textContent = "📍 Near me"; nearBtn.classList.remove("on"); nearHelp(err && err.code);
      }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
    }
    if (nearBtn) nearBtn.addEventListener("click", askLocation);

    // ---- header search icon: shows once the mini map scrolls out of view; tap = back to the search box
    var hs = document.getElementById("hdrSearch"), mw = document.getElementById("miniWrap");
    if (hs && mw && window.IntersectionObserver) {
      new IntersectionObserver(function (es) { hs.hidden = es[0].isIntersecting || es[0].boundingClientRect.top > 0; }).observe(mw);
      hs.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(function () { var qq = document.getElementById("q"); if (qq) qq.focus(); }, 350);
      });
    }
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
    var pushelves = document.getElementById("pushelves"), puresults = document.getElementById("puresults");
    function purender() {
      var t = (puq && puq.value || "").toLowerCase().trim(), st = pustate ? pustate.value : "all";
      var browsing = pucat === "all" && !t && st === "all";   // nothing picked: category rows; otherwise one grid
      if (pushelves) pushelves.hidden = !browsing;
      if (puresults) puresults.hidden = browsing;
      if (browsing) { paintHearts(); return; }
      var list = window.__POPUPS.filter(function (l) {
        var okC = pucat === "all" || l.category === pucat;
        var okT = !t || searchHit(l.search, t);
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
        var bar = document.querySelector(".catbar"), hd = document.querySelector(".hd"), anchor = pushelves || pugrid;
        if (bar && anchor) window.scrollTo({ top: Math.max(0, (pushelves && !pushelves.hidden ? pushelves : puresults).getBoundingClientRect().top + window.scrollY - bar.offsetHeight - (hd ? hd.offsetHeight : 0)), behavior: "smooth" });
      });
    });
    document.querySelectorAll(".pu-more").forEach(function (b) {
      b.addEventListener("click", function () { var ch = document.querySelector('.cchip[data-cat="' + b.dataset.cat + '"]'); if (ch) ch.click(); });
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
        var okT = !t || searchHit(l.search, t);
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

  // ---- Ticket Tailor events: shared by the Events page cards and the map pins ----
  function ttWhen(iso) {
    try { return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function ttBtn(ev, cls) {
    return '<a class="' + cls + '" data-tt="' + esc(ev.name) + '" href="' + esc(ev.url) + '" target="_blank" rel="noopener">' + (ev.free ? "RSVP" : "Get Tickets") + "</a>";
  }
  function ttMore(ev) { return ev.more > 0 ? '<div class="tt-more">🔁 ' + ev.more + " more date" + (ev.more > 1 ? "s" : "") + "</div>" : ""; }
  var ttFeed = null;
  function ttLive() {
    if (!ttFeed && window.__TT_URL) ttFeed = fetch(window.__TT_URL).then(function (r) { return r.json(); }).catch(function () { return null; });
    return ttFeed || Promise.resolve(null);
  }
  // events show instantly from the snapshot baked in at build time (window.__TT_SNAP), then the live feed
  // re-renders only if something changed (Kaj, 2026-10-23: "events load slow")
  function ttUse(render) {
    var snap = window.__TT_SNAP;
    if (snap && snap.length) render(snap);
    ttLive().then(function (list) { if (list && JSON.stringify(list) !== JSON.stringify(snap || [])) render(list); });
  }
  function ttLoad() { return ttLive().then(function (l) { return l || window.__TT_SNAP || []; }); }
  function ttVendors(ev) {   // vendors read off the event's flyer (MAM: Event Vendors tab)
    var v = ev.vendors || []; if (!v.length) return "";
    var shown = v.slice(0, 6).map(function (x) { return x.slug ? '<a href="../' + x.slug + '/">' + esc(x.name) + "</a>" : esc(x.name); });
    return '<div class="tt-vend">🎪 <b>Vendors:</b> ' + shown.join(", ") + (v.length > 6 ? " + " + (v.length - 6) + " more" : "") + "</div>";
  }
  // rough Las Vegas valley areas by ZIP, for the events "Where" filter
  var AREAS = { "Henderson": "89002 89011 89012 89014 89015 89044 89052 89074", "North Las Vegas": "89030 89031 89032 89081 89084 89085 89086",
    "Summerlin": "89134 89135 89138 89144 89145", "Downtown": "89101 89104 89106", "The Strip": "89109 89158 89169",
    "Southwest": "89113 89118 89139 89141 89148 89178 89179", "South / Silverado": "89119 89123 89183", "Spring Valley": "89102 89103 89117 89146 89147",
    "East": "89110 89115 89121 89122 89142 89156", "Northwest": "89107 89108 89128 89129 89130 89131 89143 89149 89166", "UNLV / Paradise": "89120 89154 89169" };
  function ttArea(zip) { for (var a in AREAS) if (AREAS[a].indexOf(zip) > -1) return a; return ""; }
  function ttInWindow(ev, w) {   // any of the event's dates inside this week / weekend / month (Vegas time)
    if (w === "all") return true;
    var now = new Date(), day = now.getDay(), end = new Date(now), start = new Date(now);
    if (w === "week") end.setDate(now.getDate() + 7);
    if (w === "weekend") { start.setDate(now.getDate() + ((5 - day + 7) % 7)); start.setHours(0, 0, 0, 0); end = new Date(start); end.setDate(start.getDate() + 3); if (day === 0 || day === 6) start = now; }
    if (w === "month") end.setDate(now.getDate() + 31);
    return (ev.dates || [ev.start]).some(function (d) { var t = new Date(d); return t >= start && t <= end; });
  }
  var ttGrid = document.getElementById("ttevents");
  if (ttGrid && window.__TT_URL) ttUse(function (list) {
    if (!list || !list.length) return;
    var f = { when: "all", free: false, area: "" };
    function card(ev) {
      var img = ev.thumb || ev.header;
      return '<div class="ecard ttcard">' + (img ? '<div class="tt-img"><img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>' : "") +
        '<div class="edate">' + esc(ttWhen(ev.start)) + "</div><h3>" + esc(ev.name) + "</h3>" + ttMore(ev) +
        (ev.venue ? '<div class="eloc">📍 ' + esc(ev.venue) + "</div>" : ev.online ? '<div class="eloc">💻 Online</div>' : "") + ttVendors(ev) +
        ttBtn(ev, "btn btn-primary tt-btn") + "</div>";
    }
    function draw() {
      var shown = list.filter(function (ev) {
        return ttInWindow(ev, f.when) && (!f.free || ev.free) && (!f.area || ttArea(String(ev.zip || "").slice(0, 5)) === f.area);
      });
      ttGrid.innerHTML = shown.map(card).join("");
      document.getElementById("ttnone").hidden = shown.length > 0;
    }
    // filters always show (Kaj, 2026-10-21: the page looked bare without them)
    var bar = document.getElementById("ttfilters");
    if (bar) {
      var areas = []; list.forEach(function (ev) { var a = ttArea(String(ev.zip || "").slice(0, 5)); if (a && areas.indexOf(a) < 0) areas.push(a); });
      var chip = function (k, v, label, on) { return '<button type="button" class="chip' + (on ? " on" : "") + '" data-k="' + k + '" data-v="' + esc(v) + '">' + label + "</button>"; };
      bar.innerHTML = chip("when", "all", "All dates", true) + chip("when", "week", "This week") + chip("when", "weekend", "This weekend") + chip("when", "month", "This month") +
        chip("free", "1", "🆓 Free") + (areas.length > 1 ? areas.sort().map(function (a) { return chip("area", a, "📍 " + esc(a)); }).join("") : "");
      bar.hidden = false;
      bar.onclick = function (e) {
        var b = e.target.closest("button.chip"); if (!b) return;
        var k = b.dataset.k, v = b.dataset.v;
        if (k === "when") { f.when = v; [].forEach.call(bar.querySelectorAll('[data-k="when"]'), function (x) { x.classList.toggle("on", x === b); }); }
        if (k === "free") { f.free = !f.free; b.classList.toggle("on", f.free); }
        if (k === "area") { f.area = f.area === v ? "" : v; [].forEach.call(bar.querySelectorAll('[data-k="area"]'), function (x) { x.classList.toggle("on", x.dataset.v === f.area); }); }
        track("event_filter", { filter: k, value: k === "free" ? String(f.free) : v });
        draw();
      };
    }
    draw();
    document.getElementById("ttwrap").hidden = false;
  });
  // ---- homepage feed: Upcoming Events row above the category shelves ----
  var feedBox = document.getElementById("feedSample");
  if (feedBox && window.__TT_URL) ttUse(function (list) {
    if (!list || !list.length) return;
    document.getElementById("feedEventsRow").innerHTML = list.slice(0, 12).map(function (ev) {
      var img = ev.thumb || ev.header;
      return '<div class="lcard fevent"><a class="lcard-body" href="' + esc(ev.url) + '" data-tt="' + esc(ev.name) + '" target="_blank" rel="noopener">' +
        '<div class="lcard-img" style="background:#E91E631f">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "") +
        '<span class="lcard-emoji">🎟️</span></div><div class="lcard-txt"><span class="cat">' + esc(ttWhen(ev.start)) + "</span><h3>" + esc(ev.name) +
        '</h3><div class="city">📍 ' + esc(ev.venue || "") + (ev.more ? " · 🔁 " + ev.more + " more" : "") + "</div></div></a></div>";
    }).join("");
    document.getElementById("feedEvents").hidden = false;
  });

  // ---- listing page: Google reviews carousel (hidden until the Places key is live and returns reviews) ----
  var grev = document.getElementById("gReviews");
  if (grev && grev.dataset.pid && window.__TT_URL) {
    fetch(window.__TT_URL.replace("/tt-events", "/g-reviews") + "?pid=" + encodeURIComponent(grev.dataset.pid))
      .then(function (r) { return r.json(); }).then(function (rv) {
        if (!rv || !rv.length) return;
        document.getElementById("gReviewsTrack").innerHTML = rv.map(function (x) {
          return '<figure class="grev-card"><div class="grev-stars">' + "★★★★★".slice(0, Math.round(x.rating || 0)) + '<span>' + "★★★★★".slice(Math.round(x.rating || 0)) + "</span></div>" +
            "<blockquote>" + esc(x.text) + "</blockquote><figcaption>" + (x.author_url ? '<a href="' + esc(x.author_url) + '" target="_blank" rel="noopener">' + esc(x.author) + "</a>" : esc(x.author)) +
            " · " + esc(x.when || "") + ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">Google</a></figcaption></figure>';
        }).join("");
        grev.hidden = false;
        track("reviews_shown", { count: rv.length });
      }).catch(function () {});
  }

  // ---- listing page: after a couple of listings in one visit, offer to save this one ----
  if (window.__LISTING && document.querySelector('.lhero .save[data-slug]')) {
    var lv = 0; try { lv = (parseInt(sessionStorage.getItem("mam_lv"), 10) || 0) + 1; sessionStorage.setItem("mam_lv", lv); } catch (e) {}
    var dismissed = false; try { dismissed = sessionStorage.getItem("mam_save_x") === "1"; } catch (e) {}
    if (lv >= 2 && !dismissed && getSpots().indexOf(window.__LISTING) < 0) setTimeout(function () {
      var t = document.createElement("div"); t.className = "savetoast";
      t.innerHTML = '<span>♡ Save this spot for later</span><button type="button" class="st-save">Save</button><button type="button" class="st-x" aria-label="Dismiss">✕</button>';
      document.body.appendChild(t); track("save_prompt_shown");
      t.querySelector(".st-save").addEventListener("click", function () { var b = document.querySelector('.lhero .save[data-slug]'); if (b) b.click(); t.remove(); });
      t.querySelector(".st-x").addEventListener("click", function () { try { sessionStorage.setItem("mam_save_x", "1"); } catch (e) {} t.remove(); });
    }, 6000);
  }

  // cultural calendar: each entry shows only its next occurrence, judged by today's date in Vegas
  var obs = [].slice.call(document.querySelectorAll(".ecard.obs"));
  if (obs.length) {
    var todayLV = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }), seenObs = {};
    obs.forEach(function (c) {
      var show = c.dataset.end >= todayLV && !seenObs[c.dataset.key];
      if (show) seenObs[c.dataset.key] = 1;
      c.hidden = !show;
    });
  }
  // listing page: events this business is vending at (from event flyers)
  var vendEv = document.getElementById("vendorEvents");
  if (vendEv && window.__LISTING && window.__TT_URL) fetch(window.__TT_URL.replace("/tt-events", "/event-vendors")).then(function (r) { return r.json(); }).then(function (m) {
    var mine = (m || {})[window.__LISTING] || []; if (!mine.length) return;
    document.getElementById("vendorEventsList").innerHTML = mine.map(function (ev) {
      var d = ev.start.length > 10 ? ttWhen(ev.start) : new Date(ev.start + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
        (ev.end && ev.end !== ev.start.slice(0, 10) ? " – " + new Date(ev.end + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
      var btn = ev.url ? '<a class="btn btn-primary lev-btn" data-tt="' + esc(ev.event) + '" href="' + esc(ev.url) + '" target="_blank" rel="noopener">' + (ev.ticketed ? (ev.free ? "RSVP" : "Get Tickets") : "Event info") + "</a>" : "";
      return '<div class="lev-row"><div class="lev-txt"><b>' + esc(ev.event) + "</b><span>🗓️ " + esc(d) + "</span>" + (ev.venue ? "<span>📍 " + esc(ev.venue) + "</span>" : "") + "</div>" + btn + "</div>";
    }).join("");
    vendEv.hidden = false;
  }).catch(function () {});
  // listing page: this venue's upcoming events (nothing shows if it has none)
  var liveEv = document.getElementById("liveEvents");
  if (liveEv && window.__LISTING && window.__TT_URL) ttUse(function (list) {
    var mine = (list || []).filter(function (ev) { return ev.listing_slug === window.__LISTING; });
    if (!mine.length) return;
    document.getElementById("liveEventsList").innerHTML = mine.map(function (ev) {
      return '<div class="lev-row"><div class="lev-txt"><b>' + esc(ev.name) + '</b><span>🗓️ ' + esc(ttWhen(ev.start)) + "</span>" + ttMore(ev) + "</div>" +
        ttBtn(ev, "btn btn-primary lev-btn") + "</div>";
    }).join("");
    liveEv.hidden = false;
  });

  // ---- guides index: search + category filter -------------------------
  var gsearch = document.getElementById("guidesearch");
  if (gsearch) {
    var glinks = [].slice.call(document.querySelectorAll("#gall .glink"));
    var gchips = [].slice.call(document.querySelectorAll(".cchip"));
    var gcat = "all", gpop = document.getElementById("gpopular"), gempty = document.getElementById("gempty");
    function gapply() {
      var t = (gsearch.value || "").toLowerCase().trim(), n = 0;
      glinks.forEach(function (a) {
        var ok = (gcat === "all" || a.dataset.cat === gcat) && (!t || fold(a.dataset.search).indexOf(fold(t)) > -1);
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
    // "Enter your ZIP code or address" + Near me above the map (Kaj, 2026-10-23)
    var findF = document.getElementById("mapFind"), findQ = document.getElementById("mapQ"), findErr = document.getElementById("mapFindErr");
    function youAreHere(ll) {
      if (me) me.setLatLng(ll); else me = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="mydot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 }).addTo(m);
      m.setView(ll, 14);
      var mapTop = document.getElementById("map").getBoundingClientRect().top;
      if (mapTop < 0 || mapTop > window.innerHeight * 0.6) document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (findF) findF.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (findQ.value || "").trim(); if (q.length < 3) return;
      findErr.hidden = true; findF.classList.add("busy");
      fetch(window.__TT_URL.replace("/tt-events", "/geocode") + "?q=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (g) {
        findF.classList.remove("busy");
        if (!g || !g.ok) { findErr.textContent = "We couldn't find that in the Las Vegas area. Try a ZIP code like 89123 or a street address."; findErr.hidden = false; return; }
        youAreHere([g.lat, g.lng]); findQ.blur();
        track("map_find", { method: /^\d{5}$/.test(q) ? "zip" : "address" });
      }).catch(function () { findF.classList.remove("busy"); findErr.textContent = "Couldn't look that up right now. Try again in a moment."; findErr.hidden = false; });
    });
    var nearB = document.getElementById("mapNear");
    if (nearB) nearB.addEventListener("click", function () { track("map_find", { method: "gps" }); locate(nearB, false); });
    // no surprise permission prompt on load: only auto-center if the visitor already allowed location
    if (navigator.permissions && navigator.permissions.query)
      navigator.permissions.query({ name: "geolocation" }).then(function (r) { if (r.state === "granted") locate(null, true); }).catch(function () {});
    var legItems = [].slice.call(document.querySelectorAll("#maplegend .lgi"));
    var legendToggle = document.getElementById("legendToggle"), maplegend = document.getElementById("maplegend");
    if (legendToggle && maplegend) legendToggle.addEventListener("click", function () {
      legendToggle.setAttribute("aria-expanded", maplegend.classList.toggle("expanded") ? "true" : "false");
    });
    var curCat = "all";
    function applyCat() {
      var layer = cluster || m;
      markers.forEach(function (o) {
        var show = curCat === "all" || o.cat === curCat;
        if (show && !layer.hasLayer(o.mk)) layer.addLayer(o.mk);
        else if (!show && layer.hasLayer(o.mk)) layer.removeLayer(o.mk);
      });
    }
    legItems.forEach(function (b) {
      b.addEventListener("click", function () {
        curCat = b.dataset.cat;
        if (window.__track) window.__track("map_filter", { category: curCat });
        legItems.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        applyCat();
      });
    });
    // 🎟️ upcoming Ticket Tailor events: their own pins; a business's pin never moves
    if (window.__TT_URL) ttLoad().then(function (list) {
      var n = 0;
      (list || []).forEach(function (ev) {
        if (ev.lat == null || ev.lng == null) return;
        var p = { n: ev.venue, a: ev.address, lat: ev.lat, lng: ev.lng, s: ev.listing_slug || "" };
        var mk = L.marker([ev.lat, ev.lng], { icon: L.divIcon({ className: "pinwrap", html: '<div class="pin ev"><span>🎟️</span></div>',
          iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16] }), zIndexOffset: 500 }).bindPopup(
          '<div class="pp">' + (ev.thumb ? '<div class="pp-img"><img src="' + esc(ev.thumb) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>' : "") +
          '<div class="pp-b"><b>' + esc(ev.name) + '</b><div class="pp-c">🗓️ ' + esc(ttWhen(ev.start)) + "</div>" + ttMore(ev) +
          '<div class="pp-addr">📍 ' + esc(ev.venue) + (ev.address ? "<br>" + esc(ev.address) : "") + "</div>" + ttVendors(ev) + dirLinks(p) +
          ttBtn(ev, "pp-a pp-tt") + (ev.listing_slug ? '<a class="pp-a" href="../' + ev.listing_slug + '/">More about this venue →</a>' : "") +
          "</div></div>", { maxWidth: 260, minWidth: 230 });
        markers.push({ mk: mk, cat: "__events" }); n++;
      });
      if (!n) return;
      var eb = document.querySelector('#maplegend .lgi[data-cat="__events"]'); if (eb) eb.hidden = false;
      applyCat();
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

  // ---- "Add My Aloha Map to your phone" (Kaj, 2026-10-23) -------------------------------------
  // Android/Chrome: the browser's own install prompt. iPhone: Safari has no prompt, so we show the
  // two taps (Share, then Add to Home Screen). Shows on phones only, after a 2nd page or 25 seconds,
  // never when already installed, and stays quiet for 14 days after "Not now".
  var deferredInstall = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; });
  window.addEventListener("appinstalled", function () { track("app_installed"); try { localStorage.setItem("mam_installed", "1"); } catch (x) {} });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register((window.__ROOT || "/") + "sw.js").catch(function () {});
  (function installNudge() {
    var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    var phone = /iphone|ipad|ipod|android/i.test(navigator.userAgent), ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var quietUntil = 0, views = 0;
    try { quietUntil = parseInt(localStorage.getItem("mam_install_quiet"), 10) || 0; views = (parseInt(sessionStorage.getItem("mam_pv"), 10) || 0) + 1; sessionStorage.setItem("mam_pv", views); } catch (x) {}
    try { if (localStorage.getItem("mam_installed")) return; } catch (x) {}
    if (standalone || !phone || Date.now() < quietUntil) return;
    function show() {
      if (document.querySelector(".installbar") || document.querySelector(".savetoast")) return;
      if (!ios && !deferredInstall) return;               // Android without a ready prompt: try again on the next page
      var b = document.createElement("div"); b.className = "installbar";
      b.innerHTML = '<img src="' + (window.__ROOT || "/") + 'apple-touch-icon.png" alt="" width="40" height="40">' +
        '<div class="ib-t"><b>Add My Aloha Map to your phone</b><span>' + (ios ? "Tap <b>Share</b> ⬆️ then <b>Add to Home Screen</b>" : "One tap to find local AANHPI spots, anytime") + "</span></div>" +
        (ios ? "" : '<button type="button" class="ib-add">Add</button>') + '<button type="button" class="ib-x" aria-label="Not now">✕</button>';
      document.body.appendChild(b); track("install_prompt_shown", { platform: ios ? "ios" : "android" });
      var add = b.querySelector(".ib-add");
      if (add) add.addEventListener("click", function () {
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function (c) { track(c.outcome === "accepted" ? "install_accepted" : "install_dismissed"); });
        deferredInstall = null; b.remove();
      });
      b.querySelector(".ib-x").addEventListener("click", function () {
        try { localStorage.setItem("mam_install_quiet", String(Date.now() + 14 * 864e5)); } catch (x) {}
        track("install_dismissed"); b.remove();
      });
    }
    setTimeout(show, views >= 2 ? 4000 : 25000);
  })();
})();
