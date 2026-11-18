// Netlify-Funktion: erreichbar unter /api/stand
// Die PIN kommt aus der Umgebungsvariable TRUHE_PIN (in Netlify einstellen).
import { getStore } from "@netlify/blobs";
import { handleRequest } from "../lib/core.mjs";

export default async (req) => {
  const store = getStore({ name: "weihnachtstruhe", consistency: "strong" });
  const pin = globalThis.Netlify?.env?.get("TRUHE_PIN") ?? process.env.TRUHE_PIN;
  return handleRequest(req, { store, pin });
};

export const config = { path: "/api/stand" };
