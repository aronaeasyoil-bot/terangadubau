// Espace client, espace partenaire et pages d'authentification.
import { html, raw, esc, fmtAED } from "../lib/util.js";
import { layout, t, L, waLink, icon } from "./layout.js";
import { errorText } from "./public.js";
import { SERVICES, SERVICE_KEYS } from "../data/services.js";
import { STATUS, FOOD_STATUS } from "../lib/booking.js";
import { CUISINES, DISH_KEYS } from "../data/food.js";

const alert = (lang, error, ok) => html`${error ? html`<div class="alert" role="alert">${errorText(lang, error)}</div>` : ""}${ok ? html`<div class="success" role="status">${ok}</div>` : ""}`;
const st = (lang, map, s) => (map[s] || [s, s])[lang === "en" ? 1 : 0];

export function authPage(lang, { error, next = "", vals = {} }) {
  const body = html`<div class="wrap section"><h1 class="h1">${t(lang, "account")}</h1>${alert(lang, error)}
  <div class="two">
    <form class="card form" method="post" action="/${lang}/account/login"><h2>${L(lang, "Connexion", "Sign in")}</h2>
      <input type="hidden" name="next" value="${next}">
      <label class="fld"><span>${t(lang, "email")}</span><input name="email" type="email" autocomplete="email" required value="${vals.email || ""}"></label>
      <label class="fld"><span>${L(lang, "Mot de passe", "Password")}</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-red">${L(lang, "Se connecter", "Sign in")}</button></form>
    <form class="card form" method="post" action="/${lang}/account/register"><h2>${L(lang, "Créer un compte", "Create an account")}</h2>
      <input type="hidden" name="next" value="${next}">
      <label class="fld"><span>${t(lang, "name")}</span><input name="name" autocomplete="name" required maxlength="100" value="${vals.name || ""}"></label>
      <label class="fld"><span>${t(lang, "email")}</span><input name="email" type="email" autocomplete="email" required value="${vals.email || ""}"></label>
      <label class="fld"><span>${t(lang, "phone")}</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required value="${vals.phone || ""}"></label>
      <label class="fld"><span>${L(lang, "Pays de résidence", "Country of residence")}</span><input name="country" maxlength="60" autocomplete="country-name" value="${vals.country || ""}"></label>
      <label class="fld"><span>${L(lang, "Mot de passe (10 caractères min.)", "Password (min. 10 characters)")}</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="check"><input type="checkbox" name="consent" required> <span>${t(lang, "consent")}</span></label>
      <button class="btn btn-dark">${L(lang, "Créer mon compte", "Create my account")}</button></form>
  </div>
  <p class="muted small">${L(lang, "Une demande faite sans compte peut être suivie avec son lien personnel. Les dossiers créés avec la même adresse e-mail sont rattachés automatiquement à votre compte.", "Requests made without an account can be followed with their personal link. Files created with the same email are attached to your account automatically.")}</p></div>`;
  return layout(lang, { title: t(lang, "account"), path: `/${lang}/account`, body, noindex: true });
}

export function mfaPage(lang, { user, secret, error }) {
  const uri = secret ? `otpauth://totp/TERANGA%20DUBAI:${encodeURIComponent(user.email)}?secret=${secret}&issuer=TERANGA%20DUBAI` : "";
  const body = html`<div class="wrap section narrow"><h1 class="h1">${L(lang, "Double authentification", "Two-factor authentication")}</h1>${alert(lang, error)}
    ${secret ? html`<div class="card"><p>${L(lang, "L'administration exige un second facteur. Ajoutez ce compte dans une application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…) avec la clé ci-dessous, puis saisissez le code à 6 chiffres.", "The admin area requires a second factor. Add this account to an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) with the key below, then enter the 6-digit code.")}</p>
      <p class="mono break">${secret.replace(/(.{4})/g, "$1 ")}</p><p class="small muted break">${uri}</p></div>` : ""}
    <form class="card form" method="post" action="/${lang}/account/mfa"><label class="fld"><span>${L(lang, "Code à 6 chiffres", "6-digit code")}</span>
      <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button class="btn btn-red">${L(lang, "Valider", "Verify")}</button></form></div>`;
  return layout(lang, { title: "MFA", path: `/${lang}/account`, body, user, noindex: true });
}

