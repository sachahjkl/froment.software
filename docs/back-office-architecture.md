# Architecture du back-office

## Statut

Ce document décrit l'architecture cible du back-office de Froment Software.

Les décisions suivantes sont validées :

- Effect v4 RC pour les effets, les contrats HTTP et le serveur.
- Angular 22 pour l'interface et les templates de documents.
- pnpm pour le workspace.
- Drizzle ORM avec SQLite pour la persistance.
- Une seule instance applicative avec un volume persistant.
- Des sessions serveur dans des cookies sécurisés.
- Un identifiant secret comme seul justificatif de connexion.
- Une preuve électronique pour la signature des devis.
- Les PDF et les preuves sont stockés comme BLOB dans SQLite.
- Le premier programme de livraison couvre le flux métier complet.

## Workspace

Le dépôt contient quatre packages :

```text
packages/
├── web/          # Application Angular
├── api/          # Serveur Effect
├── contracts/    # Schémas Effect et description HttpApi
└── documents/    # Templates Angular des documents
```

Le package racine orchestre les commandes pnpm, le formatage, les tests et les builds.

`packages/contracts` ne dépend ni du navigateur, ni de SQLite.

`packages/documents` expose les composants Angular et le rendu HTML côté serveur.

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

L'identifiant de connexion est un secret opaque d'au moins 256 bits.

Une route dédiée permet l'amorçage du premier administrateur.

Cette route reste disponible seulement tant qu'aucun administrateur n'existe.

Le formulaire d'amorçage accepte un mot de passe simple.

Le serveur calcule le SHA-512 du mot de passe et compare le condensat en temps constant.

La variable obligatoire `BOOTSTRAP_PASSWORD_SHA512` contient ce condensat hexadécimal.

La variable obligatoire `ACCESS_HMAC_KEY` contient une clé aléatoire de 32 octets en base64url.

La variable obligatoire `SESSION_HMAC_KEY` contient une autre clé aléatoire de 32 octets en base64url.

Le bundle Angular ne contient ni mot de passe, ni condensat de mot de passe.

Une transaction unique crée le compte, le rôle administrateur et toutes ses permissions.

La même transaction rend les amorçages concurrents impossibles.

Le serveur ouvre ensuite une session sécurisée pour le nouvel administrateur.

La page de résultat affiche l'ULID du compte et l'identifiant secret.

La page propose une action de copie pour chaque valeur.

Le composant de copie reprend l'objectif ergonomique de Clockin sans reprendre son implémentation ni son apparence.

L'ULID identifie le compte. Il ne constitue pas un justificatif secret.

Le flux de connexion est le suivant :

1. L'utilisateur saisit son identifiant.
2. Le navigateur appelle `POST /api/auth/login`.
3. Le serveur calcule un HMAC avec un pepper distinct.
4. Le serveur compare le condensat avec l'accès configuré.
5. Le serveur crée une session aléatoire.
6. Le serveur place le jeton de session dans un cookie `HttpOnly`.

Le navigateur ne stocke aucun justificatif dans `localStorage` ou `sessionStorage`.

SQLite conserve seulement le condensat du jeton de session.

Le cookie de production utilise ces attributs :

- `HttpOnly` ;
- `Secure` ;
- `SameSite=Strict` ;
- `Path=/` ;
- une expiration absolue ;
- une expiration après inactivité.

La déconnexion révoque la session côté serveur.

Une rotation de l'identifiant administrateur révoque ses sessions existantes.

Le serveur retourne une erreur uniforme pour un identifiant absent ou invalide.

Le serveur ne fournit aucun endpoint public de vérification d'identifiant.

## Protection des écritures

Chaque écriture authentifiée exige :

- une session active ;
- un jeton CSRF lié à cette session ;
- une origine autorisée ;
- un type de contenu accepté ;
- un corps inférieur à la limite configurée ;
- une limite de fréquence disponible.

