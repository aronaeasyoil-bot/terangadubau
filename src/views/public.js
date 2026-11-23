import { html, raw, esc, fmtAED } from "../lib/util.js";
import { layout, t, L, img, waLink, icon, BRAND } from "./layout.js";
import { SERVICES, SEARCH_TABS } from "../data/services.js";
import { IMAGES, DISH_IMAGES } from "../data/images.js";
import { DISHES, CUISINES } from "../data/food.js";
import { STATUS, FOOD_STATUS } from "../lib/booking.js";
import { isoDuration, hotelsMode, flightsMode } from "../lib/suppliers.js";
const liveOn = (env, k) => (k === "hotels" ? hotelsMode(env) : k === "flights" ? flightsMode(env) : null) != null;

const ERR = {
  missing_field: ["Merci de remplir tous les champs obligatoires.", "Please fill in all required fields."],
  invalid_email: ["Adresse e-mail invalide.", "Invalid email address."], invalid_phone: ["Numéro de téléphone invalide.", "Invalid phone number."],
  invalid_date: ["Date invalide.", "Invalid date."], date_in_past: ["La date ne peut pas être dans le passé.", "The date cannot be in the past."],
  dates_order: ["La date de fin doit suivre la date de début.", "The end date must be after the start date."],
  consent_required: ["Merci d'accepter le traitement de vos informations.", "Please accept the processing of your information."],
  rate_limited: ["Trop de tentatives. Réessayez dans quelques minutes ou écrivez-nous sur WhatsApp.", "Too many attempts. Try again in a few minutes or message us on WhatsApp."],
  captcha_failed: ["La vérification anti-robot a échoué. Merci de réessayer.", "The anti-bot check failed. Please try again."],
  bad_credentials: ["E-mail ou mot de passe incorrect.", "Incorrect email or password."], email_taken: ["Un compte existe déjà avec cet e-mail.", "An account already exists with this email."],
  weak_password: ["Le mot de passe doit contenir au moins 10 caractères.", "Password must be at least 10 characters."],
  invalid_number: ["Nombre invalide.", "Invalid number."], invalid_choice: ["Choix invalide.", "Invalid choice."], field_too_long: ["Un champ est trop long.", "A field is too long."],
  invalid_amount: ["Montant invalide.", "Invalid amount."], invalid_cart: ["Panier invalide.", "Invalid cart."],
  item_unavailable: ["Un plat n'est plus disponible. Merci de vérifier votre panier.", "An item is no longer available. Please check your cart."],
  below_minimum: ["Le minimum de commande du restaurant n'est pas atteint.", "The restaurant's minimum order is not reached."],
  restaurant_unavailable: ["Ce restaurant ne prend pas de commandes pour le moment.", "This restaurant is not taking orders right now."],
  quote_expired: ["Ce devis a expiré. Contactez-nous pour l'actualiser.", "This quote has expired. Contact us to refresh it."],
  not_quoted: ["Ce dossier n'a pas de devis à accepter.", "This file has no quote to accept."],
  contact_us_to_cancel: ["Ce dossier ne peut plus être annulé en ligne. Contactez-nous sur WhatsApp.", "This file can no longer be cancelled online. Contact us on WhatsApp."],
  invalid_code: ["Code invalide.", "Invalid code."], invalid_time: ["Heure invalide.", "Invalid time."],
};
export const errorText = (lang, code) => { const e = ERR[code]; return e ? L(lang, e[0], e[1]) : L(lang, "Une erreur est survenue. Merci de réessayer ou de nous écrire sur WhatsApp.", "Something went wrong. Please try again or message us on WhatsApp."); };

const v = (vals, k, d = "") => (vals && vals[k] != null ? vals[k] : d);

function field(lang, f, vals) {
  const label = lang === "en" ? f.en : f.fr, id = "f-" + f.name, req = f.req ? raw(" required") : "";
  const star = f.req ? raw(`<abbr title="${t(lang, "required")}">*</abbr>`) : "";
  let input;
  if (f.type === "select") input = html`<select id="${id}" name="${f.name}"${req}>${f.req ? "" : html`<option value="">—</option>`}${f.options.map((o) => html`<option ${v(vals, f.name) === o ? raw("selected") : ""}>${o}</option>`)}</select>`;
  else if (f.type === "textarea") input = html`<textarea id="${id}" name="${f.name}" rows="3" maxlength="${f.max || 1000}">${v(vals, f.name)}</textarea>`;
  else {
    const extra = f.type === "number" ? raw(` inputmode="numeric" min="${f.min ?? 0}" max="${f.max ?? ""}"`) : f.type === "date" ? raw(' data-future') : "";
    input = html`<input id="${id}" name="${f.name}" type="${f.type}" value="${v(vals, f.name, f.value ?? "")}"${extra}${req}${f.ph ? raw(` placeholder="${esc(f.ph)}"`) : ""}${f.max && f.type === "text" ? raw(` maxlength="${f.max}"`) : ""}>`;
  }
  return html`<label class="fld${f.type === "textarea" ? " wide" : ""}" for="${id}"><span>${label} ${star}</span>${input}</label>`;
}

export function contactFields(lang, vals, user) {
  return html`<fieldset class="grid2"><legend>${L(lang, "Vos coordonnées", "Your details")}</legend>
  <label class="fld" for="c-name"><span>${t(lang, "name")} <abbr title="${t(lang, "required")}">*</abbr></span><input id="c-name" name="name" autocomplete="name" required maxlength="100" value="${v(vals, "name", user?.name || "")}"></label>
  <label class="fld" for="c-phone"><span>${t(lang, "phone")} <abbr title="${t(lang, "required")}">*</abbr></span><input id="c-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+221 77 000 00 00" value="${v(vals, "phone", user?.phone || "")}"></label>
  <label class="fld wide" for="c-email"><span>${t(lang, "email")} <abbr title="${t(lang, "required")}">*</abbr></span><input id="c-email" name="email" type="email" inputmode="email" autocomplete="email" required value="${v(vals, "email", user?.email || "")}"></label>
  <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
  <label class="check wide"><input type="checkbox" name="consent" required> <span>${t(lang, "consent")}</span></label>
  </fieldset>`;
}
export const turnstile = (env) => env.TURNSTILE_SITE_KEY ? raw(`<div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITE_KEY)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`) : "";

