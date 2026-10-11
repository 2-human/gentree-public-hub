/* Gentree password gate, after the Crēdo Marketing Hub gate (MH-11).
 * Locally the plaintext data file exists: load it and start the hub. On the public mirror only data/bundle.enc is
 * published (tools/hub/encrypt-bundle.py, run in CI with the GENTREE_GATE_PASSWORD secret): ask for the password,
 * decrypt in the browser (PBKDF2-SHA256 → AES-256-GCM, then gunzip), run the data script, start the hub.
 * The derived key (not the password) is kept in sessionStorage for this tab only, so a reload does not ask again. */
(function () {
  var FILES = ['data'];
  var APP = ['app.js?v=1'];
  var KEY = 'gt-gate-key';
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function run(text) { var s = document.createElement('script'); s.textContent = text; document.head.appendChild(s); }
  function boot() { return APP.reduce(function (p, src) { return p.then(function () { return load(src); }); }, Promise.resolve()); }
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var enc = function (u) { var s = ''; u.forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); };

  function unlockWith(key, bundle) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(bundle.iv) }, key, b64(bundle.ct))
      .then(function (gz) { return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); })
      .then(function (json) {
        var files = JSON.parse(json);
        FILES.forEach(function (f) { if (files[f + '.js']) run(files[f + '.js']); });
        return boot();
      });
  }
  function derive(password, bundle) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(bundle.salt), iterations: bundle.iter }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']); });
  }
  function gate() {
    var g = document.getElementById('gate'), form = document.getElementById('gate-form'), msg = document.getElementById('gate-msg'), pw = document.getElementById('gate-pw');
    fetch('data/bundle.enc', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('no bundle'); return r.json(); }).then(function (bundle) {
      var saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
      var tryKey = saved ? crypto.subtle.importKey('raw', b64(saved), 'AES-GCM', true, ['decrypt']).then(function (k) { return unlockWith(k, bundle); }) : Promise.reject();
      tryKey.catch(function () {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        g.hidden = false; pw.focus();
        form.onsubmit = function (e) {
          e.preventDefault(); msg.textContent = 'Unlocking…'; form.querySelector('button').disabled = true;
          derive(pw.value, bundle).then(function (k) {
            return unlockWith(k, bundle).then(function () { return crypto.subtle.exportKey('raw', k); }).then(function (raw) { try { sessionStorage.setItem(KEY, enc(new Uint8Array(raw))); } catch (e2) {} g.hidden = true; });
          }).catch(function () { msg.textContent = 'That password did not open the family graph.'; form.querySelector('button').disabled = false; pw.select(); });
        };
      });
    }).catch(function () { g.hidden = false; msg.textContent = 'The family data is not available.'; form.hidden = true; });
  }
  /* plaintext data present (local): load it and start; otherwise the gate */
  var t = '?t=' + Date.now();   /* the local plaintext file changes with every batch: never serve it from the cache */
  load('data/data.js' + t).then(boot, gate);
})();
