# Architecture du back-office

## Statut

Ce document décrit l'architecture cible du back-office de Froment Software.

Les décisions suivantes sont validées :

- Effect v4 RC pour les effets, les contrats HTTP et le serveur.
- Angular 22 pour l'interface et Typst pour les documents PDF.
- pnpm pour le workspace.
- Drizzle ORM avec SQLite pour la persistance.
- Une seule instance applicative avec un volume persistant.
- Une connexion par adresse électronique et mot de passe.
- Des jetons d'accès PASETO en mémoire et des sessions de renouvellement rotatives.
- Une preuve électronique pour la signature des devis.
- Les PDF et les preuves sont stockés comme BLOB dans SQLite.
- Le premier programme de livraison couvre le flux métier complet.

## Workspace

Le dépôt contient cinq packages :

```text
packages/
├── web/          # Application Angular
├── api/          # Serveur Effect
├── contracts/    # Schémas Effect et description HttpApi
├── documents/    # Entrées TypeScript et templates Typst
└── l10n/         # Textes localisés partagés
```

Le package racine orchestre les commandes pnpm, le formatage, les tests et les builds.

`packages/contracts` ne dépend ni du navigateur, ni de SQLite.

`packages/documents` expose les entrées validées et formatées pour les templates Typst.

## Versions initiales

Les versions initiales prévues sont :

- pnpm `11.20.0` ;
- Effect `4.0.0-rc.110` ;
- `@effect/platform-node` `4.0.0-rc.110` ;
- Drizzle ORM `1.0.0-rc.5-169397b` ;
- Drizzle Kit `1.0.0-rc.5-ab785fc` ;
- `better-sqlite3` `13.0.3` ;
- Angular `22.1.1`.

Toutes les dépendances Effect utilisent la même version exacte.

Les modules HTTP Effect v4 restent instables pendant la phase RC.

## Usage d'Effect

Le serveur utilise Effect pour les éléments suivants :

- la description de l'API avec `HttpApi` ;
- la validation avec `Schema` ;
- l'assemblage des services avec `Layer` ;
- la configuration avec `Config` ;
- la protection des secrets avec `Redacted` ;
- les erreurs métier typées ;
- la durée de vie des ressources ;
- la concurrence ;
- la journalisation et les traces ;
- les tests avec `@effect/vitest`.

Le client Angular utilise la même description `HttpApi`.

Un service Angular encapsule le runtime Effect et le client HTTP produit depuis les contrats.

Angular conserve les signaux, les formulaires et l'état de présentation.

Effect reste chargé dans les routes différées du back-office.

## SQLite et Drizzle

Drizzle utilise `better-sqlite3` sur une instance applicative unique.

La connexion active ces options :

- `journal_mode = WAL` ;
- `foreign_keys = ON` ;
- `busy_timeout` ;
- `synchronous = FULL`.

Drizzle Kit produit des migrations SQL versionnées.

Le déploiement exécute les migrations avant le démarrage du serveur.

Les changements métier utilisent des transactions courtes.

Les PDF sont stockés comme BLOB avec leur type, leur taille et leur empreinte SHA-256.

Une sauvegarde SQLite cohérente contient donc toutes les données et tous les documents.

## Authentification

Une route dédiée permet l'amorçage du premier administrateur.

Cette route reste disponible seulement tant qu'aucun administrateur n'existe.

Le formulaire accepte le mot de passe d'amorçage, l'adresse électronique et le mot de passe administrateur.

Le serveur vérifie le mot de passe d'amorçage avec scrypt.

Il dérive les mots de passe des comptes avec Argon2id.

La variable obligatoire `BOOTSTRAP_PASSWORD_SCRYPT` contient les paramètres, le sel et le condensat en base64url.

La variable obligatoire `PASETO_SECRET_KEY` contient une clé Ed25519 secrète au format PASERK `k4.secret`.

La variable obligatoire `API_TOKEN_HMAC_KEY` contient une clé distincte de 32 octets en base64url.

La variable obligatoire `REFRESH_HMAC_KEY` contient une clé aléatoire de 32 octets en base64url.

