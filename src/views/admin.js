// Administration centrale (en français). Toutes les actions passent par des formulaires POST
// vérifiés côté serveur (rôle admin + double authentification + contrôle d'origine).
import { html, raw, fmtAED } from "../lib/util.js";
import { layout } from "./layout.js";
import { SERVICES } from "../data/services.js";
import { STATUS, FOOD_STATUS, ADMIN_TRANSITIONS } from "../lib/booking.js";
import { offerForm, restaurantForm, menuForm, foodButtons } from "./portal.js";

const NAV = [["", "Tableau de bord"], ["requests", "Réservations & devis"], ["food", "Commandes repas"], ["partners", "Partenaires"], ["offers", "Offres"],
  ["restaurants", "Restaurants & plats"], ["packages", "Forfaits"], ["payments", "Paiements"], ["commissions", "Commissions"], ["users", "Clients"], ["settings", "Paramètres"], ["audit", "Journal d'audit"]];

export function adminLayout(user, active, title, content, msg = "") {
  const body = html`<div class="admin wrap"><nav class="admin-nav" aria-label="Administration">${NAV.map(([k, n]) => html`<a href="/admin${k ? "/" + k : ""}" ${active === k ? raw('aria-current="page"') : ""}>${n}</a>`)}</nav>
    <section class="admin-main"><h1 class="h1">${title}</h1>${msg ? html`<div class="success" role="status">${msg}</div>` : ""}${content}</section></div>`;
  return layout("fr", { title: "Admin · " + title, path: "/fr/admin", body, user, noindex: true });
}
const sel = (name, opts, cur = "") => html`<select name="${name}">${opts.map((o) => html`<option ${o === cur ? raw("selected") : ""}>${o}</option>`)}</select>`;
const post = (action, fields, label, cls = "btn-dark") => html`<form method="post" action="${action}" class="inline">${Object.entries(fields).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}<button class="btn btn-sm ${cls}">${label}</button></form>`;
const waTo = (phone, text) => "https://wa.me/" + String(phone || "").replace(/[^0-9]/g, "") + "?text=" + encodeURIComponent(text);

export function adminDashboard(user, s) {
  const tiles = [["Nouvelles demandes", s.new, "/admin/requests?status=new"], ["Devis envoyés", s.quoted, "/admin/requests?status=quoted"], ["En attente de paiement", s.accepted, "/admin/requests?status=accepted"],
    ["Confirmations fournisseur", s.supplier, "/admin/requests?status=supplier_pending"], ["Commandes repas actives", s.food, "/admin/food"], ["Partenaires à valider", s.partners, "/admin/partners"],
    ["Offres à modérer", s.offers, "/admin/offers"], ["Paiements à vérifier", s.payments, "/admin/payments"]];
  return adminLayout(user, "", "Tableau de bord", html`<div class="tiles">${tiles.map(([n, v, h]) => html`<a class="tile" href="${h}"><b>${v}</b><span>${n}</span></a>`)}</div>
    <p class="muted small">Chiffre d'affaires vérifié (paiements vérifiés, hors remboursements) : <b>${fmtAED(s.revenue) || "0 AED"}</b></p>`);
}

export function adminRequests(user, rows, status) {
  return adminLayout(user, "requests", "Réservations & devis", html`<form method="get" class="inline">${sel("status", ["", ...Object.keys(STATUS)], status)}<button class="btn btn-sm btn-ghost">Filtrer</button></form>
  <table class="tbl"><thead><tr><th>Réf.</th><th>Service</th><th>Client</th><th>Statut</th><th>Montant</th><th>Date</th></tr></thead><tbody>
  ${rows.map((r) => html`<tr><td><a href="/admin/requests/${r.ref}">${r.ref}</a></td><td>${SERVICES[r.service]?.fr.name || r.service}</td><td>${r.name}</td><td><span class="status status-${r.status}">${STATUS[r.status][0]}</span></td><td>${fmtAED(r.amount_fils)}</td><td>${r.created_at.slice(0, 16)}</td></tr>`)}</tbody></table>`);
}

