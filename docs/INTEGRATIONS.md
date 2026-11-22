# Inventaire des intégrations — 22 novembre 2026

Ce qui a été vérifié directement dans le compte Cloudflare, le dépôt GitHub et les connecteurs de l'environnement.
Aucun secret n'est affiché ici ni dans le dépôt.

## Connecté et utilisé

| Intégration | État | Détail |
|---|---|---|
| Cloudflare Workers | ✅ | Worker `teranga-dubai`, URL `https://teranga-dubai.arona-easyoil.workers.dev` |
| Cloudflare D1 | ✅ | Base `teranga-dubai` (clients, dossiers, devis, paiements, commandes, partenaires, audit) |
| Cloudflare Workers Builds | ✅ | Chaque push sur `main` lance `npm test` puis les migrations D1 et `wrangler deploy` |
| Cloudflare Turnstile | ✅ | Widget anti-robot sur les formulaires publics ; secret stocké en secret Worker |
| Secrets Worker | ✅ | `TURNSTILE_SECRET`, `SALT`, `ADMIN_SETUP_CODE` (installation du 1er administrateur, inutilisable ensuite) |
| WhatsApp (clic-pour-discuter) | ✅ | `https://wa.me/971507640753` : bouton flottant, liens préremplis avec la référence du dossier, liens WhatsApp vers le client dans l'admin |
| Photos | ✅ | Wikimedia Commons sous licences libres, créditées sur `/fr/credits` |

## Trouvé mais pas utilisable tel quel

| Intégration | Constat | Ce qu'il faut faire |
|---|---|---|
| LiteAPI (hôtels) | La clé `LITEAPI_KEY` existe sur le Worker **noor-travel**. Les secrets Cloudflare ne sont pas lisibles, on ne peut pas la copier. | `npx wrangler secret put LITEAPI_KEY` sur `teranga-dubai`, puis brancher la recherche (le module Hôtels passe déjà par le parcours demande → devis). |
| Duffel (vols) | `DUFFEL_ACCESS_TOKEN` existe sur **noor-travel**, même limite. Vérifier aussi s'il s'agit d'un jeton test ou live et si l'émission de billets est autorisée. | `npx wrangler secret put DUFFEL_ACCESS_TOKEN` sur `teranga-dubai`. |
| Ancien Worker `teranga-dubai-staging` + D1 `teranga-dubai-staging` | Prototype précédent (données de test uniquement). Non utilisé, non supprimé. | À supprimer quand vous le souhaitez. |
| Worker `teranga-dubai-rentals` | Vide (aucun binding). Non utilisé. | À supprimer ou réutiliser. |

## Bloqué : aucune connexion existante

| Besoin | Blocage | Solution |
|---|---|---|
| Paiement en ligne (carte, lien de paiement, Wave) | Aucun prestataire de paiement configuré (ni Stripe, ni Network International, ni Wave Business…). | Ouvrir un compte marchand, puis ajouter la clé en secret. En attendant : paiements enregistrés et **vérifiés manuellement** dans l'admin (virement, lien, Wave, espèces). Une réservation n'est jamais confirmée sur la seule base d'un paiement. |
| E-mails transactionnels | Aucun domaine dans Cloudflare (Email Routing / Email Sending impossibles) et aucun fournisseur d'e-mail configuré. | Ajouter un domaine (ex. `terangadubai.com`) à Cloudflare. Notifications actuelles : espace client + WhatsApp. |
| WhatsApp Business API (assistant, notifications automatiques) | Le connecteur Bird de l'environnement n'a **aucun numéro WhatsApp** connecté. | Connecter le +971 50 764 0753 à WhatsApp Business API (Meta ou Bird). |
| Stockage de documents (visa, photos partenaires) | Cloudflare R2 n'est pas activé sur le compte (erreur 403/10042). | Activer R2 dans le tableau de bord Cloudflare (gratuit jusqu'à 10 Go). En attendant, aucun passeport n'est collecté en ligne. |
| Appartements, voitures, transferts, activités, restaurants, livraison, fret | Aucune API partenaire configurée. | Parcours de demande + devis + confirmation humaine, et portail partenaire pour publier offres et menus. |
| Taux de change | Aucune API de taux. | Taux AED→EUR saisi dans Admin → Paramètres avec sa date ; FCFA calculé à la parité fixe 655,957. |
| Nom de domaine | Aucun domaine dans le compte. | Ajouter le domaine puis une route personnalisée vers le Worker. |
