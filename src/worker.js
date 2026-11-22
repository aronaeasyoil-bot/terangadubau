// TERANGA DUBAI — Worker principal (routes publiques, espace client, partenaires, administration).
import { HttpError, fail, page, json, redirect, readForm, str, email as vEmail, phone as vPhone, money, int, longText, oneOf, isoDate, randomHex, base32, verifyTotp, html, newRef, timingSafeEqual, sha256 } from "./lib/util.js";
import { q, uid, throttle, audit, currentUser, startSession, clearCookie, register, login, requireRole, notify } from "./lib/auth.js";
import { createRequest, loadForClient, clientAccept, clientCancel, adminTransition, adminQuote, adminConfirm, recordPayment, verifyPayment, createFoodOrder, foodTransition, STATUS } from "./lib/booking.js";
import { SERVICES, SERVICE_KEYS } from "./data/services.js";
import { L } from "./views/layout.js";
import * as P from "./views/public.js";
import * as V from "./views/portal.js";
import * as A from "./views/admin.js";
import { LEGAL, GUIDES } from "./views/content.js";

const LANGS = ["fr", "en"];
const SITE = "https://teranga-dubai.arona-easyoil.workers.dev";
const commonsUrl = (u) => { if (!u) return null; const s = str(u, 500); if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(s)) fail("invalid_image_url"); return s; };

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        if (request.method === "GET" || request.headers.get("accept")?.includes("json")) return json({ error: e.code }, e.status);
        const lang = langOf(new URL(request.url).pathname);
        return page(P.simplePage(lang, { title: L(lang, "Action impossible", "Action not possible"), path: `/${lang}/error`, noindex: true,
          content: html`<div class="alert">${P.errorText(lang, e.code)}</div><p class="small muted">${e.code}</p><p><a class="btn btn-ghost" href="/${lang}">${L(lang, "Retour à l'accueil", "Back to home")}</a></p>` }), { status: e.status });
      }
      console.error(e && e.stack || e);
      return page(P.simplePage("fr", { title: "Erreur", path: "/fr/error", noindex: true, content: html`<p>Une erreur technique est survenue. Merci de réessayer ou de nous écrire sur WhatsApp au +971 50 764 0753.</p>` }), { status: 500 });
    }
  },
};

const langOf = (path) => (path.split("/")[1] === "en" ? "en" : "fr");

// Protection CSRF : toute requête POST doit venir de notre propre origine.
function sameOrigin(request) {
  const origin = request.headers.get("Origin"), url = new URL(request.url);
  if (origin ? origin !== url.origin : request.headers.get("Sec-Fetch-Site") && request.headers.get("Sec-Fetch-Site") !== "same-origin") fail("bad_origin", 403);
}

