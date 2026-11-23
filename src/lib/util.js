// Utilitaires partagés : échappement HTML, validation, cryptographie, réponses HTTP.

export class HttpError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const fail = (code, status = 400) => { throw new HttpError(code, status); };

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// Gabarit HTML : les valeurs interpolées sont échappées, sauf les objets marqués `raw`.
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ""));
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}
function render(v) {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

const enc = new TextEncoder();
export const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
export const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export function newRef(prefix) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + "-" + Array.from(b, (x) => a[x % a.length]).join("");
}
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Mots de passe : PBKDF2-SHA256, 100 000 itérations (limite Workers), sel aléatoire.
export async function hashPassword(pw, saltHex = randomHex(16), iter = 100000) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return `pbkdf2$${iter}$${saltHex}$${hex(bits)}`;
}
export async function verifyPassword(pw, stored) {
  const [, iter, salt, digest] = String(stored).split("$");
  if (!digest) return false;
  const again = await hashPassword(pw, salt, Number(iter));
  return timingSafeEqual(again.split("$")[3], digest);
}

// TOTP (RFC 6238) pour la double authentification des administrateurs.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export async function totp(secret, t = Date.now(), step = 30) {
  const counter = Math.floor(t / 1000 / step);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey("raw", unbase32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[19] & 15;
  const code = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6;
  return String(code).padStart(6, "0");
}
export async function verifyTotp(secret, code, t = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return false;
  for (const d of [-1, 0, 1]) if (await totp(secret, t + d * 30000) === code) return true;
  return false;
}

// Validation des champs de formulaire.
export function str(v, max, required = false) {
  if (v == null || v === "") { if (required) fail("missing_field"); return ""; }
  if (typeof v !== "string") fail("invalid_field");
  const s = v.trim().replace(/\s+/g, " ");
  if (required && !s) fail("missing_field");
  if (s.length > max) fail("field_too_long");
  return s;
}
export function longText(v, max) {
  if (v == null) return "";
  if (typeof v !== "string") fail("invalid_field");
  const s = v.trim();
  if (s.length > max) fail("field_too_long");
  return s;
}
export function email(v) {
  const s = str(v, 180, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) fail("invalid_email");
  return s;
}
export function phone(v, required = true) {
  const s = str(v, 30, required);
  if (s && !/^\+?[0-9 ()-]{7,24}$/.test(s)) fail("invalid_phone");
  return s;
}
export function isoDate(v, required = false) {
  const s = str(v, 10, required);
  if (!s) return "";
  const d = new Date(s + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d) || d.toISOString().slice(0, 10) !== s) fail("invalid_date");
  return s;
}
export function int(v, min, max, required = false) {
  if (v == null || v === "") { if (required) fail("missing_field"); return null; }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail("invalid_number");
  return n;
}
// "1 250,50" ou "1250.5" AED → fils
export function money(v, required = false) {
  if (v == null || v === "") { if (required) fail("missing_field"); return null; }
  const s = String(v).replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) fail("invalid_amount");
  const fils = Math.round(Number(s) * 100);
  if (fils <= 0) fail("invalid_amount");
  return fils;
}
export function oneOf(v, list, required = true) {
  if ((v == null || v === "") && !required) return "";
  if (!list.includes(v)) fail("invalid_choice");
  return v;
}
export const fmtAED = (fils) => fils == null ? "" :
  (fils / 100).toLocaleString("fr-FR", { minimumFractionDigits: fils % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " AED";

// Lecture sécurisée du corps de requête (formulaire ou JSON), limité en taille.
export async function readForm(request, max = 32768) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > max) fail("body_too_large", 413);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const text = await request.text();
  if (text.length > max) fail("body_too_large", 413);
  if (type === "application/json") {
    try { const o = JSON.parse(text); if (o && typeof o === "object" && !Array.isArray(o)) return o; } catch {}
    fail("invalid_json");
  }
  if (type === "application/x-www-form-urlencoded") return Object.fromEntries(new URLSearchParams(text));
  fail("unsupported_content_type", 415);
}

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "style-src 'self'",
    "connect-src 'self'",
    "form-action 'self' https://wa.me",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
};
export function page(body, { status = 200, headers = {}, cache = "no-store" } = {}) {
  return new Response("<!doctype html>" + String(body), {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache, ...SECURITY_HEADERS, ...headers },
  });
}
export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...SECURITY_HEADERS, ...headers } });
}
export function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store", ...headers } });
}