export function dashboardPage(lang, { user, requests, orders, notes, invoices, ok }) {
  const body = html`<div class="wrap section"><div class="row-between"><h1 class="h1">${L(lang, "Bonjour", "Hello")} ${user.name.split(" ")[0]}</h1>
    <form method="post" action="/${lang}/account/logout"><button class="btn btn-ghost btn-sm">${L(lang, "Déconnexion", "Sign out")}</button></form></div>${alert(lang, null, ok)}
    ${user.role === "admin" ? html`<p><a class="btn btn-dark" href="/admin">${L(lang, "Administration", "Admin")}</a></p>` : ""}
    ${user.role === "partner" ? html`<p><a class="btn btn-dark" href="/${lang}/partner">${L(lang, "Espace partenaire", "Partner area")}</a></p>` : ""}
    <div class="quick-actions"><a class="btn btn-red" href="/${lang}#search">${L(lang, "Nouvelle demande", "New request")}</a><a class="btn btn-light" href="/${lang}/food">${L(lang, "Commander un repas", "Order food")}</a><a class="btn btn-wa" href="${waLink(lang, L(lang, "mon espace client", "my account"))}" rel="noopener">${icon("wa")} ${L(lang, "Assistance", "Support")}</a></div>
    ${notes.length ? html`<section class="card"><h2>${L(lang, "Notifications", "Notifications")}</h2><ul class="notes">${notes.map((n) => html`<li class="${n.read ? "" : "unread"}"><time>${n.created_at.slice(0, 16)}</time> ${lang === "en" ? n.text_en : n.text_fr}${n.ref ? html` · <a href="/${lang}/track?ref=${n.ref}">${n.ref}</a>` : ""}</li>`)}</ul></section>` : ""}
    <section><h2 class="h2">${L(lang, "Mes réservations et demandes", "My bookings and requests")}</h2>
      ${requests.length ? html`<div class="list">${requests.map((r) => html`<a class="item card" href="/${lang}/track?ref=${r.ref}"><b>${SERVICES[r.service]?.[lang].name || r.service}</b><span class="ref">${r.ref}</span><span class="status status-${r.status}">${st(lang, STATUS, r.status)}</span>${r.amount_fils ? html`<span>${fmtAED(r.amount_fils)}</span>` : ""}<time>${r.created_at.slice(0, 10)}</time></a>`)}</div>` : html`<p class="muted">${L(lang, "Aucune demande pour le moment.", "No requests yet.")}</p>`}</section>
    <section><h2 class="h2">${L(lang, "Mes commandes de repas", "My food orders")}</h2>
      ${orders.length ? html`<div class="list">${orders.map((r) => html`<a class="item card" href="/${lang}/track?ref=${r.ref}"><b>${r.restaurant}</b><span class="ref">${r.ref}</span><span class="status">${st(lang, FOOD_STATUS, r.status)}</span><span>${fmtAED(r.total_fils)}</span><time>${r.created_at.slice(0, 10)}</time></a>`)}</div>` : html`<p class="muted">${L(lang, "Aucune commande.", "No orders.")}</p>`}</section>
    ${invoices.length ? html`<section><h2 class="h2">${L(lang, "Factures", "Invoices")}</h2><ul>${invoices.map((i) => html`<li><a href="/${lang}/account/invoice/${i.number}">${i.number}</a> · ${i.ref} · ${fmtAED(i.amount_fils)} · ${i.created_at.slice(0, 10)}</li>`)}</ul></section>` : ""}
    <section class="card"><h2>${L(lang, "Profil", "Profile")}</h2><dl class="kv"><dt>${t(lang, "email")}</dt><dd>${user.email}</dd><dt>${t(lang, "phone")}</dt><dd>${user.phone || "—"}</dd><dt>${L(lang, "Pays", "Country")}</dt><dd>${user.country || "—"}</dd></dl>
      <p class="small muted">${L(lang, "Pour modifier vos informations ou supprimer votre compte, écrivez-nous sur WhatsApp.", "To change your details or delete your account, message us on WhatsApp.")}</p></section>
  </div>`;
  return layout(lang, { title: t(lang, "account"), path: `/${lang}/account`, body, user, noindex: true });
}

