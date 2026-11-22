// Moteur de réservation hybride : dossiers, devis, statuts, paiements, commandes repas.
import { fail, newRef, randomHex, sha256, str, email as vEmail, phone as vPhone, isoDate, int, longText, oneOf, timingSafeEqual } from "./util.js";
import { q, uid, notify, audit } from "./auth.js";
import { SERVICES } from "../data/services.js";

export const STATUS = {
  new: ["Reçue", "Received"], review: ["En vérification", "Being checked"], quoted: ["Devis envoyé", "Quote sent"],
  accepted: ["Devis accepté — en attente de paiement", "Quote accepted — awaiting payment"],
  paid: ["Paiement vérifié — réservation en cours auprès du prestataire", "Payment verified — booking in progress with the supplier"],
  supplier_pending: ["En attente de confirmation du prestataire", "Awaiting supplier confirmation"],
  confirmed: ["Confirmée par le prestataire", "Confirmed by the supplier"], completed: ["Terminée", "Completed"],
  cancelled: ["Annulée", "Cancelled"], refunded: ["Remboursée", "Refunded"],
};
export const FOOD_STATUS = {
  new: ["Reçue — transmise au restaurant", "Received — sent to the restaurant"], restaurant_confirmed: ["Acceptée par le restaurant", "Accepted by the restaurant"],
  preparing: ["En préparation", "Being prepared"], out_for_delivery: ["En livraison", "Out for delivery"], delivered: ["Livrée", "Delivered"], cancelled: ["Annulée", "Cancelled"],
};
// Transitions manuelles autorisées pour l'administration. "accepted" n'est atteint que par le client,
// "paid" uniquement par un paiement vérifié, "confirmed" uniquement avec une référence fournisseur.
export const ADMIN_TRANSITIONS = {
  new: ["review", "cancelled"], review: ["cancelled"], quoted: ["review", "cancelled"], accepted: ["cancelled"],
  paid: ["supplier_pending", "refunded"], supplier_pending: ["refunded"], confirmed: ["completed", "refunded"],
};
export const FOOD_TRANSITIONS = {
  new: ["restaurant_confirmed", "cancelled"], restaurant_confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"],
};
export const canTransition = (map, from, to) => (map[from] || []).includes(to);

async function history(env, ref, from, to, actor, note = "") {
  await q(env, "INSERT INTO status_history(ref,from_status,to_status,actor,note) VALUES (?,?,?,?,?)", ref, from, to, actor, note).run();
}

// Valide les champs d'un formulaire de service à partir de sa définition.
export function validateFields(service, input) {
  const def = SERVICES[service];
  if (!def) fail("unknown_service", 404);
  const out = {};
  for (const f of def.fields) {
    const v = input[f.name];
    if (f.type === "number") { const n = int(v, f.min ?? 0, f.max ?? 1e9, !!f.req); if (n != null) out[f.name] = n; }
    else if (f.type === "date") { const d = isoDate(v, !!f.req); if (d) out[f.name] = d; }
    else if (f.type === "time") { const s = str(v, 5, !!f.req); if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail("invalid_time"); if (s) out[f.name] = s; }
    else if (f.type === "select") { const s = oneOf(v, f.options, !!f.req); if (s) out[f.name] = s; }
    else if (f.type === "textarea") { const s = longText(v, f.max || 1000); if (s) out[f.name] = s; }
    else { const s = str(v, f.max || 160, !!f.req); if (s) out[f.name] = s; }
  }
  const today = new Date().toISOString().slice(0, 10);
  if (out.arrival && out.arrival < today) fail("date_in_past");
  if (out.arrival && out.departure && out.departure < out.arrival) fail("dates_order");
  return out;
}