async function checkBot(request, env, form) {
  if (form.website) fail("invalid_request");
  if (!env.TURNSTILE_SECRET) return;
  const token = form["cf-turnstile-response"];
  if (!token) fail("captcha_failed");
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get("CF-Connecting-IP") || "" }) });
  const d = await r.json();
  if (!d.success) fail("captcha_failed");
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  if (!["GET", "HEAD", "POST"].includes(method)) return new Response(null, { status: 405 });
  if (method === "POST") sameOrigin(request);
  const user = await currentUser(request, env);

  if (path === "/") {
    const pref = (request.headers.get("Accept-Language") || "").toLowerCase().startsWith("en") ? "en" : "fr";
    return redirect("/" + pref);
  }
  if (path === "/robots.txt") return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /fr/account\nDisallow: /en/account\nDisallow: /fr/track\nDisallow: /en/track\nSitemap: ${SITE}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain" } });
  if (path === "/sitemap.xml") return sitemap();
  if (path === "/health") return json({ ok: true, db: !!env.DB, turnstile: !!env.TURNSTILE_SECRET });
  if (path.startsWith("/admin")) return adminRoutes(request, env, path, url, user);

  const [, lang, section, ...rest] = path.split("/");
  if (!LANGS.includes(lang)) return page(P.notFound("fr", user), { status: 404 });

  if (!section) {
    const packages = (await q(env, "SELECT * FROM packages WHERE status='published' ORDER BY sort").all()).results;
    return page(P.homePage(lang, env, { user, packages }), { cache: user ? "no-store" : "public, max-age=300" });
  }

  // Services
  if (SERVICE_KEYS.includes(section) && !rest.length) {
    if (method === "POST") return submitService(request, env, lang, section, user);
    const vals = Object.fromEntries(url.searchParams);
    return renderService(env, lang, section, user, vals);
  }
  if (section === "food" && rest[0] === "order" && method === "POST") {
    const form = await readForm(request);
    await throttle(request, env, "order", 10);
    await checkBot(request, env, form);
    const { ref, key } = await createFoodOrder(env, { input: form, lang, user });
    return redirect(`/${lang}/track?ref=${ref}&key=${key}&created=1`);
  }

  if (section === "track") {
    if (method === "POST") {
      const form = await readForm(request);
      await throttle(request, env, "track-act", 20);
      const row = await loadForClient(env, form.ref, form.key, user);
      if (rest[0] === "accept") { if (form.agree !== "on") fail("consent_required"); await clientAccept(env, row, user?.id || "client"); }
      else if (rest[0] === "cancel") await clientCancel(env, row, user?.id || "client");
      else fail("not_found", 404);
      return redirect(`/${lang}/track?ref=${row.ref}` + (form.key ? `&key=${form.key}` : ""));
    }
    const ref = url.searchParams.get("ref"), key = url.searchParams.get("key");
    if (!ref) return page(P.trackPage(lang, { user }));
    await throttle(request, env, "track", 60);
    let row;
    try { row = await loadForClient(env, ref.toUpperCase(), key, user); }
    catch (e) { if (e.code === "not_found") return page(P.trackPage(lang, { user, error: "not_found" }), { status: 404 }); throw e; }
    const history = (await q(env, "SELECT * FROM status_history WHERE ref=? ORDER BY id", row.ref).all()).results;
    const payments = (await q(env, "SELECT * FROM payments WHERE ref=? ORDER BY created_at", row.ref).all()).results;
    const fx = Object.fromEntries((await q(env, "SELECT key,value FROM settings WHERE key IN ('fx_eur','fx_date','pay_instructions')").all()).results.map((r) => [r.key, r.value]));
    return page(P.trackPage(lang, { user, row, history, payments, key, fx, created: url.searchParams.get("created") === "1" }), { headers: { "Referrer-Policy": "no-referrer" } });
  }

  if (section === "contact") {
    if (method === "POST") {
      const form = await readForm(request);
      try {
        await throttle(request, env, "contact", 8); await checkBot(request, env, form);
        if (form.consent !== "on") fail("consent_required");
        const fields = { message: longText(form.message, 2000) || fail("missing_field") };
        const ref = newRef("TD");
        await q(env, "INSERT INTO requests(ref,access_hash,user_id,service,lang,name,email,phone,fields) VALUES (?,?,?,?,?,?,?,?,?)",
          ref, randomHex(32), user?.id || null, "contact", lang, str(form.name, 100, true), vEmail(form.email), vPhone(form.phone), JSON.stringify(fields)).run();
        return page(P.contactPage(lang, env, { user, sent: true }));
      } catch (e) { if (e instanceof HttpError && e.status < 500 && e.status !== 403) return page(P.contactPage(lang, env, { user, vals: form, error: e.code }), { status: e.status }); throw e; }
    }
    return page(P.contactPage(lang, env, { user }));
  }

  if (section === "account") return accountRoutes(request, env, lang, rest, url, user);
  if (section === "partner") return partnerRoutes(request, env, lang, rest, user);
  if (section === "partners") return page(P.partnersInfoPage(lang, { user }));
  if (section === "credits") return page(P.creditsPage(lang, { user }), { cache: "public, max-age=3600" });
  if (section === "legal" && LEGAL[rest[0]]) { const [title, content] = LEGAL[rest[0]](lang); return page(P.simplePage(lang, { user, title, content, path: `/${lang}/legal/${rest[0]}` })); }
  if (section === "guides") {
    if (!rest[0]) return page(P.simplePage(lang, { user, title: L(lang, "Guides pratiques", "Travel guides"), path: `/${lang}/guides`,
      content: html`<ul class="guide-list">${Object.entries(GUIDES).map(([slug, g]) => html`<li><a href="/${lang}/guides/${slug}">${g[lang][0]}</a></li>`)}</ul>` }));
    const g = GUIDES[rest[0]];
    if (g) return page(P.simplePage(lang, { user, title: g[lang][0], content: g[lang][1], path: `/${lang}/guides/${rest[0]}` }), { cache: "public, max-age=3600" });
  }
  return page(P.notFound(lang, user), { status: 404 });
}