Le serveur ne journalise jamais les identifiants, les cookies ou les jetons de permalien.

Les réponses privées utilisent `Cache-Control: no-store`.

## Autorisation

Le cookie ne contient aucun rôle et aucune permission.

Le serveur charge le principal et ses permissions depuis SQLite.

Chaque endpoint vérifie une permission et la portée de la ressource.

Le guard Angular améliore seulement la navigation.

Les permissions initiales sont :

```text
client.read
client.create
client.update
client.archive

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

Un administrateur peut créer un accès client aléatoire.

Le serveur affiche cet identifiant une seule fois.

## Modèle de données

Le premier schéma contient ces tables :

- `users` ;
- `access_credentials` ;
- `sessions` ;
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

## Templates Angular

`packages/documents` contient des composants Angular autonomes.

La première version fournit ces templates :

```text
QuoteDefaultTemplate
InvoiceDefaultTemplate
SignatureEvidenceTemplate
```

Chaque template possède un identifiant stable et une version entière.

Chaque révision conserve les données complètes nécessaires au rendu.

Le snapshot contient l'émetteur, le client, les lignes, les totaux et les conditions.

Le snapshot conserve aussi l'identifiant et la version du template.

Les anciennes versions restent disponibles pour reproduire les anciens documents.

Le serveur utilise `renderApplication()` pour produire le HTML.

Chromium produit ensuite un PDF A4 avec les arrière-plans d'impression.

Un service Effect conserve une instance Chromium et limite les rendus concurrents.

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

- connexion par identifiant ;
- tableau de bord ;
- gestion des clients ;
- gestion des accès clients ;
- éditeur de devis ;
- éditeur de factures ;
- aperçu des templates ;
- historique des révisions ;
- gestion des permaliens ;
- consultation des signatures ;
- téléchargement HTML et PDF ;
- journal d'audit ;
- gestion des sessions ;
- informations de version du déploiement.

La page de version affiche chaque package du workspace avec sa version publiée.

Elle affiche aussi le commit Git exact.

Le serveur fournit ces informations depuis des métadonnées injectées pendant la construction.

Ces métadonnées proviennent uniquement d'entrées versionnées afin de préserver la reproductibilité Nix.

L'interface ne déduit aucune version depuis ses propres fichiers statiques.

Les éditeurs utilisent les Signals Forms.

Les sauvegardes utilisent une version optimiste pour détecter les modifications concurrentes.

## Déploiement

Une image OCI contient le serveur Effect, le site Angular et Chromium.

Le serveur Effect sert l'API et les fichiers Angular sous la même origine.

Cette topologie évite CORS et les cookies inter-origines.

Le volume persistant contient la base SQLite.

Les endpoints de santé distinguent la disponibilité du processus et celle de la base.

## Ordre de livraison

1. Migrer le dépôt vers pnpm et déplacer Angular dans `packages/web`.
2. Adapter Nix, la CI, VS Code et la documentation.
3. Créer `contracts`, `api` et `documents`.
4. Ajouter le serveur Effect et le service des fichiers statiques.
5. Ajouter Drizzle, SQLite et les migrations.
6. Ajouter l'amorçage administrateur à usage unique et l'affichage copiable de son ULID.
7. Remplacer l'authentification actuelle, puis ajouter les sessions, CSRF, rôles et permissions.
8. Ajouter la gestion des clients et des accès.
9. Ajouter l'éditeur et le cycle des devis.
10. Ajouter les templates Angular et le rendu HTML.
11. Ajouter Chromium et le stockage des PDF.
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
- tests de session et de révocation ;
- tests CSRF ;
- tests de concurrence sur la signature ;
- tests de numérotation ;
- tests des transitions métier ;
- tests du rendu HTML ;
- génération PDF ;
- parcours de bout en bout ;
- build Angular ;
- build API ;
- pré-rendu public ;
- `nix flake check` ;
- construction de l'image OCI.