export function requestForm(lang, env, service, { vals = {}, user, offer } = {}) {
  const s = SERVICES[service];
  return html`<form class="card form" method="post" action="/${lang}/${service}" novalidate data-validate>
    ${offer ? html`<input type="hidden" name="offer_id" value="${offer}">` : ""}
    <fieldset class="grid2"><legend>${L(lang, "Votre demande", "Your request")}</legend>${s.fields.map((f) => field(lang, f, vals))}</fieldset>
    ${contactFields(lang, vals, user)} ${turnstile(env)}
    <button class="btn btn-red btn-lg" type="submit">${t(lang, "send")}</button>
    <p class="muted small">${L(lang, "Vous recevrez une référence de dossier et un lien de suivi personnel. Réponse sur WhatsApp ou par e-mail.", "You will receive a file reference and a personal tracking link. We reply on WhatsApp or by email.")}</p>
  </form>`;
}

const onRequest = (lang) => html`<div class="notice"><strong>${t(lang, "on_request")}</strong><p>${t(lang, "on_request_text")}</p></div>`;

function hero(lang, key, title, lead, extra = "") {
  return html`<section class="phero"><div class="phero-img">${img(SERVICES[key]?.img || key, lang, { eager: true, sizes: "100vw" })}</div>
  <div class="wrap phero-txt"><h1>${title}</h1><p>${lead}</p>${extra}</div></section>`;
}

