// Définition des services : textes, image, mode de traitement et champs de formulaire.
// mode "request" = parcours de demande + devis + confirmation humaine (aucune API fournisseur
// n'est connectée à ce jour ; voir docs/INTEGRATIONS.md).

export const AREAS = ["Deira", "Bur Dubai", "Al Rigga", "Al Barsha", "Downtown Dubai", "Business Bay", "Dubai Marina", "JBR", "JLT", "Al Nahda", "International City", "Autre / Other"];
export const AIRPORTS = ["DXB — Dubai International", "DWC — Al Maktoum International", "SHJ — Sharjah International"];

// type: text|email|tel|date|time|number|select|textarea ; req: obligatoire
const F = (name, fr, en, type = "text", opts = {}) => ({ name, fr, en, type, ...opts });
const contactNote = F("note", "Précisions (facultatif)", "Details (optional)", "textarea", { max: 1000 });

export const SERVICES = {
  hotels: {
    icon: "🏨", img: "hotels", nav: true,
    fr: { name: "Hôtels", title: "Hôtels à Dubaï", lead: "Un hôtel proche de vos rendez-vous, du métro ou de vos activités. Nous vérifions la disponibilité, les taxes (dont la taxe touristique Tourism Dirham) et les conditions d'annulation avant de vous envoyer un devis." },
    en: { name: "Hotels", title: "Hotels in Dubai", lead: "A hotel close to your meetings, the metro or your activities. We check availability, taxes (including the Tourism Dirham fee) and cancellation terms before sending you a quote." },
    fields: [
      F("area", "Quartier souhaité", "Preferred area", "select", { options: AREAS, req: true }),
      F("arrival", "Arrivée", "Check-in", "date", { req: true }), F("departure", "Départ", "Check-out", "date", { req: true }),
      F("adults", "Adultes", "Adults", "number", { min: 1, max: 30, req: true, value: 2 }), F("children", "Enfants", "Children", "number", { min: 0, max: 20, value: 0 }),
      F("rooms", "Chambres", "Rooms", "number", { min: 1, max: 20, req: true, value: 1 }),
      F("stars", "Catégorie", "Category", "select", { options: ["2-3★", "4★", "5★", "Indifférent / Any"] }),
      F("budget", "Budget par nuit (AED)", "Budget per night (AED)", "number", { min: 0, max: 100000 }), contactNote,
    ],
  },
  apartments: {
    icon: "🏢", img: "apartments", nav: true,
    fr: { name: "Appartements", title: "Appartements meublés", lead: "Studios et appartements meublés pour les séjours de quelques nuits à plusieurs mois. Seuls les logements de partenaires vérifiés et autorisés pour la location courte durée sont proposés." },
    en: { name: "Apartments", title: "Furnished apartments", lead: "Furnished studios and apartments for stays from a few nights to several months. Only listings from verified partners licensed for short-term rental are offered." },
    fields: [
      F("area", "Quartier", "Area", "select", { options: AREAS, req: true }),
      F("arrival", "Arrivée", "Check-in", "date", { req: true }), F("departure", "Départ", "Check-out", "date", { req: true }),
      F("people", "Voyageurs", "Guests", "number", { min: 1, max: 30, req: true, value: 2 }),
      F("bedrooms", "Chambres", "Bedrooms", "select", { options: ["Studio", "1", "2", "3", "4+"] }),
      F("budget", "Budget total (AED)", "Total budget (AED)", "number", { min: 0, max: 1000000 }),
      F("amenities", "Équipements souhaités", "Amenities wanted", "text", { max: 200, ph: "cuisine, parking, lave-linge…" }), contactNote,
    ],
  },
  flights: {
    icon: "✈️", img: "flights", nav: true,
    fr: { name: "Vols", title: "Billets d'avion", lead: "Dakar, Abidjan, Bamako, Conakry, Lagos… vers Dubaï. La billetterie directe n'est pas encore connectée : nous comparons les tarifs avec une agence partenaire et vous envoyons un devis avec bagages et conditions." },
    en: { name: "Flights", title: "Flight tickets", lead: "Dakar, Abidjan, Bamako, Conakry, Lagos… to Dubai. Direct ticketing is not connected yet: we compare fares with a partner agency and send you a quote with baggage and fare rules." },
    fields: [
      F("trip", "Type de voyage", "Trip type", "select", { options: ["Aller-retour / Return", "Aller simple / One way", "Multi-destinations / Multi-city"], req: true }),
      F("from", "Ville de départ", "From", "text", { req: true, max: 80, ph: "Dakar (DSS)" }), F("to", "Destination", "To", "text", { req: true, max: 80, value: "Dubai (DXB)" }),
      F("arrival", "Date de départ", "Departure date", "date", { req: true }), F("departure", "Date de retour", "Return date", "date"),
      F("adults", "Adultes", "Adults", "number", { min: 1, max: 9, req: true, value: 1 }), F("children", "Enfants (2-11 ans)", "Children (2-11)", "number", { min: 0, max: 9, value: 0 }),
      F("infants", "Bébés (-2 ans)", "Infants (<2)", "number", { min: 0, max: 9, value: 0 }),
      F("cabin", "Classe", "Cabin", "select", { options: ["Économique / Economy", "Premium", "Affaires / Business", "Première / First"] }),
      F("bags", "Bagages en soute par personne", "Checked bags per person", "number", { min: 0, max: 5, value: 1 }), contactNote,
    ],
  },
  cars: {
    icon: "🚙", img: "cars", nav: true,
    fr: { name: "Voitures", title: "Location de voitures", lead: "Économique, SUV, familiale ou premium, avec ou sans chauffeur. Caution, assurance, kilométrage et permis requis sont précisés dans le devis du loueur partenaire." },
    en: { name: "Cars", title: "Car rental", lead: "Economy, SUV, family or premium, with or without a driver. Deposit, insurance, mileage and licence requirements are stated in the partner's quote." },
    fields: [
      F("category", "Catégorie", "Category", "select", { options: ["Économique / Economy", "SUV", "Familiale / Family (7 places)", "Premium", "Van"], req: true }),
      F("driver", "Formule", "Option", "select", { options: ["Sans chauffeur / Self-drive", "Avec chauffeur / With driver"], req: true }),
      F("arrival", "Début", "Pick-up date", "date", { req: true }), F("departure", "Fin", "Return date", "date", { req: true }),
      F("pickup", "Lieu de prise en charge", "Pick-up location", "text", { max: 120, req: true }),
      F("people", "Passagers", "Passengers", "number", { min: 1, max: 50, value: 2 }), contactNote,
    ],
  },
  transfers: {
    icon: "🚖", img: "transfers", nav: true,
    fr: { name: "Transferts", title: "Transferts aéroport & chauffeurs", lead: "Accueil à l'aéroport, transfert vers votre hôtel, retour vers l'aéroport, chauffeur privé à la journée, transport de groupe ou VIP. Donnez votre numéro de vol : le chauffeur suit l'heure d'arrivée." },
    en: { name: "Transfers", title: "Airport transfers & drivers", lead: "Airport meet & greet, transfer to your hotel, return to the airport, private driver by the day, group or VIP transport. Share your flight number so the driver can track your arrival." },
    fields: [
      F("kind", "Prestation", "Service", "select", { options: ["Aéroport → hôtel / Airport → hotel", "Hôtel → aéroport / Hotel → airport", "Accueil VIP / VIP meet & greet", "Chauffeur à la journée / Driver per day", "Transport de groupe / Group transport"], req: true }),
      F("airport", "Aéroport", "Airport", "select", { options: AIRPORTS, req: true }), F("terminal", "Terminal (si connu)", "Terminal (if known)", "text", { max: 10 }),
      F("flight", "Numéro de vol", "Flight number", "text", { max: 12, ph: "EK 796" }),
      F("arrival", "Date", "Date", "date", { req: true }), F("time", "Heure", "Time", "time", { req: true }),
      F("to", "Adresse / hôtel de destination", "Destination address / hotel", "text", { max: 160, req: true }),
      F("people", "Passagers", "Passengers", "number", { min: 1, max: 60, req: true, value: 1 }), F("bags", "Bagages", "Bags", "number", { min: 0, max: 100, value: 2 }),
      F("vehicle", "Véhicule", "Vehicle", "select", { options: ["Berline / Sedan", "SUV", "Van 7 places", "Minibus", "VIP"] }), contactNote,
    ],
  },
  visa: {
    icon: "🛂", img: "visa", nav: true,
    fr: { name: "Visa", title: "Assistance visa Dubaï", lead: "Nous vous aidons à préparer une demande de visa touristique ou d'affaires via les canaux officiels. La décision appartient uniquement aux autorités des Émirats : aucun visa ni délai ne peut être garanti." },
    en: { name: "Visa", title: "Dubai visa assistance", lead: "We help you prepare a tourist or business visa application through official channels. The decision rests solely with the UAE authorities: no visa or processing time can be guaranteed." },
    fields: [
      F("visa_type", "Type de demande", "Application type", "select", { options: ["Touriste 30 jours / Tourist 30 days", "Touriste 60 jours / Tourist 60 days", "Affaires / Business", "Je ne sais pas / Not sure"], req: true }),
      F("nationality", "Nationalité", "Nationality", "text", { max: 60, req: true, value: "Sénégalaise" }),
      F("people", "Nombre de voyageurs", "Travellers", "number", { min: 1, max: 30, req: true, value: 1 }),
      F("arrival", "Date d'arrivée prévue", "Planned arrival", "date", { req: true }), contactNote,
    ],
    notice: {
      fr: "Ne joignez aucun document ici. Si votre dossier est ouvert, un conseiller vous indiquera les pièces nécessaires et un canal sécurisé pour les transmettre. Vous serez informé(e) des frais officiels et de service avant tout paiement.",
      en: "Do not attach any documents here. If your file is opened, an adviser will tell you which documents are needed and a secure way to send them. You will see the official and service fees before any payment.",
    },
  },
  shopping: {
    icon: "🛍️", img: "shopping", nav: true,
    fr: { name: "Shopping", title: "TERANGA BUSINESS SHOPPING", lead: "Pour les commerçants sénégalais et africains qui viennent acheter à Dubaï : guide francophone, interprète, recherche de fournisseurs, visites de grossistes, transport local, coordination des bagages et orientation vers des transitaires." },
    en: { name: "Shopping", title: "TERANGA BUSINESS SHOPPING", lead: "For Senegalese and African traders buying in Dubai: French-speaking guide, interpreter, supplier sourcing, wholesaler visits, local transport, baggage coordination and introductions to freight forwarders." },
    fields: [
      F("package", "Forfait", "Package", "select", { options: ["Demi-journée / Half day", "Journée / Full day", "Trois jours / Three days", "Séjour complet / Full stay", "Sur mesure / Custom"], req: true }),
      F("country", "Pays d'origine", "Country of origin", "text", { max: 60, req: true, value: "Sénégal" }),
      F("arrival", "Date d'arrivée", "Arrival date", "date", { req: true }),
      F("people", "Nombre de personnes", "People", "number", { min: 1, max: 50, req: true, value: 1 }),
      F("goods", "Type de marchandises", "Type of goods", "text", { max: 200, req: true, ph: "tissus, électronique, cosmétiques, pièces auto…" }),
      F("zones", "Zones souhaitées", "Areas of interest", "select", { options: ["Deira", "Naif", "Bur Dubai", "Dragon Mart", "Plusieurs / Several", "À conseiller / Advise me"] }),
      F("budget", "Budget d'achat indicatif (AED)", "Indicative purchase budget (AED)", "number", { min: 0, max: 100000000 }),
      F("needs", "Besoins", "Needs", "select", { options: ["Guide + transport", "Guide + transport + fret", "Guide uniquement / Guide only", "Fret uniquement / Freight only"] }), contactNote,
    ],
  },
  food: {
    icon: "🍲", img: "food", nav: true,
    fr: { name: "Restaurants", title: "SAVEURS D'AFRIQUE — TERANGA FOOD", lead: "Les saveurs du Sénégal et de l'Afrique, livrées à Dubaï." },
    en: { name: "Food", title: "TASTES OF AFRICA — TERANGA FOOD", lead: "The flavours of Senegal and Africa, delivered in Dubai." },
    fields: [
      F("dishes", "Plats souhaités", "Dishes wanted", "text", { max: 300, req: true, ph: "Thiéboudienne x2, bissap x2" }),
      F("people", "Nombre de personnes", "People", "number", { min: 1, max: 300, req: true, value: 2 }),
      F("arrival", "Date", "Date", "date", { req: true }), F("time", "Heure souhaitée", "Preferred time", "time", { req: true }),
      F("to", "Adresse de livraison", "Delivery address", "text", { max: 200, req: true }),
      F("occasion", "Occasion", "Occasion", "select", { options: ["Repas / Meal", "Événement / Event", "Traiteur bureau / Office catering"] }), contactNote,
    ],
  },
  baggage: {
    icon: "🧳", img: "baggage", nav: true,
    fr: { name: "Bagages", title: "Bagages & fret", lead: "Collecte de vos achats, emballage, transport vers l'aéroport, coordination du fret maritime ou aérien vers l'Afrique. Les envois sont confiés à des transporteurs et transitaires autorisés." },
    en: { name: "Baggage", title: "Baggage & freight", lead: "Pick-up of your purchases, packing, transport to the airport, coordination of sea or air freight to Africa. Shipments are handled by licensed carriers and forwarders." },
    fields: [
      F("kind", "Prestation", "Service", "select", { options: ["Collecte + emballage / Pick-up + packing", "Transport vers l'aéroport / To the airport", "Fret aérien / Air freight", "Fret maritime / Sea freight"], req: true }),
      F("from", "Adresse de collecte", "Pick-up address", "text", { max: 160, req: true }),
      F("to", "Destination finale", "Final destination", "text", { max: 120, req: true, value: "Dakar, Sénégal" }),
      F("weight", "Poids estimé (kg)", "Estimated weight (kg)", "number", { min: 1, max: 100000, req: true }),
      F("parcels", "Nombre de colis", "Number of parcels", "number", { min: 1, max: 5000, req: true, value: 1 }),
      F("dimensions", "Dimensions (cm, facultatif)", "Dimensions (cm, optional)", "text", { max: 60, ph: "60 x 40 x 40" }),
      F("goods", "Nature des marchandises", "Nature of goods", "text", { max: 200, req: true }),
      F("arrival", "Date souhaitée", "Preferred date", "date", { req: true }), contactNote,
    ],
  },
  activities: {
    icon: "🐪", img: "activities", nav: true,
    fr: { name: "Activités", title: "Excursions & activités", lead: "Safari dans le désert, visite de Dubaï, Burj Khalifa, croisière en dhow, sorties en famille, shopping tours et visites culturelles. Les billets et créneaux sont confirmés par le prestataire avant paiement." },
    en: { name: "Activities", title: "Tours & activities", lead: "Desert safari, Dubai city tour, Burj Khalifa, dhow cruise, family outings, shopping tours and cultural visits. Tickets and time slots are confirmed with the operator before payment." },
    fields: [
      F("activity", "Activité", "Activity", "select", { options: ["Desert Safari", "Visite de Dubaï / City tour", "Burj Khalifa", "Croisière dhow / Dhow cruise", "Activité familiale / Family activity", "Shopping tour", "Excursion privée / Private tour", "Visite culturelle / Cultural visit"], req: true }),
      F("arrival", "Date", "Date", "date", { req: true }),
      F("adults", "Adultes", "Adults", "number", { min: 1, max: 60, req: true, value: 2 }), F("children", "Enfants", "Children", "number", { min: 0, max: 40, value: 0 }),
      F("pickup", "Hôtel / lieu de prise en charge", "Hotel / pick-up point", "text", { max: 160 }), contactNote,
    ],
  },
  packages: {
    icon: "🎁", img: "packages", nav: true,
    fr: { name: "Forfaits", title: "Forfaits de séjour", lead: "Des séjours complets, organisés par une seule équipe. Chaque forfait fait l'objet d'un devis détaillé selon vos dates et votre budget." },
    en: { name: "Packages", title: "Stay packages", lead: "Complete stays organised by one team. Each package comes with a detailed quote based on your dates and budget." },
    fields: [
      F("package", "Forfait", "Package", "select", { options: ["TERANGA ESSENTIAL", "TERANGA BUSINESS SHOPPING", "TERANGA FAMILY", "TERANGA PREMIUM", "TERANGA CUSTOM"], req: true }),
      F("arrival", "Arrivée", "Arrival", "date", { req: true }), F("departure", "Départ", "Departure", "date", { req: true }),
      F("adults", "Adultes", "Adults", "number", { min: 1, max: 50, req: true, value: 2 }), F("children", "Enfants", "Children", "number", { min: 0, max: 30, value: 0 }),
      F("budget", "Budget total (AED)", "Total budget (AED)", "number", { min: 0, max: 10000000 }), contactNote,
    ],
  },
};
export const SERVICE_KEYS = Object.keys(SERVICES);

// Onglets du moteur de recherche de la page d'accueil (ordre demandé).
export const SEARCH_TABS = ["hotels", "apartments", "flights", "cars", "transfers", "visa", "shopping", "food", "baggage", "activities"];