La variable obligatoire `QUOTE_LINK_HMAC_KEY` contient une troisième clé aléatoire de 32 octets en base64url.

Le bundle Angular ne contient ni mot de passe, ni condensat de mot de passe, ni clé secrète.

Une transaction unique crée le compte, ses identifiants de connexion et son rôle administrateur.

La même transaction rend les amorçages concurrents impossibles.

Le serveur crée ensuite une famille de sessions de renouvellement et émet un jeton d'accès.

Le flux de connexion est le suivant :

1. L'utilisateur saisit son adresse électronique et son mot de passe.
2. Le navigateur appelle `POST /api/auth/login`.
3. Le serveur normalise l'adresse et vérifie le condensat Argon2id.
4. Le serveur crée une famille de sessions de renouvellement.
5. Le serveur retourne un jeton d'accès PASETO `v4.public` valable dix minutes.
6. Le serveur place le jeton de renouvellement opaque dans un cookie sécurisé.

Angular conserve le jeton d'accès seulement en mémoire.

Le navigateur ne stocke aucun jeton d'authentification dans `localStorage` ou `sessionStorage`.

Le cookie `__Secure-froment-refresh` utilise ces attributs :

- `HttpOnly` ;
- `Secure` ;
- `SameSite=Strict` ;
- `Path=/api/auth` ;
- une expiration absolue de 30 jours.

SQLite conserve seulement le HMAC-SHA-256 de chaque jeton de renouvellement.

Chaque renouvellement consomme le jeton courant et crée son remplacement dans une transaction.

Une réutilisation hors du délai de concurrence révoque toute la famille.

La déconnexion révoque la famille courante et supprime le cookie.

Un changement de mot de passe, une désactivation ou un archivage client révoque les sessions concernées.

Le serveur retourne une erreur uniforme pour une adresse ou un mot de passe invalide.

## API et jetons d'API

Le serveur publie le contrat OpenAPI 3.1 sur `GET /api/openapi.json`.

Le serveur publie la documentation Scalar localisée sur `GET /api/docs`.

Le contrat documente toutes les routes serveur avec leurs mécanismes de sécurité.

Les URLs ne contiennent aucun segment de version.

Un administrateur gère les jetons d'API depuis la section Configuration.

Le secret suit le format `froment_api_v1_<ulid>.<secret>`.

Le serveur affiche le secret seulement dans la réponse de création.

SQLite conserve uniquement son HMAC-SHA-256 dans `api_tokens`.

Chaque jeton possède une expiration, une limite de fréquence et une liste de permissions.

Le serveur intersecte ces permissions avec les permissions actuelles du compte propriétaire.

La révocation est définitive et idempotente.

## Protection des écritures

Une requête privée du navigateur exige un jeton d'accès PASETO actif avec les permissions requises.

Une requête d'API exige un jeton d'API Bearer actif avec les permissions requises.

Le serveur sélectionne explicitement le type de Bearer par son préfixe et rejette les justificatifs mixtes.

Les routes de connexion, d'amorçage, de renouvellement et de déconnexion exigent l'origine configurée.

Les deux types de jetons exigent :

- un type de contenu accepté ;
- un corps inférieur à la limite configurée ;
- une limite de fréquence disponible.

Le serveur ne journalise jamais les mots de passe, les cookies, les Bearer ou les jetons de permalien.

Les réponses privées utilisent `Cache-Control: no-store`.

## Autorisation

Le jeton PASETO ne contient aucun rôle et aucune permission.

Le serveur charge le compte, ses rôles et ses permissions depuis SQLite après validation du jeton.

Chaque endpoint vérifie une permission et la portée de la ressource.

Le guard Angular améliore seulement la navigation.

Les permissions initiales sont :

```text
client.read
client.create
client.update
client.archive
client.access.create

quote.read
quote.create
quote.update
quote.delete
quote.send
quote.sign

order.read
order.create
order.update

invoice.read
invoice.create
invoice.update
invoice.issue
invoice.send
invoice.mark-paid
invoice.void

template.read
template.select

document.render
document.download

user.read
user.create
user.update
session.manage
audit.read
```

