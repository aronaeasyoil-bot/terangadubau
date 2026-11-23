// Recherche fournisseurs en temps réel : LiteAPI (hôtels) et Duffel (vols).
// Actif uniquement si le secret correspondant existe sur le Worker. Recherche seulement :
// aucune réservation ni aucun paiement n'est déclenché ici. Le client choisit une offre,
// qui est jointe à sa demande ; l'équipe vérifie, envoie le devis et réserve après paiement vérifié.

const LITE = "https://api.liteapi.travel/v3.0";
const DUFFEL = "https://api.duffel.com";

// Centres approximatifs des quartiers (rayon 3 km) pour filtrer les hôtels.
const AREA_GEO = {
  "Deira": [25.2697, 55.3095], "Bur Dubai": [25.2532, 55.2968], "Al Rigga": [25.2637, 55.3227],
  "Al Barsha": [25.1136, 55.2003], "Downtown Dubai": [25.1972, 55.2744], "Business Bay": [25.1850, 55.2650],
  "Dubai Marina": [25.0805, 55.1403], "JBR": [25.0784, 55.1340], "JLT": [25.0693, 55.1418],
  "Al Nahda": [25.2894, 55.3711], "International City": [25.1653, 55.4085],
};

export const hotelsMode = (env) => !env.LITEAPI_KEY ? null : env.LITEAPI_KEY.startsWith("sand") ? "test" : "live";
export const flightsMode = (env) => !env.DUFFEL_ACCESS_TOKEN ? null : env.DUFFEL_ACCESS_TOKEN.startsWith("duffel_test_") ? "test" : "live";