async function renderService(env, lang, service, user, vals = {}, error = null, status = 200) {
  if (service === "food") {
    const restaurants = (await q(env, "SELECT * FROM restaurants WHERE status='published' ORDER BY name").all()).results;
    const menus = {};
    for (const r of restaurants) menus[r.id] = (await q(env, "SELECT * FROM menu_items WHERE restaurant_id=? AND available=1 ORDER BY name_fr", r.id).all()).results;
    return page(P.foodPage(lang, env, { user, restaurants, menus, vals, error }), { status });
  }
  const offers = (await q(env, `SELECT o.* FROM offers o LEFT JOIN partners p ON p.id=o.partner_id
    WHERE o.service=? AND o.status='published' AND (o.partner_id IS NULL OR p.status='approved') ORDER BY o.updated_at DESC LIMIT 24`, service).all()).results;
  const packages = service === "packages" ? (await q(env, "SELECT * FROM packages WHERE status='published' ORDER BY sort").all()).results : [];
  return page(P.servicePage(lang, env, service, { user, vals, error, offers, packages }), { status });
}

async function submitService(request, env, lang, service, user) {
  const form = await readForm(request);
  try {
    await throttle(request, env, "submit", 15);
    await checkBot(request, env, form);
    const { ref, key } = await createRequest(env, { service, input: form, lang, user });
    return redirect(`/${lang}/track?ref=${ref}&key=${key}&created=1`);
  } catch (e) {
    if (e instanceof HttpError && e.status < 500 && e.status !== 403) return renderService(env, lang, service, user, form, e.code, e.status === 429 ? 429 : 400);
    throw e;
  }
}

