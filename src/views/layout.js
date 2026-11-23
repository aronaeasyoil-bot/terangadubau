import { html, raw, esc } from "../lib/util.js";
import { SERVICES } from "../data/services.js";
import { IMAGES } from "../data/images.js";

export const BRAND = {
  name: "TERANGA DUBAI", signature: "Your African Travel Companion",
  phone: "+971 50 764 0753", wa: "https://wa.me/971507640753",
};
export const VERSION = "2026.11.23";

const T = {
  fr: {
    home: "Accueil", contact: "Contact", account: "Mon espace", track: "Suivre un dossier", partners: "Partenaires",
    menu: "Menu", close: "Fermer", lang_switch: "English", book_now: "Réserver maintenant", discover: "Découvrir nos services",
    send: "Envoyer ma demande", name: "Nom complet", email: "E-mail", phone: "Téléphone / WhatsApp",
    consent: "J'accepte que TERANGA DUBAI traite ces informations pour répondre à ma demande (voir la politique de confidentialité).",
    on_request: "Traitement sur demande", on_request_text: "Aucun système de réservation instantanée n'est encore connecté pour ce service. Votre demande crée un dossier suivi : un conseiller vérifie disponibilités et tarifs, puis vous envoie un devis. Aucun paiement n'est demandé avant votre acceptation.",
    footer_tag: "Hébergement, voyages, shopping, restauration et assistance à Dubaï, avec la chaleur de l'accueil africain.",
    legal: "Informations légales", privacy: "Confidentialité", terms: "Conditions générales", cancel: "Annulation", refund: "Remboursement", credits: "Crédits photos",
    services: "Nos services", wa_cta: "Écrire sur WhatsApp", required: "obligatoire",
  },
  en: {
    home: "Home", contact: "Contact", account: "My account", track: "Track a booking", partners: "Partners",
    menu: "Menu", close: "Close", lang_switch: "Français", book_now: "Book now", discover: "Explore our services",
    send: "Send my request", name: "Full name", email: "Email", phone: "Phone / WhatsApp",
    consent: "I agree that TERANGA DUBAI may process this information to answer my request (see the privacy policy).",
    on_request: "Handled on request", on_request_text: "No instant booking system is connected for this service yet. Your request opens a tracked file: an adviser checks availability and prices, then sends you a quote. No payment is requested before you accept.",
    footer_tag: "Accommodation, travel, shopping, food and assistance in Dubai, with the warmth of African hospitality.",
    legal: "Legal", privacy: "Privacy", terms: "Terms", cancel: "Cancellation", refund: "Refunds", credits: "Photo credits",
    services: "Our services", wa_cta: "Message us on WhatsApp", required: "required",
  },
};
export const t = (lang, k) => T[lang]?.[k] ?? T.fr[k] ?? k;
export const L = (lang, fr, en) => (lang === "en" ? en : fr);

export function waLink(lang, subject = "", ref = "") {
  const msg = subject
    ? L(lang, "Bonjour TERANGA DUBAI, je vous contacte au sujet de : ", "Hello TERANGA DUBAI, I'm contacting you about: ") + subject + (ref ? " (" + ref + ")" : "")
    : L(lang, "Bonjour TERANGA DUBAI, je souhaite organiser mon séjour à Dubaï.", "Hello TERANGA DUBAI, I'd like to organise my stay in Dubai.");
  return BRAND.wa + "?text=" + encodeURIComponent(msg);
}

export function img(key, lang, { cls = "", eager = false, sizes = "(max-width: 700px) 100vw, 50vw", source } = {}) {
  const i = source || IMAGES[key];
  if (!i) return "";
  return raw(`<img src="${esc(i.src)}" width="${i.w}" height="${i.h}" alt="${esc(lang === "en" ? (i.alt_en || i.alt || "") : (i.alt || ""))}" class="${esc(cls)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" sizes="${sizes}">`);
}

const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.2-.2-.2-.5-.4Z"/></svg>',
};
export const icon = (k) => raw(ICON[k] || "");