L'administrateur initial reçoit toutes les permissions.

Un administrateur peut définir ou remplacer l'adresse électronique et le mot de passe d'un compte client.

## Modèle de données

Le premier schéma contient ces tables :

- `users` ;
- `password_credentials` ;
- `refresh_sessions` ;
- `api_tokens` ;
- `api_token_permissions` ;
- `roles` ;
- `permissions` ;
- `user_roles` ;
- `role_permissions` ;
- `clients` ;
- `client_contacts` ;
- `issuer_settings` ;
- `quotes` ;
- `quote_lines` ;
- `quote_revisions` ;
- `quote_links` ;
- `quote_signatures` ;
- `orders` ;
- `invoices` ;
- `invoice_lines` ;
- `invoice_revisions` ;
- `document_artifacts` ;
- `audit_events` ;
- `idempotency_keys`.

Les clés internes utilisent des ULID.

Les ULID sont validés par SQLite et par les schémas Effect générés depuis Drizzle.

Les identifiants publics et les jetons ne révèlent aucune clé interne séquentielle.

## Montants

Le serveur ne calcule jamais un montant avec un nombre flottant.

Le modèle utilise :

- des prix en centimes ;
- des quantités en millièmes ;
- des taux de TVA en points de base ;
- la devise EUR pour la première version.

Le serveur calcule tous les sous-totaux, les taxes et les totaux.

Le client affiche les résultats du serveur.

## Cycle des devis

Un devis suit ce cycle :

```text
draft → sent → accepted
             → rejected
             → expired
```

Un devis envoyé devient immuable.

Une modification ultérieure crée une nouvelle révision.

L'acceptation crée une commande dans la même transaction.

## Cycle des factures

Une facture suit ce cycle :

```text
draft → issued → paid
               → void
```

Le serveur attribue le numéro lors de l'émission.

L'attribution du numéro est transactionnelle et idempotente.

Une facture émise devient immuable.

Une correction comptable future utilisera un avoir distinct.

## Templates Typst

`packages/documents` contient les entrées validées et les templates Typst locaux.

Le package fournit trois templates :

```text
quote.typ
invoice.typ
order.typ
```

Chaque template possède un identifiant stable et une version entière.

Chaque révision conserve les données complètes nécessaires au rendu.

Le snapshot contient l'émetteur, le client, les lignes, les totaux et les conditions.

Le snapshot conserve aussi l'identifiant et la version du template.

Le rendu reçoit des valeurs déjà formatées en français par TypeScript.

Le serveur compile chaque document dans un répertoire temporaire isolé.

Typst produit directement un PDF A4 avec les polices locales embarquées.

Un service Effect limite les compilations concurrentes et supprime chaque répertoire temporaire.

## Permaliens

Chaque permalien contient un jeton aléatoire de 256 bits.

SQLite conserve seulement son condensat.

Un permalien référence une révision précise.

Il possède une expiration, une révocation et une politique d'utilisation.

Une signature consomme le permalien dans une transaction.

## Preuve électronique

Une preuve de signature conserve ces éléments :

- le snapshot signé ;
- l'empreinte du snapshot ;
- le nom du signataire ;
- le consentement explicite ;
- la signature saisie ou dessinée ;
- l'heure du serveur ;
- l'adresse IP ;
- le user-agent ;
- le permalien utilisé ;
- l'empreinte du PDF final ;
- l'événement d'audit associé.

La signature, l'acceptation et la création de la commande sont atomiques.

Cette preuve ne constitue pas une signature qualifiée eIDAS.

## Interface

Le premier programme comprend ces écrans :

- connexion par adresse électronique et mot de passe ;
- tableau de bord ;
- gestion des clients ;
- gestion des identifiants de connexion client ;
- éditeur de devis ;
- éditeur de factures ;
- aperçu PDF des documents ;
- historique des révisions ;
- gestion des permaliens ;
- consultation des signatures ;
- téléchargement PDF ;
- journal d'audit ;
- révocation des sessions de renouvellement ;
- informations de version du déploiement.

La page de version affiche chaque package du workspace avec sa version publiée.

Elle affiche aussi le commit Git exact.

