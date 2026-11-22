// Parcours complets contre un serveur en marche : BASE=http://127.0.0.1:8787 SETUP=… node test/e2e.mjs
import assert from "node:assert/strict";
import { totp } from "../src/lib/util.js";
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const stamp = Date.now().toString(36);
const future = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

function client() {
  let cookie = "";
  return async (path, { form, method } = {}) => {
    const r = await fetch(BASE + path, { method: method || (form ? "POST" : "GET"), redirect: "manual",
      headers: { Origin: BASE, Cookie: cookie, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: form ? new URLSearchParams(form) : undefined });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, location: r.headers.get("location"), text: await r.text() };
  };
}
const step = (n) => console.log("✓", n);

const guest = client(), admin = client(), partnerC = client(), cust = client();

// 1. Demande d'hôtel sans compte
let r = await guest("/fr/hotels", { form: { area: "Deira", arrival: future(20), departure: future(25), adults: "2", children: "0", rooms: "1", name: "Awa Test", phone: "+221 77 000 00 00", email: `awa.${stamp}@example.test`, consent: "on" } });
assert.equal(r.status, 303, r.text.slice(0, 300));
const trackUrl = r.location; const [, ref, key] = trackUrl.match(/ref=(TD-[A-Z2-9]{8})&key=([0-9a-f]{32})/);
r = await guest(trackUrl); assert.match(r.text, new RegExp(ref)); step("demande hôtel " + ref);
r = await guest(`/fr/track?ref=${ref}&key=${"0".repeat(32)}`); assert.equal(r.status, 404); step("lien de suivi protégé par clé");
r = await guest("/fr/hotels", { form: { area: "Deira", arrival: future(25), departure: future(20), adults: "2", rooms: "1", name: "X", phone: "+221770000000", email: "x@example.test", consent: "on" } });
assert.equal(r.status, 400); assert.match(r.text, /date de fin/); step("erreur de dates affichée");
r = await fetch(BASE + "/fr/hotels", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" }, body: "a=1", redirect: "manual" });
assert.equal(r.status, 403); step("CSRF refusé");

// 2. Création de l'administrateur + MFA
if (process.env.SETUP) {
  r = await admin("/admin/setup", { form: { setup_code: process.env.SETUP, name: "Admin Test", email: `admin.${stamp}@example.test`, phone: "+971500000000", password: "admin-password-very-long" } });
  assert.equal(r.status, 303, r.text.slice(0, 200));
} else {
  r = await admin("/fr/account/login", { form: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
}
r = await admin("/fr/account/mfa"); const secret = (r.text.match(/class="mono break">([A-Z2-7 ]+)</) || [])[1]?.replace(/ /g, "");
assert.ok(secret, "secret MFA"); r = await admin("/admin"); assert.equal(r.location, "/fr/account/mfa"); step("admin bloqué sans MFA");
r = await admin("/fr/account/mfa", { form: { code: await totp(secret) } }); assert.equal(r.location, "/admin"); step("MFA validée");
r = await admin("/admin"); assert.match(r.text, /Tableau de bord/);

// 3. Devis → acceptation client → paiement vérifié → confirmation fournisseur → facture
r = await admin(`/admin/requests/${ref}/status`, { form: { to: "review" } }); assert.equal(r.status, 303);
r = await admin(`/admin/requests/${ref}/quote`, { form: { amount: "2400", deposit: "800", expires: future(5), text: "Hôtel 4★ Deira, 5 nuits, petit-déjeuner, taxes incluses. Annulation gratuite jusqu'à 7 jours avant." } }); assert.equal(r.status, 303);
r = await admin(`/admin/requests/${ref}/confirm`, { form: { supplier_ref: "X" } }); assert.equal(r.status, 409); step("confirmation impossible avant paiement");
r = await guest("/fr/track/accept", { form: { ref, key, agree: "on" } }); assert.equal(r.status, 303); step("devis accepté par le client");
r = await admin("/admin/payments", { form: { ref, kind: "deposit", method: "bank_transfer", amount: "800", status: "pending" } });
r = await admin(`/admin/requests/${ref}`); assert.match(r.text, /Devis accepté/); step("paiement en attente ≠ payé");
const pid = r.text.match(/\/admin\/payments\/([0-9a-f]{20})\/verify/)[1];
r = await admin(`/admin/payments/${pid}/verify`, { form: { back: `/admin/requests/${ref}` } });
r = await admin(`/admin/requests/${ref}`); assert.match(r.text, /Paiement vérifié/); step("paiement vérifié → payé");
r = await admin(`/admin/requests/${ref}/confirm`, { form: { supplier_ref: "HTL-55821" } }); assert.equal(r.status, 303);
r = await admin(`/admin/requests/${ref}/invoice`, { form: {} }); assert.equal(r.status, 303);
r = await guest(trackUrl); assert.match(r.text, /Confirmée par le prestataire/); assert.match(r.text, /HTL-55821/); step("réservation confirmée visible côté client");

// 4. Partenaire restaurant → validation → menu → commande repas
r = await partnerC("/fr/account/register", { form: { name: "Chez Fatou Test", email: `resto.${stamp}@example.test`, phone: "+971501111111", country: "AE", password: "partner-password-1", consent: "on" } }); assert.equal(r.status, 303);
r = await partnerC("/fr/partner/apply", { form: { company: "Chez Fatou Test", category: "restaurant", phone: "+971501111111", city: "Deira", consent: "on" } }); assert.equal(r.status, 303);
r = await admin("/admin/partners"); const partnerId = r.text.match(/\/admin\/partners\/([0-9a-f]{20})"[^]*?Chez Fatou Test|Chez Fatou Test[^]*?\/admin\/partners\/([0-9a-f]{20})/); 
const pidP = partnerId[1] || partnerId[2]; r = await admin(`/admin/partners/${pidP}`, { form: { action: "approved" } }); step("partenaire validé");
r = await partnerC("/fr/partner/restaurant", { form: { name: "Chez Fatou Test", area: "Deira", cuisine: "senegal", delivery_fee: "10", min_order: "0" } }); assert.equal(r.status, 303);
r = await partnerC("/fr/partner"); const restoId = r.text.match(/name="restaurant_id" value="([0-9a-f]{20})"/)[1];
r = await partnerC("/fr/partner/menu", { form: { restaurant_id: restoId, dish_key: "thieboudienne", name_fr: "Thiéboudienne", name_en: "Thieboudienne", price: "45", allergens: "poisson" } }); assert.equal(r.status, 303);
r = await guest("/fr/food"); assert.doesNotMatch(r.text, /data-restaurant="/); step("restaurant non publié invisible");
r = await admin(`/admin/restaurants/${restoId}/status`, { form: { status: "published" } });
r = await guest("/fr/food"); assert.match(r.text, /data-restaurant="/); const itemId = r.text.match(/data-add='\{&quot;id&quot;:&quot;([0-9a-f]{20})/)[1]; step("menu publié");
r = await cust("/fr/account/register", { form: { name: "Moussa Client", email: `moussa.${stamp}@example.test`, phone: "+221770000001", password: "client-password-1", consent: "on" } });
r = await cust("/fr/food/order", { form: { restaurant_id: restoId, cart: JSON.stringify([{ id: itemId, qty: 2, price_fils: 1 }]), address: "Hôtel X, Deira", slot: "20h", name: "Moussa", phone: "+221770000001", email: `moussa.${stamp}@example.test`, consent: "on" } });
assert.equal(r.status, 303, r.text.slice(0, 300)); r = await cust(r.location); assert.match(r.text, /100 AED/); step("commande repas : prix recalculé côté serveur (2×45 + 10)");
const fref = r.text.match(/TF-[A-Z2-9]{8}/)[0];
r = await partnerC("/fr/partner/food", { form: { ref: fref, to: "restaurant_confirmed" } }); assert.equal(r.status, 303);
r = await cust("/fr/account"); assert.match(r.text, new RegExp(fref)); assert.match(r.text, /Acceptée par le restaurant/); step("suivi commande dans l'espace client");
r = await cust("/admin"); assert.notEqual(r.status, 200); step("client sans accès admin");
console.log("\nTous les parcours sont passés.");