export function invoicePage(lang, { user, inv, req }) {
  const body = html`<div class="wrap section narrow"><article class="card invoice"><img src="/img/logo.webp" width="160" height="47" alt="TERANGA DUBAI">
    <h1>${L(lang, "Facture", "Invoice")} ${inv.number}</h1><p>${L(lang, "Date", "Date")} : ${inv.created_at.slice(0, 10)}</p>
    <p>${L(lang, "Client", "Customer")} : ${req?.name || ""} · ${req?.email || ""}</p><p>${L(lang, "Dossier", "File")} : ${inv.ref}</p>
    <p class="price">${L(lang, "Montant", "Amount")} : <b>${fmtAED(inv.amount_fils)}</b> (${inv.currency})</p>
    <p class="small muted">${L(lang, "Document généré par TERANGA DUBAI. Les mentions légales de facturation (numéro de licence, TRN TVA) seront ajoutées dès qu'elles seront renseignées dans les paramètres.", "Generated by TERANGA DUBAI. Legal invoicing details (licence number, VAT TRN) will be added once entered in settings.")}</p>
    <button class="btn btn-ghost" data-print>${L(lang, "Imprimer / PDF", "Print / PDF")}</button></article></div>`;
  return layout(lang, { title: inv.number, path: `/${lang}/account`, body, user, noindex: true });
}