// ---------- Accueil ----------
export function homePage(lang, env, { user, packages }) {
  const tabs = SEARCH_TABS.map((k) => [k, SERVICES[k]]);
  const body = html`
  <section class="hero">
    <div class="hero-img">${img("hero", lang, { eager: true, sizes: "100vw" })}</div>
    <div class="wrap hero-txt">
      <p class="kicker">Your African Travel Companion</p>
      <h1>TERANGA <span>DUBAI</span></h1>
      <p class="lead">${L(lang, "Découvrez Dubaï avec la chaleur de l'accueil africain. Hébergement, voyages, shopping, restauration et assistance : tout votre séjour au même endroit.", "Discover Dubai with the warmth of African hospitality. Accommodation, travel, shopping, food and assistance: your whole stay in one place.")}</p>
      <div class="ctas"><a class="btn btn-red btn-lg" href="#search">${t(lang, "book_now")}</a><a class="btn btn-light btn-lg" href="#services">${t(lang, "discover")}</a>
      <a class="btn btn-wa btn-lg" href="${waLink(lang)}" rel="noopener">${icon("wa")} WhatsApp</a></div>
    </div>
  </section>

  <section id="search" class="search wrap" aria-label="${L(lang, "Moteur de recherche", "Search")}">
    <div class="tabs" role="tablist">${tabs.map(([k, s], i) => html`<button role="tab" type="button" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${i === 0}" ${i ? raw('tabindex="-1"') : ""} data-tab="${k}"><span aria-hidden="true">${s.icon}</span> ${s[lang].name}</button>`)}</div>
    ${tabs.map(([k, s], i) => html`<form role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}" class="panel" method="get" action="/${lang}/${k}${liveOn(env, k) ? "#resultats" : "#form"}" ${i ? raw("hidden") : ""}>${liveOn(env, k) ? raw('<input type="hidden" name="search" value="1">') : ""}
      <div class="panel-fields">${s.fields.filter((f) => f.req).slice(0, 4).map((f) => field(lang, { ...f, req: false }, {}))}</div>
      <button class="btn btn-red" type="submit">${L(lang, "Rechercher", "Search")}</button>
    </form>`)}
    <p class="muted small">${liveOn(env, "hotels") || liveOn(env, "flights") ? L(lang, "Hôtels et vols : tarifs en temps réel de nos fournisseurs, puis devis et confirmation par notre équipe. Autres services : votre recherche ouvre une demande, nous vérifions les disponibilités réelles et vous répondons avec un devis. Nous n'affichons jamais de résultats fictifs.", "Hotels and flights: live rates from our suppliers, then a quote and confirmation from our team. Other services: your search opens a request, we check real availability and reply with a quote. We never show made-up results.") : L(lang, "Aucune API de réservation instantanée n'est encore connectée : la recherche ouvre une demande traitée par notre équipe, qui vérifie les disponibilités réelles et vous répond avec un devis. Nous n'affichons jamais de résultats fictifs.", "No instant-booking API is connected yet: your search opens a request handled by our team, who check real availability and reply with a quote. We never show made-up results.")}</p>
  </section>

  <section id="services" class="wrap section">
    <h2 class="h2">${t(lang, "services")}</h2>
    <div class="cards">${Object.entries(SERVICES).map(([k, s]) => html`<a class="svc" href="/${lang}/${k}">${img(s.img, lang, { sizes: "(max-width:700px) 50vw, 25vw" })}<span class="svc-t"><span aria-hidden="true">${s.icon}</span> ${s[lang].name}</span></a>`)}</div>
  </section>

  <section class="food-band">
    <div class="wrap food-in">
      <div class="food-img">${img("food", lang, { sizes: "(max-width:700px) 100vw, 40vw" })}</div>
      <div><p class="kicker">TERANGA FOOD</p><h2 class="h2">${L(lang, "Saveurs d'Afrique", "Tastes of Africa")}</h2>
        <p class="lead">${L(lang, "Les saveurs du Sénégal et de l'Afrique, livrées à Dubaï.", "The flavours of Senegal and Africa, delivered in Dubai.")}</p>
        <p>${L(lang, "Thiéboudienne, mafé, yassa, dibi, fataya, bissap, bouye… Retrouvez les plats de chez vous pendant votre séjour, préparés par des restaurants partenaires.", "Thieboudienne, mafé, yassa, dibi, fataya, bissap, bouye… Find the dishes from home during your stay, cooked by partner restaurants.")}</p>
        <a class="btn btn-red" href="/${lang}/food">${L(lang, "Voir les plats", "See the dishes")}</a></div>
    </div>
  </section>

  <section class="wrap section split">
    <div>${img("deira", lang)}</div>
    <div><p class="kicker">TERANGA BUSINESS SHOPPING</p><h2 class="h2">${L(lang, "Acheter à Dubaï, accompagné", "Buy in Dubai, with a guide")}</h2>
      <p>${L(lang, "Guide francophone, interprète, recherche de fournisseurs, visites de grossistes à Deira, Naif, Bur Dubai ou Dragon Mart, transport local et coordination du fret vers l'Afrique.", "French-speaking guide, interpreter, supplier sourcing, wholesaler visits in Deira, Naif, Bur Dubai or Dragon Mart, local transport and freight coordination to Africa.")}</p>
      <a class="btn btn-dark" href="/${lang}/shopping">${L(lang, "Préparer mon voyage d'affaires", "Plan my business trip")}</a></div>
  </section>

  <section class="grey"><div class="wrap section">
    <h2 class="h2">${L(lang, "Comment ça marche", "How it works")}</h2>
    <ol class="steps">
      <li><b>1</b><h3>${L(lang, "Votre demande", "Your request")}</h3><p>${L(lang, "Choisissez un service et dites-nous vos dates et besoins. Vous recevez une référence et un lien de suivi.", "Pick a service and tell us your dates and needs. You get a reference and a tracking link.")}</p></li>
      <li><b>2</b><h3>${L(lang, "Vérification & devis", "Checks & quote")}</h3><p>${L(lang, "Nous vérifions disponibilités, tarifs et conditions auprès des prestataires, puis vous envoyons un devis clair en AED.", "We check availability, prices and terms with suppliers, then send you a clear quote in AED.")}</p></li>
      <li><b>3</b><h3>${L(lang, "Acceptation & paiement", "Acceptance & payment")}</h3><p>${L(lang, "Vous acceptez le devis en ligne. Le paiement (acompte ou total) est vérifié par notre équipe avant toute réservation.", "You accept the quote online. Payment (deposit or full) is verified by our team before anything is booked.")}</p></li>
      <li><b>4</b><h3>${L(lang, "Confirmation", "Confirmation")}</h3><p>${L(lang, "Votre réservation n'est confirmée qu'après confirmation écrite du prestataire. Vous suivez tout depuis votre espace.", "Your booking is confirmed only once the supplier confirms in writing. You follow everything from your account.")}</p></li>
    </ol>
  </div></section>

  <section class="wrap section">
    <h2 class="h2">${L(lang, "Forfaits de séjour", "Stay packages")}</h2>
    <div class="pkgs">${packages.map((p) => html`<article class="pkg"><h3>${p.name}</h3><p>${lang === "en" ? p.tagline_en : p.tagline_fr}</p>
      <a class="btn btn-ghost" href="/${lang}/packages?package=${encodeURIComponent(p.name)}#form">${L(lang, "Demander un devis", "Request a quote")}</a></article>`)}</div>
  </section>

  <section class="cta-band"><div class="wrap"><h2>${L(lang, "Une question ? Parlez à un conseiller.", "A question? Talk to an adviser.")}</h2>
    <p>${L(lang, "En français et en anglais sur WhatsApp.", "In French and English on WhatsApp.")}</p>
    <a class="btn btn-wa btn-lg" href="${waLink(lang)}" rel="noopener">${icon("wa")} ${BRAND.phone}</a></div></section>`;
  return layout(lang, { title: L(lang, "Voyage, hôtels, shopping et restauration africaine à Dubaï", "Travel, hotels, shopping and African food in Dubai"), path: "/" + lang, body, user, active: "home" });
}

// ---------- Pages de service ----------
export function servicePage(lang, env, service, { user, vals, error, offers = [], packages = [], live = null }) {
  const s = SERVICES[service], c = s[lang];
  const extra = service === "shopping" ? shoppingExtra(lang) : service === "activities" ? activitiesExtra(lang) : service === "packages" ? packagesExtra(lang, packages) : "";
  const body = html`${hero(lang, service, c.title, c.lead)}
  <div class="wrap section">
    ${extra}
    ${live ? liveSection(lang, service, live, vals || {}) : ""}
    ${offers.length ? html`<h2 class="h2">${L(lang, "Offres de nos partenaires vérifiés", "Offers from verified partners")}</h2><div class="offers">${offers.map((o) => offerCard(lang, service, o))}</div>` : ""}
    <div class="formwrap" id="form">
      <div><h2 class="h2">${L(lang, "Faire une demande", "Make a request")}</h2>${onRequest(lang)}
        ${s.notice ? html`<div class="notice notice-dark"><p>${s.notice[lang]}</p></div>` : ""}
        <p><a class="btn btn-wa" href="${waLink(lang, c.title)}" rel="noopener">${icon("wa")} ${t(lang, "wa_cta")}</a></p></div>
      <div>${error ? html`<div class="alert" role="alert">${errorText(lang, error)}</div>` : ""}${requestForm(lang, env, service, { vals, user, offer: vals?.offer_id })}</div>
    </div>
  </div>`;
  return layout(lang, { title: c.title, description: c.lead, path: `/${lang}/${service}`, body, user, active: service });
}

// ---------- Recherche en temps réel (LiteAPI / Duffel) ----------
const LIVE_ERR = {
  dates: ["Vérifiez les dates : elles doivent être à venir, dans le bon ordre (30 nuits maximum pour les hôtels).", "Check the dates: they must be in the future and in order (30 nights max for hotels)."],
  places: ["Ville ou aéroport introuvable. Indiquez le code de l'aéroport, par exemple Dakar (DSS).", "City or airport not found. Use the airport code, for example Dakar (DSS)."],
  infants: ["Chaque bébé doit voyager avec un adulte.", "Each infant must travel with an adult."],
  rate_limited: ["Trop de recherches. Réessayez dans quelques minutes.", "Too many searches. Try again in a few minutes."],
  supplier: ["La recherche en ligne ne répond pas pour le moment. Envoyez votre demande ci-dessous, notre équipe s'en charge.", "Online search is not responding right now. Send your request below and our team will handle it."],
};
const money2 = (n, cur) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " " + cur;
const hm = (iso) => (iso || "").slice(11, 16);
const dm = (iso) => (iso || "").slice(8, 10) + "/" + (iso || "").slice(5, 7);
const LIVE_FIELDS = { hotels: ["area", "arrival", "departure", "adults", "rooms"], flights: ["trip", "from", "to", "arrival", "departure", "adults", "children", "infants", "cabin"] };

function pickLink(lang, service, vals, note) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(vals)) if (val && !["search", "note", "offer_id"].includes(k) && k.length < 20) p.set(k, String(val).slice(0, 120));
  p.set("note", note.slice(0, 900));
  return `/${lang}/${service}?${p}#form`;
}

