import { test } from "node:test";
import assert from "node:assert/strict";
import { totp, verifyTotp, base32, money, isoDate, email, html, esc, hashPassword, verifyPassword, fmtAED } from "../src/lib/util.js";
import { canTransition, ADMIN_TRANSITIONS, FOOD_TRANSITIONS, validateFields } from "../src/lib/booking.js";
import { SERVICES } from "../src/data/services.js";

test("TOTP conforme RFC 6238 (SHA-1)", async () => {
  const secret = base32(new TextEncoder().encode("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(await totp(secret, 59000), "287082");
  assert.equal(await totp(secret, 1111111109000), "081804");
  assert.ok(await verifyTotp(secret, "081804", 1111111109000 + 25000));
  assert.ok(!(await verifyTotp(secret, "000000", 1111111109000)));
});

test("montants en fils", () => {
  assert.equal(money("1250"), 125000);
  assert.equal(money("1 250,50"), 125050);
  assert.equal(money(""), null);
  assert.throws(() => money("-5"));
  assert.throws(() => money("abc"));
  assert.equal(fmtAED(125050).replace(/\s/g, " "), "1 250,50 AED");
});

test("validation", () => {
  assert.equal(isoDate("2027-02-28"), "2027-02-28");
  assert.throws(() => isoDate("2027-02-30"));
  assert.equal(email(" Moussa@Example.SN "), "moussa@example.sn");
  assert.throws(() => email("pas-un-email"));
});

test("échappement HTML", () => {
  assert.equal(String(html`<p>${"<script>alert(1)</script>"}</p>`), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.equal(esc(`"'&`), "&quot;&#39;&amp;");
});

test("mots de passe PBKDF2", async () => {
  const h = await hashPassword("un-mot-de-passe-solide");
  assert.ok(await verifyPassword("un-mot-de-passe-solide", h));
  assert.ok(!(await verifyPassword("mauvais", h)));
});

test("machine à états : un paiement ou une acceptation ne se force pas à la main", () => {
  assert.ok(canTransition(ADMIN_TRANSITIONS, "new", "review"));
  assert.ok(!canTransition(ADMIN_TRANSITIONS, "quoted", "accepted"));   // seul le client accepte
  assert.ok(!canTransition(ADMIN_TRANSITIONS, "accepted", "paid"));     // seul un paiement vérifié
  assert.ok(!canTransition(ADMIN_TRANSITIONS, "accepted", "confirmed")); // paiement reçu ≠ réservation confirmée
  assert.ok(!canTransition(ADMIN_TRANSITIONS, "paid", "confirmed"));     // confirmation fournisseur obligatoire
  assert.ok(!canTransition(FOOD_TRANSITIONS, "new", "delivered"));
});

test("formulaires de service", () => {
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10);
  const ok = validateFields("hotels", { area: "Deira", arrival: future, departure: later, adults: "2", rooms: "1" });
  assert.equal(ok.adults, 2);
  assert.throws(() => validateFields("hotels", { area: "Deira", arrival: later, departure: future, adults: "2", rooms: "1" }), /dates_order/);
  assert.throws(() => validateFields("hotels", { area: "Paris", arrival: future, departure: later, adults: "2", rooms: "1" }), /invalid_choice/);
  for (const k of Object.keys(SERVICES)) assert.ok(SERVICES[k].fields.length > 2, k);
});