const nights = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const intIn = (x, lo, hi, d) => { const n = parseInt(x, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);

async function cached(key, ttl, fn) {
  const cache = globalThis.caches?.default;
  const req = new Request("https://cache.teranga.internal/" + encodeURIComponent(key));
  if (cache) { const hit = await cache.match(req); if (hit) return hit.json(); }
  const data = await fn();
  if (cache) await cache.put(req, new Response(JSON.stringify(data), { headers: { "Cache-Control": `max-age=${ttl}` } }));
  return data;
}

// ---------- Hôtels (LiteAPI) ----------
export function hotelQuery(vals) {
  const q = { area: vals.area || "", checkin: vals.arrival, checkout: vals.departure,
    adults: intIn(vals.adults, 1, 30, 2), rooms: intIn(vals.rooms, 1, 9, 1), children: intIn(vals.children, 0, 20, 0) };
  if (!isDate(q.checkin) || !isDate(q.checkout)) return { error: "dates" };
  if (q.checkin < today() || nights(q.checkin, q.checkout) < 1 || nights(q.checkin, q.checkout) > 30) return { error: "dates" };
  if (q.rooms > q.adults) q.rooms = q.adults;
  return q;
}

export async function searchHotels(env, q) {
  const h = { "X-API-Key": env.LITEAPI_KEY, accept: "application/json", "content-type": "application/json" };
  const geo = AREA_GEO[q.area];
  const list = await cached("lite-hotels:" + (q.area || "all") + ":" + hotelsMode(env), 86400, async () => {
    const p = new URLSearchParams({ countryCode: "AE", cityName: "Dubai", limit: "60" });
    if (geo) { p.set("latitude", geo[0]); p.set("longitude", geo[1]); p.set("radius", "3000"); }
    const r = await fetch(`${LITE}/data/hotels?${p}`, { headers: h, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("LiteAPI hotels " + r.status);
    return ((await r.json()).data || []).map((x) => ({ id: x.id, name: x.name, stars: x.stars ?? null, rating: x.rating ?? null,
      reviews: x.reviewCount ?? null, photo: x.main_photo || x.thumbnail || "", address: x.address || "" }));
  });
  if (!list.length) return [];
  const byId = new Map(list.map((x) => [x.id, x]));
  const base = Math.floor(q.adults / q.rooms), extra = q.adults % q.rooms;
  const occupancies = Array.from({ length: q.rooms }, (_, i) => ({ adults: base + (i < extra ? 1 : 0) }));
  const r = await fetch(`${LITE}/hotels/rates`, { method: "POST", headers: h, signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ hotelIds: list.map((x) => x.id), checkin: q.checkin, checkout: q.checkout, occupancies,
      currency: "AED", guestNationality: "SN", timeout: 12, maxRatesPerHotel: 1 }) });
  const body = await r.json().catch(() => null);
  if (!r.ok) { if (body?.error?.code === 2001) return []; throw new Error("LiteAPI rates " + r.status + " " + (body?.error?.message || "")); }
  const out = [];
  for (const d of body?.data || []) {
    const info = byId.get(d.hotelId); if (!info) continue;
    let best = null;
    for (const rt of d.roomTypes || []) {
      const rate = rt.rates?.[0];
      const amount = Number(rt.offerRetailRate?.amount ?? rate?.retailRate?.total?.[0]?.amount);
      if (!Number.isFinite(amount)) continue;
      if (!best || amount < best.amount) best = { amount, currency: rt.offerRetailRate?.currency || rate?.retailRate?.total?.[0]?.currency || "AED",
        room: rate?.name || "", board: rate?.boardName || "", refundable: rate?.cancellationPolicies?.refundableTag === "RFN", offerId: rt.offerId || "" };
    }
    if (best) out.push({ ...info, ...best, nights: nights(q.checkin, q.checkout) });
  }
  return out.sort((a, b) => a.amount - b.amount).slice(0, 24);
}

// ---------- Vols (Duffel) ----------
const CABINS = { "Économique / Economy": "economy", "Premium": "premium_economy", "Affaires / Business": "business", "Première / First": "first" };

async function iata(env, text) {
  const s = String(text || "").trim();
  const m = s.match(/\(([A-Za-z]{3})\)/) || s.match(/^([A-Za-z]{3})$/) || s.match(/\b([A-Z]{3})\b/);
  if (m) return m[1].toUpperCase();
  if (s.length < 2) return null;
  return cached("duffel-place:" + s.toLowerCase(), 604800, async () => {
    const r = await fetch(`${DUFFEL}/places/suggestions?query=${encodeURIComponent(s.slice(0, 60))}`, { headers: duffelHeaders(env), signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const p = (await r.json()).data?.[0];
    return p?.iata_city_code || p?.iata_code || null;
  });
}
const duffelHeaders = (env) => ({ authorization: `Bearer ${env.DUFFEL_ACCESS_TOKEN}`, "duffel-version": "v2", accept: "application/json", "content-type": "application/json" });

export async function flightQuery(env, vals) {
  const q = { depart: vals.arrival, ret: vals.departure || "", adults: intIn(vals.adults, 1, 9, 1), children: intIn(vals.children, 0, 9, 0),
    infants: intIn(vals.infants, 0, 9, 0), cabin: CABINS[vals.cabin] || "economy", oneWay: /simple|one way/i.test(vals.trip || "") };
  if (!isDate(q.depart) || q.depart < today()) return { error: "dates" };
  if (q.oneWay) q.ret = "";
  if (q.ret && (!isDate(q.ret) || q.ret < q.depart)) return { error: "dates" };
  if (q.infants > q.adults) return { error: "infants" };
  q.from = await iata(env, vals.from); q.to = await iata(env, vals.to || "DXB");
  if (!q.from || !q.to) return { error: "places" };
  return q;
}

export async function searchFlights(env, q) {
  const passengers = [...Array.from({ length: q.adults }, () => ({ type: "adult" })),
    ...Array.from({ length: q.children }, () => ({ age: 8 })), ...Array.from({ length: q.infants }, () => ({ age: 1 }))];
  const slices = [{ origin: q.from, destination: q.to, departure_date: q.depart }];
  if (q.ret) slices.push({ origin: q.to, destination: q.from, departure_date: q.ret });
  const r = await fetch(`${DUFFEL}/air/offer_requests?return_offers=true&supplier_timeout=20000`, { method: "POST", headers: duffelHeaders(env),
    signal: AbortSignal.timeout(28000), body: JSON.stringify({ data: { slices, passengers, cabin_class: q.cabin, max_connections: 2 } }) });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error("Duffel " + r.status + " " + (body?.errors?.[0]?.title || ""));
  const offers = (body?.data?.offers || []).map((o) => ({
    id: o.id, amount: Number(o.total_amount), currency: o.total_currency, live: !!o.live_mode, expires: o.expires_at,
    airline: o.owner?.name || "", code: o.owner?.iata_code || "", logo: o.owner?.logo_symbol_url || "",
    refundable: !!o.conditions?.refund_before_departure?.allowed, changeable: !!o.conditions?.change_before_departure?.allowed,
    slices: (o.slices || []).map((s) => {
      const segs = s.segments || [];
      const bags = segs[0]?.passengers?.[0]?.baggages?.find((b) => b.type === "checked")?.quantity ?? null;
      return { from: s.origin?.iata_code, to: s.destination?.iata_code, dep: segs[0]?.departing_at, arr: segs.at(-1)?.arriving_at,
        duration: s.duration || "", stops: Math.max(0, segs.length - 1), via: segs.slice(0, -1).map((g) => g.destination?.iata_code).join(", "),
        flights: segs.map((g) => `${g.marketing_carrier?.iata_code || ""} ${g.marketing_carrier_flight_number || ""}`.trim()).join(" / "), bags };
    }),
  })).filter((o) => Number.isFinite(o.amount));
  // Une offre par itinéraire (même vols) : la moins chère.
  const seen = new Map();
  for (const o of offers.sort((a, b) => a.amount - b.amount)) { const k = o.slices.map((s) => s.flights + s.dep).join("|"); if (!seen.has(k)) seen.set(k, o); }
  return [...seen.values()].slice(0, 20);
}

export function isoDuration(d) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d || ""); if (!m) return "";
  const h = (+(m[1] || 0)) * 24 + (+(m[2] || 0));
  return `${h} h ${String(+(m[3] || 0)).padStart(2, "0")}`;
}