function liveSection(lang, service, live, vals) {
  const s = SERVICES[service];
  const test = live.mode === "test";
  const form = html`<form class="card form live-form" method="get" action="/${lang}/${service}#resultats">
    <input type="hidden" name="search" value="1">
    <fieldset class="grid2"><legend>${service === "hotels" ? L(lang, "Voir les tarifs en temps réel", "See live rates") : L(lang, "Comparer les vols en temps réel", "Compare live flights")}</legend>
    ${s.fields.filter((f) => LIVE_FIELDS[service].includes(f.name)).map((f) => field(lang, f, vals))}</fieldset>
    <button class="btn btn-red btn-lg" type="submit">${L(lang, "Rechercher", "Search")}</button>
  </form>`;
  const banner = test ? html`<div class="alert" role="note"><strong>${L(lang, "Mode test du fournisseur", "Supplier test mode")}</strong> : ${L(lang, "les résultats ci-dessous sont des données de démonstration, ils ne sont pas réels et ne peuvent pas être réservés.", "the results below are demonstration data; they are not real and cannot be booked.")}</div>` : "";
  let results = "";
  if (live.searched) {
    if (live.error) results = html`<div class="alert" role="alert">${L(lang, ...LIVE_ERR[live.error] || LIVE_ERR.supplier)}</div>`;
    else if (!live.results.length) results = html`<div class="notice"><strong>${L(lang, "Aucun résultat disponible pour ces critères.", "No results available for these criteria.")}</strong><p>${L(lang, "Modifiez vos dates ou envoyez une demande : notre équipe cherche aussi auprès de ses partenaires.", "Change your dates or send a request: our team also searches with its partners.")}</p></div>`;
    else results = html`<p class="muted small">${live.results.length} ${L(lang, "résultat(s)", "result(s)")}. ${service === "hotels"
      ? L(lang, "Prix total du séjour, taxes du fournisseur incluses ; la taxe touristique de Dubaï (Tourism Dirham) peut s'ajouter sur place.", "Total stay price including supplier taxes; Dubai's Tourism Dirham fee may be charged at the hotel.")
      : L(lang, "Prix total pour tous les passagers, taxes incluses.", "Total price for all passengers, taxes included.")}
      ${L(lang, " Tarifs du moment, non garantis tant que la réservation n'est pas confirmée.", " Current fares, not guaranteed until the booking is confirmed.")}</p>
      <div class="live-list">${live.results.map((r) => service === "hotels" ? hotelCard(lang, r, vals, test) : flightCard(lang, r, vals, test))}</div>`;
  }
  return html`<section class="live" id="resultats">
    <h2 class="h2">${service === "hotels" ? L(lang, "Disponibilités et tarifs en ligne", "Online availability and rates") : L(lang, "Vols disponibles en ligne", "Flights available online")}</h2>
    <p>${L(lang, "Les tarifs viennent directement de notre fournisseur", "Rates come straight from our supplier")} (${service === "hotels" ? "LiteAPI" : "Duffel"}). ${L(lang, "Choisissez une offre : elle est jointe à votre demande, nous vérifions puis vous envoyons le devis. Aucun paiement n'est demandé à cette étape.", "Pick an offer: it is attached to your request, we check it and send you the quote. No payment is taken at this step.")}</p>
    ${banner}${form}${results}</section>`;
}

function hotelCard(lang, h, vals, test) {
  const stars = h.stars ? "★".repeat(Math.min(5, Math.round(h.stars))) : "";
  const note = `${L(lang, "Offre choisie en ligne", "Offer picked online")}${test ? " [TEST]" : ""} : ${h.name}${h.stars ? ` (${h.stars}★)` : ""} · ${h.room}${h.board ? " · " + h.board : ""} · ${h.nights} ${L(lang, "nuit(s)", "night(s)")} · ${money2(h.amount, h.currency)} · ${h.refundable ? L(lang, "remboursable", "refundable") : L(lang, "non remboursable", "non-refundable")} · LiteAPI ${h.id}`;
  return html`<article class="card live-card">
    ${h.photo && /^https:\/\//.test(h.photo) ? raw(`<img src="${esc(h.photo)}" alt="" loading="lazy" width="320" height="200" referrerpolicy="no-referrer">`) : ""}
    <div class="live-b"><h3>${h.name} <span class="stars" aria-label="${h.stars || ""} ${L(lang, "étoiles", "stars")}">${stars}</span></h3>
    ${h.address ? html`<p class="muted small">${h.address}</p>` : ""}
    ${h.rating ? html`<p class="small">${L(lang, "Note", "Rating")} ${h.rating}/10${h.reviews ? html` · ${h.reviews} ${L(lang, "avis", "reviews")}` : ""}</p>` : ""}
    <p class="small">${h.room}${h.board ? " · " + h.board : ""} · <b>${h.refundable ? L(lang, "Annulation possible (conditions)", "Cancellable (terms apply)") : L(lang, "Non remboursable", "Non-refundable")}</b></p>
    <p class="price">${money2(h.amount, h.currency)} <span class="muted small">${L(lang, "pour", "for")} ${h.nights} ${L(lang, "nuit(s)", "night(s)")}</span></p>
    <a class="btn btn-red" href="${pickLink(lang, "hotels", vals, note)}">${L(lang, "Choisir cet hôtel", "Choose this hotel")}</a></div></article>`;
}

function flightCard(lang, f, vals, test) {
  const slice = (s) => html`<div class="leg"><b>${hm(s.dep)}</b> ${s.from} → <b>${hm(s.arr)}</b> ${s.to} <span class="muted small">${dm(s.dep)} · ${isoDuration(s.duration)} · ${s.stops ? `${s.stops} ${L(lang, "escale(s)", "stop(s)")} (${s.via})` : L(lang, "direct", "direct")}</span><br><span class="muted small">${s.flights}${s.bags != null ? ` · ${s.bags} ${L(lang, "bagage(s) en soute", "checked bag(s)")}` : ""}</span></div>`;
  const note = `${L(lang, "Vol choisi en ligne", "Flight picked online")}${test ? " [TEST]" : ""} : ${f.airline} · ${f.slices.map((s) => `${s.from}-${s.to} ${dm(s.dep)} ${hm(s.dep)} ${s.flights}`).join(" | ")} · ${money2(f.amount, f.currency)} · Duffel ${f.id}`;
  return html`<article class="card live-card flight">
    <div class="live-b"><h3>${f.logo && /^https:\/\//.test(f.logo) ? raw(`<img class="logo-air" src="${esc(f.logo)}" alt="" width="28" height="28" referrerpolicy="no-referrer"> `) : ""}${f.airline}</h3>
    ${f.slices.map(slice)}
    <p class="small">${f.refundable ? L(lang, "Remboursable avant le départ (frais possibles)", "Refundable before departure (fees may apply)") : L(lang, "Non remboursable", "Non-refundable")} · ${f.changeable ? L(lang, "modifiable", "changeable") : L(lang, "non modifiable", "not changeable")}</p>
    <p class="price">${money2(f.amount, f.currency)}</p>
    <a class="btn btn-red" href="${pickLink(lang, "flights", vals, note)}">${L(lang, "Choisir ce vol", "Choose this flight")}</a></div></article>`;
}