// ---------- Espace client ----------
async function accountRoutes(request, env, lang, rest, url, user) {
  const method = request.method;
  if (rest[0] === "login" && method === "POST") {
    const form = await readForm(request);
    try {
      await throttle(request, env, "login", 8);
      const u = await login(env, vEmail(form.email), String(form.password || ""));
      const cookie = await startSession(env, u, 0);
      await audit(env, u.id, "auth.login", "", "", request);
      return redirect(u.role === "admin" ? `/${lang}/account/mfa` : safeNext(form.next, lang), { "Set-Cookie": cookie });
    } catch (e) { if (e instanceof HttpError && e.status < 500) return page(V.authPage(lang, { error: e.code, vals: form }), { status: e.status }); throw e; }
  }
  if (rest[0] === "register" && method === "POST") {
    const form = await readForm(request);
    try {
      await throttle(request, env, "register", 5);
      if (form.consent !== "on") fail("consent_required");
      const u = await register(env, { email: vEmail(form.email), name: str(form.name, 100, true), phone: vPhone(form.phone), country: str(form.country, 60), password: form.password, lang });
      // Rattache les dossiers créés auparavant sans compte avec le même e-mail ? Non : sans vérification de
      // l'adresse, ce serait une fuite. Ils restent accessibles via leur lien de suivi.
      const cookie = await startSession(env, u, 0);
      await audit(env, u.id, "auth.register", "", "", request);
      return redirect(safeNext(form.next, lang), { "Set-Cookie": cookie });
    } catch (e) { if (e instanceof HttpError && e.status < 500) return page(V.authPage(lang, { error: e.code, vals: form }), { status: e.status }); throw e; }
  }
  if (rest[0] === "logout" && method === "POST") {
    if (user) await q(env, "DELETE FROM sessions WHERE token_hash=?", user.token_hash).run();
    return redirect(`/${lang}`, { "Set-Cookie": clearCookie });
  }
  if (!user) return page(V.authPage(lang, { next: url.searchParams.get("next") || "" }));

  if (rest[0] === "mfa") {
    if (user.role !== "admin") return redirect(`/${lang}/account`);
    if (method === "POST") {
      const form = await readForm(request);
      await throttle(request, env, "mfa", 8);
      const row = await q(env, "SELECT totp_secret, totp_enabled FROM users WHERE id=?", user.id).first();
      if (!row.totp_secret || !(await verifyTotp(row.totp_secret, String(form.code || "").trim()))) {
        await audit(env, user.id, "auth.mfa_fail", "", "", request);
        return page(V.mfaPage(lang, { user, secret: row.totp_enabled ? null : row.totp_secret, error: "invalid_code" }), { status: 401 });
      }
      await env.DB.batch([q(env, "UPDATE users SET totp_enabled=1 WHERE id=?", user.id), q(env, "UPDATE sessions SET mfa=1 WHERE token_hash=?", user.token_hash)]);
      await audit(env, user.id, "auth.mfa_ok", "", "", request);
      return redirect("/admin");
    }
    let row = await q(env, "SELECT totp_secret, totp_enabled FROM users WHERE id=?", user.id).first();
    if (!row.totp_enabled && !row.totp_secret) {
      const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
      await q(env, "UPDATE users SET totp_secret=? WHERE id=?", secret, user.id).run();
      row = { totp_secret: secret };
    }
    return page(V.mfaPage(lang, { user, secret: row.totp_enabled ? null : row.totp_secret }));
  }
  if (rest[0] === "invoice" && rest[1]) {
    const inv = await q(env, "SELECT * FROM invoices WHERE number=?", rest[1]).first();
    if (!inv) fail("not_found", 404);
    const req = await q(env, "SELECT name,email,user_id FROM requests WHERE ref=?", inv.ref).first();
    if (user.role !== "admin" && req?.user_id !== user.id) fail("not_found", 404);
    return page(V.invoicePage(lang, { user, inv, req }));
  }
  const requests = (await q(env, "SELECT ref,service,status,amount_fils,created_at FROM requests WHERE user_id=? ORDER BY created_at DESC LIMIT 100", user.id).all()).results;
  const orders = (await q(env, "SELECT f.ref,f.status,f.total_fils,f.created_at,r.name restaurant FROM food_orders f JOIN restaurants r ON r.id=f.restaurant_id WHERE f.user_id=? ORDER BY f.created_at DESC LIMIT 50", user.id).all()).results;
  const notes = (await q(env, "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20", user.id).all()).results;
  const invoices = (await q(env, "SELECT i.* FROM invoices i JOIN requests r ON r.ref=i.ref WHERE r.user_id=? ORDER BY i.created_at DESC", user.id).all()).results;
  ctxMarkRead(env, user.id);
  return page(V.dashboardPage(lang, { user, requests, orders, notes, invoices }));
}
function ctxMarkRead(env, id) { return q(env, "UPDATE notifications SET read=1 WHERE user_id=? AND read=0", id).run(); }
const safeNext = (n, lang) => (typeof n === "string" && /^\/(fr|en)\/[a-z/]*$/.test(n) ? n : `/${lang}/account`);

