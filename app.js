// My Aloha Map — client behavior: search/filter, My Spots (localStorage), map, sharing, demo forms.
(function () {
  var KEY = "aloha_spots";
  function getSpots() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function setSpots(a) { localStorage.setItem(KEY, JSON.stringify(a)); }

  // ---- save hearts -----------------------------------------------------
  function paintHearts() {
    var s = getSpots();
    document.querySelectorAll(".save").forEach(function (b) {
      var on = s.indexOf(b.dataset.slug) > -1;
      b.classList.toggle("on", on);
      b.textContent = on ? "♥" : "♡";
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".save");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var s = getSpots(), i = s.indexOf(b.dataset.slug);
    if (i > -1) s.splice(i, 1); else s.push(b.dataset.slug);
    setSpots(s); paintHearts();
  });
  paintHearts();

  // ---- index search / filter ------------------------------------------
  var q = document.getElementById("q"), loc = document.getElementById("loc"),
      grid = document.getElementById("grid");
  if (grid) {
    var cards = [].slice.call(grid.querySelectorAll(".lcard")),
        chips = [].slice.call(document.querySelectorAll(".chip")),
        cat = "all", st = "all";
    function apply() {
      var t = (q && q.value || "").toLowerCase(), n = 0;
      cards.forEach(function (c) {
        var okC = cat === "all" || c.dataset.cat === cat,
            okS = st === "all" || c.dataset.state === st,
            okT = !t || c.dataset.search.indexOf(t) > -1,
            show = okC && okS && okT;
        c.style.display = show ? "" : "none"; if (show) n++;
      });
      var em = document.getElementById("empty"); if (em) em.style.display = n ? "none" : "block";
    }
    if (q) q.addEventListener("input", apply);
    if (loc) loc.addEventListener("change", function () { st = loc.value; apply(); });
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("on"); });
        ch.classList.add("on"); cat = ch.dataset.cat; apply();
      });
    });
  }

  // ---- My Spots render (saved or shared via ?spots=) -------------------
  var sg = document.getElementById("spotsgrid");
  if (sg && window.__ALL) {
    var params = new URLSearchParams(location.search);
    var shared = params.get("spots");
    var slugs = shared ? shared.split(",").filter(Boolean) : getSpots();
    var byslug = {}; window.__ALL.forEach(function (l) { byslug[l.slug] = l; });
    var html = "";
    slugs.forEach(function (sl) {
      var l = byslug[sl]; if (!l) return;
      var loc2 = l.city + (l.state ? ", " + l.state : "");
      var v = l.verified ? '<span class="vtag">🌺 Verified</span>' : "";
      var rev = l.reviews ? '<div class="city">⭐ ' + l.reviews + ' reviews</div>' : "";
      html += '<div class="lcard" data-slug="' + l.slug + '">' +
        '<button class="save on" data-slug="' + l.slug + '">♥</button>' +
        '<a class="lcard-body" href="../' + l.slug + '/"><div class="emoji">' + l.emoji + '</div>' +
        '<span class="cat">' + l.category + '</span>' + v +
        '<h3>' + l.name + '</h3><p>' + (l.service || "") + '</p>' +
        '<div class="city">📍 ' + loc2 + '</div>' + rev + '</a></div>';
    });
    sg.innerHTML = html;
    var empty = document.getElementById("spotsempty");
    if (empty) empty.style.display = html ? "none" : "block";
    if (shared) {
      var h1 = document.querySelector(".ghero h1");
      if (h1) h1.innerHTML = '♡ <span class="g">A shared list</span>';
    }
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
    var m = L.map("map").setView([37.5, -119], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(m);
    var group = [];
    window.__MAPDATA.forEach(function (p) {
      var icon = L.divIcon({
        className: "pinwrap",
        html: '<div class="pin' + (p.v ? " v" : "") + '" style="background:' + p.col + '"><span>' + p.e + '</span></div>',
        iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16]
      });
      var mk = L.marker([p.lat, p.lng], { icon: icon }).addTo(m);
      mk.bindPopup('<b>' + p.n + '</b><br>' + p.c + ' · ' + p.city +
        (p.v ? ' · 🌺 Verified' : '') + '<br><a href="../' + p.s + '/">View listing →</a>');
      group.push([p.lat, p.lng]);
    });
    if (group.length) m.fitBounds(group, { padding: [40, 40], maxZoom: 11 });
  }

  // ---- nonprofit finder ("support one near you") ----------------------
  var npf = document.getElementById("npfinder");
  if (npf && window.__NPS) {
    var NPS = window.__NPS, PFX = window.__NPPREFIX || "";
    var box = document.getElementById("npresults");
    function mi(a, b, c, d) {
      var R = 3959, p = Math.PI / 180;
      var x = Math.sin((c - a) * p / 2), y = Math.sin((d - b) * p / 2);
      var h = x * x + Math.cos(a * p) * Math.cos(c * p) * y * y;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    function draw(list, withDist) {
      box.innerHTML = list.map(function (n) {
        var loc = n.city + (n.state ? ", " + n.state : "");
        if (withDist && n._d != null) loc += " · " + Math.round(n._d) + " mi";
        var eth = n.eth ? " · " + n.eth : "";
        return '<div class="lcard"><a class="lcard-body" href="' + PFX + n.slug + '/">' +
          '<div class="emoji">' + n.e + '</div><span class="cat">Nonprofit' + eth + '</span>' +
          '<h3>' + n.name + '</h3><p>' + (n.svc || "") + '</p>' +
          '<div class="city">📍 ' + loc + '</div></a></div>';
      }).join("");
    }
    draw(NPS.slice(0, 6), false); // starter set
    var geoBtn = document.getElementById("npgeo"), stateSel = document.getElementById("npstate");
    if (geoBtn) geoBtn.addEventListener("click", function () {
      if (!navigator.geolocation) { alert("Location isn't available — pick your state instead."); return; }
      geoBtn.textContent = "📍 Locating…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, ln = pos.coords.longitude;
        var withCoords = NPS.filter(function (n) { return n.lat != null; })
          .map(function (n) { n._d = mi(la, ln, n.lat, n.lng); return n; })
          .sort(function (a, b) { return a._d - b._d; });
        draw(withCoords.slice(0, 6), true);
        geoBtn.textContent = "📍 Nonprofits near you";
        if (stateSel) stateSel.value = "";
      }, function () {
        geoBtn.textContent = "📍 Use my location";
        alert("Couldn't get your location — pick your state instead.");
      });
    });
    if (stateSel) stateSel.addEventListener("change", function () {
      var s = stateSel.value;
      if (!s) { draw(NPS.slice(0, 6), false); return; }
      draw(NPS.filter(function (n) { return n.state === s; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 12), false);
    });
  }

  // ---- demo forms (no webhook wired yet) ------------------------------
  document.querySelectorAll("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      f.querySelectorAll(".fld,button,.consent,input[type=email]").forEach(function (el) { el.style.display = "none"; });
      var ok = f.querySelector(".form-ok"); if (ok) ok.hidden = false;
    });
  });
})();