Le serveur fournit ces informations depuis des métadonnées injectées pendant la construction.

Ces métadonnées proviennent uniquement d'entrées versionnées afin de préserver la reproductibilité Nix.

L'interface ne déduit aucune version depuis ses propres fichiers statiques.

Les éditeurs utilisent les Signals Forms.

Les sauvegardes utilisent une version optimiste pour détecter les modifications concurrentes.

## Déploiement

Une image OCI contient le serveur Effect, le site Angular, Typst et les polices des documents.

Le serveur Effect sert l'API et les fichiers Angular sous la même origine.

Cette topologie évite CORS et les cookies inter-origines.

Le volume persistant contient la base SQLite.

Les endpoints de santé distinguent la disponibilité du processus et celle de la base.

### Taille de l'image PDF-001

Les tailles ci-dessous utilisent l'archive Nix compressée et la somme des couches indiquée par Skopeo.

| Rendu    | Révision                                   | Archive compressée | Couches décompressées |
| -------- | ------------------------------------------ | -----------------: | --------------------: |
| Chromium | `98025b46190089757d4ee77d31548a1239c927c9` | 735 683 638 octets |  2 148 956 160 octets |
| Typst    | répertoire PDF-001 du 22 août 2026         | 116 837 296 octets |    328 744 960 octets |

## Observabilité

Le serveur génère un identifiant UUID pour chaque requête.

Il retourne cet identifiant dans `X-Request-ID` et l'ajoute aux journaux structurés.

Le client conserve cet identifiant avec toute erreur HTTP décodée.

Le middleware HTTP Effect accepte les contextes W3C `traceparent` entrants.

L'export OTLP reste désactivé par défaut.

Pour activer l'export des traces, configurez ces variables :

```text
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example
```

Le serveur ajoute automatiquement `/v1/traces` à l'endpoint OTLP général.

Utilisez `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` pour fournir l'URL complète du signal.

Utilisez `OTEL_SDK_DISABLED=true` pour interdire explicitement tout export.

## Ordre de livraison

1. Migrer le dépôt vers pnpm et déplacer Angular dans `packages/web`.
2. Adapter Nix, la CI, VS Code et la documentation.
3. Créer `contracts`, `api` et `documents`.
4. Ajouter le serveur Effect et le service des fichiers statiques.
5. Ajouter Drizzle, SQLite et les migrations.
6. Ajouter l'amorçage administrateur à usage unique.
7. Ajouter les mots de passe, PASETO, les sessions de renouvellement, les rôles et les permissions.
8. Ajouter la gestion des clients et de leurs identifiants de connexion.
9. Ajouter l'éditeur et le cycle des devis.
10. Ajouter les templates Typst et le rendu PDF local.
11. Ajouter le stockage des PDF.
12. Ajouter les permaliens et la signature.
13. Créer les commandes après acceptation.
14. Ajouter les factures et leur numérotation.
15. Ajouter l'audit, les sauvegardes, l'observabilité et la page de version du déploiement.
16. Ajouter les tests de bout en bout.
17. Construire et publier l'image OCI finale.

Chaque étape produit un système exécutable et un commit atomique.

## Parcours d'acceptation

Le parcours final est :

```text
amorçage administrateur ou connexion administrateur
→ création d'un client
→ création d'un devis
→ génération du PDF
→ création du permalien
→ signature publique
→ création de la commande
→ création et émission de la facture
→ téléchargement du PDF
→ contrôle du journal d'audit
```

Le programme doit passer ces validations :

- tests Angular ;
- tests Effect ;
- tests des contrats ;
- tests SQLite sur une base temporaire ;
- matrice des permissions ;
- tests des jetons d'accès, du renouvellement, de la rotation et de la révocation ;
- tests d'origine des routes sensibles au cookie ;
- tests de concurrence sur la signature ;
- tests de numérotation ;
- tests des transitions métier ;
- tests du rendu PDF Typst ;
- génération PDF ;
- parcours de bout en bout ;
- build Angular ;
- build API ;
- pré-rendu public ;
- `nix flake check` ;
- construction de l'image OCI.