export function layout(lang, { title, description = "", path = "/", body, noindex = false, flash = "", user = null, active = "" }) {
  const other = lang === "fr" ? "en" : "fr";
  const altPath = path.replace(/^\/(fr|en)(?=\/|$)/, "/" + other);
  const canonical = "https://teranga-dubai.arona-easyoil.workers.dev" + path;
  const nav = Object.entries(SERVICES).filter(([, s]) => s.nav);
  return html`<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title ? title + " — " : ""}TERANGA DUBAI · Your African Travel Companion</title>
<meta name="description" content="${description || t(lang, "footer_tag")}">
${noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ""}
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="${lang}" href="${canonical}"><link rel="alternate" hreflang="${other}" href="${"https://teranga-dubai.arona-easyoil.workers.dev" + altPath}">
<meta property="og:title" content="${title || "TERANGA DUBAI"}"><meta property="og:description" content="${description || t(lang, "footer_tag")}">
<meta property="og:image" content="${IMAGES.hero.src}"><meta property="og:type" content="website">
<meta name="theme-color" content="#B5121B">
<link rel="icon" href="/img/icon.png"><link rel="apple-touch-icon" href="/img/icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/app.css?v=${VERSION}">
<script src="/app.js?v=${VERSION}" defer></script>
</head><body>
<a class="skip" href="#main">${L(lang, "Aller au contenu", "Skip to content")}</a>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/${lang}" aria-label="TERANGA DUBAI — ${t(lang, "home")}"><img src="/img/logo.webp" srcset="/img/logo.webp 1x, /img/logo@2x.webp 2x" width="160" height="47" alt="TERANGA DUBAI"></a>
    <nav class="quick" aria-label="${L(lang, "Raccourcis", "Shortcuts")}">
      <a href="/${other}${path.replace(/^\/(fr|en)/, "")}" hreflang="${other}" class="lang">${other.toUpperCase()}</a>
      <a href="/${lang}/account" class="acct">${user ? user.name.split(" ")[0] : t(lang, "account")}</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="menu" data-menu><span></span><span></span><span></span><b class="sr">${t(lang, "menu")}</b></button>
    </nav>
  </div>
  <nav id="menu" class="menu" aria-label="${L(lang, "Navigation principale", "Main navigation")}">
    <div class="wrap menu-in">
      <a href="/${lang}" ${active === "home" ? raw('aria-current="page"') : ""}>${t(lang, "home")}</a>
      ${nav.map(([k, s]) => html`<a href="/${lang}/${k}" ${active === k ? raw('aria-current="page"') : ""}>${s[lang].name}</a>`)}
      <a href="/${lang}/contact" ${active === "contact" ? raw('aria-current="page"') : ""}>${t(lang, "contact")}</a>
      <a href="/${lang}/track" class="m-only">${t(lang, "track")}</a>
      <a href="/${lang}/partners" class="m-only">${t(lang, "partners")}</a>
    </div>
  </nav>
</header>
${flash ? html`<div class="flash wrap" role="status">${flash}</div>` : ""}
<main id="main">${body}</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div><img src="/img/logo.webp" width="140" height="41" alt="TERANGA DUBAI" class="foot-logo" loading="lazy"><p>${t(lang, "footer_tag")}</p>
      <p><a href="${waLink(lang)}" rel="noopener">WhatsApp ${BRAND.phone}</a></p></div>
    <div><h2>${t(lang, "services")}</h2><ul>${nav.map(([k, s]) => html`<li><a href="/${lang}/${k}">${s[lang].name}</a></li>`)}</ul></div>
    <div><h2>TERANGA</h2><ul>
      <li><a href="/${lang}/account">${t(lang, "account")}</a></li><li><a href="/${lang}/track">${t(lang, "track")}</a></li>
      <li><a href="/${lang}/partners">${t(lang, "partners")}</a></li><li><a href="/${lang}/guides">${L(lang, "Guides pratiques", "Travel guides")}</a></li><li><a href="/${lang}/contact">${t(lang, "contact")}</a></li></ul></div>
    <div><h2>${t(lang, "legal")}</h2><ul>
      <li><a href="/${lang}/legal/privacy">${t(lang, "privacy")}</a></li><li><a href="/${lang}/legal/terms">${t(lang, "terms")}</a></li>
      <li><a href="/${lang}/legal/cancellation">${t(lang, "cancel")}</a></li><li><a href="/${lang}/legal/refunds">${t(lang, "refund")}</a></li>
      <li><a href="/${lang}/credits">${t(lang, "credits")}</a></li></ul></div>
  </div>
  <p class="wrap copy">© ${new Date().getUTCFullYear()} TERANGA DUBAI · ${BRAND.signature}</p>
</footer>
<a class="wa-float" href="${waLink(lang)}" rel="noopener" aria-label="${t(lang, "wa_cta")}">${icon("wa")}<span>WhatsApp</span></a>
</body></html>`;
}