export async function createRequest(env, { service, input, lang, user }) {
  const fields = validateFields(service, input);
  const name = str(input.name, 100, true), mail = vEmail(input.email), tel = vPhone(input.phone);
  if (input.consent !== "on" && input.consent !== true) fail("consent_required");
  const offerId = input.offer_id ? str(input.offer_id, 40) : null;
  if (offerId) {
    const ok = await q(env, "SELECT 1 FROM offers WHERE id = ? AND service = ? AND status = 'published'", offerId, service).first();
    if (!ok) fail("unknown_offer");
  }
  const ref = newRef("TD"), key = randomHex(16);
  await q(env, `INSERT INTO requests(ref,access_hash,user_id,service,offer_id,lang,name,email,phone,fields) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ref, await sha256(key), user?.id || null, service, offerId, lang, name, mail, tel, JSON.stringify(fields)).run();
  await history(env, ref, null, "new", user?.id || "client");
  await notify(env, user?.id, ref, "Votre demande " + ref + " a bien été reçue.", "Your request " + ref + " has been received.");
  return { ref, key };
}

// Accès à un dossier : propriétaire connecté, ou référence + clé secrète du lien de suivi.
export async function loadForClient(env, ref, key, user) {
  if (!/^(TD|TF)-[A-Z2-9]{8}$/.test(String(ref || ""))) fail("not_found", 404);
  const table = ref.startsWith("TF") ? "food_orders" : "requests";
  const row = await q(env, `SELECT * FROM ${table} WHERE ref = ?`, ref).first();
  if (!row) fail("not_found", 404);
  const owner = user && row.user_id === user.id;
  const keyOk = key && /^[0-9a-f]{32}$/.test(key) && timingSafeEqual(await sha256(key), row.access_hash);
  if (!owner && !keyOk && user?.role !== "admin") fail("not_found", 404);
  row.kind = table === "food_orders" ? "food" : "request";
  return row;
}

export async function clientAccept(env, row, actor) {
  if (row.status !== "quoted") fail("not_quoted", 409);
  if (row.quote_expires && row.quote_expires < new Date().toISOString().slice(0, 10)) fail("quote_expired", 409);
  await q(env, "UPDATE requests SET status='accepted', updated_at=CURRENT_TIMESTAMP WHERE ref=? AND status='quoted'", row.ref).run();
  await history(env, row.ref, "quoted", "accepted", actor, "client");
}
export async function clientCancel(env, row, actor) {
  if (!["new", "review", "quoted"].includes(row.status)) fail("contact_us_to_cancel", 409);
  await q(env, "UPDATE requests SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE ref=?", row.ref).run();
  await history(env, row.ref, row.status, "cancelled", actor, "client");
}

export async function adminTransition(env, admin, ref, to, note) {
  const row = await q(env, "SELECT * FROM requests WHERE ref=?", ref).first();
  if (!row) fail("not_found", 404);
  if (!canTransition(ADMIN_TRANSITIONS, row.status, to)) fail("transition_not_allowed", 409);
  if (to === "refunded") {
    const refund = await q(env, "SELECT 1 FROM payments WHERE ref=? AND kind='refund' AND status='verified'", ref).first();
    if (!refund) fail("refund_payment_missing", 409);
  }
  await q(env, "UPDATE requests SET status=?, updated_at=CURRENT_TIMESTAMP WHERE ref=?", to, ref).run();
  await history(env, ref, row.status, to, admin.id, note);
  await notify(env, row.user_id, ref, `Dossier ${ref} : ${STATUS[to][0]}.`, `File ${ref}: ${STATUS[to][1]}.`);
  await audit(env, admin.id, "request.status", ref, { from: row.status, to });
}

export async function adminQuote(env, admin, ref, { amount_fils, deposit_fils, quote_text, quote_expires, partner_id }) {
  const row = await q(env, "SELECT * FROM requests WHERE ref=?", ref).first();
  if (!row) fail("not_found", 404);
  if (!["new", "review", "quoted"].includes(row.status)) fail("transition_not_allowed", 409);
  if (deposit_fils && deposit_fils > amount_fils) fail("deposit_above_total");
  await q(env, `UPDATE requests SET status='quoted', amount_fils=?, deposit_fils=?, quote_text=?, quote_expires=?, partner_id=?, updated_at=CURRENT_TIMESTAMP WHERE ref=?`,
    amount_fils, deposit_fils || null, quote_text, quote_expires || null, partner_id || null, ref).run();
  await history(env, ref, row.status, "quoted", admin.id);
  await notify(env, row.user_id, ref, `Un devis est disponible pour le dossier ${ref}.`, `A quote is available for file ${ref}.`);
  await audit(env, admin.id, "request.quote", ref, { amount_fils, deposit_fils });
}

export async function adminConfirm(env, admin, ref, supplierRef) {
  const row = await q(env, "SELECT * FROM requests WHERE ref=?", ref).first();
  if (!row) fail("not_found", 404);
  if (!["paid", "supplier_pending"].includes(row.status)) fail("payment_not_verified", 409);
  if (!supplierRef) fail("supplier_ref_required");
  await q(env, "UPDATE requests SET status='confirmed', supplier_ref=?, updated_at=CURRENT_TIMESTAMP WHERE ref=?", supplierRef, ref).run();
  await history(env, ref, row.status, "confirmed", admin.id, "supplier ref " + supplierRef);
  await notify(env, row.user_id, ref, `Réservation ${ref} confirmée par le prestataire.`, `Booking ${ref} confirmed by the supplier.`);
  // Commission due au partenaire lié, calculée sur le montant du devis.
  if (row.partner_id && row.amount_fils) {
    const p = await q(env, "SELECT commission_pct FROM partners WHERE id=?", row.partner_id).first();
    if (p) await q(env, "INSERT INTO commissions(id,ref,partner_id,base_fils,pct,amount_fils) VALUES (?,?,?,?,?,?)",
      uid(), ref, row.partner_id, row.amount_fils, p.commission_pct, Math.round(row.amount_fils * p.commission_pct / 100)).run();
  }
  await audit(env, admin.id, "request.confirm", ref, { supplierRef });
}

// Enregistrement d'un paiement. Seul un paiement "verified" (contrôlé sur le relevé ou le tableau de bord
// du prestataire de paiement) fait avancer un dossier, et jamais au-delà de "paid".
export async function recordPayment(env, admin, { ref, kind, method, amount_fils, status, provider_ref, note }) {
  const isFood = ref.startsWith("TF-");
  const row = await q(env, `SELECT * FROM ${isFood ? "food_orders" : "requests"} WHERE ref=?`, ref).first();
  if (!row) fail("not_found", 404);
  await q(env, "INSERT INTO payments(id,ref,kind,method,amount_fils,status,provider_ref,note,recorded_by) VALUES (?,?,?,?,?,?,?,?,?)",
    uid(), ref, kind, method, amount_fils, status, provider_ref || null, note || null, admin.id).run();
  await audit(env, admin.id, "payment.record", ref, { kind, method, amount_fils, status });
  if (status === "verified" && kind !== "refund") await applyVerified(env, admin, ref);
}

export async function verifyPayment(env, admin, id) {
  const p = await q(env, "SELECT * FROM payments WHERE id=? AND status='pending'", id).first();
  if (!p) fail("not_found", 404);
  await q(env, "UPDATE payments SET status='verified' WHERE id=?", id).run();
  await audit(env, admin.id, "payment.verify", p.ref, { id, amount_fils: p.amount_fils });
  if (p.kind !== "refund") await applyVerified(env, admin, p.ref);
}

// Fait avancer un dossier quand les paiements vérifiés couvrent l'acompte (ou le total) demandé.
async function applyVerified(env, admin, ref) {
  const isFood = ref.startsWith("TF-");
  const row = await q(env, `SELECT * FROM ${isFood ? "food_orders" : "requests"} WHERE ref=?`, ref).first();
  const paid = await q(env, "SELECT COALESCE(SUM(amount_fils),0) s FROM payments WHERE ref=? AND status='verified' AND kind!='refund'", ref).first();
  if (isFood) {
    if (paid.s >= row.total_fils) await q(env, "UPDATE food_orders SET payment_status='verified', updated_at=CURRENT_TIMESTAMP WHERE ref=?", ref).run();
    return;
  }
  const needed = row.deposit_fils || row.amount_fils;
  if (row.status === "accepted" && needed && paid.s >= needed) {
    await q(env, "UPDATE requests SET status='paid', updated_at=CURRENT_TIMESTAMP WHERE ref=?", ref).run();
    await history(env, ref, "accepted", "paid", admin.id, "payment verified");
    await notify(env, row.user_id, ref, `Paiement vérifié pour ${ref}. Nous réservons auprès du prestataire.`, `Payment verified for ${ref}. We are booking with the supplier.`);
  }
}

// Commande de repas : prix toujours relus en base, jamais pris du navigateur.
export async function createFoodOrder(env, { input, lang, user }) {
  const restaurantId = str(input.restaurant_id, 40, true);
  const r = await q(env, "SELECT * FROM restaurants WHERE id=? AND status='published'", restaurantId).first();
  if (!r) fail("restaurant_unavailable", 409);
  let cart;
  try { cart = JSON.parse(input.cart || "[]"); } catch { fail("invalid_cart"); }
  if (!Array.isArray(cart) || !cart.length || cart.length > 30) fail("invalid_cart");
  const items = []; let subtotal = 0;
  for (const c of cart) {
    const id = str(c?.id, 40, true), qty = int(c?.qty, 1, 50, true);
    const m = await q(env, "SELECT id,name_fr,name_en,price_fils FROM menu_items WHERE id=? AND restaurant_id=? AND available=1", id, r.id).first();
    if (!m) fail("item_unavailable", 409);
    items.push({ id: m.id, name_fr: m.name_fr, name_en: m.name_en, qty, price_fils: m.price_fils });
    subtotal += m.price_fils * qty;
  }
  if (subtotal < r.min_order_fils) fail("below_minimum", 409);
  const name = str(input.name, 100, true), mail = vEmail(input.email), tel = vPhone(input.phone);
  const address = str(input.address, 240, true), slot = str(input.slot, 40, true), note = longText(input.note, 500);
  if (input.consent !== "on" && input.consent !== true) fail("consent_required");
  const ref = newRef("TF"), key = randomHex(16), total = subtotal + r.delivery_fee_fils;
  await q(env, `INSERT INTO food_orders(ref,access_hash,user_id,restaurant_id,items,subtotal_fils,delivery_fee_fils,total_fils,name,phone,email,address,slot,note,lang)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, ref, await sha256(key), user?.id || null, r.id, JSON.stringify(items), subtotal, r.delivery_fee_fils, total,
    name, tel, mail, address, slot, note, lang).run();
  await history(env, ref, null, "new", user?.id || "client");
  await notify(env, user?.id, ref, `Commande ${ref} reçue et transmise au restaurant.`, `Order ${ref} received and sent to the restaurant.`);
  return { ref, key };
}

export async function foodTransition(env, actor, ref, to, restaurantFilter = null) {
  const row = await q(env, "SELECT f.*, r.partner_id FROM food_orders f JOIN restaurants r ON r.id=f.restaurant_id WHERE f.ref=?", ref).first();
  if (!row) fail("not_found", 404);
  if (restaurantFilter && row.partner_id !== restaurantFilter) fail("not_found", 404);
  if (!canTransition(FOOD_TRANSITIONS, row.status, to)) fail("transition_not_allowed", 409);
  await q(env, "UPDATE food_orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE ref=?", to, ref).run();
  await history(env, ref, row.status, to, actor.id);
  await notify(env, row.user_id, ref, `Commande ${ref} : ${FOOD_STATUS[to][0]}.`, `Order ${ref}: ${FOOD_STATUS[to][1]}.`);
  await audit(env, actor.id, "food.status", ref, { from: row.status, to });
}
