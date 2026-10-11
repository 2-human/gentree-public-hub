/* Gentree hub — three panels, after the Crēdo Marketing Hub design (MH-10, 5 Oct 2026).
 * Left: navigation tree (graph, people, families, places, unions, data). Main: the item chosen in the navigation; the
 * family graph by default. Right: a drawer with the details of the person or union clicked in main.
 * Routes (hash): #/graph[?focus=<id>] · #/people · #/people/<id>[?tab=…] · #/families · #/families/<surname> ·
 *                #/places · #/places/<slug> · #/unions · #/data/questions · #/data/about
 * Data: data/data.js (PEOPLE, UNIONS) — see the header of that file for the fields. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var enc = encodeURIComponent, dec = decodeURIComponent;
  if (typeof PEOPLE === 'undefined' || typeof UNIONS === 'undefined') {
    $('app-main').innerHTML = '<h1>Gentree</h1><p class="lead">The family data could not be loaded (data/data.js is missing).</p>';
    return;
  }

  /* ───────────── model ───────────── */
  var yearOf = function (d) { return d ? parseInt(String(d).slice(0, 4), 10) : null; };
  var fracYear = function (d) { if (!d) return null; var p = String(d).split('-').map(Number); return p[0] + ((p[1] || 1) - 1) / 12 + ((p[2] || 1) - 1) / 365; };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(d) { if (!d) return ''; var p = String(d).split('-'); if (!p[1]) return p[0]; if (!p[2]) return MONTHS[+p[1] - 1] + ' ' + p[0]; return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }

  var people = new Map(), unions = new Map();
  PEOPLE.forEach(function (p) {
    people.set(p.id, Object.assign({}, p, { born: p.born || null, died: p.died || null, bornYear: yearOf(p.born), bornY: fracYear(p.born), diedYear: yearOf(p.died), parentUnion: null, unions: [], estimated: false }));
  });
  UNIONS.forEach(function (u) {
    var r = Object.assign({}, u, { partners: u.partners || [], children: u.children || [], year: u.year ? +u.year : (u.date ? yearOf(u.date) : null), yearY: u.date ? fracYear(u.date) : (u.year ? +u.year : null), yearEstimated: !!u.approx });
    unions.set(r.id, r);
    r.partners.forEach(function (pid) { var p = people.get(pid); if (!p) throw new Error('Union ' + r.id + ': unknown person ' + pid); p.unions.push(r.id); });
    r.children.forEach(function (c) { var p = people.get(c); if (!p) throw new Error('Union ' + r.id + ': unknown child ' + c); p.parentUnion = r.id; });
  });
  /* fill in missing years so everyone can be placed: a union sits a year before its first child (or 25 years after the
     younger partner); a person without a birth year is placed from their relatives */
  for (var pass = 0; pass < 4; pass++) {
    unions.forEach(function (u) { if (u.year) return;
      var kids = u.children.map(function (c) { return people.get(c).bornYear; }).filter(Boolean);
      var par = u.partners.map(function (p) { return people.get(p).bornYear; }).filter(Boolean);
      if (kids.length) { u.year = Math.min.apply(null, kids) - 1; u.yearEstimated = true; }
      else if (par.length) { u.year = Math.max.apply(null, par) + 25; u.yearEstimated = true; }
    });
    people.forEach(function (p) { if (p.bornYear) return;
      var own = p.unions.map(function (u) { return unions.get(u).year; }).filter(Boolean);
      var parent = p.parentUnion ? unions.get(p.parentUnion).year : null;
      if (parent) { p.bornYear = parent + 2; p.estimated = true; }
      else if (own.length) { p.bornYear = Math.min.apply(null, own) - 25; p.estimated = true; }
    });
  }
  people.forEach(function (p) { if (!p.bornYear) throw new Error('Cannot place ' + p.first + ': no birth year and no dated relatives'); });

  var name = function (p) { return [p.first, p.married || p.changed || p.surname].filter(Boolean).join(' '); };
  var fullName = function (p) { var later = p.married || p.changed; return later && later !== p.surname ? p.first + ' ' + later + ' (' + (p.married ? 'née' : 'born') + ' ' + p.surname + ')' : name(p); };
  var years = function (p) { var b = (p.estimated ? 'c. ' : '') + p.bornYear, d = p.diedYear != null ? p.diedYear : p.diedText; return d ? b + ' – ' + d : (p.estimated ? b : b + ' –'); };
  var personLink = function (p) { return '<a href="#/people/' + enc(p.id) + '">' + esc(name(p)) + '</a>'; };

  /* family-of-origin tint: one colour per birth surname that has children in the data, in order of frequency */
  var PALETTE = ['#c2543b', '#2f8070', '#7a5aa8', '#c08a1e', '#3b6fc2', '#b0477c', '#5f8a2f', '#8a6d3b'];
  var surnameCount = new Map();
  unions.forEach(function (u) { u.partners.forEach(function (pid) { var s = people.get(pid).surname; if (s) surnameCount.set(s, (surnameCount.get(s) || 0) + 1 + u.children.length); }); });
  var FAMILIES = {};
  Array.from(surnameCount.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, PALETTE.length).forEach(function (e, i) { FAMILIES[e[0]] = PALETTE[i]; });
  var surnames = {};   /* every birth surname → members (people born with it) */
  var UNKNOWN = 'Surname unknown';
  people.forEach(function (p) { var s = p.surname || UNKNOWN; (surnames[s] = surnames[s] || []).push(p); });
  var surnameList = Object.keys(surnames).sort(function (a, b) { return surnames[b].length - surnames[a].length || a.localeCompare(b); });

  /* places: born / died / married there */
  var slug = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var places = {};
  function addPlace(pl, kind, item) { if (!pl) return; var k = slug(pl); (places[k] = places[k] || { name: pl, slug: k, born: [], died: [], married: [] })[kind].push(item); }
  people.forEach(function (p) { addPlace(p.bornPlace, 'born', p); addPlace(p.diedPlace, 'died', p); });
  unions.forEach(function (u) { addPlace(u.place, 'married', u); });
  var placeList = Object.keys(places).map(function (k) { return places[k]; }).sort(function (a, b) { return (b.born.length + b.died.length + b.married.length) - (a.born.length + a.died.length + a.married.length) || a.name.localeCompare(b.name); });

  /* kinship */
  function ancestorsOf(id, maxDepth) { maxDepth = maxDepth || 8; var out = new Map(), q = [[id, 0]];
    while (q.length) { var cur = q.shift(), p = people.get(cur[0]), d = cur[1]; if (!p.parentUnion || d >= maxDepth) continue;
      unions.get(p.parentUnion).partners.forEach(function (par) { if (!out.has(par) || out.get(par) > d + 1) { out.set(par, d + 1); q.push([par, d + 1]); } }); }
    return out; }
  function descendantsOf(id) { var out = new Set(), q = [id];
    while (q.length) { var cur = q.shift(); people.get(cur).unions.forEach(function (uid) { unions.get(uid).children.forEach(function (c) { if (!out.has(c)) { out.add(c); q.push(c); } }); }); }
    return out; }
  function relation(u) {
    if (u.partners.length < 2) return null;
    var A = ancestorsOf(u.partners[0]), B = ancestorsOf(u.partners[1]), best = null;
    A.forEach(function (da, id) { if (B.has(id)) { var db = B.get(id); if (!best || da + db < best.da + best.db) best = { id: id, da: da, db: db }; } });
    if (!best) return null;
    var deg = Math.min(best.da, best.db) - 1, rem = Math.abs(best.da - best.db), ord = ['', 'first', 'second', 'third', 'fourth'];
    var label = deg === 0 ? (rem === 0 ? 'siblings' : 'aunt/uncle and niece/nephew') : (ord[deg] || deg + 'th') + ' cousins';
    if (deg > 0 && rem) label += rem === 1 ? ' once removed' : ' ' + rem + ' times removed';
    return { label: label, via: name(people.get(best.id)) };
  }
  unions.forEach(function (u) { u.rel = relation(u); });
  var siblingsOf = function (p) { return p.parentUnion ? unions.get(p.parentUnion).children.filter(function (c) { return c !== p.id; }).map(function (c) { return people.get(c); }) : []; };
  var parentsOf = function (p) { return p.parentUnion ? unions.get(p.parentUnion).partners.map(function (x) { return people.get(x); }) : []; };
  var childrenOf = function (p) { var out = []; p.unions.forEach(function (uid) { unions.get(uid).children.forEach(function (c) { out.push(people.get(c)); }); }); return out; };
  function unionTitle(u) { return u.partners.length ? u.partners.map(function (x) { return name(people.get(x)); }).concat(u.partners.length < 2 ? ['unknown partner'] : []).join(' & ') : 'Unknown parents'; }
  function unionWhen(u) {
    if (!u.partners.length) return 'Groups siblings whose parents are not yet known';
    var verb = u.type === 'partnership' ? 'Partnership' : 'Married', where = u.place ? ', ' + u.place : '';
    var when = u.approx ? verb + ' about ' + u.year + where : u.yearEstimated ? verb + where + ', date not recorded' : verb + ' ' + (u.date ? fmtDate(u.date) : u.year) + where;
    if (u.separated) when += '; separated ' + fmtDate(u.separated);
    if (u.ended) when += '; ' + (u.endedHow || 'ended') + (u.ended === true ? ', date unknown' : ' ' + fmtDate(u.ended));
    return when;
  }
  /* open questions: what the data still lacks */
  function openQuestions() {
    var q = [];
    people.forEach(function (p) {
      if (p.note && /not yet known|CONFIRM|probable|not confirmed/i.test(p.note)) q.push({ kind: 'person', id: p.id, label: name(p), what: p.note });
      if (!p.surname) q.push({ kind: 'person', id: p.id, label: name(p), what: 'Surname unknown.' });
      if (!p.born) q.push({ kind: 'person', id: p.id, label: name(p), what: 'Birth date unknown (placed at about ' + p.bornYear + ').' });
      else if (!p.bornPlace) q.push({ kind: 'person', id: p.id, label: name(p), what: 'Birthplace unknown.' });
      if (p.diedText && !p.died) q.push({ kind: 'person', id: p.id, label: name(p), what: 'Death date unknown (' + p.diedText + ').' });
      if (p.died && !p.diedPlace) q.push({ kind: 'person', id: p.id, label: name(p), what: 'Place of death unknown.' });
    });
    unions.forEach(function (u) {
      if (!u.partners.length) q.push({ kind: 'union', id: u.id, label: unionTitle(u), what: 'Parents of ' + u.children.map(function (c) { return name(people.get(c)); }).join(', ') + ' unknown.' });
      else if (u.partners.length < 2) q.push({ kind: 'union', id: u.id, label: unionTitle(u), what: 'Partner unknown.' });
      if (u.yearEstimated && u.partners.length) q.push({ kind: 'union', id: u.id, label: unionTitle(u), what: u.approx ? 'Marriage date approximate (about ' + u.year + ').' : 'Marriage date not recorded.' });
      else if (u.partners.length && !u.place) q.push({ kind: 'union', id: u.id, label: unionTitle(u), what: 'Marriage place not recorded.' });
      if (u.ended === true) q.push({ kind: 'union', id: u.id, label: unionTitle(u), what: 'Date the union ended unknown.' });
    });
    return q;
  }

  /* ───────────── the graph ───────────── */
  var G = (function () {
    var PW = 128, PH = 38, PH2 = 52, UW = 14, UH = 12, GAPX = 18, GAPY = 8, YPX = 10, ROW = 150, TEXT_W = PW - 18;
    var mctx = document.createElement('canvas').getContext('2d'); mctx.font = '12px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
    var textW = function (s) { return mctx.measureText(s).width; };
    function wrapName(s) { if (textW(s) <= TEXT_W) return [s]; var w = s.split(' '), first = w[0];
      for (var i = 1; i < w.length; i++) { var t = first + ' ' + w[i]; if (textW(t) <= TEXT_W) first = t; else return [first, w.slice(i).join(' ')]; } return [first]; }
    var nodes = [], byId = new Map();
    people.forEach(function (p) { var lines = wrapName(name(p)); var n = { id: p.id, kind: 'p', w: PW, h: lines.length > 1 ? PH2 : PH, lines: lines, x: 0, y: 0, nb: [] }; nodes.push(n); byId.set(p.id, n); });
    unions.forEach(function (u) { var n = { id: u.id, kind: 'u', w: UW, h: UH, x: 0, y: 0, nb: [] }; nodes.push(n); byId.set(u.id, n); });
    unions.forEach(function (u) { var un = byId.get(u.id);
      u.partners.forEach(function (pid) { un.nb.push(byId.get(pid)); byId.get(pid).nb.push(un); });
      u.children.forEach(function (cid) { un.nb.push(byId.get(cid)); byId.get(cid).nb.push(un); }); });
    var allY = Array.from(people.values()).map(function (p) { return p.bornYear; });
    var minYear = Math.min.apply(null, allY) - 6, maxYear = Math.max.apply(null, allY) + 6;
    function generations() { var gen = new Map(), changed = true, guard = 0;
      people.forEach(function (p) { if (!p.parentUnion) gen.set(p.id, 0); });
      while (changed && guard++ < 50) { changed = false;
        unions.forEach(function (u) { var gs = u.partners.map(function (id) { return gen.get(id); }).filter(function (g) { return g !== undefined; });
          var g = gs.length ? Math.max.apply(null, gs) : (u.partners.length ? null : 0); if (g === null) return;
          u.partners.forEach(function (id) { if (!people.get(id).parentUnion && gen.get(id) !== g) { gen.set(id, g); changed = true; } });
          u.children.forEach(function (c) { if (gen.get(c) !== g + 1) { gen.set(c, g + 1); changed = true; } }); }); }
      return gen; }
    var GEN = generations();
    var mode = 'time';
    function assignY() { nodes.forEach(function (n) {
      if (n.kind === 'p') { var p = people.get(n.id); n.y = mode === 'time' ? ((p.bornY != null ? p.bornY : p.bornYear) - minYear) * YPX : (GEN.get(p.id) || 0) * ROW; }
      else { var u = unions.get(n.id); if (mode === 'time') n.y = ((u.yearY != null ? u.yearY : u.year) - minYear) * YPX - UH / 2;
        else { var gs = u.partners.map(function (id) { return GEN.get(id) || 0; }); n.y = ((gs.length ? Math.max.apply(null, gs) : -1) + 0.5) * ROW + PH / 2 - UH / 2; } } }); }
    function initialOrder() { var seen = new Set(), order = [];
      var visitP = function (id) { if (seen.has(id)) return; seen.add(id); order.push(byId.get(id));
        people.get(id).unions.map(function (u) { return unions.get(u); }).sort(function (a, b) { return a.year - b.year; }).forEach(visitU); };
      var visitU = function (u) { if (seen.has(u.id)) return; seen.add(u.id);
        if (u.partners[0]) visitP(u.partners[0]); order.push(byId.get(u.id)); if (u.partners[1]) visitP(u.partners[1]);
        u.children.map(function (c) { return people.get(c); }).sort(function (a, b) { return a.bornYear - b.bornYear; }).forEach(function (c) { visitP(c.id); }); };
      Array.from(unions.values()).sort(function (a, b) { return a.year - b.year; }).forEach(visitU);
      people.forEach(function (p) { visitP(p.id); });
      order.forEach(function (n, i) { n.x = i * 70; }); }
    var overlapY = function (a, b) { return a.y < b.y + b.h + GAPY && b.y < a.y + a.h + GAPY; };
    function relax() { var N = nodes.length;
      for (var it = 0; it < 600; it++) { var k = 0.5 * (1 - it / 600) + 0.08;
        nodes.forEach(function (n) { if (!n.nb.length) return; var s = 0; n.nb.forEach(function (m) { s += m.x; }); n.x += k * (s / n.nb.length - n.x); });
        unions.forEach(function (u) {
          var kids = u.children.map(function (c) { return byId.get(c); }); if (kids.length > 1) { var xs = kids.map(function (n) { return n.x; }).sort(function (a, b) { return a - b; }); kids.forEach(function (n, i) { n.x = xs[i]; }); }
          if (u.partners.length < 2) return;
          var a = byId.get(u.partners[0]), b = byId.get(u.partners[1]), un = byId.get(u.id), minSep = PW + GAPX, mid = (a.x + b.x) / 2, dir = a.x <= b.x ? 1 : -1;
          if (Math.abs(a.x - b.x) < minSep) { a.x = mid - dir * minSep / 2; b.x = mid + dir * minSep / 2; }
          var lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x); if (un.x < lo || un.x > hi) un.x = Math.min(hi, Math.max(lo, un.x)); });
        for (var ps = 0; ps < 3; ps++) { nodes.sort(function (a, b) { return a.x - b.x; });
          for (var i = 0; i < N; i++) { var a2 = nodes[i]; for (var j = i + 1; j < N; j++) { var b2 = nodes[j], need = (a2.w + b2.w) / 2 + GAPX, dx = b2.x - a2.x;
            if (dx > need + PW) break; if (dx < need && overlapY(a2, b2)) { var sh = (need - dx) / 2 + 0.01; a2.x -= sh; b2.x += sh; } } } } }
      var minX = Math.min.apply(null, nodes.map(function (n) { return n.x - n.w / 2; })); nodes.forEach(function (n) { n.x -= minX - 20; }); }
    var laid = null;
    function layout() { if (laid === mode) return; assignY(); initialOrder(); relax(); laid = mode; }

    var opts = { mode: 'time', tint: false, cousin: false, years: false, grid: true };
    try { Object.assign(opts, JSON.parse(localStorage.getItem('gt-graph-opts') || '{}')); } catch (e) {}
    var saveOpts = function () { try { localStorage.setItem('gt-graph-opts', JSON.stringify(opts)); } catch (e) {} };
    var NS = 'http://www.w3.org/2000/svg';
    var el = function (t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; };
    var wrap, svg, world, gGrid, gEdges, gNodes, tip, extent = { w: 0, h: 0 }, view = { k: 1, tx: 0, ty: 0 }, rootId = '', onPick = null;

    function render() {
      gGrid.innerHTML = ''; gEdges.innerHTML = ''; gNodes.innerHTML = '';
      var width = Math.max.apply(null, nodes.map(function (n) { return n.x + n.w / 2; })) + 40, height = Math.max.apply(null, nodes.map(function (n) { return n.y + n.h; })) + 40;
      extent = { w: width + 80, h: height };
      if (mode === 'time') { for (var y = Math.ceil(minYear / 10) * 10; y <= maxYear; y += 10) { var yy = (y - minYear) * YPX + PH / 2;
        gGrid.appendChild(el('line', { x1: -70, y1: yy, x2: width, y2: yy })); var t = el('text', { x: -74, y: yy + 4, 'text-anchor': 'end' }); t.textContent = y; gGrid.appendChild(t); } }
      else { var maxG = Math.max.apply(null, Array.from(GEN.values())); for (var g = 0; g <= maxG; g++) { var gy = g * ROW + PH / 2;
        gGrid.appendChild(el('line', { x1: -70, y1: gy, x2: width, y2: gy })); var t2 = el('text', { x: -74, y: gy + 4, 'text-anchor': 'end' }); t2.textContent = 'Gen ' + g; gGrid.appendChild(t2); } }
      unions.forEach(function (u) { var un = byId.get(u.id), uy = un.y + UH / 2, ux = un.x, cls = 'edge' + (u.rel ? ' cousin' : '');
        u.partners.forEach(function (pid) { var pn = byId.get(pid); gEdges.appendChild(el('path', { d: 'M' + pn.x + ',' + (pn.y + pn.h) + ' V' + uy + ' H' + ux, 'class': cls, 'data-union': u.id, 'data-person': pid })); });
        u.children.forEach(function (cid) { var cn = byId.get(cid), jog = Math.min(cn.y, Math.max(uy + 4, cn.y - 14));
          gEdges.appendChild(el('path', { d: 'M' + ux + ',' + uy + ' V' + jog + ' H' + cn.x + ' V' + cn.y, 'class': 'edge', 'data-union': u.id, 'data-person': cid, 'data-child': 1 })); }); });
      unions.forEach(function (u) { var n = byId.get(u.id);
        var g2 = el('g', { 'class': 'union' + (u.rel ? ' cousin' : ''), 'data-id': u.id, transform: 'translate(' + n.x + ',' + (n.y + UH / 2) + ')' });
        g2.appendChild(el('circle', { r: 4.5 })); if (u.ended) g2.appendChild(el('line', { x1: -3, y1: 3, x2: 3, y2: -3, 'class': 'ended' }));
        var t3 = el('text', { x: 8, y: 3.5 }); t3.textContent = (u.yearEstimated ? 'c. ' : '') + u.year + (u.ended && u.ended !== true ? '–' + yearOf(u.ended) : ''); g2.appendChild(t3); gNodes.appendChild(g2); });
      people.forEach(function (p) { var n = byId.get(p.id);
        var g3 = el('g', { 'class': 'node', 'data-id': p.id, transform: 'translate(' + (n.x - PW / 2) + ',' + n.y + ')' });
        g3.appendChild(el('rect', { width: PW, height: n.h, rx: 4 }));
        g3.appendChild(el('rect', { 'class': 'tint', x: 0, y: 0, width: 4, height: n.h, rx: 1, fill: FAMILIES[p.surname] || 'var(--gother)' }));
        n.lines.forEach(function (line, i) { var t4 = el('text', { x: 11, y: 16 + i * 14 }); t4.textContent = line; g3.appendChild(t4); });
        var t5 = el('text', { x: 11, y: n.h - 8, 'class': 'yrs' }); t5.textContent = years(p); g3.appendChild(t5); gNodes.appendChild(g3); });
      applyFocus();
    }
    var applyView = function () { world.setAttribute('transform', 'translate(' + view.tx + ',' + view.ty + ') scale(' + view.k + ')'); };
    function fit() { var r = svg.getBoundingClientRect(), pad = 24, top = 56;
      var k = Math.min((r.width - pad * 2) / extent.w, (r.height - top - pad) / extent.h, 1.2);
      view.k = k; view.tx = pad + 80 * k + (r.width - pad * 2 - extent.w * k) / 2; view.ty = top + (r.height - top - pad - extent.h * k) / 2; applyView(); }
    function centerOn(id) { var n = byId.get(id); if (!n) return; var r = svg.getBoundingClientRect(); view.k = Math.max(view.k, 1);
      view.tx = r.width / 2 - n.x * view.k; view.ty = r.height / 2 - (n.y + n.h / 2) * view.k; applyView(); select(id); }
    function select(id) { Array.prototype.forEach.call(svg.querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); }); var g = id && gNodes.querySelector('.node[data-id="' + id + '"]'); if (g) g.classList.add('sel'); }
    function applyFocus() {
      Array.prototype.forEach.call(svg.querySelectorAll('.infocus,.root'), function (x) { x.classList.remove('infocus'); x.classList.remove('root'); });
      if (!rootId) { svg.classList.remove('focusmode'); return; }
      svg.classList.add('focusmode');
      var anc = ancestorsOf(rootId), desc = descendantsOf(rootId), ids = new Set([rootId]); anc.forEach(function (v, k) { ids.add(k); }); desc.forEach(function (k) { ids.add(k); });
      var uids = new Set();
      ids.forEach(function (id) { var p = people.get(id); if (p.parentUnion && (id === rootId || anc.has(id))) uids.add(p.parentUnion); if (id === rootId || desc.has(id)) p.unions.forEach(function (u) { uids.add(u); }); });
      ids.forEach(function (id) { gNodes.querySelector('.node[data-id="' + id + '"]').classList.add('infocus'); });
      gNodes.querySelector('.node[data-id="' + rootId + '"]').classList.add('root');
      uids.forEach(function (uid) { gNodes.querySelector('.union[data-id="' + uid + '"]').classList.add('infocus');
        Array.prototype.forEach.call(gEdges.querySelectorAll('.edge[data-union="' + uid + '"]'), function (e) { if (ids.has(e.getAttribute('data-person'))) e.classList.add('infocus'); }); });
    }
    /* hover: the neighbourhood of a person or union, and a tooltip */
    var showTip = function (html, e) { tip.innerHTML = html; tip.style.display = 'block'; moveTip(e); };
    function moveTip(e) { var r = svg.getBoundingClientRect(), x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 10; if (y + tip.offsetHeight > r.height - 8) y = e.clientY - r.top - tip.offsetHeight - 10; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
    var hideTip = function () { tip.style.display = 'none'; };
    var setOn = function (sel) { Array.prototype.forEach.call(svg.querySelectorAll('.on'), function (x) { x.classList.remove('on'); }); sel.forEach(function (x) { if (x) x.classList.add('on'); }); };
    function hoverIn(e) { var g = e.target.closest('.node,.union'); if (!g) return; var id = g.getAttribute('data-id'), on = [];
      if (g.classList.contains('node')) { var p = people.get(id), uids = [p.parentUnion].concat(p.unions).filter(Boolean), pids = new Set([id]);
        uids.forEach(function (uid) { var u = unions.get(uid); u.partners.forEach(function (x) { pids.add(x); }); if (uid !== p.parentUnion) u.children.forEach(function (x) { pids.add(x); }); });
        if (p.parentUnion) unions.get(p.parentUnion).children.forEach(function (x) { pids.add(x); });
        pids.forEach(function (x) { on.push(gNodes.querySelector('.node[data-id="' + x + '"]')); });
        uids.forEach(function (uid) { on.push(gNodes.querySelector('.union[data-id="' + uid + '"]')); Array.prototype.forEach.call(gEdges.querySelectorAll('.edge[data-union="' + uid + '"]'), function (x) { on.push(x); }); });
        var born = p.born ? fmtDate(p.born) + (p.bornPlace ? ', ' + p.bornPlace : '') : (p.estimated ? 'about ' + p.bornYear + ' (estimated)' : 'unknown');
        showTip('<b>' + esc(fullName(p)) + '</b><span class="m">Born:</span> ' + esc(born) + (p.died || p.diedText ? '<br><span class="m">Died:</span> ' + esc((p.died ? fmtDate(p.died) : p.diedText) + (p.diedPlace ? ', ' + p.diedPlace : '')) : '') + '<br><span class="m">Click for details</span>', e); }
      else { var u = unions.get(id); on.push(g); Array.prototype.forEach.call(gEdges.querySelectorAll('.edge[data-union="' + id + '"]'), function (x) { on.push(x); });
        u.partners.concat(u.children).forEach(function (x) { on.push(gNodes.querySelector('.node[data-id="' + x + '"]')); });
        showTip('<b>' + esc(unionTitle(u)) + '</b><span class="m">' + esc(unionWhen(u)) + ' · ' + u.children.length + ' child' + (u.children.length === 1 ? '' : 'ren') + '</span>' + (u.rel ? '<br><span class="m">Partners are ' + esc(u.rel.label) + ', via ' + esc(u.rel.via) + '</span>' : ''), e); }
      setOn(on); svg.classList.add('hovering'); }
    function hoverOut(e) { var from = e.target.closest && e.target.closest('.node,.union'); var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.node,.union'); if (from && to === from) return; svg.classList.remove('hovering'); setOn([]); hideTip(); }

    function toolbar() {
      var sel = '<select data-groot aria-label="Compare with a rooted chart"><option value="">No root (rootless)</option>' + Array.from(people.values()).sort(function (a, b) { return name(a).localeCompare(name(b)) || a.bornYear - b.bornYear; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === rootId ? ' selected' : '') + '>' + esc(name(p) + ' (' + p.bornYear + ')') + '</option>'; }).join('') + '</select>';
      var tg = function (k, label) { return '<button class="btn" data-gopt="' + k + '" aria-pressed="' + (opts[k] ? 'true' : 'false') + '">' + label + '</button>'; };
      return '<div class="gtools"><div class="seg"><button data-gmode="time" aria-pressed="' + (opts.mode === 'time') + '">Time axis</button><button data-gmode="gen" aria-pressed="' + (opts.mode === 'gen') + '">Generation rows</button></div>' +
        tg('tint', 'Tint by family') + tg('cousin', 'Cousin unions') + tg('years', 'Marriage years') + tg('grid', 'Year grid') + '<button class="btn" data-gfit>Fit</button>' + sel + '</div>' +
        '<div class="glegend">' + Object.keys(FAMILIES).map(function (s) { return '<span><i class="sw" style="background:' + FAMILIES[s] + '"></i>' + esc(s) + '</span>'; }).join('') + '<span><i class="sw" style="background:var(--gother)"></i>married in</span></div>' +
        '<div class="ghint">Drag to pan · wheel to zoom · hover for the neighbourhood · click for details</div><div class="gtip"></div>';
    }
    function applyOpts() { svg.classList.toggle('tinted', !!opts.tint); svg.classList.toggle('markcousin', !!opts.cousin); svg.classList.toggle('years', !!opts.years); gGrid.style.display = opts.grid ? '' : 'none';
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-gopt]'), function (b) { b.setAttribute('aria-pressed', String(!!opts[b.getAttribute('data-gopt')])); });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-gmode]'), function (b) { b.setAttribute('aria-pressed', String(opts.mode === b.getAttribute('data-gmode'))); });
      wrap.querySelector('.glegend').style.display = opts.tint ? '' : 'none'; }

    function mount(container, pick) {
      onPick = pick; mode = opts.mode;
      container.innerHTML = '<div class="graph-wrap"><svg xmlns="http://www.w3.org/2000/svg"><g class="world"><g class="grid"></g><g class="edges"></g><g class="nodes"></g></g></svg>' + toolbar() + '</div>';
      wrap = container.querySelector('.graph-wrap'); svg = wrap.querySelector('svg'); world = svg.querySelector('.world'); gGrid = svg.querySelector('.grid'); gEdges = svg.querySelector('.edges'); gNodes = svg.querySelector('.nodes'); tip = wrap.querySelector('.gtip');
      layout(); render(); fit(); applyOpts();
      /* pan / zoom; a click without movement picks the node under the pointer */
      var drag = null, moved = false;
      svg.addEventListener('wheel', function (e) { e.preventDefault(); var r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, f = Math.exp(-e.deltaY * 0.0015);
        var nk = Math.min(4, Math.max(0.15, view.k * f)), ratio = nk / view.k; view.tx = mx - (mx - view.tx) * ratio; view.ty = my - (my - view.ty) * ratio; view.k = nk; applyView(); }, { passive: false });
      svg.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, hit: e.target.closest && e.target.closest('.node,.union') }; moved = false; svg.classList.add('dragging'); try { svg.setPointerCapture(e.pointerId); } catch (x) {} });
      svg.addEventListener('pointermove', function (e) { if (!drag) return; if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true; view.tx = drag.tx + e.clientX - drag.x; view.ty = drag.ty + e.clientY - drag.y; applyView(); });
      var up = function (e) { if (!drag) return; var hit = drag.hit; drag = null; svg.classList.remove('dragging');   /* pointer capture retargets pointerup to the svg: use the element hit at pointerdown */
        if (!moved && onPick) { var g = hit; if (g) { var id = g.getAttribute('data-id'); if (g.classList.contains('node')) select(id); onPick(g.classList.contains('node') ? 'person' : 'union', id, g); } } };
      svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', function () { drag = null; svg.classList.remove('dragging'); });
      gNodes.addEventListener('pointerover', hoverIn); gNodes.addEventListener('pointermove', function (e) { if (tip.style.display === 'block') moveTip(e); }); gNodes.addEventListener('pointerout', hoverOut);
      wrap.addEventListener('click', function (e) {
        var b = e.target.closest('[data-gopt],[data-gmode],[data-gfit]'); if (!b) return;
        if (b.hasAttribute('data-gfit')) { fit(); return; }
        if (b.hasAttribute('data-gmode')) { opts.mode = b.getAttribute('data-gmode'); mode = opts.mode; saveOpts(); layout(); render(); fit(); applyOpts(); return; }
        var k = b.getAttribute('data-gopt'); opts[k] = !opts[k]; saveOpts(); applyOpts(); });
      wrap.querySelector('[data-groot]').addEventListener('change', function (e) { rootId = e.target.value; applyFocus(); });
      window.addEventListener('resize', onResize);
    }
    function onResize() { if (svg && document.body.contains(svg)) fit(); else window.removeEventListener('resize', onResize); }
    function setRoot(id) { rootId = id || ''; if (svg && document.body.contains(svg)) { applyFocus(); var s = wrap.querySelector('[data-groot]'); if (s) s.value = rootId; } }
    return { mount: mount, centerOn: centerOn, select: select, setRoot: setRoot, fit: fit, mounted: function () { return !!(svg && document.body.contains(svg)); } };
  })();

  /* ───────────── drawer ───────────── */
  var DR = [];
  var dr = function (fn) { DR.push(fn); return ' data-dr="' + (DR.length - 1) + '"'; };
  var lastTab = (function () { try { return sessionStorage.getItem('gt-drawer-tab'); } catch (e) { return null; } })();
  function openDrawer(title, tabs) {
    if (typeof tabs === 'string') tabs = [['Basic info', tabs]];
    tabs = tabs.filter(function (t) { return t && t[1]; });
    var pick = Math.max(0, tabs.map(function (t) { return t[0]; }).indexOf(lastTab));
    $('drawer-title').textContent = title;
    var bar = tabs.length > 1 ? '<div class="dtabs" role="tablist">' + tabs.map(function (t, i) { return '<button role="tab" id="dtab-' + i + '" aria-controls="dpanel-' + i + '" aria-selected="' + (i === pick) + '" data-dtab="' + i + '">' + esc(t[0]) + '</button>'; }).join('') + '</div>' : '';
    $('drawer-body').innerHTML = bar + tabs.map(function (t, i) { return '<div class="dpanel" role="tabpanel" id="dpanel-' + i + '" aria-labelledby="dtab-' + i + '"' + (i === pick ? '' : ' hidden') + '>' + t[1] + '</div>'; }).join('');
    $('drawer-body').scrollTop = 0;
    var d = $('app-drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('drawer-close').focus();
  }
  function pickDrawerTab(i) {
    Array.prototype.forEach.call(document.querySelectorAll('#drawer-body [data-dtab]'), function (b) { var on = +b.getAttribute('data-dtab') === i; b.setAttribute('aria-selected', String(on)); if (on) { lastTab = b.textContent; try { sessionStorage.setItem('gt-drawer-tab', lastTab); } catch (e) {} } });
    Array.prototype.forEach.call(document.querySelectorAll('#drawer-body .dpanel'), function (p, k) { p.hidden = k !== i; });
  }
  function closeDrawer() {
    var d = $('app-drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
    var a = document.activeElement; if (a && a.closest && a.closest('#app-drawer')) $('app-main').focus({ preventScroll: true });
    Array.prototype.forEach.call(document.querySelectorAll('.sel'), function (e) { e.classList.remove('sel'); });
  }
  var kv = function (rows) { return '<dl class="kv">' + rows.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; };
  var go = function (href, t, cls) { return '<a class="btn' + (cls ? ' ' + cls : '') + '" href="' + esc(href) + '">' + esc(t) + '</a>'; };
  var pbtn = function (p) { return '<button class="linkbtn"' + dr(function () { drawerPerson(p); }) + '>' + esc(name(p)) + '</button> <span class="sub">' + esc(years(p)) + '</span>'; };
  var ubtn = function (u, t) { return '<button class="linkbtn"' + dr(function () { drawerUnion(u); }) + '>' + esc(t || unionTitle(u)) + '</button>'; };

  function personBasics(p) {
    return kv([['Name', esc(fullName(p))], ['Family of origin', p.surname ? '<i class="sw" style="background:' + (FAMILIES[p.surname] || 'var(--gother)') + '"></i>' + '<a href="#/families/' + enc(p.surname) + '">' + esc(p.surname) + '</a>' : '<span class="sub">unknown</span>'],
      ['Born', p.born ? esc(fmtDate(p.born)) + (p.bornPlace ? ', ' + placeLink(p.bornPlace) : '') : (p.estimated ? 'about ' + p.bornYear + ' <span class="chip warn">estimated</span>' : 'unknown')],
      ['Died', p.died || p.diedText ? esc(p.died ? fmtDate(p.died) : p.diedText) + (p.diedPlace ? ', ' + placeLink(p.diedPlace) : '') : null],
      ['Note', p.note ? esc(p.note) : null]]);
  }
  function personRelations(p) {
    var h = '', par = parentsOf(p), sib = siblingsOf(p), kids = childrenOf(p);
    h += '<h3>Parents</h3>' + (p.parentUnion ? (par.length ? '<ul class="rel">' + par.map(function (x) { return '<li>' + pbtn(x) + '</li>'; }).join('') + '</ul>' : '<p class="note">Parents not yet known (grouped with siblings).</p>') : '<p class="note">Not recorded.</p>');
    if (sib.length) h += '<h3>Siblings</h3><ul class="rel">' + sib.sort(function (a, b) { return a.bornYear - b.bornYear; }).map(function (x) { return '<li>' + pbtn(x) + '</li>'; }).join('') + '</ul>';
    h += '<h3>Partners</h3>' + (p.unions.length ? '<ul class="rel">' + p.unions.map(function (uid) { var u = unions.get(uid), o = u.partners.filter(function (x) { return x !== p.id; })[0];
      return '<li>' + (o ? pbtn(people.get(o)) : '<span class="sub">unknown partner</span>') + '<div class="sub">' + esc(unionWhen(u)) + ' · ' + ubtn(u, 'union details') + '</div></li>'; }).join('') + '</ul>' : '<p class="note">None recorded.</p>');
    h += '<h3>Children</h3>' + (kids.length ? '<ul class="rel">' + kids.sort(function (a, b) { return a.bornYear - b.bornYear; }).map(function (x) { return '<li>' + pbtn(x) + '</li>'; }).join('') + '</ul>' : '<p class="note">None recorded.</p>');
    return h;
  }
  function personEvents(p) {
    var ev = [];
    ev.push([p.bornY != null ? p.bornY : p.bornYear, p.born ? fmtDate(p.born) : 'c. ' + p.bornYear, 'Born' + (p.bornPlace ? ' in ' + p.bornPlace : '')]);
    p.unions.forEach(function (uid) { var u = unions.get(uid), o = u.partners.filter(function (x) { return x !== p.id; })[0];
      ev.push([u.yearY != null ? u.yearY : u.year, u.date ? fmtDate(u.date) : (u.yearEstimated ? 'c. ' + u.year : String(u.year)), (u.type === 'partnership' ? 'Partnership with ' : 'Married ') + (o ? name(people.get(o)) : 'unknown partner') + (u.place ? ' in ' + u.place : '')]);
      u.children.forEach(function (c) { var k = people.get(c); ev.push([k.bornY != null ? k.bornY : k.bornYear, k.born ? fmtDate(k.born) : 'c. ' + k.bornYear, 'Child ' + name(k) + ' born' + (k.bornPlace ? ' in ' + k.bornPlace : '')]); });
      if (u.separated) ev.push([fracYear(u.separated), fmtDate(u.separated), 'Separated from ' + (o ? name(people.get(o)) : 'partner')]);
      if (u.ended && u.ended !== true) ev.push([fracYear(u.ended), fmtDate(u.ended), (u.endedHow === 'divorced' ? 'Divorced ' : 'Union ended with ') + (o ? name(people.get(o)) : 'partner')]); });
    if (p.died) ev.push([fracYear(p.died), fmtDate(p.died), 'Died' + (p.diedPlace ? ' in ' + p.diedPlace : '')]); else if (p.diedText) ev.push([9999, p.diedText, 'Died' + (p.diedPlace ? ' in ' + p.diedPlace : '')]);
    ev.sort(function (a, b) { return a[0] - b[0]; });
    return '<ul class="timeline">' + ev.map(function (e) { return '<li><span class="when">' + esc(e[1]) + '</span><span>' + esc(e[2]) + '</span></li>'; }).join('') + '</ul>';
  }
  function drawerPerson(p) {
    openDrawer(name(p), [['Basic info', personBasics(p) + '<div class="toolbar">' + go('#/people/' + enc(p.id), 'Open the page') + go('#/graph?focus=' + enc(p.id), 'Show in graph') + '<button class="btn"' + dr(function () { G.setRoot(p.id); if (!G.mounted()) location.hash = '#/graph?focus=' + enc(p.id) + '&root=1'; }) + '>Compare as root</button></div>'],
      ['Relations', personRelations(p)], ['Timeline', personEvents(p)]]);
  }
  function drawerUnion(u) {
    var kids = u.children.map(function (c) { return people.get(c); }).sort(function (a, b) { return a.bornYear - b.bornYear; });
    openDrawer(unionTitle(u), [['Basic info', kv([['Partners', u.partners.length ? u.partners.map(function (x) { return pbtn(people.get(x)); }).join('<br>') : '<span class="sub">unknown</span>'],
        ['When', esc(unionWhen(u))], ['Kind', u.type === 'partnership' ? 'Partnership' : (u.partners.length ? 'Marriage' : 'Sibling group')],
        ['Partners related', u.rel ? esc(u.rel.label) + ', via ' + esc(u.rel.via) : null]]) + '<div class="toolbar">' + go('#/unions', 'All unions') + '</div>'],
      ['Children', kids.length ? '<ul class="rel">' + kids.map(function (k) { return '<li>' + pbtn(k) + '</li>'; }).join('') + '</ul>' : '<p class="note">None recorded.</p>']]);
  }
  var placeLink = function (pl) { return '<a href="#/places/' + enc(slug(pl)) + '">' + esc(pl) + '</a>'; };

  /* ───────────── views (main) ───────────── */
  function peopleTable(list, cols) {
    return '<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Born</th><th>Died</th><th>Family of origin</th><th>Parents</th><th class="num">Children</th></tr></thead><tbody>' +
      list.map(function (p) { var par = parentsOf(p);
        return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerPerson(p); }) + '><td>' + personLink(p) + (p.married && p.married !== p.surname ? '<div class="sub">née ' + esc(p.surname) + '</div>' : '') + '</td>' +
          '<td>' + esc(p.born ? fmtDate(p.born) : 'c. ' + p.bornYear) + (p.bornPlace ? '<div class="sub">' + esc(p.bornPlace) + '</div>' : '') + '</td>' +
          '<td>' + esc(p.died ? fmtDate(p.died) : (p.diedText || '')) + (p.diedPlace ? '<div class="sub">' + esc(p.diedPlace) + '</div>' : '') + '</td>' +
          '<td>' + (p.surname ? '<i class="sw" style="background:' + (FAMILIES[p.surname] || 'var(--gother)') + '"></i>' + esc(p.surname) : '<span class="sub">unknown</span>') + '</td>' +
          '<td class="sub">' + (par.length ? esc(par.map(name).join(' & ')) : (p.parentUnion ? 'unknown' : '')) + '</td><td class="num">' + childrenOf(p).length + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  var byName = function (a, b) { return name(a).localeCompare(name(b)) || a.bornYear - b.bornYear; };
  var byBirth = function (a, b) { return a.bornYear - b.bornYear || name(a).localeCompare(name(b)); };
  function viewPeople() { var list = Array.from(people.values()).sort(byBirth);
    return '<h1>People</h1><p class="lead">Everyone in the data, oldest first. Click a row for the details; the name opens the person’s page.</p>' + peopleTable(list); }
  function viewPerson(p, tab) {
    var tabs = [['overview', 'Overview'], ['relations', 'Relations'], ['timeline', 'Timeline']];
    var h = '<h1>' + esc(fullName(p)) + '</h1><p class="lead">' + esc(years(p)) + (p.bornPlace ? ' · born in ' + esc(p.bornPlace) : '') + '</p>' +
      '<div class="toolbar">' + go('#/graph?focus=' + enc(p.id), 'Show in graph') + '<button class="btn"' + dr(function () { drawerPerson(p); }) + '>Details</button></div>' +
      '<nav class="mtabs" aria-label="Views">' + tabs.map(function (t, i) { return '<a href="#/people/' + enc(p.id) + (i ? '?tab=' + t[0] : '') + '"' + ((tab || 'overview') === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>';
    if (tab === 'relations') h += personRelations(p); else if (tab === 'timeline') h += personEvents(p); else h += personBasics(p);
    return h;
  }
  function viewFamilies() {
    return '<h1>Families of origin</h1><p class="lead">One family per birth surname. The tint is the colour used in the graph.</p><div class="tiles">' + surnameList.map(function (s) { var m = surnames[s];
      return '<a class="tile" href="#/families/' + enc(s) + '" style="text-decoration:none"><h3><i class="sw" style="background:' + (FAMILIES[s] || 'var(--gother)') + '"></i>' + esc(s) + '</h3><p>' + m.length + ' ' + (m.length === 1 ? 'person' : 'people') + ' · ' + Math.min.apply(null, m.map(function (p) { return p.bornYear; })) + ' to ' + Math.max.apply(null, m.map(function (p) { return p.bornYear; })) + '</p></a>'; }).join('') + '</div>';
  }
  function viewFamily(s) { var m = (surnames[s] || []).slice().sort(byBirth);
    return '<h1><i class="sw" style="background:' + (FAMILIES[s] || 'var(--gother)') + '"></i>' + esc(s) + '</h1><p class="lead">' + m.length + ' people born ' + esc(s) + '.</p>' + peopleTable(m); }
  function viewPlaces() {
    return '<h1>Places</h1><p class="lead">Where people were born, married and died.</p><div class="scroll"><table class="tbl"><thead><tr><th>Place</th><th class="num">Born</th><th class="num">Married</th><th class="num">Died</th></tr></thead><tbody>' +
      placeList.map(function (pl) { return '<tr><td><a href="#/places/' + enc(pl.slug) + '">' + esc(pl.name) + '</a></td><td class="num">' + pl.born.length + '</td><td class="num">' + pl.married.length + '</td><td class="num">' + pl.died.length + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function viewPlace(pl) {
    var h = '<h1>' + esc(pl.name) + '</h1><p class="lead">' + pl.born.length + ' born · ' + pl.married.length + ' married · ' + pl.died.length + ' died here.</p>';
    if (pl.born.length) h += '<h2>Born here</h2>' + peopleTable(pl.born.slice().sort(byBirth));
    if (pl.married.length) h += '<h2>Married here</h2><ul class="rel">' + pl.married.map(function (u) { return '<li>' + ubtn(u) + ' <span class="sub">' + esc(unionWhen(u)) + '</span></li>'; }).join('') + '</ul>';
    if (pl.died.length) h += '<h2>Died here</h2>' + peopleTable(pl.died.slice().sort(byBirth));
    return h;
  }
  function viewUnions() { var list = Array.from(unions.values()).sort(function (a, b) { return a.year - b.year; });
    return '<h1>Unions</h1><p class="lead">Marriages and partnerships, oldest first. Click a row for the details.</p><div class="scroll"><table class="tbl"><thead><tr><th>Partners</th><th>When</th><th class="num">Children</th><th>Relation</th></tr></thead><tbody>' +
      list.map(function (u) { return '<tr class="clk"' + dr(function (el) { el.classList.add('sel'); drawerUnion(u); }) + '><td>' + esc(unionTitle(u)) + (u.ended ? ' <span class="chip">ended</span>' : '') + (u.type === 'partnership' ? ' <span class="chip">partnership</span>' : '') + '</td><td class="sub">' + esc(unionWhen(u)) + '</td><td class="num">' + u.children.length + '</td><td class="sub">' + (u.rel ? esc(u.rel.label) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>'; }
  function viewQuestions() { var q = openQuestions();
    return '<h1>Open questions</h1><p class="lead">What the data still lacks, derived from the records: unknown names, dates, places and partners. ' + q.length + ' items.</p><div class="scroll"><table class="tbl"><thead><tr><th>Who</th><th>What is missing</th></tr></thead><tbody>' +
      q.map(function (x) { var fn = x.kind === 'person' ? function (el) { el.classList.add('sel'); drawerPerson(people.get(x.id)); } : function (el) { el.classList.add('sel'); drawerUnion(unions.get(x.id)); };
        return '<tr class="clk"' + dr(fn) + '><td>' + esc(x.label) + ' <span class="chip">' + x.kind + '</span></td><td>' + esc(x.what) + '</td></tr>'; }).join('') + '</tbody></table></div>'; }
  function viewAbout() { var ys = Array.from(people.values()).map(function (p) { return p.bornYear; }), est = Array.from(people.values()).filter(function (p) { return p.estimated; }).length, ue = Array.from(unions.values()).filter(function (u) { return u.yearEstimated; }).length;
    var tile = function (k, v) { return '<div class="tile"><p>' + k + '</p><div class="big">' + v + '</div></div>'; };
    return '<h1>About the data</h1><p class="lead">The family as recorded so far. Data lives in <code>public/hub/data/data.js</code> of the private repo; the published copy is encrypted and opens with the password.</p>' +
      '<div class="tiles kpis">' + tile('People', people.size) + tile('Unions', unions.size) + tile('Families of origin', surnameList.length) + tile('Places', placeList.length) + tile('Span', Math.min.apply(null, ys) + ' – ' + Math.max.apply(null, ys)) + tile('Estimated birth years', est) + tile('Undated unions', ue) + '</div>' +
      '<h2>How to read the graph</h2><ol class="notes"><li>Vertical position is the birth year, so no generation is “the top”.</li><li>A marriage is a bar at its date; children hang from the bar, not from a parent, so no surname is the trunk.</li><li>Every line has the same weight and colour by default. “Compare as root” shows what a rooted chart would do instead.</li><li>Cousin unions are ordinary edges; a tree would have to duplicate people there.</li><li>“c.” marks a year estimated from relatives; the tooltip and the drawer say what is known.</li></ol>'; }

  /* ───────────── navigation ───────────── */
  var expanded = {}, lastCur = null;
  function nodesNav() {
    return [{ sec: 'Graph' }, { label: 'Family graph', href: '#/graph' },
      { sec: 'Entities' },
      { label: 'People', href: '#/people', count: people.size, children: Array.from(people.values()).sort(byName).map(function (p) { return { label: name(p) + ' (' + p.bornYear + ')', href: '#/people/' + enc(p.id), sw: FAMILIES[p.surname] || 'var(--gother)' }; }) },
      { label: 'Families', href: '#/families', count: surnameList.length, children: surnameList.map(function (s) { return { label: s, href: '#/families/' + enc(s), count: surnames[s].length, sw: FAMILIES[s] || 'var(--gother)' }; }) },
      { label: 'Places', href: '#/places', count: placeList.length, children: placeList.map(function (pl) { return { label: pl.name, href: '#/places/' + enc(pl.slug), count: pl.born.length + pl.married.length + pl.died.length }; }) },
      { label: 'Unions', href: '#/unions', count: unions.size },
      { sec: 'Data' }, { label: 'Open questions', href: '#/data/questions', count: openQuestions().length }, { label: 'About the data', href: '#/data/about' }];
  }
  function renderTree() {
    var cur = (location.hash || '#/graph').split('?')[0], q = ($('app-filter').value || '').trim().toLowerCase();
    if (lastCur !== cur) { expanded[cur] = true; lastCur = cur; }
    var ns = nodesNav();
    (function mark(list) { return list.some(function (n) { var hit = n.href === cur || (n.children && mark(n.children)); if (hit && n.children && n.href !== cur) expanded[n.href] = true; return hit; }); })(ns);
    function match(n) { return !q || (n.label || '').toLowerCase().indexOf(q) >= 0 || (n.children || []).some(match); }
    function li(n) {
      if (n.sec) return '<li class="sec">' + esc(n.sec) + '</li>';
      if (!match(n)) return '';
      var kids = n.children && n.children.length, open = kids && (expanded[n.href] || !!q);
      return '<li><div class="row' + (n.href === cur ? ' cur' : '') + '">' +
        '<button class="tog' + (kids ? '' : ' leaf') + '" data-tog="' + esc(n.href) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? 'Collapse ' : 'Expand ') + esc(n.label) + '">▶</button>' +
        '<a href="' + esc(n.href) + '"' + (n.href === cur ? ' aria-current="page"' : '') + ' title="' + esc(n.label) + '">' + (n.sw ? '<span class="sw" style="background:' + n.sw + '"></span>' : '') + esc(n.label) + '</a>' +
        (n.count != null ? '<span class="cnt">' + n.count + '</span>' : '') + '</div>' + (open ? '<ul>' + n.children.map(li).join('') + '</ul>' : '') + '</li>';
    }
    $('app-tree').innerHTML = '<ul class="tree">' + ns.map(li).join('') + '</ul>';
    var c = $('app-tree').querySelector('.row.cur'); if (c && !q) c.scrollIntoView({ block: 'nearest' });
  }

  /* ───────────── router ───────────── */
  function route(h) {   /* h: a hash to render instead of location.hash (smoke tests; window.GT.route) */
    var hash = typeof h === 'string' ? h : (location.hash || '#/graph'), qs = {}, path = hash.split('?')[0]; (hash.split('?')[1] || '').split('&').forEach(function (kv2) { if (kv2) { var p = kv2.split('='); qs[dec(p[0])] = dec(p[1] || ''); } });
    var parts = path.replace(/^#\/?/, '').split('/').map(function (s) { return s ? dec(s) : s; });
    var main = $('app-main'), crumbs = [], html = '', after = null; DR = []; main.classList.remove('flush'); closeDrawer();
    if (parts[0] === 'graph' || !parts[0]) { crumbs.push(['Family graph', '#/graph']); main.classList.add('flush'); html = '';
      after = function () { G.mount(main, function (kind, id) { if (kind === 'person') drawerPerson(people.get(id)); else drawerUnion(unions.get(id)); });
        if (qs.focus && people.has(qs.focus)) { G.centerOn(qs.focus); if (qs.root) G.setRoot(qs.focus); drawerPerson(people.get(qs.focus)); } }; }
    else if (parts[0] === 'people') { crumbs.push(['People', '#/people']); var p = parts[1] && people.get(parts[1]);
      if (p) { crumbs.push([name(p), path]); html = viewPerson(p, qs.tab); } else html = viewPeople(); }
    else if (parts[0] === 'families') { crumbs.push(['Families', '#/families']); if (parts[1] && surnames[parts[1]]) { crumbs.push([parts[1], path]); html = viewFamily(parts[1]); } else html = viewFamilies(); }
    else if (parts[0] === 'places') { crumbs.push(['Places', '#/places']); var pl = parts[1] && places[parts[1]]; if (pl) { crumbs.push([pl.name, path]); html = viewPlace(pl); } else html = viewPlaces(); }
    else if (parts[0] === 'unions') { crumbs.push(['Unions', '#/unions']); html = viewUnions(); }
    else if (parts[0] === 'data') { crumbs.push(['Data', '#/data/about']); if (parts[1] === 'questions') { crumbs.push(['Open questions', path]); html = viewQuestions(); } else { crumbs.push(['About the data', path]); html = viewAbout(); } }
    else { location.replace('#/graph'); return; }
    main.innerHTML = html; main.scrollTop = 0; if (after) after();
    $('app-crumbs').innerHTML = crumbs.map(function (c, i) { return (i ? '<span class="sep">›</span>' : '') + '<a href="' + esc(c[1]) + '">' + esc(c[0]) + '</a>'; }).join('');
    document.title = (crumbs.length ? crumbs[crumbs.length - 1][0] + ' · ' : '') + 'Gentree · Milosavljević family';
    renderTree(); $('app-nav').classList.remove('open'); $('app-menu').setAttribute('aria-expanded', 'false');
  }

  /* ───────────── wiring ───────────── */
  $('app-right').innerHTML = '<span class="bar-chip">' + people.size + ' people · ' + unions.size + ' unions</span>';
  document.addEventListener('click', function (e) {
    var dt = e.target.closest('[data-dtab]'); if (dt) { pickDrawerTab(+dt.getAttribute('data-dtab')); return; }
    var t = e.target.closest('[data-tog]'); if (t) { var k = t.getAttribute('data-tog'); expanded[k] = t.getAttribute('aria-expanded') !== 'true'; renderTree(); return; }
    var d = e.target.closest('[data-dr]'); if (d && !e.target.closest('a')) { Array.prototype.forEach.call(document.querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); }); DR[+d.getAttribute('data-dr')](d); }
  });
  $('drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if ($('app-drawer').classList.contains('open')) closeDrawer(); else $('app-nav').classList.remove('open'); } });
  $('app-filter').addEventListener('input', renderTree);
  $('app-menu').addEventListener('click', function () { var o = $('app-nav').classList.toggle('open'); $('app-menu').setAttribute('aria-expanded', String(o)); });
  window.addEventListener('hashchange', function () { route(); });
  window.GT = { route: route, people: people, unions: unions, graph: G };   /* for smoke tests and the console */
  route();
})();