// ---------- Espace partenaire ----------
const CATS = ["hotel", "apartment", "restaurant", "transport", "driver", "guide", "agency", "activity", "logistics"];
export function partnerPage(lang, env, { user, partner, offers = [], restaurants = [], menus = {}, orders = [], requests = [], commissions = [], error, ok }) {
  let inner;
  if (!partner) {
    inner = html`<form class="card form" method="post" action="/${lang}/partner/apply"><h2>${L(lang, "Demande de partenariat", "Partnership application")}</h2>
      <label class="fld"><span>${L(lang, "Société", "Company")} *</span><input name="company" required maxlength="120"></label>
      <label class="fld"><span>${L(lang, "Catégorie", "Category")} *</span><select name="category" required>${CATS.map((c) => html`<option>${c}</option>`)}</select></label>
      <label class="fld"><span>${t(lang, "phone")} *</span><input name="phone" type="tel" required value="${user.phone || ""}"></label>
      <label class="fld"><span>${L(lang, "Ville / quartier", "City / area")}</span><input name="city" maxlength="80"></label>
      <label class="fld"><span>${L(lang, "N° de licence commerciale", "Trade licence no.")}</span><input name="licence_no" maxlength="60"></label>
      <label class="fld wide"><span>${L(lang, "Présentation", "Description")}</span><textarea name="description" rows="4" maxlength="1500"></textarea></label>
      <label class="check"><input type="checkbox" name="consent" required> <span>${L(lang, "Je certifie disposer des licences et autorisations nécessaires à mon activité.", "I confirm I hold the licences and permits required for my business.")}</span></label>
      <button class="btn btn-red">${L(lang, "Envoyer ma candidature", "Submit my application")}</button></form>`;
  } else if (partner.status !== "approved") {
    inner = html`<div class="notice"><strong>${partner.company}</strong><p>${partner.status === "pending" ? L(lang, "Votre candidature est en cours de vérification. Nous vous contacterons pour les documents professionnels.", "Your application is being reviewed. We will contact you for business documents.") : L(lang, "Votre compte partenaire n'est pas actif. Contactez-nous.", "Your partner account is not active. Contact us.")}</p></div>`;
  } else {
    inner = html`<p>${partner.company} · ${partner.category} · ${L(lang, "commission", "commission")} ${partner.commission_pct}%</p>
    <section><h2 class="h2">${L(lang, "Mes offres", "My offers")}</h2>
      <table class="tbl"><thead><tr><th>${L(lang, "Titre", "Title")}</th><th>Service</th><th>${L(lang, "Prix", "Price")}</th><th>Statut</th></tr></thead><tbody>
      ${offers.map((o) => html`<tr><td>${o.title_fr}</td><td>${o.service}</td><td>${fmtAED(o.price_fils)}</td><td>${o.status}</td></tr>`)}</tbody></table>
      <details class="card"><summary>${L(lang, "Ajouter une offre", "Add an offer")}</summary>${offerForm(`/${lang}/partner/offers`, {})}</details></section>
    ${partner.category === "restaurant" ? html`<section><h2 class="h2">${L(lang, "Mon restaurant", "My restaurant")}</h2>
      ${restaurants.map((r) => html`<div class="card"><h3>${r.name} <small>(${r.status})</small></h3><table class="tbl"><tbody>${(menus[r.id] || []).map((m) => html`<tr><td>${m.name_fr}</td><td>${fmtAED(m.price_fils)}</td><td>${m.available ? "✓" : "—"}</td></tr>`)}</tbody></table>
        <details><summary>${L(lang, "Ajouter un plat", "Add a dish")}</summary>${menuForm(`/${lang}/partner/menu`, r.id)}</details></div>`)}
      ${restaurants.length ? "" : html`<details class="card" open><summary>${L(lang, "Créer la fiche restaurant", "Create the restaurant page")}</summary>${restaurantForm(`/${lang}/partner/restaurant`)}</details>`}
      <h3>${L(lang, "Commandes", "Orders")}</h3>${orders.map((o) => html`<div class="card"><b>${o.ref}</b> · ${st(lang, FOOD_STATUS, o.status)} · ${fmtAED(o.total_fils)} · ${o.slot}<br><span class="small">${o.address}</span>
        <ul class="small">${JSON.parse(o.items).map((i) => html`<li>${i.qty} × ${i.name_fr}</li>`)}</ul>${foodButtons(`/${lang}/partner/food`, o)}</div>`)}</section>` : ""}
    <section><h2 class="h2">${L(lang, "Missions et réservations attribuées", "Assigned missions and bookings")}</h2>
      ${requests.map((r) => html`<div class="card"><b>${r.ref}</b> · ${r.service} · ${st(lang, STATUS, r.status)}<dl class="kv small">${Object.entries(JSON.parse(r.fields)).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></div>`)}
      ${requests.length ? "" : html`<p class="muted">—</p>`}</section>
    <section><h2 class="h2">${L(lang, "Commissions", "Commissions")}</h2><table class="tbl"><tbody>${commissions.map((c) => html`<tr><td>${c.ref}</td><td>${fmtAED(c.base_fils)}</td><td>${c.pct}%</td><td>${fmtAED(c.amount_fils)}</td><td>${c.status}</td></tr>`)}</tbody></table></section>`;
  }
  const body = html`<div class="wrap section"><h1 class="h1">${L(lang, "Espace partenaire", "Partner area")}</h1>${alert(lang, error, ok)}${inner}</div>`;
  return layout(lang, { title: L(lang, "Espace partenaire", "Partner area"), path: `/${lang}/partner`, body, user, noindex: true });
}

export function offerForm(action, o = {}, admin = false) {
  return html`<form class="form grid2" method="post" action="${action}">
    ${o.id ? html`<input type="hidden" name="id" value="${o.id}">` : ""}
    <label class="fld"><span>Service *</span><select name="service" required>${SERVICE_KEYS.filter((k) => k !== "food").map((k) => html`<option ${o.service === k ? raw("selected") : ""}>${k}</option>`)}</select></label>
    <label class="fld"><span>Zone / Area</span><input name="area" maxlength="80" value="${o.area || ""}"></label>
    <label class="fld"><span>Titre FR *</span><input name="title_fr" required maxlength="140" value="${o.title_fr || ""}"></label>
    <label class="fld"><span>Title EN *</span><input name="title_en" required maxlength="140" value="${o.title_en || ""}"></label>
    <label class="fld wide"><span>Description FR</span><textarea name="desc_fr" rows="3" maxlength="2000">${o.desc_fr || ""}</textarea></label>
    <label class="fld wide"><span>Description EN</span><textarea name="desc_en" rows="3" maxlength="2000">${o.desc_en || ""}</textarea></label>
    <label class="fld"><span>Capacité / Capacity</span><input name="capacity" type="number" min="0" max="500" value="${o.capacity ?? ""}"></label>
    <label class="fld"><span>Chambres / Bedrooms</span><input name="bedrooms" type="number" min="0" max="50" value="${o.bedrooms ?? ""}"></label>
    <label class="fld"><span>Prix indicatif AED</span><input name="price" inputmode="decimal" value="${o.price_fils ? o.price_fils / 100 : ""}"></label>
    <label class="fld"><span>Unité / Unit</span><input name="unit" maxlength="30" value="${o.unit || "nuit"}"></label>
    <label class="fld wide"><span>Conditions FR</span><textarea name="terms_fr" rows="2" maxlength="2000">${o.terms_fr || ""}</textarea></label>
    <label class="fld wide"><span>Terms EN</span><textarea name="terms_en" rows="2" maxlength="2000">${o.terms_en || ""}</textarea></label>
    ${admin ? html`<label class="fld wide"><span>Image (URL upload.wikimedia.org / thumb.wikimedia.org)</span><input name="image_url" type="url" value="${o.image_url || ""}"></label>` : ""}
    <button class="btn btn-red">${admin ? "Enregistrer" : "Soumettre pour validation"}</button></form>`;
}
export function restaurantForm(action, r = {}) {
  return html`<form class="form grid2" method="post" action="${action}">${r.id ? html`<input type="hidden" name="id" value="${r.id}">` : ""}
    <label class="fld"><span>Nom *</span><input name="name" required maxlength="120" value="${r.name || ""}"></label>
    <label class="fld"><span>Quartier *</span><input name="area" required maxlength="80" value="${r.area || ""}"></label>
    <label class="fld"><span>Cuisine</span><select name="cuisine">${Object.keys(CUISINES).map((c) => html`<option ${r.cuisine === c ? raw("selected") : ""}>${c}</option>`)}</select></label>
    <label class="fld"><span>Téléphone</span><input name="phone" type="tel" value="${r.phone || ""}"></label>
    <label class="fld"><span>Horaires</span><input name="hours" maxlength="80" value="${r.hours || ""}"></label>
    <label class="fld"><span>Frais de livraison AED</span><input name="delivery_fee" inputmode="decimal" value="${r.delivery_fee_fils != null ? r.delivery_fee_fils / 100 : ""}"></label>
    <label class="fld"><span>Minimum de commande AED</span><input name="min_order" inputmode="decimal" value="${r.min_order_fils != null ? r.min_order_fils / 100 : ""}"></label>
    <button class="btn btn-red">Enregistrer</button></form>`;
}
export function menuForm(action, restaurantId) {
  return html`<form class="form grid2" method="post" action="${action}"><input type="hidden" name="restaurant_id" value="${restaurantId}">
    <label class="fld"><span>Plat de référence</span><select name="dish_key"><option value="">—</option>${DISH_KEYS.map((k) => html`<option>${k}</option>`)}</select></label>
    <label class="fld"><span>Prix AED *</span><input name="price" inputmode="decimal" required></label>
    <label class="fld"><span>Nom FR *</span><input name="name_fr" required maxlength="120"></label><label class="fld"><span>Name EN *</span><input name="name_en" required maxlength="120"></label>
    <label class="fld wide"><span>Description FR</span><input name="desc_fr" maxlength="400"></label><label class="fld wide"><span>Description EN</span><input name="desc_en" maxlength="400"></label>
    <label class="fld"><span>Ingrédients</span><input name="ingredients" maxlength="400"></label><label class="fld"><span>Allergènes</span><input name="allergens" maxlength="200" placeholder="arachide, poisson, gluten…"></label>
    <button class="btn btn-red">Ajouter</button></form>`;
}
export function foodButtons(action, o) {
  const next = { new: ["restaurant_confirmed", "cancelled"], restaurant_confirmed: ["preparing", "cancelled"], preparing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"] }[o.status] || [];
  return html`<div class="btns">${next.map((s) => html`<form method="post" action="${action}"><input type="hidden" name="ref" value="${o.ref}"><input type="hidden" name="to" value="${s}"><button class="btn btn-sm ${s === "cancelled" ? "btn-ghost" : "btn-dark"}">${FOOD_STATUS[s][0]}</button></form>`)}</div>`;
}
