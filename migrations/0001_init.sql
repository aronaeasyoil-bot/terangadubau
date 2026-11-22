-- TERANGA DUBAI — schéma initial (Cloudflare D1 / SQLite)
-- Montants stockés en fils (1 AED = 100 fils) pour éviter les arrondis.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','partner','admin')),
  lang TEXT NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr','en')),
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL,
  mfa INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  company TEXT NOT NULL,
  category TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  licence_no TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  commission_pct REAL NOT NULL DEFAULT 10 CHECK (commission_pct BETWEEN 0 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  partner_id TEXT REFERENCES partners(id),
  service TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  desc_fr TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  area TEXT,
  capacity INTEGER,
  bedrooms INTEGER,
  price_fils INTEGER CHECK (price_fils IS NULL OR price_fils > 0),
  unit TEXT NOT NULL DEFAULT 'séjour',
  terms_fr TEXT NOT NULL DEFAULT '',
  terms_en TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX offers_service ON offers(service, status);

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  partner_id TEXT REFERENCES partners(id),
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  cuisine TEXT NOT NULL DEFAULT 'senegal',
  phone TEXT,
  hours TEXT,
  delivery_fee_fils INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_fils >= 0),
  min_order_fils INTEGER NOT NULL DEFAULT 0 CHECK (min_order_fils >= 0),
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  dish_key TEXT,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  desc_fr TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',
  allergens TEXT NOT NULL DEFAULT '',
  price_fils INTEGER NOT NULL CHECK (price_fils > 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX menu_restaurant ON menu_items(restaurant_id);

-- Dossiers de réservation (parcours hybride : demande → devis → acceptation → paiement → confirmation fournisseur)
CREATE TABLE requests (
  ref TEXT PRIMARY KEY,
  access_hash TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  service TEXT NOT NULL,
  offer_id TEXT REFERENCES offers(id),
  lang TEXT NOT NULL DEFAULT 'fr',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  fields TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN
    ('new','review','quoted','accepted','paid','supplier_pending','confirmed','completed','cancelled','refunded')),
  amount_fils INTEGER CHECK (amount_fils IS NULL OR amount_fils > 0),
  deposit_fils INTEGER CHECK (deposit_fils IS NULL OR deposit_fils > 0),
  quote_text TEXT,
  quote_expires TEXT,
  supplier_ref TEXT,
  partner_id TEXT REFERENCES partners(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX requests_user ON requests(user_id);
CREATE INDEX requests_status ON requests(status);

CREATE TABLE food_orders (
  ref TEXT PRIMARY KEY,
  access_hash TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  items TEXT NOT NULL,
  subtotal_fils INTEGER NOT NULL,
  delivery_fee_fils INTEGER NOT NULL,
  total_fils INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  slot TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN
    ('new','restaurant_confirmed','preparing','out_for_delivery','delivered','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','verified','refunded')),
  lang TEXT NOT NULL DEFAULT 'fr',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX food_user ON food_orders(user_id);

-- Paiements : enregistrés et vérifiés côté serveur / par l'administration. Jamais de numéro de carte.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','full','balance','refund')),
  method TEXT NOT NULL CHECK (method IN ('bank_transfer','payment_link','cash','wave','card','other')),
  amount_fils INTEGER NOT NULL CHECK (amount_fils > 0),
  currency TEXT NOT NULL DEFAULT 'AED',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','refunded')),
  provider_ref TEXT,
  note TEXT,
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX payments_ref ON payments(ref);

CREATE TABLE invoices (
  number TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  amount_fils INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  issued_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE commissions (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  base_fils INTEGER NOT NULL,
  pct REAL NOT NULL,
  amount_fils INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','settled','void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  ref TEXT,
  text_fr TEXT NOT NULL,
  text_en TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX notifications_user ON notifications(user_id, read);

CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT,
  note TEXT,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX history_ref ON status_history(ref);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  ip_hash TEXT,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE packages (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline_fr TEXT NOT NULL,
  tagline_en TEXT NOT NULL,
  includes_fr TEXT NOT NULL,
  includes_en TEXT NOT NULL,
  price_from_fils INTEGER CHECK (price_from_fils IS NULL OR price_from_fils > 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  hits INTEGER NOT NULL
);

INSERT INTO packages (slug,name,tagline_fr,tagline_en,includes_fr,includes_en,sort) VALUES
 ('essential','TERANGA ESSENTIAL','Hébergement, transferts et assistance.','Accommodation, transfers and assistance.',
  'Hébergement sélectionné selon votre budget|Accueil et transfert aéroport aller-retour|Assistance francophone sur WhatsApp pendant le séjour',
  'Accommodation matched to your budget|Airport meet & greet and return transfer|French- and English-speaking WhatsApp assistance during your stay',1),
 ('business','TERANGA BUSINESS SHOPPING','Hébergement, transferts, guide commercial et coordination des achats.','Accommodation, transfers, business guide and purchase coordination.',
  'Hébergement proche des zones commerciales|Transferts aéroport|Guide commercial francophone (Deira, Naif, Dragon Mart…)|Coordination des achats, des bagages et orientation vers les transitaires',
  'Accommodation near the trading districts|Airport transfers|French-speaking business guide (Deira, Naif, Dragon Mart…)|Purchase and baggage coordination, introductions to freight forwarders',2),
 ('family','TERANGA FAMILY','Hébergement familial, transferts, restauration et activités.','Family accommodation, transfers, food and activities.',
  'Appartement ou hôtel familial|Transferts avec véhicule adapté|Repas sénégalais livrés selon les partenaires disponibles|Activités en famille',
  'Family apartment or hotel|Transfers in a suitable vehicle|Senegalese meals delivered, subject to partner availability|Family activities',3),
 ('premium','TERANGA PREMIUM','Hébergement supérieur, chauffeur et conciergerie personnalisée.','Upscale accommodation, private driver and personal concierge.',
  'Hôtel ou résidence haut de gamme|Chauffeur privé|Conciergerie personnalisée|Réservations restaurants et activités',
  'Upscale hotel or residence|Private driver|Personal concierge|Restaurant and activity bookings',4),
 ('custom','TERANGA CUSTOM','Un séjour entièrement construit avec vous.','A stay built entirely around you.',
  'Vous choisissez chaque service|Devis détaillé avant tout paiement|Un interlocuteur unique',
  'You choose every service|Detailed quote before any payment|One point of contact',5);
