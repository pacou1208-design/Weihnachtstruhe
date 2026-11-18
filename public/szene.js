// Zeichnet den Weihnachtsbaum, die Kugeln und die Truhe als SVG.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Anordnung genau wie auf dem Plakat (von oben nach unten, links nach rechts)
  const REIHEN = [
    { y: 268, abstand: 120, kugeln: [5, 12] },
    { y: 478, abstand: 118, kugeln: [2, 9, 14, 7] },
    { y: 650, abstand: 125, kugeln: [16, 1, 11, 4] },
    { y: 805, abstand: 130, kugeln: [13, 8, 15, 3, 10, 6] },
  ];
  const SCHATZKUGEL = { nr: 17, x: 812, y: 958 };

  function sternPfad(cx, cy, aussen, innen, zacken = 5) {
    let d = "";
    for (let i = 0; i < zacken * 2; i++) {
      const r = i % 2 ? innen : aussen;
      const w = (Math.PI / zacken) * i - Math.PI / 2;
      d += (i ? "L" : "M") + (cx + r * Math.cos(w)).toFixed(1) + " " + (cy + r * Math.sin(w)).toFixed(1);
    }
    return d + "Z";
  }

  // Eine Tannen-Ebene mit leicht gewellter Unterkante
  function ebenePfad(spitze, unten, hb) {
    const l = 500 - hb, r = 500 + hb;
    let d = `M500 ${spitze} Q${500 + hb * 0.45} ${spitze + (unten - spitze) * 0.62} ${r} ${unten}`;
    const n = Math.max(4, Math.round((2 * hb) / 70));
    const breite = (2 * hb) / n;
    for (let i = 0; i < n; i++) {
      const x1 = r - breite * (i + 1);
      d += ` Q${(x1 + breite / 2).toFixed(1)} ${unten + 26} ${x1.toFixed(1)} ${unten}`;
    }
    d += ` Q${500 - hb * 0.45} ${spitze + (unten - spitze) * 0.62} 500 ${spitze}Z`;
    return d;
  }

  function defs(svg) {
    const d = el("defs", {}, svg);
    d.innerHTML = `
      <linearGradient id="tanne" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2E7D4F"/><stop offset="1" stop-color="#256B42"/>
      </linearGradient>
      <radialGradient id="kugelLeuchten" cx=".38" cy=".35" r=".75">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#FFF8EE"/><stop offset="1" stop-color="#F3E3A6"/>
      </radialGradient>
      <radialGradient id="goldKugel" cx=".35" cy=".32" r=".8">
        <stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#C9A227"/><stop offset="1" stop-color="#8a6c12"/>
      </radialGradient>
      <radialGradient id="goldLeuchten" cx=".35" cy=".32" r=".8">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#F3E3A6"/><stop offset="1" stop-color="#C9A227"/>
      </radialGradient>
      <radialGradient id="halo">
        <stop offset=".55" stop-color="#F3E3A6" stop-opacity=".95"/><stop offset="1" stop-color="#F3E3A6" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="sternGold" cx=".4" cy=".35" r=".7">
        <stop offset="0" stop-color="#fff6cc"/><stop offset=".6" stop-color="#e3c04a"/><stop offset="1" stop-color="#C9A227"/>
      </radialGradient>`;
  }

  function kugel(parent, nr, x, y, gold = false) {
    const r = gold ? 62 : 48;
    const g = el("g", { class: "kugel" + (gold ? " gold" : ""), id: "kugel-" + nr, transform: `translate(${x} ${y})` }, parent);
    const s = el("g", { class: "schwing" }, g);
    el("circle", { class: "glanz", r: r + 22, fill: "url(#halo)" }, s);
    // goldener Aufhänger
    el("path", { d: `M-7 ${-r - 14} a7 8 0 1 1 14 0`, fill: "none", stroke: "#C9A227", "stroke-width": 4 }, s);
    el("rect", { x: -13, y: -r - 14, width: 26, height: 17, rx: 4, fill: "#C9A227", stroke: "#9a7a12", "stroke-width": 2 }, s);
    el("circle", {
      class: "koerper", r, fill: gold ? "url(#goldKugel)" : "#ffffff",
      stroke: gold ? "#9a7a12" : "#C62828", "stroke-width": gold ? 6 : 7,
    }, s);
    el("ellipse", { cx: -r * 0.38, cy: -r * 0.4, rx: r * 0.24, ry: r * 0.13, fill: "#fff", opacity: gold ? 0.75 : 0.9, transform: `rotate(-35 ${-r * 0.38} ${-r * 0.4})` }, s);
    const t = el("text", { class: "ziffer", y: 3 }, s);
    if (gold) t.style.fontSize = "84px";
    const b = el("g", { class: "abzeichen", transform: `translate(${r * 0.74} ${r * 0.74})` }, s);
    el("circle", { r: gold ? 22 : 19, fill: "#C62828", stroke: "#fff", "stroke-width": 3 }, b);
    el("text", { y: 1 }, b).textContent = nr;
    g.style.setProperty("--verz", (-(nr * 0.37) % 3).toFixed(2) + "s");
    return g;
  }

  function zeichneBaum(svg) {
    svg.innerHTML = "";
    defs(svg);
    // Schneeboden
    el("ellipse", { cx: 500, cy: 1048, rx: 490, ry: 30, fill: "#ffffff", opacity: 0.85 }, svg);
    // Stamm
    el("rect", { x: 452, y: 840, width: 96, height: 112, rx: 8, fill: "#7A4A21", stroke: "#4e2d12", "stroke-width": 5 }, svg);
    el("path", { d: "M475 870 V940 M500 860 V945 M525 875 V935", stroke: "#5c3616", "stroke-width": 4, "stroke-linecap": "round" }, svg);
    // drei Tannen-Ebenen (unten zuerst)
    [[380, 860, 470], [200, 600, 330], [95, 340, 200]].forEach(([s, u, h]) => {
      el("path", { d: ebenePfad(s, u, h), fill: "url(#tanne)", stroke: "#1E5631", "stroke-width": 6, "stroke-linejoin": "round" }, svg);
    });
    // gestrichelte goldene Girlanden
    [["M362 352 Q500 432 640 382"], ["M222 542 Q500 628 785 572"], ["M150 708 Q500 790 852 742"]].forEach(([d]) => {
      el("path", { d, fill: "none", stroke: "#C9A227", "stroke-width": 7, "stroke-dasharray": "16 11", "stroke-linecap": "round" }, svg);
    });
    // Stern auf der Spitze
    const stern = el("g", { class: "stern-spitze" }, svg);
    el("path", { d: sternPfad(500, 74, 64, 27), fill: "url(#sternGold)", stroke: "#9a7a12", "stroke-width": 4, "stroke-linejoin": "round" }, stern);

    // Kugeln
    const kugeln = el("g", { id: "kugeln" }, svg);
    REIHEN.forEach((reihe) => {
      const n = reihe.kugeln.length;
      reihe.kugeln.forEach((nr, i) => {
        const x = 500 + (i - (n - 1) / 2) * reihe.abstand;
        kugel(kugeln, nr, x, reihe.y);
      });
    });

    // Truhe links unter dem Baum
    const truhe = el("g", { transform: "translate(50 862) scale(.82)" }, svg);
    zeichneTruhe(truhe, "baum");

    // goldene Schatzkugel rechts
    kugel(kugeln, SCHATZKUGEL.nr, SCHATZKUGEL.x, SCHATZKUGEL.y, true);
    const label = el("text", { x: SCHATZKUGEL.x, y: 1068, "text-anchor": "middle", fill: "#7F1D1D", "font-family": "Chewy, Chalkboard SE, cursive", "font-size": 30 }, svg);
    label.textContent = "Schatzkugel";

    el("g", { id: "funkenEbene" }, svg);
  }

  // Truhe im Koordinatensystem 300 × 260
  function zeichneTruhe(parent, id) {
    const g = el("g", { class: "truhe" }, parent);
    const d = el("defs", {}, g);
    d.innerHTML = `
      <radialGradient id="licht-${id}" cx=".5" cy=".85" r=".75">
        <stop offset="0" stop-color="#fffbe6"/><stop offset=".4" stop-color="#F3E3A6" stop-opacity=".9"/><stop offset="1" stop-color="#F3E3A6" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="holz-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#94602f"/><stop offset="1" stop-color="#7A4A21"/>
      </linearGradient>
      <linearGradient id="band-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a8861b"/><stop offset=".5" stop-color="#ecd27a"/><stop offset="1" stop-color="#a8861b"/>
      </linearGradient>`;
    // geöffneter Deckel (Innenseite)
    const auf = el("g", { class: "deckel-auf" }, g);
    el("path", { d: "M34 118 L52 22 Q150 6 248 22 L266 118 Z", fill: "#4e2d12", stroke: "#3a210c", "stroke-width": 5, "stroke-linejoin": "round" }, auf);
    el("path", { d: "M52 22 Q150 6 248 22", fill: "none", stroke: `url(#band-${id})`, "stroke-width": 10 }, auf);
    el("path", { d: "M70 112 L80 30 M230 112 L220 30", stroke: `url(#band-${id})`, "stroke-width": 12 }, auf);
    // Innenraum
    el("rect", { x: 34, y: 112, width: 232, height: 20, fill: "#2b160a" }, g);
    // Licht aus der Truhe
    const licht = el("g", { class: "licht" }, g);
    el("ellipse", { cx: 150, cy: 100, rx: 175, ry: 120, fill: `url(#licht-${id})` }, licht);
    el("ellipse", { cx: 150, cy: 118, rx: 118, ry: 16, fill: "#fffbe6" }, licht);
    el("ellipse", { cx: 150, cy: 112, rx: 80, ry: 30, fill: "#ffffff", opacity: 0.7 }, licht);
    // Truhenkörper
    el("rect", { x: 30, y: 118, width: 240, height: 124, rx: 10, fill: `url(#holz-${id})`, stroke: "#4e2d12", "stroke-width": 6 }, g);
    el("path", { d: "M36 160 H264 M36 200 H264", stroke: "#5c3616", "stroke-width": 3, opacity: 0.6 }, g);
    el("rect", { x: 58, y: 118, width: 20, height: 124, fill: `url(#band-${id})`, stroke: "#8a6c12", "stroke-width": 2 }, g);
    el("rect", { x: 222, y: 118, width: 20, height: 124, fill: `url(#band-${id})`, stroke: "#8a6c12", "stroke-width": 2 }, g);
    el("rect", { x: 30, y: 226, width: 240, height: 14, rx: 5, fill: `url(#band-${id})`, stroke: "#8a6c12", "stroke-width": 2 }, g);
    [68, 232].forEach((x) => [140, 180, 220].forEach((y) => el("circle", { cx: x, cy: y, r: 3.2, fill: "#7d6413" }, g)));
    // geschlossener Deckel
    const zu = el("g", { class: "deckel-zu" }, g);
    el("path", { d: "M30 122 V82 Q30 40 150 38 Q270 40 270 82 V122 Z", fill: `url(#holz-${id})`, stroke: "#4e2d12", "stroke-width": 6, "stroke-linejoin": "round" }, zu);
    el("path", { d: "M58 122 V60 Q60 50 78 46 V122 Z M242 122 V60 Q240 50 222 46 V122 Z", fill: `url(#band-${id})`, stroke: "#8a6c12", "stroke-width": 2 }, zu);
    el("rect", { x: 30, y: 112, width: 240, height: 12, rx: 4, fill: `url(#band-${id})`, stroke: "#8a6c12", "stroke-width": 2 }, zu);
    // Vorhängeschloss
    const schloss = el("g", { class: "schloss" }, g);
    el("path", { class: "buegel", d: "M136 126 V114 a14 14 0 0 1 28 0 V126", fill: "none", stroke: "#8a6c12", "stroke-width": 7, "stroke-linecap": "round" }, schloss);
    el("rect", { x: 126, y: 124, width: 48, height: 40, rx: 8, fill: `url(#band-${id})`, stroke: "#7d6413", "stroke-width": 3 }, schloss);
    el("circle", { cx: 150, cy: 140, r: 6, fill: "#4e2d12" }, schloss);
    el("path", { d: "M147 142 L145 154 H155 L153 142Z", fill: "#4e2d12" }, schloss);
    return g;
  }

  // Funken und kleine Sterne rund um eine Kugel
  function funkeln(nr) {
    const k = document.getElementById("kugel-" + nr);
    const ebene = document.getElementById("funkenEbene");
    if (!k || !ebene) return;
    k.classList.remove("neu"); void k.getBBox(); k.classList.add("neu");
    setTimeout(() => k.classList.remove("neu"), 1200);
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(k.getAttribute("transform"));
    const cx = +m[1], cy = +m[2];
    for (let i = 0; i < 12; i++) {
      const w = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 60;
      const gr = 8 + Math.random() * 10;
      const s = el("path", {
        class: "funke", d: sternPfad(cx, cy, gr, gr * 0.42),
        fill: i % 3 ? "#C9A227" : "#F3E3A6", stroke: "#fff", "stroke-width": 1.5,
      }, ebene);
      s.style.setProperty("--dx", (Math.cos(w) * dist).toFixed(0) + "px");
      s.style.setProperty("--dy", (Math.sin(w) * dist).toFixed(0) + "px");
      s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
      setTimeout(() => s.remove(), 1600);
    }
  }

  window.Szene = { zeichneBaum, zeichneTruhe, funkeln, sternPfad, el };
})();
