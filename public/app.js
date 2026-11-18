// „Das Rätsel der Weihnachtstruhe“ – Steuerung der Seite
(function () {
  "use strict";
  const ANZAHL = 17;
  const STANDARD_HASH = "69be80da579acd28dcae661a4ff56dfdbed93b21ad7a61e493a54dd89c5eb968";
  const API = "api/stand";
  const SPEICHER = "weihnachtstruhe-stand";
  const ABFRAGE_MS = 20000;

  const $ = (id) => document.getElementById(id);
  const lies = (k, standard) => { try { const v = localStorage.getItem(k); return v === null ? standard : JSON.parse(v); } catch { return standard; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const leer = () => Array(ANZAHL).fill(null);
  const gueltig = (z) => Array.isArray(z) && z.length === ANZAHL && z.every((d) => d === null || (Number.isInteger(d) && d >= 0 && d <= 9));

  // ---------- Stand (zuletzt bekannter Stand liegt im Browser) ----------
  let stand = (() => {
    const s = lies(SPEICHER, null) || {};
    return { digits: gueltig(s.digits) ? s.digits : leer(), codeHash: s.codeHash || STANDARD_HASH, updatedAt: s.updatedAt || null };
  })();
  let angezeigt = leer(); // was gerade am Baum zu sehen ist

  function standUebernehmen(neu) {
    if (!neu || !gueltig(neu.digits)) return;
    stand = { digits: neu.digits, codeHash: /^[0-9a-f]{64}$/.test(neu.codeHash || "") ? neu.codeHash : STANDARD_HASH, updatedAt: neu.updatedAt || null };
    schreib(SPEICHER, stand);
  }

  // ---------- Baum zeichnen ----------
  Szene.zeichneBaum($("baum"));
  const sternleiste = $("sternleiste");
  for (let i = 0; i < ANZAHL; i++) {
    sternleiste.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 40 40"><path d="${Szene.sternPfad(20, 21, 18, 8)}"/></svg>`);
  }

  function zeigeStand({ animieren = true } = {}) {
    const neu = [];
    stand.digits.forEach((d, i) => {
      const nr = i + 1;
      const k = $("kugel-" + nr);
      const t = k.querySelector("text.ziffer");
      k.classList.toggle("voll", d !== null);
      if (d !== null) t.textContent = d;
      if (d !== null && d !== angezeigt[i]) neu.push(nr);
    });
    const anzahl = stand.digits.filter((d) => d !== null).length;
    const alt = angezeigt.filter((d) => d !== null).length;
    angezeigt = stand.digits.slice();
    $("anzahl").textContent = anzahl;
    $("fortschrittText").textContent =
      anzahl === 0 ? "Das Abenteuer beginnt!" :
      anzahl === ANZAHL ? "Alle 17 Ziffern gefunden!" :
      `Schon ${anzahl} von 17 Ziffern gefunden`;
    [...sternleiste.children].forEach((s, i) => s.classList.toggle("an", i < anzahl));
    if (animieren && neu.length) {
      neu.forEach((nr, i) => setTimeout(() => Szene.funkeln(nr), 300 + i * 450));
      if (anzahl !== alt) { $("anzahl").classList.remove("hupf"); void $("anzahl").offsetWidth; $("anzahl").classList.add("hupf"); }
    }
  }

  // ---------- Online-Abgleich ----------
  let onlineBekannt = null;
  function verbindungAnzeigen(ok) {
    onlineBekannt = ok;
    $("verbindung").textContent = ok ? "" : "Offline – letzter bekannter Stand";
  }
  async function laden() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const daten = await r.json();
      standUebernehmen(daten);
      verbindungAnzeigen(true);
      if (!adminOffen()) zeigeStand();
    } catch {
      verbindungAnzeigen(false);
    }
  }
  async function senden(body) {
    let r;
    try {
      r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    } catch {
      verbindungAnzeigen(false);
      throw new Error("Keine Internetverbindung. Speichern ist nur online möglich.");
    }
    let daten = {};
    try { daten = await r.json(); } catch {}
    if (!r.ok) {
      const fehler = new Error(daten.error || "Fehler beim Speichern (" + r.status + ").");
      fehler.needsSetup = Boolean(daten.needsSetup);
      throw fehler;
    }
    verbindungAnzeigen(true);
    standUebernehmen(daten);
    return daten;
  }

  // ---------- Ebenen (Brief, Finale, Lehrkraft …) ----------
  const offen = [];
  function oeffne(id) { const e = $(id); e.hidden = false; offen.push(id); }
  function schliesse(id) {
    const e = $(id); e.hidden = true;
    const i = offen.lastIndexOf(id); if (i >= 0) offen.splice(i, 1);
    if (id === "adminEbene") adminSchliessen();
    if (id === "erfolgEbene") konfettiStopp();
  }
  const adminOffen = () => offen.includes("adminEbene");
  document.querySelectorAll("[data-schliessen]").forEach((b) =>
    b.addEventListener("click", () => schliesseMitPruefung(b.closest(".ebene").id)));
  $("briefEbene").addEventListener("click", (e) => { if (e.target.id === "briefEbene") schliesse("briefEbene"); });

  async function schliesseMitPruefung(id) {
    if (id === "adminEbene" && hatAenderungen() && !(await frage("Es gibt ungespeicherte Änderungen. Trotzdem schließen?", "Ja, schließen"))) return;
    schliesse(id);
    if (id === "erfolgEbene") schliesse("finaleEbene");
  }

  // Sicherheitsabfrage
  function frage(text, jaText = "Ja") {
    return new Promise((ok) => {
      $("frageText").textContent = text;
      $("frageJa").textContent = jaText;
      oeffne("frageEbene");
      $("frageNein").focus();
      const fertig = (wert) => { schliesse("frageEbene"); $("frageJa").onclick = $("frageNein").onclick = null; ok(wert); };
      $("frageJa").onclick = () => fertig(true);
      $("frageNein").onclick = () => fertig(false);
    });
  }

  // ---------- Brief ----------
  $("briefKnopf").addEventListener("click", () => oeffne("briefEbene"));

  // ---------- Finale ----------
  const code = leer();
  let aktiv = 0;
  const codefelder = $("codefelder");
  for (let i = 0; i < ANZAHL; i++) {
    const b = document.createElement("button");
    b.className = "codefeld";
    b.type = "button";
    b.setAttribute("aria-label", "Kugel " + (i + 1));
    b.innerHTML = `<span class="nr">${i + 1}</span><span class="box"></span>`;
    b.addEventListener("click", () => { aktiv = i; zeigeCode(); });
    codefelder.appendChild(b);
  }
  Szene.zeichneTruhe($("finaleTruhe"), "finale");
  Szene.zeichneTruhe($("erfolgTruhe"), "erfolg");

  function zeigeCode() {
    [...codefelder.children].forEach((b, i) => {
      b.querySelector(".box").textContent = code[i] ?? "";
      b.classList.toggle("aktiv", i === aktiv);
    });
  }
  function meldung(text) {
    const m = $("meldung");
    m.textContent = text;
    m.classList.remove("sichtbar"); void m.offsetWidth; if (text) m.classList.add("sichtbar");
  }
  function ziffer(d) {
    code[aktiv] = d;
    if (aktiv < ANZAHL - 1) aktiv++;
    codefelder.classList.remove("falsch", "richtig");
    meldung("");
    zeigeCode();
  }
  function zurueck() {
    if (code[aktiv] === null && aktiv > 0) aktiv--;
    code[aktiv] = null;
    meldung("");
    zeigeCode();
  }
  function allesLeeren() { code.fill(null); aktiv = 0; meldung(""); codefelder.classList.remove("falsch", "richtig"); zeigeCode(); }

  let pruefeGerade = false;
  async function pruefen() {
    if (pruefeGerade) return;
    const fehlend = code.filter((d) => d === null).length;
    if (fehlend) { meldung(fehlend === 1 ? "Es fehlt noch 1 Ziffer." : `Es fehlen noch ${fehlend} Ziffern.`); return; }
    pruefeGerade = true;
    const hash = await window.sha256Hex(code.join(""));
    if (hash === stand.codeHash) {
      codefelder.classList.add("richtig");
      meldung("");
      $("finaleTruhe").querySelector(".truhe").classList.add("offen");
      setTimeout(erfolg, 900);
    } else {
      codefelder.classList.remove("falsch"); void codefelder.offsetWidth; codefelder.classList.add("falsch");
      $("finaleTruhe").classList.remove("wackeln"); void $("finaleTruhe").getBBox(); $("finaleTruhe").classList.add("wackeln");
      meldung("Fast! Prüft noch einmal jede Ziffer.");
      pruefeGerade = false;
    }
  }

  $("finaleKnopf").addEventListener("click", () => {
    allesLeeren();
    pruefeGerade = false;
    $("finaleTruhe").querySelector(".truhe").classList.remove("offen");
    oeffne("finaleEbene");
  });
  $("tastenfeld").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ziffer) ziffer(+b.dataset.ziffer);
    else if (b.dataset.taste === "zurueck") zurueck();
    else if (b.dataset.taste === "leeren") allesLeeren();
    else if (b.dataset.taste === "pruefen") pruefen();
  });

  function erfolg() {
    const t = $("erfolgTruhe").querySelector(".truhe");
    t.classList.remove("offen");
    oeffne("erfolgEbene");
    setTimeout(() => t.classList.add("offen"), 350);
    setTimeout(konfettiStart, 700);
    if (tonAn) glocken();
    pruefeGerade = false;
  }

  // Tastatur
  document.addEventListener("keydown", (e) => {
    const oben = offen[offen.length - 1];
    if (e.key === "Escape" && oben) { schliesseMitPruefung(oben); return; }
    if (oben !== "finaleEbene") return;
    if (/^[0-9]$/.test(e.key)) { ziffer(+e.key); e.preventDefault(); }
    else if (e.key === "Backspace" || e.key === "Delete") { zurueck(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { aktiv = Math.max(0, aktiv - 1); zeigeCode(); }
    else if (e.key === "ArrowRight") { aktiv = Math.min(ANZAHL - 1, aktiv + 1); zeigeCode(); }
    else if (e.key === "Enter") { pruefen(); e.preventDefault(); }
  });

  // ---------- Konfetti ----------
  let konfettiLauf = null;
  function konfettiStart() {
    const c = $("konfetti"), ctx = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const farben = ["#C62828", "#C9A227", "#F3E3A6", "#2E7D4F", "#ffffff", "#e0bd45"];
    const teile = [];
    const neu = (start) => ({
      x: Math.random() * innerWidth, y: start ? -20 - Math.random() * innerHeight : -20,
      vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3.5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.25,
      s: 7 + Math.random() * 9, f: farben[(Math.random() * farben.length) | 0], stern: Math.random() < 0.25,
    });
    for (let i = 0; i < 220; i++) teile.push(neu(true));
    const ende = performance.now() + 12000;
    konfettiStopp();
    const schritt = (t) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      teile.forEach((p, i) => {
        p.x += p.vx + Math.sin((t / 600) + i) * 0.6; p.y += p.vy; p.r += p.vr;
        if (p.y > innerHeight + 20) { if (t < ende) teile[i] = neu(false); else return; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.f;
        if (p.stern) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? p.s * 0.45 : p.s; const w = (Math.PI / 5) * k; ctx.lineTo(Math.cos(w) * r, Math.sin(w) * r); } ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (t < ende + 6000) konfettiLauf = requestAnimationFrame(schritt);
    };
    konfettiLauf = requestAnimationFrame(schritt);
  }
  function konfettiStopp() { if (konfettiLauf) cancelAnimationFrame(konfettiLauf); konfettiLauf = null; }

  // ---------- Glöckchen (wird im Browser erzeugt, keine Datei nötig) ----------
  let tonAn = lies("weihnachtstruhe-ton", false) === true;
  let audio = null;
  function audioBereit() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  function glocke(ac, freq, wann, laut = 0.18) {
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([fak, l]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = freq * fak;
      g.gain.setValueAtTime(0.0001, wann);
      g.gain.exponentialRampToValueAtTime(laut * l, wann + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, wann + 1.6 / Math.sqrt(fak));
      o.connect(g).connect(ac.destination);
      o.start(wann); o.stop(wann + 1.8);
    });
  }
  function glocken() {
    const ac = audioBereit(); if (!ac) return;
    const t = ac.currentTime + 0.05;
    [1318.5, 1568, 2093, 1568, 2093, 2637].forEach((f, i) => glocke(ac, f, t + i * 0.16));
    for (let i = 0; i < 14; i++) glocke(ac, 2637 + Math.random() * 1800, t + 1.1 + i * 0.07, 0.05);
  }
  function tonZeigen() { $("tonKnopf").setAttribute("aria-pressed", String(tonAn)); }
  $("tonKnopf").addEventListener("click", () => {
    tonAn = !tonAn; schreib("weihnachtstruhe-ton", tonAn); tonZeigen();
    if (tonAn) { const ac = audioBereit(); if (ac) glocke(ac, 2093, ac.currentTime + 0.02, 0.12); }
  });
  tonZeigen();

  // ---------- Vollbild ----------
  $("vollbildKnopf").addEventListener("click", () => {
    const d = document, el = d.documentElement;
    try {
      const p = (d.fullscreenElement || d.webkitFullscreenElement)
        ? (d.exitFullscreen || d.webkitExitFullscreen).call(d)
        : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (p && p.catch) p.catch(() => {});
    } catch {}
  });

  // ---------- Schnee ----------
  const reduziert = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let schneeAn = lies("weihnachtstruhe-schnee", !reduziert) === true;
  const sc = $("schnee"), sctx = sc.getContext("2d");
  let flocken = [], schneeLauf = null;
  function schneeGroesse() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    sc.width = innerWidth * dpr; sc.height = innerHeight * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(110, Math.round((innerWidth * innerHeight) / 22000));
    flocken = Array.from({ length: n }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: 1.5 + Math.random() * 3.5,
      v: 0.25 + Math.random() * 0.6, w: Math.random() * 6.28, kristall: Math.random() < 0.3,
    }));
  }
  function schneeSchritt() {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const f of flocken) {
      f.y += f.v; f.w += 0.01; f.x += Math.sin(f.w) * 0.35;
      if (f.y > innerHeight + 10) { f.y = -10; f.x = Math.random() * innerWidth; }
      if (f.kristall) {
        sctx.strokeStyle = "rgba(150,180,210,.65)"; sctx.lineWidth = 1.4; sctx.beginPath();
        for (let k = 0; k < 3; k++) { const a = f.w + (k * Math.PI) / 3, l = f.r * 2.2; sctx.moveTo(f.x - Math.cos(a) * l, f.y - Math.sin(a) * l); sctx.lineTo(f.x + Math.cos(a) * l, f.y + Math.sin(a) * l); }
        sctx.stroke();
      } else {
        sctx.fillStyle = "rgba(255,255,255,.95)"; sctx.strokeStyle = "rgba(150,180,210,.55)"; sctx.lineWidth = 1;
        sctx.beginPath(); sctx.arc(f.x, f.y, f.r, 0, 6.283); sctx.fill(); sctx.stroke();
      }
    }
    schneeLauf = requestAnimationFrame(schneeSchritt);
  }
  function schneeZeigen() {
    $("schneeKnopf").setAttribute("aria-pressed", String(schneeAn));
    if (schneeLauf) cancelAnimationFrame(schneeLauf);
    schneeLauf = null;
    sctx.clearRect(0, 0, sc.width, sc.height);
    if (schneeAn) { schneeGroesse(); schneeSchritt(); }
  }
  $("schneeKnopf").addEventListener("click", () => { schneeAn = !schneeAn; schreib("weihnachtstruhe-schnee", schneeAn); schneeZeigen(); });
  addEventListener("resize", () => { if (schneeAn) schneeGroesse(); });
  schneeZeigen();

  // ---------- Eingabe für die Lehrkraft ----------
  let adminPin = null;
  let gespeichert = leer();
  const raster = $("adminRaster");
  const adminFelder = [];
  for (let i = 0; i < ANZAHL; i++) {
    const f = document.createElement("div");
    f.className = "admin-feld" + (i === 16 ? " gold" : "");
    f.innerHTML = `<label class="nr" for="af${i}">${i + 1}</label><input id="af${i}" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="Ziffer für Kugel ${i + 1}"><button type="button" class="leeren" aria-label="Kugel ${i + 1} leeren" title="Leeren">×</button>`;
    const inp = f.querySelector("input");
    inp.addEventListener("input", () => {
      const z = inp.value.replace(/\D/g, "").slice(-1);
      inp.value = z;
      adminAktualisieren();
      if (z && i < ANZAHL - 1) adminFelder[i + 1].focus();
    });
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("keydown", (e) => {
      if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        // Ziffer direkt setzen und weiterspringen (auch bei schnellem Tippen)
        e.preventDefault();
        inp.value = e.key;
        adminAktualisieren();
        if (i < ANZAHL - 1) adminFelder[i + 1].focus();
      } else if (e.key === "Backspace" && !inp.value && i > 0) adminFelder[i - 1].focus();
    });
    f.querySelector(".leeren").addEventListener("click", () => { inp.value = ""; adminAktualisieren(); inp.focus(); });
    adminFelder.push(inp);
    raster.appendChild(f);
  }
  const feldWerte = () => adminFelder.map((x) => (x.value === "" ? null : +x.value));
  const hatAenderungen = () => adminPin !== null && feldWerte().some((d, i) => d !== gespeichert[i]);

  async function adminAktualisieren() {
    const werte = feldWerte();
    adminFelder.forEach((x, i) => x.parentElement.classList.toggle("geaendert", werte[i] !== gespeichert[i]));
    const p = $("adminPruefung");
    const fehlend = werte.filter((d) => d === null).length;
    p.className = "admin-pruefung";
    if (fehlend) { p.textContent = `${ANZAHL - fehlend} von 17 Kugeln ausgefüllt.`; return; }
    const ok = (await window.sha256Hex(werte.join(""))) === stand.codeHash;
    p.textContent = ok ? "✓ Alle 17 Ziffern zusammen ergeben den richtigen Code." : "⚠ Die 17 Ziffern ergeben nicht den gespeicherten Code. Bitte mit dem Lösungsblatt vergleichen.";
    p.classList.add(ok ? "ok" : "fehler");
  }
  function felderFuellen(digits) {
    gespeichert = digits.slice();
    adminFelder.forEach((x, i) => (x.value = digits[i] ?? ""));
    $("hashAnzeige").textContent = stand.codeHash.slice(0, 12) + "…";
    adminAktualisieren();
  }
  function setzeMeldung(id, text, ok) { const m = $(id); m.textContent = text; m.className = "admin-meldung " + (ok ? "ok" : "fehler"); }

  function zeigeFormular(welches) {
    $("pinForm").hidden = welches !== "login";
    $("pinSetupForm").hidden = welches !== "setup";
    $("adminInhalt").hidden = welches !== "inhalt";
    if (welches === "login") setTimeout(() => $("pinFeld").focus(), 50);
    if (welches === "setup") setTimeout(() => $("setupPin1").focus(), 50);
  }
  function adminFreigeben(pin, digits) {
    adminPin = pin;
    zeigeFormular("inhalt");
    ["adminMeldung", "codeMeldung", "pinAendernMeldung"].forEach((m) => setzeMeldung(m, "", true));
    felderFuellen(digits);
    zeigeStand();
    adminFelder[Math.max(0, digits.findIndex((x) => x === null))].focus();
  }

  $("adminKnopf").addEventListener("click", async () => {
    adminPin = null;
    $("pinFeld").value = ""; $("setupPin1").value = $("setupPin2").value = "";
    ["pinMeldung", "setupMeldung"].forEach((m) => setzeMeldung(m, "", true));
    zeigeFormular("login");
    oeffne("adminEbene");
    // Gibt es schon eine PIN? Wenn nicht, gleich das Formular zum Festlegen zeigen.
    try {
      const r = await fetch(API, { cache: "no-store" });
      const d = await r.json();
      if (d.pinConfigured === false && adminOffen() && adminPin === null) zeigeFormular("setup");
    } catch {}
  });
  $("pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("pinFeld").value.trim();
    setzeMeldung("pinMeldung", "Prüfe …", true);
    try {
      const d = await senden({ action: "login", pin });
      adminFreigeben(pin, d.digits);
    } catch (err) {
      if (err.needsSetup) { zeigeFormular("setup"); return; }
      setzeMeldung("pinMeldung", err.message, false);
      $("pinFeld").select();
    }
  });
  $("pinSetupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("setupPin1").value.trim(), b = $("setupPin2").value.trim();
    if (!/^\d{4,12}$/.test(a)) return setzeMeldung("setupMeldung", "Die PIN muss aus 4 bis 12 Ziffern bestehen.", false);
    if (a !== b) return setzeMeldung("setupMeldung", "Die beiden Eingaben stimmen nicht überein.", false);
    setzeMeldung("setupMeldung", "Speichere …", true);
    try {
      const d = await senden({ action: "setupPin", newPin: a });
      adminFreigeben(a, d.digits);
      setzeMeldung("adminMeldung", "PIN festgelegt ✓ Bitte gut merken!", true);
    } catch (err) {
      setzeMeldung("setupMeldung", err.message, false);
      if (/bereits eine PIN/.test(err.message)) setTimeout(() => zeigeFormular("login"), 1500);
    }
  });
  $("pinAendernKnopf").addEventListener("click", async () => {
    const a = $("neuPin1").value.trim(), b = $("neuPin2").value.trim();
    if (!/^\d{4,12}$/.test(a)) return setzeMeldung("pinAendernMeldung", "Die PIN muss aus 4 bis 12 Ziffern bestehen.", false);
    if (a !== b) return setzeMeldung("pinAendernMeldung", "Die beiden Eingaben stimmen nicht überein.", false);
    if (!(await frage("Neue PIN speichern? Die alte PIN gilt dann nicht mehr.", "Ja, speichern"))) return;
    try {
      await senden({ action: "changePin", pin: adminPin, newPin: a });
      adminPin = a;
      $("neuPin1").value = $("neuPin2").value = "";
      setzeMeldung("pinAendernMeldung", "Neue PIN gespeichert ✓", true);
    } catch (err) { setzeMeldung("pinAendernMeldung", err.message, false); }
  });
  function adminSchliessen() {
    adminPin = null;
    adminFelder.forEach((x) => (x.value = ""));
    $("pinFeld").value = "";
    ["neuCode1", "neuCode2", "neuPin1", "neuPin2", "setupPin1", "setupPin2"].forEach((id) => ($(id).value = ""));
  }

  $("speichernKnopf").addEventListener("click", async () => {
    setzeMeldung("adminMeldung", "Speichere …", true);
    try {
      await senden({ action: "saveDigits", pin: adminPin, digits: feldWerte() });
      gespeichert = stand.digits.slice();
      schliesse("adminEbene");
      zeigeStand();
    } catch (err) { setzeMeldung("adminMeldung", err.message, false); }
  });

  $("resetKnopf").addEventListener("click", async () => {
    if (!(await frage("Wirklich alle eingetragenen Ziffern löschen? Das kann nicht rückgängig gemacht werden.", "Ja, alles löschen"))) return;
    try {
      await senden({ action: "reset", pin: adminPin });
      felderFuellen(stand.digits);
      zeigeStand();
      setzeMeldung("adminMeldung", "Alle Ziffern wurden gelöscht.", true);
    } catch (err) { setzeMeldung("adminMeldung", err.message, false); }
  });

  $("codeKnopf").addEventListener("click", async () => {
    const a = $("neuCode1").value.replace(/\s/g, ""), b = $("neuCode2").value.replace(/\s/g, "");
    if (!/^\d{17}$/.test(a)) return setzeMeldung("codeMeldung", "Der Code muss genau 17 Ziffern haben.", false);
    if (a !== b) return setzeMeldung("codeMeldung", "Die beiden Eingaben stimmen nicht überein.", false);
    if (!(await frage("Neuen Code speichern? Danach gilt der alte Code nicht mehr.", "Ja, speichern"))) return;
    try {
      await senden({ action: "setCode", pin: adminPin, codeHash: await window.sha256Hex(a) });
      $("neuCode1").value = $("neuCode2").value = "";
      $("hashAnzeige").textContent = stand.codeHash.slice(0, 12) + "…";
      setzeMeldung("codeMeldung", "Neuer Code gespeichert ✓", true);
      adminAktualisieren();
    } catch (err) { setzeMeldung("codeMeldung", err.message, false); }
  });

  // ---------- Start ----------
  zeigeStand({ animieren: false });
  laden();
  setInterval(() => { if (!document.hidden) laden(); }, ABFRAGE_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) laden(); });
  addEventListener("online", laden);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
