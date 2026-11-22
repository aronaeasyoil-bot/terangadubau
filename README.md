# TERANGA DUBAI — Your African Travel Companion

Plateforme de voyage, réservation, shopping, restauration africaine et conciergerie à Dubaï.
Production : **https://teranga-dubai.arona-easyoil.workers.dev**

## Architecture

- **Cloudflare Worker** (`src/worker.js`) : rendu HTML côté serveur, FR/EN, aucune dépendance d'exécution.
- **Cloudflare D1** (`migrations/`) : base relationnelle, migrations versionnées.
- **Assets statiques** (`public/`) : CSS, JS léger (menu, onglets, panier), logo officiel, manifeste PWA.
- **Turnstile** contre les robots, limitation de débit par IP, protection CSRF par contrôle d'origine, CSP stricte.

```
src/
  worker.js          routes publiques, espace client, partenaires, administration
  lib/util.js        validation, échappement HTML, PBKDF2, TOTP, réponses HTTP
  lib/auth.js        sessions, rôles, limitation de débit, audit, notifications
  lib/booking.js     moteur hybride : dossiers, devis, statuts, paiements, commandes repas, commissions
  data/              services et formulaires, plats, photos (licences)
  views/             gabarits (public, portail client/partenaire, admin, contenus)
```

## Moteur de réservation hybride

`new → review → quoted → accepted (client) → paid (paiement vérifié) → supplier_pending → confirmed (réf. fournisseur) → completed`
avec `cancelled` / `refunded`. Règles codées et testées : seul le client accepte un devis ; seul un paiement **vérifié**
fait passer en `paid` ; une réservation n'est `confirmed` qu'avec la référence du prestataire. Historique et journal d'audit.

## Espaces

- **Public** : accueil, moteur multi-services, 11 services, TERANGA FOOD, Business Shopping, forfaits, guides, mentions.
- **Client** (`/fr/account`) : inscription, connexion, dossiers, commandes, devis, factures, notifications. Suivi sans compte par lien secret.
- **Partenaire** (`/fr/partner`) : candidature, validation admin, offres (modérées), restaurant + menu, commandes, missions, commissions.
- **Admin** (`/admin`) : MFA TOTP obligatoire. Devis, statuts, paiements, factures, partenaires, offres, restaurants, forfaits, commissions, paramètres, audit.

Premier administrateur : `/admin/setup` avec le code d'installation (secret `ADMIN_SETUP_CODE`), une seule fois.

## Développement

```bash
npm install
npm run db:migrate:local
npm run dev                                  # http://127.0.0.1:8787
npm test                                     # tests unitaires
SETUP=<code .dev.vars> node test/e2e.mjs     # parcours complets contre le serveur local
```

`.dev.vars` (non versionné) : `ADMIN_SETUP_CODE=…`, `SALT=…`.

## Déploiement

Automatique via Cloudflare Workers Builds à chaque push sur `main` : `npm test`, puis
`wrangler d1 migrations apply DB --remote && wrangler deploy`.

Intégrations connectées et bloquées : voir [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