// ---------- Espace partenaire ----------
async function partnerRoutes(request, env, lang, rest, user) {
  if (!user) return redirect(`/${lang}/account?next=/${lang}/partner`);
  const method = request.method;
  let partner = await q(env, "SELECT * FROM partners WHERE user_id=?", user.id).first();
  if (method === "POST") {
    const form = await readForm(request);
    await throttle(request, env, "partner", 40);
    if (rest[0] === "apply") {
      if (partner) fail("already_applied", 409);
      if (form.consent !== "on") fail("consent_required");
      const id = uid();
      await env.DB.batch([
        q(env, "INSERT INTO partners(id,user_id,company,category,phone,city,licence_no,description) VALUES (?,?,?,?,?,?,?,?)", id, user.id,
          str(form.company, 120, true), oneOf(form.category, ["hotel", "apartment", "restaurant", "transport", "driver", "guide", "agency", "activity", "logistics"]),
          vPhone(form.phone), str(form.city, 80), str(form.licence_no, 60), longText(form.description, 1500)),
        q(env, "UPDATE users SET role='partner' WHERE id=? AND role='client'", user.id)]);
      await audit(env, user.id, "partner.apply", id);
      return redirect(`/${lang}/partner`);
    }
    if (!partner || partner.status !== "approved") fail("forbidden", 403);
    if (rest[0] === "offers") {
      await saveOffer(env, form, partner.id, false);
      await audit(env, user.id, "offer.submit", partner.id);
    } else if (rest[0] === "restaurant") {
      if (partner.category !== "restaurant") fail("forbidden", 403);
      await saveRestaurant(env, form, partner.id, "pending");
    } else if (rest[0] === "menu") {
      const r = await q(env, "SELECT id FROM restaurants WHERE id=? AND partner_id=?", str(form.restaurant_id, 40, true), partner.id).first();
      if (!r) fail("not_found", 404);
      await saveMenuItem(env, form);
    } else if (rest[0] === "food") {
      await foodTransition(env, user, str(form.ref, 20, true), oneOf(form.to, ["restaurant_confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]), partner.id);
    } else fail("not_found", 404);
    return redirect(`/${lang}/partner`);
  }
  if (!partner) return page(V.partnerPage(lang, env, { user }));
  const offers = (await q(env, "SELECT * FROM offers WHERE partner_id=? ORDER BY created_at DESC", partner.id).all()).results;
  const restaurants = (await q(env, "SELECT * FROM restaurants WHERE partner_id=?", partner.id).all()).results;
  const menus = {};
  for (const r of restaurants) menus[r.id] = (await q(env, "SELECT * FROM menu_items WHERE restaurant_id=?", r.id).all()).results;
  const orders = (await q(env, "SELECT f.* FROM food_orders f JOIN restaurants r ON r.id=f.restaurant_id WHERE r.partner_id=? ORDER BY f.created_at DESC LIMIT 50", partner.id).all()).results;
  const requests = (await q(env, "SELECT ref,service,status,fields FROM requests WHERE partner_id=? AND status IN ('paid','supplier_pending','confirmed') ORDER BY updated_at DESC", partner.id).all()).results;
  const commissions = (await q(env, "SELECT * FROM commissions WHERE partner_id=? ORDER BY created_at DESC", partner.id).all()).results;
  return page(V.partnerPage(lang, env, { user, partner, offers, restaurants, menus, orders, requests, commissions }));
}

async function saveOffer(env, f, partnerId, admin) {
  const service = oneOf(f.service, SERVICE_KEYS.filter((k) => k !== "food"));
  const vals = [service, str(f.title_fr, 140, true), str(f.title_en, 140, true), longText(f.desc_fr, 2000), longText(f.desc_en, 2000), str(f.area, 80),
    int(f.capacity, 0, 500), int(f.bedrooms, 0, 50), money(f.price), str(f.unit, 30) || "nuit", longText(f.terms_fr, 2000), longText(f.terms_en, 2000), admin ? commonsUrl(f.image_url) : null];
  if (admin && f.id) {
    await q(env, `UPDATE offers SET service=?,title_fr=?,title_en=?,desc_fr=?,desc_en=?,area=?,capacity=?,bedrooms=?,price_fils=?,unit=?,terms_fr=?,terms_en=?,image_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...vals, str(f.id, 40)).run();
  } else {
    await q(env, `INSERT INTO offers(id,partner_id,service,title_fr,title_en,desc_fr,desc_en,area,capacity,bedrooms,price_fils,unit,terms_fr,terms_en,image_url,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      uid(), partnerId, ...vals, admin ? "draft" : "pending").run();
  }
}
async function saveRestaurant(env, f, partnerId, status) {
  await q(env, `INSERT INTO restaurants(id,partner_id,name,area,cuisine,phone,hours,delivery_fee_fils,min_order_fils,status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    uid(), partnerId, str(f.name, 120, true), str(f.area, 80, true), oneOf(f.cuisine || "senegal", ["senegal", "cotedivoire", "mali", "guinee", "nigeria", "other"]),
    f.phone ? vPhone(f.phone) : null, str(f.hours, 80), f.delivery_fee === "0" ? 0 : (money(f.delivery_fee) || 0), f.min_order === "0" ? 0 : (money(f.min_order) || 0), status).run();
}
async function saveMenuItem(env, f) {
  await q(env, `INSERT INTO menu_items(id,restaurant_id,dish_key,name_fr,name_en,desc_fr,desc_en,ingredients,allergens,price_fils) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    uid(), str(f.restaurant_id, 40, true), str(f.dish_key, 40) || null, str(f.name_fr, 120, true), str(f.name_en, 120, true), str(f.desc_fr, 400), str(f.desc_en, 400),
    str(f.ingredients, 400), str(f.allergens, 200), money(f.price, true)).run();
}

// ---------- Administration ----------
async function adminRoutes(request, env, path, url, user) {
  const method = request.method;
  if (path === "/admin/setup") {
    const hasAdmin = await q(env, "SELECT 1 FROM users WHERE role='admin'").first();
    if (hasAdmin || !env.ADMIN_SETUP_CODE) return page(P.notFound("fr", user), { status: 404 });
    if (method !== "POST") return page(A.adminSetupPage());
    const form = await readForm(request);
    await throttle(request, env, "setup", 5);
    if (!timingSafeEqual(await sha256(String(form.setup_code || "")), await sha256(env.ADMIN_SETUP_CODE))) {
      await audit(env, null, "admin.setup_fail", "", "", request);
      return page(A.adminSetupPage("Code d'installation invalide."), { status: 401 });
    }
    if (typeof form.password !== "string" || form.password.length < 14) return page(A.adminSetupPage("Mot de passe trop court (14 caractères minimum)."), { status: 400 });
    const u = await register(env, { email: vEmail(form.email), name: str(form.name, 100, true), phone: vPhone(form.phone), country: "AE", password: form.password, lang: "fr", role: "admin" });
    await audit(env, u.id, "admin.setup", u.id, "", request);
    const cookie = await startSession(env, u, 0);
    return redirect("/fr/account/mfa", { "Set-Cookie": cookie });
  }
  if (!user) return redirect("/fr/account?next=/fr/account/mfa");
  if (user.role === "admin" && !user.mfa) return redirect("/fr/account/mfa");
  requireRole(user, "admin");
  const seg = path.split("/").slice(2);
  const back = (to, msg = "") => redirect(to + (msg ? (to.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(msg) : ""));
  const okMsg = url.searchParams.get("ok") || "";

  if (method === "POST") {
    const f = await readForm(request);
    const [a, b, c] = seg;
    if (a === "requests" && b && c === "status") { await adminTransition(env, user, b, str(f.to, 30, true), str(f.note, 300)); return back(`/admin/requests/${b}`, "Statut mis à jour"); }
    if (a === "requests" && b && c === "quote") {
      await adminQuote(env, user, b, { amount_fils: money(f.amount, true), deposit_fils: money(f.deposit), quote_text: longText(f.text, 4000) || fail("missing_field"), quote_expires: isoDate(f.expires), partner_id: str(f.partner_id, 40) || null });
      return back(`/admin/requests/${b}`, "Devis publié");
    }
    if (a === "requests" && b && c === "confirm") { await adminConfirm(env, user, b, str(f.supplier_ref, 80, true)); return back(`/admin/requests/${b}`, "Réservation confirmée"); }
    if (a === "requests" && b && c === "invoice") {
      const r = await q(env, "SELECT * FROM requests WHERE ref=?", b).first();
      if (!r?.amount_fils) fail("not_found", 404);
      const n = (await q(env, "SELECT COUNT(*) n FROM invoices").first()).n + 1;
      const number = `TD${new Date().getUTCFullYear()}-${String(n).padStart(5, "0")}`;
      await q(env, "INSERT INTO invoices(number,ref,amount_fils,issued_by) VALUES (?,?,?,?)", number, b, r.amount_fils, user.id).run();
      await notify(env, r.user_id, b, `Facture ${number} disponible.`, `Invoice ${number} available.`);
      await audit(env, user.id, "invoice.issue", b, number);
      return back(`/admin/requests/${b}`, "Facture " + number + " émise");
    }
    if (a === "payments" && !b) {
      const ref = str(f.ref, 20, true);
      await recordPayment(env, user, { ref, kind: oneOf(f.kind, ["deposit", "full", "balance", "refund"]), method: oneOf(f.method, ["bank_transfer", "payment_link", "cash", "wave", "card", "other"]),
        amount_fils: money(f.amount, true), status: oneOf(f.status, ["pending", "verified", "failed"]), provider_ref: str(f.provider_ref, 120), note: str(f.note, 300) });
      return back(ref.startsWith("TF") ? "/admin/food" : `/admin/requests/${ref}`, "Paiement enregistré");
    }
    if (a === "payments" && b && c === "verify") {
      await verifyPayment(env, user, b);
      return back(/^\/admin\/[a-z/A-Z0-9-]*$/.test(f.back || "") ? f.back : "/admin/payments", "Paiement vérifié");
    }
    if (a === "food" && b === "status") { await foodTransition(env, user, str(f.ref, 20, true), str(f.to, 30, true)); return back("/admin/food", "Commande mise à jour"); }
    if (a === "partners" && b) {
      if (f.action === "commission") { const pct = Number(String(f.commission).replace(",", ".")); if (!(pct >= 0 && pct <= 100)) fail("invalid_number"); await q(env, "UPDATE partners SET commission_pct=? WHERE id=?", pct, b).run(); }
      else await q(env, "UPDATE partners SET status=? WHERE id=?", oneOf(f.action, ["approved", "rejected", "suspended"]), b).run();
      const p = await q(env, "SELECT user_id FROM partners WHERE id=?", b).first();
      if (p && f.action !== "commission") await notify(env, p.user_id, null, `Statut partenaire : ${f.action}.`, `Partner status: ${f.action}.`);
      await audit(env, user.id, "partner." + f.action, b, f.commission || "");
      return back("/admin/partners", "Partenaire mis à jour");
    }
    if (a === "offers" && !b) { await saveOffer(env, f, null, true); await audit(env, user.id, "offer.save", f.id || "new"); return back("/admin/offers", "Offre enregistrée"); }
    if (a === "offers" && b && c === "status") { await q(env, "UPDATE offers SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", oneOf(f.status, ["published", "archived", "draft"]), b).run(); await audit(env, user.id, "offer.status", b, f.status); return back("/admin/offers", "Offre mise à jour"); }
    if (a === "restaurants" && !b) { await saveRestaurant(env, f, null, "draft"); await audit(env, user.id, "restaurant.create", f.name); return back("/admin/restaurants", "Restaurant créé"); }
    if (a === "restaurants" && b && c === "status") { await q(env, "UPDATE restaurants SET status=? WHERE id=?", oneOf(f.status, ["published", "suspended", "draft"]), b).run(); await audit(env, user.id, "restaurant.status", b, f.status); return back("/admin/restaurants", "Restaurant mis à jour"); }
    if (a === "menu" && !b) { await saveMenuItem(env, f); await audit(env, user.id, "menu.add", f.restaurant_id); return back("/admin/restaurants", "Plat ajouté"); }
    if (a === "menu" && b && c === "toggle") { await q(env, "UPDATE menu_items SET available = 1 - available WHERE id=?", b).run(); return back("/admin/restaurants"); }
    if (a === "packages" && b) {
      await q(env, "UPDATE packages SET tagline_fr=?, tagline_en=?, includes_fr=?, includes_en=?, price_from_fils=?, status=? WHERE slug=?",
        str(f.tagline_fr, 200, true), str(f.tagline_en, 200, true), longText(f.includes_fr, 2000), longText(f.includes_en, 2000), money(f.price), oneOf(f.status, ["published", "draft"]), b).run();
      await audit(env, user.id, "package.update", b); return back("/admin/packages", "Forfait enregistré");
    }
    if (a === "commissions" && b) { await q(env, "UPDATE commissions SET status='settled' WHERE id=?", b).run(); await audit(env, user.id, "commission.settle", b); return back("/admin/commissions", "Commission réglée"); }
    if (a === "settings") {
      const fx = f.fx_eur ? String(f.fx_eur).replace(",", ".") : "";
      if (fx && !/^0?\.\d{1,6}$|^\d(\.\d{1,6})?$/.test(fx)) fail("invalid_number");
      const entries = { fx_eur: fx, fx_date: isoDate(f.fx_date), licence: str(f.licence, 80), trn: str(f.trn, 40), pay_instructions: longText(f.pay_instructions, 1500) };
      await env.DB.batch(Object.entries(entries).map(([k, v]) => q(env, "INSERT INTO settings(key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", k, v)));
      await audit(env, user.id, "settings.update", "", Object.keys(entries).join(","));
      return back("/admin/settings", "Paramètres enregistrés");
    }
    fail("not_found", 404);
  }

  const [a, b] = seg;
  const all = async (sql, ...args) => (await q(env, sql, ...args).all()).results;
  if (!a) {
    const one = async (sql) => Object.values(await q(env, sql).first())[0];
    const s = { new: await one("SELECT COUNT(*) FROM requests WHERE status='new'"), quoted: await one("SELECT COUNT(*) FROM requests WHERE status='quoted'"),
      accepted: await one("SELECT COUNT(*) FROM requests WHERE status='accepted'"), supplier: await one("SELECT COUNT(*) FROM requests WHERE status IN ('paid','supplier_pending')"),
      food: await one("SELECT COUNT(*) FROM food_orders WHERE status NOT IN ('delivered','cancelled')"), partners: await one("SELECT COUNT(*) FROM partners WHERE status='pending'"),
      offers: await one("SELECT COUNT(*) FROM offers WHERE status='pending'"), payments: await one("SELECT COUNT(*) FROM payments WHERE status='pending'"),
      revenue: await one("SELECT COALESCE(SUM(CASE WHEN kind='refund' THEN -amount_fils ELSE amount_fils END),0) FROM payments WHERE status='verified'") };
    return page(A.adminDashboard(user, s));
  }
  if (a === "requests" && !b) {
    const status = url.searchParams.get("status") || "";
    const rows = status && STATUS[status] ? await all("SELECT * FROM requests WHERE status=? ORDER BY created_at DESC LIMIT 200", status) : await all("SELECT * FROM requests ORDER BY created_at DESC LIMIT 200");
    return page(A.adminRequests(user, rows, status));
  }
  if (a === "requests" && b) {
    const r = await q(env, "SELECT * FROM requests WHERE ref=?", b).first();
    if (!r) return page(P.notFound("fr", user), { status: 404 });
    return page(A.adminRequest(user, r, { history: await all("SELECT * FROM status_history WHERE ref=? ORDER BY id", b), payments: await all("SELECT * FROM payments WHERE ref=? ORDER BY created_at", b),
      partners: await all("SELECT id, company FROM partners WHERE status='approved' ORDER BY company"), invoices: await all("SELECT * FROM invoices WHERE ref=?", b), msg: okMsg }));
  }
  if (a === "food") return page(A.adminFood(user, await all("SELECT f.*, r.name restaurant FROM food_orders f JOIN restaurants r ON r.id=f.restaurant_id ORDER BY f.created_at DESC LIMIT 200")));
  if (a === "partners") return page(A.adminPartners(user, await all("SELECT p.*, u.email FROM partners p JOIN users u ON u.id=p.user_id ORDER BY p.status='pending' DESC, p.created_at DESC")));
  if (a === "offers") {
    const edit = url.searchParams.get("edit") ? await q(env, "SELECT * FROM offers WHERE id=?", url.searchParams.get("edit")).first() : null;
    return page(A.adminOffers(user, await all("SELECT o.*, p.company FROM offers o LEFT JOIN partners p ON p.id=o.partner_id ORDER BY o.status='pending' DESC, o.updated_at DESC"), edit));
  }
  if (a === "restaurants") {
    const rows = await all("SELECT r.*, p.company FROM restaurants r LEFT JOIN partners p ON p.id=r.partner_id ORDER BY r.created_at DESC");
    const menus = {}; for (const r of rows) menus[r.id] = await all("SELECT * FROM menu_items WHERE restaurant_id=?", r.id);
    return page(A.adminRestaurants(user, rows, menus));
  }
  if (a === "packages") return page(A.adminPackages(user, await all("SELECT * FROM packages ORDER BY sort")));
  if (a === "payments") return page(A.adminPayments(user, await all("SELECT * FROM payments ORDER BY created_at DESC LIMIT 300")));
  if (a === "commissions") return page(A.adminCommissions(user, await all("SELECT c.*, p.company FROM commissions c JOIN partners p ON p.id=c.partner_id ORDER BY c.created_at DESC")));
  if (a === "users") return page(A.adminUsers(user, await all("SELECT id,name,email,phone,country,role,totp_enabled,created_at FROM users ORDER BY created_at DESC LIMIT 500")));
  if (a === "settings") return page(A.adminSettings(user, Object.fromEntries((await all("SELECT key,value FROM settings")).map((r) => [r.key, r.value]))));
  if (a === "audit") return page(A.adminAudit(user, await all("SELECT * FROM audit_log ORDER BY id DESC LIMIT 300")));
  return page(P.notFound("fr", user), { status: 404 });
}

function sitemap() {
  const paths = ["", ...SERVICE_KEYS, "contact", "partners", "guides", ...Object.keys(GUIDES).map((g) => "guides/" + g), "legal/privacy", "legal/terms", "legal/cancellation", "legal/refunds"];
  const urls = paths.flatMap((p) => LANGS.map((l) => `<url><loc>${SITE}/${l}${p ? "/" + p : ""}</loc></url>`)).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
}
