// Kernlogik des Online-Speichers für „Das Rätsel der Weihnachtstruhe“.
// Gespeichert werden NUR: 17 Ziffern (oder leer), der SHA-256-Hash des Codes
// und ein Zeitstempel. Keine Namen, keine personenbezogenen Daten.

export const ANZAHL = 17;

// Hash des Codes, der gilt, solange noch kein neuer Code festgelegt wurde.
export const STANDARD_HASH =
  "69be80da579acd28dcae661a4ff56dfdbed93b21ad7a61e493a54dd89c5eb968";

const MAX_FEHLVERSUCHE = 5;
const SPERRZEIT_MS = 10 * 60 * 1000; // 10 Minuten

const leereZiffern = () => Array(ANZAHL).fill(null);

function antwort(status, daten) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vergleich in konstanter Zeit (über Hashes), damit die PIN nicht erraten werden kann.
async function pinStimmt(eingabe, richtig) {
  const a = await sha256Hex("truhe:" + String(eingabe ?? ""));
  const b = await sha256Hex("truhe:" + String(richtig));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// PIN, die auf der Website festgelegt wurde: gespeichert wird nur ein
// gesalzener PBKDF2-Hash, nie die PIN selbst.
const PIN_MUSTER = /^\d{4,12}$/;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function pinHash(pin, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256));
}

async function neuerPinEintrag(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pinHash(pin, salt) };
}

async function gespeichertePinStimmt(eingabe, eintrag) {
  const a = await pinHash(String(eingabe ?? ""), eintrag.salt);
  let diff = a.length ^ eintrag.hash.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (eintrag.hash.charCodeAt(i) || 0);
  return diff === 0;
}

function gueltigeZiffern(z) {
  return (
    Array.isArray(z) &&
    z.length === ANZAHL &&
    z.every((d) => d === null || (Number.isInteger(d) && d >= 0 && d <= 9))
  );
}

async function ladeStand(store) {
  const s = (await store.get("stand", { type: "json" })) || {};
  return {
    digits: gueltigeZiffern(s.digits) ? s.digits : leereZiffern(),
    codeHash: /^[0-9a-f]{64}$/.test(s.codeHash || "") ? s.codeHash : STANDARD_HASH,
    updatedAt: s.updatedAt || null,
  };
}

/**
 * @param {Request} req
 * @param {{store: {get: Function, setJSON: Function}, pin: string|undefined}} umgebung
 */
export async function handleRequest(req, { store, pin }) {
  // Zwei Wege zur PIN: (1) auf der Website festgelegt (empfohlen),
  // (2) optional als Netlify-Umgebungsvariable TRUHE_PIN (Notfall-PIN).
  const umgebungsPin = typeof pin === "string" && pin.trim().length >= 4 ? pin.trim() : null;
  const pinEintrag = await store.get("pin", { type: "json" });
  const gespeichert = pinEintrag && pinEintrag.salt && pinEintrag.hash ? pinEintrag : null;
  const pinEingerichtet = Boolean(umgebungsPin || gespeichert);

  if (req.method === "GET") {
    const stand = await ladeStand(store);
    return antwort(200, { ...stand, pinConfigured: pinEingerichtet });
  }

  if (req.method !== "POST") return antwort(405, { error: "Methode nicht erlaubt" });

  let body;
  try {
    body = await req.json();
  } catch {
    return antwort(400, { error: "Ungültige Anfrage" });
  }

  // Erste Einrichtung: PIN festlegen, solange noch keine existiert
  if (body.action === "setupPin") {
    if (pinEingerichtet) return antwort(409, { error: "Es gibt bereits eine PIN. Bitte mit der PIN anmelden." });
    if (!PIN_MUSTER.test(String(body.newPin ?? ""))) return antwort(400, { error: "Die PIN muss aus 4 bis 12 Ziffern bestehen." });
    await store.setJSON("pin", await neuerPinEintrag(body.newPin));
    return antwort(200, { ok: true, ...(await ladeStand(store)) });
  }

  if (!pinEingerichtet) {
    return antwort(503, { error: "Es ist noch keine PIN festgelegt.", needsSetup: true });
  }

  // Schutz gegen Durchprobieren der PIN
  const sperre = (await store.get("sperre", { type: "json" })) || { fails: 0, until: 0 };
  const jetzt = Date.now();
  if (sperre.until > jetzt) {
    const min = Math.ceil((sperre.until - jetzt) / 60000);
    return antwort(429, { error: `Zu viele falsche PINs. Bitte in ${min} Minute(n) erneut versuchen.` });
  }

  const richtig =
    (umgebungsPin && (await pinStimmt(body.pin, umgebungsPin))) ||
    (gespeichert && (await gespeichertePinStimmt(body.pin, gespeichert)));
  if (!richtig) {
    const fails = (sperre.until && sperre.until <= jetzt ? 0 : sperre.fails) + 1;
    const neu = fails >= MAX_FEHLVERSUCHE ? { fails: 0, until: jetzt + SPERRZEIT_MS } : { fails, until: 0 };
    await store.setJSON("sperre", neu);
    return antwort(401, { error: "Die PIN ist falsch." });
  }
  if (sperre.fails || sperre.until) await store.setJSON("sperre", { fails: 0, until: 0 });

  const stand = await ladeStand(store);

  switch (body.action) {
    case "login":
      return antwort(200, { ok: true, ...stand });

    case "saveDigits":
      if (!gueltigeZiffern(body.digits)) return antwort(400, { error: "Ungültige Ziffern" });
      stand.digits = body.digits;
      break;

    case "reset":
      stand.digits = leereZiffern();
      break;

    case "changePin":
      if (!PIN_MUSTER.test(String(body.newPin ?? ""))) return antwort(400, { error: "Die PIN muss aus 4 bis 12 Ziffern bestehen." });
      await store.setJSON("pin", await neuerPinEintrag(body.newPin));
      return antwort(200, { ok: true, ...stand });

    case "setCode":
      if (!/^[0-9a-f]{64}$/.test(body.codeHash || "")) return antwort(400, { error: "Ungültiger Hash" });
      stand.codeHash = body.codeHash;
      break;

    default:
      return antwort(400, { error: "Unbekannte Aktion" });
  }

  stand.updatedAt = new Date().toISOString();
  await store.setJSON("stand", stand);
  return antwort(200, { ok: true, ...stand });
}