function offerCard(lang, service, o) {
  return html`<article class="offer card">${o.image_url ? raw(`<img src="${esc(o.image_url)}" alt="" loading="lazy" width="640" height="400">`) : ""}
    <div class="offer-b"><h3>${lang === "en" ? o.title_en : o.title_fr}</h3><p class="muted">${o.area || ""}${o.capacity ? " · " + o.capacity + L(lang, " pers.", " guests") : ""}${o.bedrooms != null ? " · " + o.bedrooms + L(lang, " ch.", " bd") : ""}</p>
    <p>${lang === "en" ? o.desc_en : o.desc_fr}</p>
    ${o.price_fils ? html`<p class="price">${L(lang, "À partir de", "From")} <b>${fmtAED(o.price_fils)}</b> / ${o.unit}</p><p class="muted small">${L(lang, "Prix indicatif communiqué par le partenaire, à confirmer selon vos dates.", "Indicative price from the partner, to be confirmed for your dates.")}</p>` : ""}
    ${(lang === "en" ? o.terms_en : o.terms_fr) ? html`<details><summary>${L(lang, "Conditions", "Terms")}</summary><p>${lang === "en" ? o.terms_en : o.terms_fr}</p></details>` : ""}
    <a class="btn btn-red" href="/${lang}/${service}?offer_id=${o.id}#form">${L(lang, "Demander cette offre", "Request this offer")}</a></div></article>`;
}

function shoppingExtra(lang) {
  const zones = [["deira", "Deira", L(lang, "Grossistes, souks et commerce de gros historique autour de la crique.", "Wholesalers and historic trading souks around the creek.")],
    ["goldsouk", "Naif & Gold Souk", L(lang, "Marchés traditionnels de Deira : textile, accessoires, bijoux.", "Deira's traditional markets: textiles, accessories, jewellery.")],
    ["burdubai", "Bur Dubai", L(lang, "Souk des tissus et commerces de détail.", "Textile souk and retail shops.")],
    ["dragonmart", "Dragon Mart", L(lang, "Vaste centre de commerce de gros, près d'International City.", "Large wholesale trading centre near International City.")]];
  const services = L(lang, "Accompagnement commercial|Guide francophone|Interprète|Recherche de fournisseurs|Visites de grossistes|Organisation de rendez-vous|Assistance aux achats|Transport local|Coordination des bagages|Orientation vers les transitaires", "Business support|French-speaking guide|Interpreter|Supplier sourcing|Wholesaler visits|Meeting scheduling|Purchase assistance|Local transport|Baggage coordination|Introductions to freight forwarders").split("|");
  const pk = L(lang, "Demi-journée|Journée|Trois jours|Séjour complet|Sur mesure", "Half day|Full day|Three days|Full stay|Custom").split("|");
  return html`<ul class="chips">${services.map((s) => html`<li>${s}</li>`)}</ul>
  <h2 class="h2">${L(lang, "Zones commerciales", "Trading districts")}</h2>
  <div class="zones">${zones.map(([k, n, d]) => html`<figure class="zone">${img(k, lang, { sizes: "(max-width:700px) 100vw, 25vw" })}<figcaption><b>${n}</b><span>${d}</span></figcaption></figure>`)}</div>
  <h2 class="h2">${L(lang, "Forfaits", "Packages")}</h2><div class="pkgs">${pk.map((p) => html`<article class="pkg"><h3>${p}</h3><a class="btn btn-ghost" href="#form">${L(lang, "Devis", "Quote")}</a></article>`)}</div>
  <p class="muted small">${L(lang, "Les photos de commerçants partenaires seront ajoutées avec leur autorisation.", "Photos of partner traders will be added with their permission.")}</p>`;
}
function activitiesExtra(lang) {
  const a = [["activities", "Desert Safari"], ["dhow", L(lang, "Croisière en dhow", "Dhow cruise")], ["burj", "Burj Khalifa"], ["frame", "Dubai Frame"], ["miracle", L(lang, "Sorties en famille", "Family outings")], ["metro", L(lang, "Visite de Dubaï", "City tour")]];
  return html`<div class="zones">${a.map(([k, n]) => html`<figure class="zone">${img(k, lang, { sizes: "(max-width:700px) 100vw, 33vw" })}<figcaption><b>${n}</b><span>${L(lang, "Durée, inclusions, prix et créneaux confirmés dans le devis.", "Duration, inclusions, price and slots confirmed in the quote.")}</span></figcaption></figure>`)}</div>`;
}
function packagesExtra(lang, packages) {
  return html`<div class="pkgs big">${packages.map((p) => html`<article class="pkg"><h3>${p.name}</h3><p>${lang === "en" ? p.tagline_en : p.tagline_fr}</p>
    <ul>${(lang === "en" ? p.includes_en : p.includes_fr).split("|").map((i) => html`<li>${i}</li>`)}</ul>
    ${p.price_from_fils ? html`<p class="price">${L(lang, "À partir de", "From")} <b>${fmtAED(p.price_from_fils)}</b></p>` : html`<p class="muted small">${L(lang, "Prix sur devis", "Price on quote")}</p>`}</article>`)}</div>`;
}