export function adminRequest(user, r, { history, payments, partners, invoices, msg, error }) {
  const f = JSON.parse(r.fields);
  const next = ADMIN_TRANSITIONS[r.status] || [];
  const content = html`${error ? html`<div class="alert">${error}</div>` : ""}
  <div class="two"><article class="card"><h2>${SERVICES[r.service]?.fr.title} · ${r.ref}</h2><p class="status status-${r.status}">${STATUS[r.status][0]}</p>
    <dl class="kv"><dt>Client</dt><dd>${r.name}</dd><dt>E-mail</dt><dd>${r.email}</dd><dt>Téléphone</dt><dd>${r.phone} · <a href="${waTo(r.phone, `Bonjour ${r.name}, TERANGA DUBAI au sujet de votre dossier ${r.ref}.`)}" rel="noopener">WhatsApp</a></dd><dt>Langue</dt><dd>${r.lang}</dd>
    ${Object.entries(f).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}${r.offer_id ? html`<dt>Offre</dt><dd>${r.offer_id}</dd>` : ""}${r.supplier_ref ? html`<dt>Réf. fournisseur</dt><dd>${r.supplier_ref}</dd>` : ""}</dl>
    <div class="btns">${next.map((s) => post(`/admin/requests/${r.ref}/status`, { to: s }, "→ " + STATUS[s][0], s === "cancelled" || s === "refunded" ? "btn-ghost" : "btn-dark"))}</div>
    <h3>Historique</h3><ol class="timeline">${history.map((h) => html`<li><time>${h.at.slice(0, 16)}</time> ${h.from_status || "—"} → ${h.to_status} ${h.note ? "· " + h.note : ""}</li>`)}</ol></article>
  <div>
    ${["new", "review", "quoted"].includes(r.status) ? html`<form class="card form" method="post" action="/admin/requests/${r.ref}/quote"><h3>Envoyer / réviser le devis</h3>
      <label class="fld"><span>Montant total AED *</span><input name="amount" inputmode="decimal" required value="${r.amount_fils ? r.amount_fils / 100 : ""}"></label>
      <label class="fld"><span>Acompte demandé AED (vide = paiement total)</span><input name="deposit" inputmode="decimal" value="${r.deposit_fils ? r.deposit_fils / 100 : ""}"></label>
      <label class="fld"><span>Valable jusqu'au</span><input name="expires" type="date" value="${r.quote_expires || ""}"></label>
      <label class="fld"><span>Partenaire prestataire</span><select name="partner_id"><option value="">—</option>${partners.map((p) => html`<option value="${p.id}" ${r.partner_id === p.id ? raw("selected") : ""}>${p.company}</option>`)}</select></label>
      <label class="fld wide"><span>Détail du devis (prestations, taxes incluses, conditions d'annulation) *</span><textarea name="text" rows="6" required maxlength="4000">${r.quote_text || ""}</textarea></label>
      <button class="btn btn-red">Publier le devis</button><p class="small muted">Le client l'accepte depuis son lien de suivi ou son espace.</p></form>` : ""}
    ${["paid", "supplier_pending"].includes(r.status) ? html`<form class="card form" method="post" action="/admin/requests/${r.ref}/confirm"><h3>Confirmation fournisseur</h3>
      <label class="fld"><span>Référence de confirmation du prestataire *</span><input name="supplier_ref" required maxlength="80"></label><button class="btn btn-red">Confirmer la réservation</button></form>` : ""}
    ${paymentForm(r.ref, r.deposit_fils || r.amount_fils)}
    <div class="card"><h3>Paiements</h3><ul>${payments.map((p) => html`<li>${p.created_at.slice(0, 16)} · ${p.kind} · ${p.method} · ${fmtAED(p.amount_fils)} · <b>${p.status}</b>${p.provider_ref ? " · " + p.provider_ref : ""}
      ${p.status === "pending" ? post(`/admin/payments/${p.id}/verify`, { back: "/admin/requests/" + r.ref }, "Marquer vérifié") : ""}</li>`)}</ul>
      <h3>Factures</h3><ul>${invoices.map((i) => html`<li><a href="/fr/account/invoice/${i.number}">${i.number}</a> · ${fmtAED(i.amount_fils)}</li>`)}</ul>
      ${r.amount_fils && ["paid", "supplier_pending", "confirmed", "completed"].includes(r.status) ? post(`/admin/requests/${r.ref}/invoice`, {}, "Émettre la facture") : ""}</div>
  </div></div>`;
  return adminLayout(user, "requests", "Dossier " + r.ref, content, msg);
}
export function paymentForm(ref, amount) {
  return html`<form class="card form" method="post" action="/admin/payments"><h3>Enregistrer un paiement</h3><input type="hidden" name="ref" value="${ref}">
    <div class="grid2"><label class="fld"><span>Type</span>${sel("kind", ["deposit", "full", "balance", "refund"])}</label><label class="fld"><span>Moyen</span>${sel("method", ["bank_transfer", "payment_link", "wave", "card", "cash", "other"])}</label>
    <label class="fld"><span>Montant AED *</span><input name="amount" inputmode="decimal" required value="${amount ? amount / 100 : ""}"></label><label class="fld"><span>Statut</span>${sel("status", ["pending", "verified", "failed"])}</label>
    <label class="fld"><span>Réf. transaction</span><input name="provider_ref" maxlength="120"></label><label class="fld"><span>Note</span><input name="note" maxlength="300"></label></div>
    <p class="small muted">« verified » uniquement après contrôle sur le relevé bancaire ou le tableau de bord du prestataire de paiement. Ne jamais saisir de numéro de carte.</p><button class="btn btn-dark">Enregistrer</button></form>`;
}

export function adminFood(user, rows) {
  return adminLayout(user, "food", "Commandes repas", html`${rows.map((o) => html`<div class="card"><b>${o.ref}</b> · ${o.restaurant} · ${FOOD_STATUS[o.status][0]} · ${fmtAED(o.total_fils)} · paiement ${o.payment_status}
    <p class="small">${o.name} · ${o.phone} · <a href="${waTo(o.phone, `Bonjour ${o.name}, TERANGA DUBAI au sujet de votre commande ${o.ref}.`)}" rel="noopener">WhatsApp</a> · ${o.address} · ${o.slot}</p>
    <ul class="small">${JSON.parse(o.items).map((i) => html`<li>${i.qty} × ${i.name_fr} (${fmtAED(i.price_fils)})</li>`)}</ul>${foodButtons("/admin/food/status", o)}
    <details><summary>Paiement</summary>${paymentForm(o.ref, o.total_fils)}</details></div>`)}${rows.length ? "" : html`<p class="muted">Aucune commande.</p>`}`);
}

export function adminPartners(user, rows) {
  return adminLayout(user, "partners", "Partenaires", html`<table class="tbl"><thead><tr><th>Société</th><th>Catégorie</th><th>Contact</th><th>Licence</th><th>Statut</th><th>Commission</th><th></th></tr></thead><tbody>
  ${rows.map((p) => html`<tr><td>${p.company}<br><span class="small muted">${p.description || ""}</span></td><td>${p.category}</td><td>${p.email}<br>${p.phone}</td><td>${p.licence_no || "—"}</td><td>${p.status}</td>
    <td><form method="post" action="/admin/partners/${p.id}" class="inline"><input name="commission" value="${p.commission_pct}" size="4" inputmode="decimal"><button class="btn btn-sm btn-ghost" name="action" value="commission">OK</button></form></td>
    <td class="btns">${["approved", "rejected", "suspended"].filter((s) => s !== p.status).map((s) => post(`/admin/partners/${p.id}`, { action: s }, { approved: "Valider", rejected: "Refuser", suspended: "Suspendre" }[s], s === "approved" ? "btn-red" : "btn-ghost"))}</td></tr>`)}</tbody></table>
  <p class="small muted">Vérifier la licence commerciale et, pour les appartements, l'autorisation de location courte durée avant validation.</p>`);
}

export function adminOffers(user, rows, edit) {
  return adminLayout(user, "offers", "Offres", html`<table class="tbl"><thead><tr><th>Titre</th><th>Service</th><th>Partenaire</th><th>Prix</th><th>Statut</th><th></th></tr></thead><tbody>
  ${rows.map((o) => html`<tr><td><a href="/admin/offers?edit=${o.id}">${o.title_fr}</a></td><td>${o.service}</td><td>${o.company || "TERANGA"}</td><td>${fmtAED(o.price_fils)}</td><td>${o.status}</td>
  <td class="btns">${["published", "archived"].filter((s) => s !== o.status).map((s) => post(`/admin/offers/${o.id}/status`, { status: s }, s === "published" ? "Publier" : "Archiver", s === "published" ? "btn-red" : "btn-ghost"))}</td></tr>`)}</tbody></table>
  <div class="card"><h2>${edit ? "Modifier l'offre" : "Nouvelle offre TERANGA"}</h2>${offerForm("/admin/offers", edit || {}, true)}</div>`);
}

export function adminRestaurants(user, rows, menus) {
  return adminLayout(user, "restaurants", "Restaurants & plats", html`<p class="muted small">Les menus et prix sont fournis par les restaurants partenaires. Ne publier que des informations confirmées par le restaurant.</p>
  ${rows.map((r) => html`<div class="card"><h2>${r.name} <small>· ${r.area} · ${r.status} · ${r.company || "géré par TERANGA"}</small></h2>
    <div class="btns">${["published", "suspended"].filter((s) => s !== r.status).map((s) => post(`/admin/restaurants/${r.id}/status`, { status: s }, s === "published" ? "Publier" : "Suspendre", s === "published" ? "btn-red" : "btn-ghost"))}</div>
    <table class="tbl"><tbody>${(menus[r.id] || []).map((m) => html`<tr><td>${m.name_fr}</td><td>${fmtAED(m.price_fils)}</td><td>${m.allergens}</td><td>${post(`/admin/menu/${m.id}/toggle`, {}, m.available ? "Indisponible" : "Disponible", "btn-ghost")}</td></tr>`)}</tbody></table>
    <details><summary>Ajouter un plat</summary>${menuForm("/admin/menu", r.id)}</details></div>`)}
  <details class="card"><summary>Créer un restaurant</summary>${restaurantForm("/admin/restaurants")}</details>`);
}

export function adminPackages(user, rows) {
  return adminLayout(user, "packages", "Forfaits", html`${rows.map((p) => html`<form class="card form grid2" method="post" action="/admin/packages/${p.slug}"><h2 class="wide">${p.name}</h2>
    <label class="fld"><span>Accroche FR</span><input name="tagline_fr" value="${p.tagline_fr}" maxlength="200"></label><label class="fld"><span>Tagline EN</span><input name="tagline_en" value="${p.tagline_en}" maxlength="200"></label>
    <label class="fld wide"><span>Inclus FR (séparés par |)</span><textarea name="includes_fr" rows="2" maxlength="2000">${p.includes_fr}</textarea></label>
    <label class="fld wide"><span>Includes EN (separated by |)</span><textarea name="includes_en" rows="2" maxlength="2000">${p.includes_en}</textarea></label>
    <label class="fld"><span>Prix « à partir de » AED (vide = sur devis)</span><input name="price" inputmode="decimal" value="${p.price_from_fils ? p.price_from_fils / 100 : ""}"></label>
    <label class="fld"><span>Statut</span>${sel("status", ["published", "draft"], p.status)}</label><button class="btn btn-dark">Enregistrer</button></form>`)}`);
}

export function adminPayments(user, rows) {
  return adminLayout(user, "payments", "Paiements", html`<table class="tbl"><thead><tr><th>Date</th><th>Dossier</th><th>Type</th><th>Moyen</th><th>Montant</th><th>Statut</th><th>Réf.</th><th></th></tr></thead><tbody>
  ${rows.map((p) => html`<tr><td>${p.created_at.slice(0, 16)}</td><td><a href="/admin/${p.ref.startsWith("TF") ? "food" : "requests/" + p.ref}">${p.ref}</a></td><td>${p.kind}</td><td>${p.method}</td><td>${fmtAED(p.amount_fils)}</td><td>${p.status}</td><td>${p.provider_ref || ""}</td>
  <td>${p.status === "pending" ? post(`/admin/payments/${p.id}/verify`, { back: "/admin/payments" }, "Vérifié") : ""}</td></tr>`)}</tbody></table>`);
}
export function adminCommissions(user, rows) {
  return adminLayout(user, "commissions", "Commissions", html`<table class="tbl"><thead><tr><th>Dossier</th><th>Partenaire</th><th>Base</th><th>%</th><th>Commission</th><th>Statut</th><th></th></tr></thead><tbody>
  ${rows.map((c) => html`<tr><td>${c.ref}</td><td>${c.company}</td><td>${fmtAED(c.base_fils)}</td><td>${c.pct}</td><td>${fmtAED(c.amount_fils)}</td><td>${c.status}</td><td>${c.status === "due" ? post(`/admin/commissions/${c.id}`, {}, "Réglée") : ""}</td></tr>`)}</tbody></table>`);
}
export function adminUsers(user, rows) {
  return adminLayout(user, "users", "Clients et comptes", html`<table class="tbl"><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Pays</th><th>Rôle</th><th>MFA</th><th>Créé</th></tr></thead><tbody>
  ${rows.map((u) => html`<tr><td>${u.name}</td><td>${u.email}</td><td>${u.phone || ""}</td><td>${u.country || ""}</td><td>${u.role}</td><td>${u.totp_enabled ? "✓" : ""}</td><td>${u.created_at.slice(0, 10)}</td></tr>`)}</tbody></table>`);
}
export function adminSettings(user, s) {
  return adminLayout(user, "settings", "Paramètres", html`<form class="card form grid2" method="post" action="/admin/settings"><h2 class="wide">Taux de change indicatifs</h2>
    <p class="wide small muted">Saisir le taux 1 AED = x EUR et sa date de relevé. Le FCFA (XOF) est calculé avec la parité fixe 1 EUR = 655,957 XOF. Les conversions ne sont affichées qu'à titre indicatif ; la devise facturée reste l'AED.</p>
    <label class="fld"><span>1 AED = … EUR</span><input name="fx_eur" inputmode="decimal" value="${s.fx_eur || ""}"></label><label class="fld"><span>Date du taux</span><input name="fx_date" type="date" value="${s.fx_date || ""}"></label>
    <h2 class="wide">Facturation</h2><label class="fld"><span>N° de licence commerciale</span><input name="licence" value="${s.licence || ""}" maxlength="80"></label><label class="fld"><span>TRN (TVA)</span><input name="trn" value="${s.trn || ""}" maxlength="40"></label>
    <label class="fld wide"><span>Instructions de paiement affichées au client (virement, Wave…)</span><textarea name="pay_instructions" rows="3" maxlength="1500">${s.pay_instructions || ""}</textarea></label>
    <button class="btn btn-dark">Enregistrer</button></form>`);
}
export function adminAudit(user, rows) {
  return adminLayout(user, "audit", "Journal d'audit", html`<table class="tbl"><thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Détail</th></tr></thead><tbody>
  ${rows.map((a) => html`<tr><td>${a.at.slice(0, 19)}</td><td>${a.actor || ""}</td><td>${a.action}</td><td>${a.target || ""}</td><td class="small">${a.detail || ""}</td></tr>`)}</tbody></table>`);
}

export function adminSetupPage(error) {
  const body = html`<div class="wrap section narrow"><h1 class="h1">Création du compte administrateur</h1>${error ? html`<div class="alert">${error}</div>` : ""}
  <form class="card form" method="post" action="/admin/setup"><p class="small muted">Utilisable une seule fois, tant qu'aucun administrateur n'existe. Le code d'installation est fourni par l'équipe technique.</p>
    <label class="fld"><span>Code d'installation</span><input name="setup_code" required autocomplete="off"></label>
    <label class="fld"><span>Nom</span><input name="name" required maxlength="100"></label><label class="fld"><span>E-mail</span><input name="email" type="email" required></label>
    <label class="fld"><span>Téléphone</span><input name="phone" type="tel" required></label>
    <label class="fld"><span>Mot de passe (14 caractères min.)</span><input name="password" type="password" minlength="14" required autocomplete="new-password"></label>
    <button class="btn btn-red">Créer</button></form></div>`;
  return layout("fr", { title: "Installation", path: "/fr/admin", body, noindex: true });
}
