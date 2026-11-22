// Pages éditoriales et légales. Contenus volontairement prudents : aucune règle administrative
// n'est présentée comme garantie ; les textes légaux sont des modèles à faire valider par un juriste.
import { html } from "../lib/util.js";
import { L } from "./layout.js";

export const LEGAL = {
  privacy: (lang) => [L(lang, "Politique de confidentialité", "Privacy policy"), html`
    <p>${L(lang, "TERANGA DUBAI collecte uniquement les informations nécessaires pour traiter vos demandes, réservations et commandes : nom, coordonnées, détails du voyage et historique des échanges.", "TERANGA DUBAI only collects the information needed to handle your requests, bookings and orders: name, contact details, trip details and message history.")}</p>
    <p>${L(lang, "Ces données sont hébergées sur l'infrastructure Cloudflare et transmises aux seuls prestataires concernés par votre réservation (hôtel, transporteur, restaurant…). Elles ne sont jamais vendues.", "Data is hosted on Cloudflare infrastructure and shared only with the suppliers involved in your booking (hotel, transport, restaurant…). It is never sold.")}</p>
    <p>${L(lang, "Les copies de passeport ne sont demandées que lorsqu'elles sont indispensables (visa, certaines réservations) et par un canal sécurisé indiqué par un conseiller. Aucun numéro de carte bancaire n'est stocké.", "Passport copies are only requested when strictly necessary (visa, some bookings) and through a secure channel provided by an adviser. No card numbers are stored.")}</p>
    <p>${L(lang, "Vous pouvez demander l'accès, la rectification ou la suppression de vos données sur WhatsApp au +971 50 764 0753.", "You can request access, correction or deletion of your data on WhatsApp at +971 50 764 0753.")}</p>
    <p class="muted small">${L(lang, "Seul un cookie technique de session est utilisé, uniquement si vous vous connectez. Aucun cookie publicitaire.", "Only a technical session cookie is used, and only if you sign in. No advertising cookies.")}</p>`],
  terms: (lang) => [L(lang, "Conditions générales", "Terms and conditions"), html`
    <p>${L(lang, "TERANGA DUBAI agit comme intermédiaire et conciergerie entre le client et des prestataires indépendants (hôtels, loueurs, transporteurs, restaurants, guides, transitaires).", "TERANGA DUBAI acts as an intermediary and concierge between the customer and independent suppliers (hotels, rental companies, transport, restaurants, guides, forwarders).")}</p>
    <p>${L(lang, "Une demande ou un paiement ne vaut pas réservation : une réservation n'est confirmée qu'après confirmation écrite du prestataire, communiquée avec sa référence dans votre espace client.", "A request or payment is not a booking: a booking is only confirmed once the supplier confirms in writing, shown with its reference in your account.")}</p>
    <p>${L(lang, "Les prix sont exprimés et facturés en dirhams des Émirats (AED). Les conversions en EUR ou FCFA sont indicatives.", "Prices are stated and billed in UAE dirhams (AED). EUR or FCFA conversions are indicative.")}</p>
    <p>${L(lang, "Les services réglementés (visa, transport de marchandises, location courte durée) sont exécutés par des prestataires disposant des autorisations requises. TERANGA DUBAI ne garantit ni l'obtention d'un visa ni un délai administratif.", "Regulated services (visa, freight, short-term rentals) are performed by suppliers holding the required permits. TERANGA DUBAI does not guarantee any visa or processing time.")}</p>
    <p class="muted small">${L(lang, "Modèle à faire valider par un conseil juridique aux Émirats avant l'ouverture commerciale.", "Template to be reviewed by UAE legal counsel before commercial launch.")}</p>`],
  cancellation: (lang) => [L(lang, "Conditions d'annulation", "Cancellation policy"), html`
    <p>${L(lang, "Avant acceptation d'un devis, vous pouvez annuler votre demande gratuitement depuis votre lien de suivi.", "Before accepting a quote, you can cancel your request free of charge from your tracking link.")}</p>
    <p>${L(lang, "Après acceptation, les conditions d'annulation applicables sont celles du prestataire, indiquées dans le devis (par exemple : tarif non remboursable, annulation gratuite jusqu'à une date donnée).", "After acceptance, the supplier's cancellation terms apply, as stated in the quote (e.g. non-refundable rate, free cancellation until a given date).")}</p>
    <p>${L(lang, "Pour annuler une réservation confirmée, contactez-nous sur WhatsApp en indiquant votre référence.", "To cancel a confirmed booking, contact us on WhatsApp with your reference.")}</p>`],
  refunds: (lang) => [L(lang, "Politique de remboursement", "Refund policy"), html`
    <p>${L(lang, "Lorsqu'un remboursement est dû (prestation non confirmée par le fournisseur, annulation dans les délais prévus), il est effectué sur le moyen de paiement d'origine ou par virement, déduction faite des frais non récupérables indiqués dans le devis.", "When a refund is due (service not confirmed by the supplier, cancellation within the allowed period), it is made to the original payment method or by bank transfer, minus any non-recoverable fees stated in the quote.")}</p>
    <p>${L(lang, "Si le prestataire ne confirme pas une réservation payée, la totalité des sommes versées pour cette prestation vous est remboursée.", "If the supplier does not confirm a paid booking, all amounts paid for that service are refunded.")}</p>
    <p>${L(lang, "Chaque remboursement est enregistré dans votre dossier avec sa date et sa référence.", "Every refund is recorded in your file with its date and reference.")}</p>`],
};