// ---------- Teranga Food ----------
export function foodPage(lang, env, { user, restaurants, menus, vals, error }) {
  const c = SERVICES.food[lang];
  const kinds = [["plat", L(lang, "Plats", "Mains")], ["entree", L(lang, "Entrées & snacks", "Starters & snacks")], ["boisson", L(lang, "Boissons", "Drinks")]];
  const body = html`
  <section class="food-hero"><div class="food-hero-img">${img("food", lang, { eager: true, sizes: "100vw" })}</div>
    <div class="wrap food-hero-txt"><p class="kicker">TERANGA FOOD</p><h1>${c.title}</h1><p class="lead">${c.lead}</p>
    <a class="btn btn-red btn-lg" href="#commander">${L(lang, "Commander", "Order")}</a></div></section>
  <div class="wrap section">
    ${restaurants.length ? html`<section id="commander"><h2 class="h2">${L(lang, "Restaurants partenaires", "Partner restaurants")}</h2>
      ${restaurants.map((r) => restaurantBlock(lang, env, r, menus[r.id] || [], user))}</section>`
      : html`<div class="notice" id="commander"><strong>${L(lang, "Restaurants partenaires en cours de référencement", "Partner restaurants being onboarded")}</strong>
        <p>${L(lang, "Aucun restaurant partenaire n'a encore publié son menu et ses prix sur la plateforme. En attendant, faites une demande ci-dessous : notre équipe la transmet aux restaurants sénégalais et africains de Dubaï et vous confirme disponibilité, prix et livraison avant tout paiement.", "No partner restaurant has published its menu and prices on the platform yet. Meanwhile, send a request below: our team passes it on to Senegalese and African restaurants in Dubai and confirms availability, price and delivery before any payment.")}</p>
        <p><a href="/${lang}/partners">${L(lang, "Vous êtes restaurateur ? Devenez partenaire.", "Own a restaurant? Become a partner.")}</a></p></div>`}

    ${kinds.map(([k, label]) => html`<h2 class="h2">${label}</h2><div class="dishes">${DISHES.filter((d) => d.kind === k).map((d) => dishCard(lang, d))}</div>`)}
    <h2 class="h2">${L(lang, "Autres cuisines africaines", "Other African cuisines")}</h2>
    <ul class="chips">${Object.values(CUISINES).map((cz) => html`<li>${lang === "en" ? cz[1] : cz[0]}</li>`)}</ul>
    <p class="muted small">${L(lang, "Photos d'illustration de la recette (Wikimedia Commons, voir crédits). Variantes, accompagnements, allergènes et prix sont ceux indiqués par chaque restaurant partenaire.", "Photos illustrate the recipe (Wikimedia Commons, see credits). Variants, sides, allergens and prices are those stated by each partner restaurant.")}</p>

    <div class="formwrap" id="form"><div><h2 class="h2">${L(lang, "Demande de repas ou traiteur", "Meal or catering request")}</h2>${onRequest(lang)}</div>
      <div>${error ? html`<div class="alert" role="alert">${errorText(lang, error)}</div>` : ""}${requestForm(lang, env, "food", { vals, user })}</div></div>
  </div>`;
  return layout(lang, { title: c.title, description: c.lead, path: `/${lang}/food`, body, user, active: "food" });
}
function dishCard(lang, d) {
  const [name, desc] = d[lang];
  const im = DISH_IMAGES[d.key];
  return html`<article class="dish${d.star ? " dish-star" : ""}">${im ? img(null, lang, { source: { ...im, alt: name, alt_en: name }, sizes: "(max-width:700px) 50vw, 25vw" }) : html`<div class="dish-ph" aria-hidden="true">${name[0]}</div>`}
    <div><h3>${name}</h3><p>${desc}</p></div></article>`;
}
function restaurantBlock(lang, env, r, items, user) {
  return html`<article class="resto card" data-restaurant="${r.id}" data-fee="${r.delivery_fee_fils}" data-min="${r.min_order_fils}">
    <header><h3>${r.name}</h3><p class="muted">${r.area} · ${(CUISINES[r.cuisine] || CUISINES.other)[lang === "en" ? 1 : 0]}${r.hours ? " · " + r.hours : ""}</p>
    <p class="small">${L(lang, "Livraison", "Delivery")} ${fmtAED(r.delivery_fee_fils) || L(lang, "offerte", "free")}${r.min_order_fils ? " · " + L(lang, "minimum", "minimum") + " " + fmtAED(r.min_order_fils) : ""}</p></header>
    <ul class="menu-list">${items.map((m) => html`<li><div><b>${lang === "en" ? m.name_en : m.name_fr}</b><span class="small muted">${lang === "en" ? m.desc_en : m.desc_fr}</span>
      ${m.allergens ? html`<span class="small">${L(lang, "Allergènes", "Allergens")} : ${m.allergens}</span>` : ""}</div>
      <div class="menu-act"><span class="price">${fmtAED(m.price_fils)}</span><button class="btn btn-red btn-sm" type="button" data-add='${raw(esc(JSON.stringify({ id: m.id, n: lang === "en" ? m.name_en : m.name_fr, p: m.price_fils })))}'>+ ${L(lang, "Ajouter", "Add")}</button></div></li>`)}</ul>
    <form class="cart" method="post" action="/${lang}/food/order" data-cart hidden>
      <h4>${L(lang, "Votre panier", "Your cart")}</h4><ul data-lines></ul>
      <p class="small">${L(lang, "Sous-total", "Subtotal")} <b data-sub></b> · ${L(lang, "Livraison", "Delivery")} <b>${fmtAED(r.delivery_fee_fils) || "0 AED"}</b> · ${L(lang, "Total", "Total")} <b data-total></b></p>
      <input type="hidden" name="restaurant_id" value="${r.id}"><input type="hidden" name="cart" data-cart-json>
      <fieldset class="grid2"><legend>${L(lang, "Livraison", "Delivery")}</legend>
        <label class="fld wide"><span>${L(lang, "Adresse de livraison", "Delivery address")} *</span><input name="address" required maxlength="240" autocomplete="street-address"></label>
        <label class="fld"><span>${L(lang, "Horaire souhaité", "Preferred time")} *</span><input name="slot" required maxlength="40" placeholder="${L(lang, "Aujourd'hui 20h", "Today 8pm")}"></label>
        <label class="fld"><span>${L(lang, "Instructions", "Instructions")}</span><input name="note" maxlength="500"></label></fieldset>
      ${contactFields(lang, {}, user)} ${turnstile(env)}
      <p class="small muted">${L(lang, "Le restaurant confirme la commande et l'heure de livraison. Le paiement se fait selon les modalités indiquées dans la confirmation (lien de paiement, virement ou à la livraison si le restaurant l'accepte).", "The restaurant confirms the order and delivery time. Payment follows the terms in the confirmation (payment link, transfer, or on delivery if the restaurant accepts it).")}</p>
      <button class="btn btn-red btn-lg" type="submit">${L(lang, "Envoyer la commande", "Send order")}</button>
    </form></article>`;
}

