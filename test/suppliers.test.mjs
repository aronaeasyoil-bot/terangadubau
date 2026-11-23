import test from "node:test";
import assert from "node:assert/strict";
import { hotelsMode, flightsMode, hotelQuery, flightQuery, searchHotels, searchFlights, isoDuration } from "../src/lib/suppliers.js";

const future = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("modes test/live selon le préfixe des clés", () => {
  assert.equal(hotelsMode({}), null); assert.equal(flightsMode({}), null);
  assert.equal(hotelsMode({ LITEAPI_KEY: "sand_x" }), "test"); assert.equal(hotelsMode({ LITEAPI_KEY: "prod_x" }), "live");
  assert.equal(flightsMode({ DUFFEL_ACCESS_TOKEN: "duffel_test_x" }), "test"); assert.equal(flightsMode({ DUFFEL_ACCESS_TOKEN: "duffel_live_x" }), "live");
});

test("validation des requêtes", async () => {
  assert.equal(hotelQuery({ arrival: future(-1), departure: future(2) }).error, "dates");
  assert.equal(hotelQuery({ arrival: future(5), departure: future(5) }).error, "dates");
  const h = hotelQuery({ arrival: future(5), departure: future(8), adults: "3", rooms: "2" });
  assert.equal(h.adults, 3); assert.equal(h.rooms, 2);
  const f = await flightQuery({}, { arrival: future(10), departure: future(20), from: "Dakar (DSS)", to: "Dubai (DXB)", trip: "Aller-retour / Return", adults: "2" });
  assert.deepEqual([f.from, f.to, f.adults, !!f.ret], ["DSS", "DXB", 2, true]);
  const ow = await flightQuery({}, { arrival: future(10), departure: future(20), from: "DSS", to: "DXB", trip: "Aller simple / One way" });
  assert.equal(ow.ret, "");
  assert.equal((await flightQuery({}, { arrival: future(3), from: "DSS", to: "DXB", adults: "1", infants: "2" })).error, "infants");
});

test("LiteAPI : hôtels triés par prix, sans tarif = exclu", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([String(url), init?.method || "GET", init?.body ? JSON.parse(init.body) : null]);
    if (String(url).includes("/data/hotels")) return reply({ data: [
      { id: "h1", name: "Hotel A", stars: 4, rating: 8.6, reviewCount: 120, main_photo: "https://static.example/a.jpg", address: "Deira" },
      { id: "h2", name: "Hotel B", stars: 3 }, { id: "h3", name: "Hotel C" }] });
    return reply({ data: [
      { hotelId: "h1", roomTypes: [{ offerId: "o1", offerRetailRate: { amount: 900, currency: "AED" }, rates: [{ name: "Double", boardName: "Room Only", cancellationPolicies: { refundableTag: "RFN" } }] }] },
      { hotelId: "h2", roomTypes: [{ offerId: "o2", offerRetailRate: { amount: 450, currency: "AED" }, rates: [{ name: "Twin", boardName: "Breakfast", cancellationPolicies: { refundableTag: "NRFN" } }] }] },
    ] });
  };
  const q = hotelQuery({ area: "Deira", arrival: future(5), departure: future(8), adults: "3", rooms: "2" });
  const r = await searchHotels({ LITEAPI_KEY: "sand_k" }, q);
  assert.deepEqual(r.map((x) => [x.id, x.amount, x.refundable, x.nights]), [["h2", 450, false, 3], ["h1", 900, true, 3]]);
  const rates = calls.find((c) => c[1] === "POST")[2];
  assert.deepEqual(rates.occupancies, [{ adults: 2 }, { adults: 1 }]);
  assert.equal(rates.currency, "AED");
  assert.match(calls[0][0], /latitude=25\.2697/);
});

test("Duffel : offres normalisées et dédoublonnées", async () => {
  let sent;
  const seg = (o, d, dep, arr, fn) => ({ origin: { iata_code: o }, destination: { iata_code: d }, departing_at: dep, arriving_at: arr,
    marketing_carrier: { iata_code: "EK" }, marketing_carrier_flight_number: fn, passengers: [{ baggages: [{ type: "checked", quantity: 2 }] }] });
  const offer = (id, amt) => ({ id, total_amount: String(amt), total_currency: "USD", live_mode: false, owner: { name: "Emirates", iata_code: "EK" },
    conditions: { refund_before_departure: { allowed: true }, change_before_departure: null },
    slices: [{ origin: { iata_code: "DSS" }, destination: { iata_code: "DXB" }, duration: "PT11H35M",
      segments: [seg("DSS", "JED", "2026-12-12T08:00:00", "2026-12-12T15:00:00", "796"), seg("JED", "DXB", "2026-12-12T17:00:00", "2026-12-12T20:35:00", "804")] }] });
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return reply({ data: { offers: [offer("off_2", 900), offer("off_1", 850.5)] } }); };
  const r = await searchFlights({ DUFFEL_ACCESS_TOKEN: "duffel_test_x" }, { from: "DSS", to: "DXB", depart: "2026-12-12", ret: "", adults: 1, children: 1, infants: 0, cabin: "economy" });
  assert.equal(r.length, 1); assert.equal(r[0].id, "off_1"); assert.equal(r[0].amount, 850.5);
  assert.deepEqual([r[0].slices[0].stops, r[0].slices[0].via, r[0].slices[0].bags, r[0].slices[0].flights], [1, "JED", 2, "EK 796 / EK 804"]);
  assert.deepEqual(sent.data.passengers, [{ type: "adult" }, { age: 8 }]);
  assert.equal(isoDuration("PT11H35M"), "11 h 35"); assert.equal(isoDuration("P1DT2H5M"), "26 h 05");
});

test("Duffel : erreur fournisseur remontée", async () => {
  globalThis.fetch = async () => reply({ errors: [{ title: "Unauthorized" }] }, 401);
  await assert.rejects(searchFlights({ DUFFEL_ACCESS_TOKEN: "x" }, { from: "DSS", to: "DXB", depart: "2026-12-12", ret: "", adults: 1, children: 0, infants: 0, cabin: "economy" }), /Duffel 401/);
});