export const GUIDES = {
  "voyager-dubai-depuis-senegal": {
    fr: ["Voyager à Dubaï depuis le Sénégal", html`<p>Dubaï est desservie depuis l'Afrique de l'Ouest par plusieurs compagnies, avec ou sans escale. Comparez la durée totale, la franchise bagages (important pour les voyages d'achats) et les conditions de modification.</p>
      <h2>Avant le départ</h2><ul><li>Vérifiez la validité de votre passeport et les conditions d'entrée applicables à votre nationalité sur les portails officiels des Émirats (ICP et GDRFA Dubaï) ou auprès de la compagnie aérienne.</li>
      <li>Préparez une copie de votre réservation d'hébergement et de votre billet retour.</li><li>La monnaie locale est le dirham (AED), arrimé au dollar américain.</li></ul>
      <h2>À l'arrivée</h2><p>L'aéroport international de Dubaï (DXB) compte plusieurs terminaux. Notez votre terminal d'arrivée et partagez votre numéro de vol pour un accueil et un transfert sans attente.</p>
      <p><a class="btn btn-red" href="/fr/transfers">Réserver un transfert</a> <a class="btn btn-ghost" href="/fr/visa">Assistance visa</a></p>`],
    en: ["Travelling to Dubai from Senegal", html`<p>Dubai is served from West Africa by several airlines, direct or with a stop. Compare total travel time, baggage allowance (important for shopping trips) and change conditions.</p>
      <h2>Before you go</h2><ul><li>Check your passport validity and the entry requirements for your nationality on the official UAE portals (ICP and GDRFA Dubai) or with your airline.</li>
      <li>Keep a copy of your accommodation booking and return ticket.</li><li>The local currency is the dirham (AED), pegged to the US dollar.</li></ul>
      <h2>On arrival</h2><p>Dubai International Airport (DXB) has several terminals. Note your arrival terminal and share your flight number for a smooth meet & greet and transfer.</p>
      <p><a class="btn btn-red" href="/en/transfers">Book a transfer</a> <a class="btn btn-ghost" href="/en/visa">Visa assistance</a></p>`] },
  "acheter-marchandises-deira": {
    fr: ["Acheter des marchandises à Deira", html`<p>Deira, au nord de la crique de Dubaï, regroupe des souks historiques et de nombreux grossistes. Naif, Bur Dubai et Dragon Mart complètent l'offre selon le type de marchandises.</p>
      <h2>Conseils</h2><ul><li>Préparez une liste précise (références, quantités, budget) et demandez des factures pour chaque achat.</li><li>Comparez plusieurs fournisseurs avant de vous engager.</li>
      <li>Anticipez le transport : franchise bagages de votre billet, ou fret aérien/maritime via un transitaire autorisé.</li><li>Renseignez-vous sur les règles douanières à l'arrivée dans votre pays.</li></ul>
      <p><a class="btn btn-red" href="/fr/shopping">TERANGA BUSINESS SHOPPING</a> <a class="btn btn-ghost" href="/fr/baggage">Bagages & fret</a></p>`],
    en: ["Buying goods in Deira", html`<p>Deira, north of Dubai Creek, is home to historic souks and many wholesalers. Naif, Bur Dubai and Dragon Mart complete the picture depending on the goods.</p>
      <h2>Tips</h2><ul><li>Prepare a precise list (references, quantities, budget) and ask for an invoice for each purchase.</li><li>Compare several suppliers before committing.</li>
      <li>Plan transport early: your ticket's baggage allowance, or air/sea freight with a licensed forwarder.</li><li>Check customs rules on arrival in your country.</li></ul>
      <p><a class="btn btn-red" href="/en/shopping">TERANGA BUSINESS SHOPPING</a> <a class="btn btn-ghost" href="/en/baggage">Baggage & freight</a></p>`] },
  "reserver-transfert-aeroport": {
    fr: ["Réserver un transfert aéroport à Dubaï", html`<p>Un transfert réservé à l'avance évite l'attente après un long vol, surtout en famille ou avec beaucoup de bagages.</p>
      <ul><li>Indiquez votre numéro de vol, le terminal si vous le connaissez, le nombre de passagers et de bagages.</li><li>Choisissez un véhicule adapté : berline, SUV, van ou minibus pour les groupes.</li>
      <li>Gardez votre téléphone joignable sur WhatsApp à l'atterrissage.</li></ul><p><a class="btn btn-red" href="/fr/transfers">Demander un transfert</a></p>`],
    en: ["Booking an airport transfer in Dubai", html`<p>A pre-booked transfer avoids waiting after a long flight, especially with family or lots of luggage.</p>
      <ul><li>Share your flight number, terminal if known, number of passengers and bags.</li><li>Choose a suitable vehicle: sedan, SUV, van or minibus for groups.</li>
      <li>Keep your phone reachable on WhatsApp when you land.</li></ul><p><a class="btn btn-red" href="/en/transfers">Request a transfer</a></p>`] },
  "restaurants-senegalais-dubai": {
    fr: ["Manger sénégalais à Dubaï", html`<p>Thiéboudienne, mafé, yassa, dibi… TERANGA FOOD référence progressivement des restaurants sénégalais et africains de Dubaï qui publient eux-mêmes leurs menus, prix et zones de livraison.</p>
      <p>Tant qu'un restaurant n'a pas publié son menu, votre commande passe par une demande : nous vérifions avec le restaurant avant de vous confirmer prix et horaire.</p><p><a class="btn btn-red" href="/fr/food">Voir TERANGA FOOD</a></p>`],
    en: ["Eating Senegalese food in Dubai", html`<p>Thieboudienne, mafé, yassa, dibi… TERANGA FOOD is gradually listing Senegalese and African restaurants in Dubai that publish their own menus, prices and delivery areas.</p>
      <p>Until a restaurant has published its menu, your order goes through a request: we check with the restaurant before confirming price and time.</p><p><a class="btn btn-red" href="/en/food">See TERANGA FOOD</a></p>`] },
};