// ---------- Suivi ----------
export function trackPage(lang, { user, row, history = [], payments = [], error, key, created, fx = {} }) {
  const isFood = row?.kind === "food";
  const st = row ? (isFood ? FOOD_STATUS : STATUS)[row.status] : null;
  const link = row && key ? `/${lang}/track?ref=${row.ref}&key=${key}` : "";
  const body = html`<div class="wrap section narrow">
    <h1 class="h1">${t(lang, "track")}</h1>
    ${created ? html`<div class="success" role="status"><h2>${L(lang, "Merci ! Votre demande est enregistrée.", "Thank you! Your request is registered.")}</h2>
      <p>${L(lang, "Référence", "Reference")} : <b class="ref">${row.ref}</b></p>
      <p>${L(lang, "Conservez ce lien personnel pour suivre votre dossier :", "Keep this personal link to follow your file:")}<br><a href="${link}" class="break">${link}</a></p>
      <p><a class="btn btn-wa" href="${waLink(lang, L(lang, "ma demande", "my request"), row.ref)}" rel="noopener">${icon("wa")} ${L(lang, "Confirmer sur WhatsApp", "Confirm on WhatsApp")}</a>
      ${user ? "" : html` <a class="btn btn-ghost" href="/${lang}/account">${L(lang, "Créer mon espace client", "Create my account")}</a>`}</p></div>` : ""}
    ${error ? html`<div class="alert" role="alert">${errorText(lang, error)}</div>` : ""}
    ${!row ? html`<form class="card form" method="get" action="/${lang}/track"><label class="fld"><span>${L(lang, "Référence (TD-… ou TF-…)", "Reference (TD-… or TF-…)")}</span><input name="ref" required pattern="T[DF]-[A-Z2-9]{8}" autocapitalize="characters"></label>
      <label class="fld"><span>${L(lang, "Clé de suivi (dans votre lien)", "Tracking key (in your link)")}</span><input name="key" required pattern="[0-9a-f]{32}"></label>
      <button class="btn btn-red">${L(lang, "Suivre", "Track")}</button><p class="small muted">${L(lang, "Connecté(e) ? Vos dossiers sont dans", "Signed in? Your files are in")} <a href="/${lang}/account">${t(lang, "account")}</a>.</p></form>` : html`
    <article class="card">
      <h2>${isFood ? L(lang, "Commande", "Order") : SERVICES[row.service]?.[lang].name} · <span class="ref">${row.ref}</span></h2>
      <p class="status status-${row.status}">${lang === "en" ? st[1] : st[0]}</p>
      ${isFood ? foodSummary(lang, row) : requestSummary(lang, row, key, fx)}
      ${payments.length ? html`<h3>${L(lang, "Paiements enregistrés", "Recorded payments")}</h3><ul>${payments.map((p) => html`<li>${p.created_at.slice(0, 10)} · ${fmtAED(p.amount_fils)} · ${p.kind} · ${p.status === "verified" ? L(lang, "vérifié", "verified") : p.status}</li>`)}</ul>` : ""}
      <h3>${L(lang, "Historique", "History")}</h3><ol class="timeline">${history.map((h) => html`<li><time>${h.at.replace("T", " ").slice(0, 16)}</time> ${((isFood ? FOOD_STATUS : STATUS)[h.to_status] || [h.to_status, h.to_status])[lang === "en" ? 1 : 0]}</li>`)}</ol>
      <p><a class="btn btn-wa" href="${waLink(lang, L(lang, "mon dossier", "my file"), row.ref)}" rel="noopener">${icon("wa")} ${L(lang, "Assistance WhatsApp", "WhatsApp support")}</a></p>
    </article>`}
  </div>`;
  return layout(lang, { title: t(lang, "track"), path: `/${lang}/track`, body, user, noindex: true });
}
function requestSummary(lang, row, key, fx = {}) {
  const f = JSON.parse(row.fields || "{}"), def = SERVICES[row.service];
  const label = (n) => { const x = def?.fields.find((y) => y.name === n); return x ? (lang === "en" ? x.en : x.fr) : n; };
  const hidden = key ? raw(`<input type="hidden" name="key" value="${esc(key)}">`) : "";
  return html`<dl class="kv">${Object.entries(f).map(([k, val]) => html`<dt>${label(k)}</dt><dd>${val}</dd>`)}</dl>
  ${row.amount_fils ? html`<div class="quote"><h3>${L(lang, "Devis", "Quote")}</h3><p class="price">${L(lang, "Total", "Total")} : <b>${fmtAED(row.amount_fils)}</b>${row.deposit_fils ? html` · ${L(lang, "acompte demandé", "deposit")} : <b>${fmtAED(row.deposit_fils)}</b>` : ""}</p>
    <p class="small muted">${L(lang, "Devise facturée : AED (dirham des Émirats).", "Billing currency: AED (UAE dirham).")}${row.quote_expires ? " " + L(lang, "Valable jusqu'au ", "Valid until ") + row.quote_expires + "." : ""}</p>
    ${fx.fx_eur && fx.fx_date ? html`<p class="small muted">${L(lang, "Indicatif", "Indicative")} : ≈ ${(row.amount_fils / 100 * Number(fx.fx_eur)).toFixed(0)} EUR · ≈ ${Math.round(row.amount_fils / 100 * Number(fx.fx_eur) * 655.957).toLocaleString("fr-FR")} FCFA (${L(lang, "taux du", "rate of")} ${fx.fx_date})</p>` : ""}
    ${row.quote_text ? html`<p class="pre">${row.quote_text}</p>` : ""}
    ${row.status === "quoted" ? html`<form method="post" action="/${lang}/track/accept"><input type="hidden" name="ref" value="${row.ref}">${hidden}
      <label class="check"><input type="checkbox" name="agree" required> <span>${L(lang, "J'accepte ce devis et les conditions d'annulation et de remboursement.", "I accept this quote and the cancellation and refund terms.")}</span></label>
      <button class="btn btn-red">${L(lang, "Accepter le devis", "Accept the quote")}</button></form>` : ""}
    ${row.status === "accepted" ? html`<div class="notice">${fx.pay_instructions ? html`<p class="pre">${fx.pay_instructions}</p>` : ""}<p>${L(lang, "Devis accepté. Un conseiller vous envoie les instructions de paiement (lien de paiement sécurisé, virement ou Wave selon disponibilité). Votre réservation sera faite et confirmée après vérification du paiement.", "Quote accepted. An adviser will send payment instructions (secure payment link, bank transfer or Wave where available). Your booking will be made and confirmed once payment is verified.")}</p></div>` : ""}
  </div>` : ""}
  ${row.supplier_ref ? html`<p>${L(lang, "Référence prestataire", "Supplier reference")} : <b>${row.supplier_ref}</b></p>` : ""}
  ${["new", "review", "quoted"].includes(row.status) ? html`<form method="post" action="/${lang}/track/cancel" data-confirm="${L(lang, "Annuler cette demande ?", "Cancel this request?")}"><input type="hidden" name="ref" value="${row.ref}">${hidden}<button class="btn btn-ghost btn-sm">${L(lang, "Annuler ma demande", "Cancel my request")}</button></form>` : ""}`;
}
function foodSummary(lang, row) {
  const items = JSON.parse(row.items || "[]");
  return html`<ul>${items.map((i) => html`<li>${i.qty} × ${lang === "en" ? i.name_en : i.name_fr} — ${fmtAED(i.price_fils * i.qty)}</li>`)}</ul>
  <p>${L(lang, "Livraison", "Delivery")} : ${fmtAED(row.delivery_fee_fils) || "0 AED"} · <b>${L(lang, "Total", "Total")} : ${fmtAED(row.total_fils)}</b></p>
  <p class="small">${row.address} · ${row.slot}</p><p class="small muted">${L(lang, "Paiement", "Payment")} : ${row.payment_status}</p>`;
}

// ---------- Contact, partenaires, mentions ----------
export function contactPage(lang, env, { user, vals, error, sent }) {
  const body = html`${hero(lang, "packages", t(lang, "contact"), L(lang, "Une équipe à Dubaï, joignable sur WhatsApp en français et en anglais.", "A team in Dubai, reachable on WhatsApp in French and English."))}
  <div class="wrap section formwrap"><div>
    <p><a class="btn btn-wa btn-lg" href="${waLink(lang)}" rel="noopener">${icon("wa")} ${BRAND.phone}</a></p>
    <p>${L(lang, "Lien direct", "Direct link")} : <a href="${BRAND.wa}">${BRAND.wa.replace("https://", "")}</a></p>
    <p class="muted">${L(lang, "Pour une réservation, utilisez de préférence le formulaire du service concerné : votre dossier sera suivi avec une référence.", "For a booking, please use the relevant service form so your file is tracked with a reference.")}</p></div>
    <div>${sent ? html`<div class="success">${L(lang, "Message reçu. Nous vous répondons rapidement.", "Message received. We'll reply shortly.")}</div>` : ""}
    ${error ? html`<div class="alert" role="alert">${errorText(lang, error)}</div>` : ""}
    <form class="card form" method="post" action="/${lang}/contact"><fieldset><legend>${L(lang, "Votre message", "Your message")}</legend>
      <label class="fld wide"><span>${L(lang, "Message", "Message")} *</span><textarea name="message" rows="5" required maxlength="2000">${v(vals, "message")}</textarea></label></fieldset>
      ${contactFields(lang, vals, user)} ${turnstile(env)}<button class="btn btn-red">${L(lang, "Envoyer", "Send")}</button></form></div></div>`;
  return layout(lang, { title: t(lang, "contact"), path: `/${lang}/contact`, body, user, active: "contact" });
}

export function partnersInfoPage(lang, { user }) {
  const cats = L(lang, "Hôtels|Appartements|Restaurants|Transporteurs|Chauffeurs|Guides|Agences|Prestataires d'activités|Logistique", "Hotels|Apartments|Restaurants|Transport companies|Drivers|Guides|Agencies|Activity providers|Logistics").split("|");
  const body = html`${hero(lang, "deira", L(lang, "Devenir partenaire", "Become a partner"), L(lang, "Proposez vos offres aux voyageurs africains à Dubaï. Chaque partenaire est vérifié par notre équipe avant publication.", "Offer your services to African travellers in Dubai. Every partner is verified by our team before publication."))}
  <div class="wrap section"><ul class="chips">${cats.map((c) => html`<li>${c}</li>`)}</ul>
  <ol class="steps"><li><b>1</b><h3>${L(lang, "Créez votre compte", "Create your account")}</h3><p>${L(lang, "Inscrivez-vous puis complétez votre profil professionnel.", "Sign up, then complete your business profile.")}</p></li>
  <li><b>2</b><h3>${L(lang, "Validation", "Verification")}</h3><p>${L(lang, "Nous vérifions votre licence commerciale et les autorisations nécessaires (ex. location courte durée).", "We check your trade licence and required permits (e.g. short-term rental).")}</p></li>
  <li><b>3</b><h3>${L(lang, "Publication", "Publishing")}</h3><p>${L(lang, "Vous ajoutez offres, menus, photos et tarifs. Chaque publication est relue par l'administration.", "You add offers, menus, photos and prices. Each listing is reviewed by our team.")}</p></li></ol>
  <p><a class="btn btn-red btn-lg" href="/${lang}/partner">${L(lang, "Accéder à l'espace partenaire", "Go to the partner area")}</a></p></div>`;
  return layout(lang, { title: L(lang, "Partenaires", "Partners"), path: `/${lang}/partners`, body, user });
}

export function creditsPage(lang, { user }) {
  const all = [...Object.values(IMAGES), ...Object.values(DISH_IMAGES)];
  const body = html`<div class="wrap section narrow"><h1 class="h1">${t(lang, "credits")}</h1>
    <p>${L(lang, "Les photographies proviennent de Wikimedia Commons et sont utilisées selon leur licence. Elles illustrent des lieux et des recettes, jamais un établissement partenaire précis.", "Photographs come from Wikimedia Commons and are used under their licence. They illustrate places and recipes, never a specific partner business.")}</p>
    <p>${L(lang, "Logo : TERANGA DUBAI, tous droits réservés.", "Logo: TERANGA DUBAI, all rights reserved.")}</p>
    <ul class="credits">${all.map((i) => html`<li><a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(i.file.replace(/ /g, "_"))}" rel="noopener">${i.file}</a> — ${i.author} — ${i.license}</li>`)}</ul></div>`;
  return layout(lang, { title: t(lang, "credits"), path: `/${lang}/credits`, body, user });
}

export function simplePage(lang, { user, title, path, content, noindex = false }) {
  return layout(lang, { title, path, user, noindex, body: html`<div class="wrap section narrow prose"><h1 class="h1">${title}</h1>${content}</div>` });
}
export function notFound(lang, user) {
  return simplePage(lang, { user, title: L(lang, "Page introuvable", "Page not found"), path: `/${lang}/404`, noindex: true,
    content: html`<p>${L(lang, "Cette page n'existe pas.", "This page does not exist.")}</p><p><a class="btn btn-red" href="/${lang}">${t(lang, "home")}</a></p>` });
}
