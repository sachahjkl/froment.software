# Revue complète du code

Date : 2026-08-20

Référence : copie de travail courante au-dessus du commit `6469700e`.

## Résumé

La revue couvre les sources suivies du monorepo. Elle exclut `node_modules`, `dist` et `.deploy`.

La revue a trouvé 50 défauts encore présents :

- 9 défauts de priorité haute ;
- 29 défauts de priorité moyenne ;
- 12 défauts de priorité basse.

Traitez d'abord `REV-001` à `REV-009`. Ces défauts concernent l'intégrité métier, la sécurité et la CI.

## Contrôles exécutés

| Contrôle                                                  | Résultat                    |
| --------------------------------------------------------- | --------------------------- |
| `nix develop -c pnpm build`                               | Réussi                      |
| `nix develop -c pnpm test`                                | Réussi, 129 tests           |
| `corepack pnpm lint`                                      | Réussi, 159 fichiers source |
| `corepack pnpm format:check`                              | Réussi, 290 fichiers        |
| `nix build .#checks.x86_64-linux.test --print-build-logs` | Échec dans les tests API    |

Les contrôles réussis ne couvrent pas plusieurs scénarios ci-dessous.

## Priorité haute

### REV-001 - Une migration publiée a été modifiée

- Références : `packages/api/drizzle/20260820090553_client_role/migration.sql:1-3`, `packages/api/src/database/database.ts:46-49`.
- Scénario : une base a déjà appliqué l'ancienne migration avec `INSERT OR IGNORE`.
- Défaut : Drizzle ne rejoue pas le fichier modifié sur cette base.
- Impact : les bases neuves et existantes peuvent avoir des rôles différents.
- Correction : restaurez la migration publiée. Ajoutez une nouvelle migration corrective.
- Test attendu : migrez une base créée avant le correctif et vérifiez le rôle `client`.

### REV-002 - L'émission d'une facture peut réussir avant l'échec HTTP

- Références : `packages/api/src/invoices/invoices.ts:625-747`, `packages/api/src/server.ts:655-668`.
- Scénario : SQLite valide l'émission, puis Chromium ou le stockage du PDF échoue.
- Défaut : l'API retourne une erreur après l'émission et la consommation du numéro.
- Impact : le client croit à un échec. La facture reste émise sans PDF.
- Correction : enregistrez une tâche de rendu durable avec l'émission. Exposez son état et sa reprise idempotente.
- Test attendu : forcez l'échec du rendu après le commit, puis relancez l'opération.

### REV-003 - Un devis expiré reste bloqué dans l'état `sent`

- Références : `packages/api/src/quotes/quote-links.ts:221-240`, `packages/api/src/quotes/quotes.ts:431-432`.
- Scénario : le lien atteint sa date d'expiration.
- Défaut : les lectures refusent le lien, mais aucun code ne passe le devis à `expired`.
- Impact : le devis ne peut plus être signé, révisé ou renvoyé.
- Correction : ajoutez une transition atomique vers `expired` avant les opérations concernées.
- Test attendu : avancez l'horloge après l'expiration et vérifiez la nouvelle transition.

### REV-004 - L'archivage d'un client laisse ses liens publics actifs

- Références : `packages/api/src/clients/clients.ts:178-195`, `packages/api/src/quotes/quote-links.ts:221-240`, `packages/api/src/quotes/quote-links.ts:287-319`.
- Scénario : archivez un client après l'envoi d'un devis, puis utilisez le lien existant.
- Défaut : l'archivage révoque les accès et sessions, mais pas les liens de devis.
- Impact : le lien expose encore le document et peut créer une commande.
- Correction : révoquez les liens ouverts pendant l'archivage. Vérifiez aussi que le client reste actif.
- Test attendu : archivez le client, puis refusez consultation, PDF et signature.

### REV-005 - Les contrats acceptent des totaux contradictoires

- Références : `packages/contracts/src/quotes.ts:100-125`, `packages/contracts/src/invoices.ts:72-93`.
- Scénario : décodez une ligne avec `netTotalCents: 999`, `vatTotalCents: 999` et `totalCents: 1`.
- Défaut : les schémas vérifient chaque entier sans vérifier les calculs.
- Impact : un document peut présenter des lignes et des totaux incompatibles.
- Correction : vérifiez les calculs, les agrégats, les positions et les identifiants avec `BigInt`.
- Test attendu : rejetez chaque incohérence de ligne et de document.

### REV-006 - Le rendu monétaire perd des centimes

- Références : `packages/documents/src/quote-default-template.ts:22-29`, `packages/documents/src/invoice-default-template.ts:22-29`.
- Scénario : formatez `9007199254740991` centimes.
- Défaut : la division flottante produit `...,90 EUR` au lieu de `...,91 EUR`.
- Impact : deux montants différents peuvent produire le même document légal.
- Correction : formatez les entiers avec `BigInt` ou réduisez la plage autorisée.
- Test attendu : testez les trois valeurs proches de `Number.MAX_SAFE_INTEGER`.

### REV-007 - Les pull requests exécutent du code sur un runner persistant

- Références : `.github/workflows/ci.yml:7`, `.github/workflows/ci.yml:16-23`.
- Scénario : une pull request modifie `flake.nix` ou un script exécuté par `nix flake check`.
- Défaut : le travail utilise un runner `self-hosted` persistant.
- Impact : du code non approuvé peut attaquer le runner et son démon Nix.
- Correction : utilisez un runner éphémère sans secret pour les pull requests.
- Test attendu : vérifiez qu'une pull request externe ne reçoit aucun runner persistant.

### REV-008 - Chromium fonctionne sans sandbox avec l'utilisateur root

- Références : `packages/api/src/documents/document-renderer.ts:37-41`, `flake.nix:125-142`.
- Scénario : Chromium traite un document contenant des données contrôlées par un utilisateur.
- Défaut : l'image ne définit aucun utilisateur et lance Chromium avec `--no-sandbox`.
- Impact : une faille Chromium donne un accès root au conteneur et au volume SQLite.
- Correction : exécutez l'image avec un utilisateur non-root. Supprimez `--no-sandbox`.
- Test attendu : vérifiez l'identité du processus et le démarrage de Chromium avec sandbox.

### REV-009 - La dérivation Nix des tests échoue

- Références : `flake.nix:100-123`, `flake.nix:171`, `packages/api/package.json:13`.
- Scénario : exécutez `nix build .#checks.x86_64-linux.test --print-build-logs`.
- Défaut : les tests API quittent avec le code 1 dans le sandbox Nix.
- Impact : `nix flake check` échoue en CI malgré le succès des tests locaux.
- Correction : activez un reporter non interactif. Identifiez ensuite la dépendance absente du sandbox.
- Test attendu : exécutez la dérivation deux fois sur une machine sans cache local.

## Priorité moyenne

### REV-010 - La rotation d'un accès client ne révoque pas les anciens accès

- Références : `packages/api/src/clients/clients.ts:213-260`.
- Scénario : créez un nouvel accès après la fuite du précédent.
- Impact : l'ancien identifiant reste valide sans expiration.
- Correction : révoquez les anciens identifiants et leurs sessions dans la transaction.

### REV-011 - Les connexions réussies peuvent remplir la base

- Références : `packages/api/src/authentication/authentication.ts:150-203`.
- Scénario : appelez continuellement la connexion avec un identifiant valide.
- Impact : chaque appel crée une session et un événement d'audit permanents.
- Correction : limitez aussi les connexions réussies avant la transaction.

### REV-012 - Les consultations et PDF publics ne sont pas limités

- Références : `packages/api/src/server.ts:521-546`, `packages/api/src/server.ts:549-563`.
- Scénario : téléchargez continuellement le PDF avec un jeton valide.
- Impact : l'attaquant consomme la bande passante et les lectures SQLite.
- Correction : limitez consultation, téléchargement et signature par adresse et condensat du jeton.

### REV-013 - Les révisions de devis et artefacts restent mutables

- Références : `packages/api/drizzle/20260819201456_gray_quasar/migration.sql:1-61`, `packages/api/src/documents/document-artifacts.ts:238-285`.
- Scénario : modifiez une révision ou un blob PDF directement dans SQLite après signature.
- Impact : le portail peut servir un contenu différent de la preuve signée.
- Correction : interdisez les mises à jour et suppressions avec des triggers. Vérifiez le hash à la lecture.

### REV-014 - Les clés étrangères ne garantissent pas la cohérence métier

- Références : `packages/api/src/database/schema.ts:540-568`, `packages/api/src/database/schema.ts:572-609`.
- Scénario : associez une commande à une révision d'un autre devis.
- Impact : une migration ou un futur défaut peut attribuer un document au mauvais client.
- Correction : ajoutez des clés composites ou des triggers pour chaque relation métier.

### REV-015 - Le contrôle des clés étrangères arrive après le commit

- Références : `packages/api/src/database/database.ts:46-55`.
- Scénario : une migration introduit une référence invalide.
- Impact : la migration reste enregistrée comme appliquée avant l'échec du démarrage.
- Correction : exécutez le contrôle dans la transaction du migrateur avant son journal.

### REV-016 - Les horodatages valident seulement leur forme

- Références : `packages/contracts/src/quotes.ts:18-20`, `packages/contracts/src/invoices.ts:24-26`, `packages/contracts/src/client-portal.ts:11-14`.
- Scénario : décodez `2026-99-99T99:99:99.999Z`.
- Impact : un rendu peut recevoir une date impossible et lever `RangeError`.
- Correction : utilisez un schéma partagé qui valide et canonicalise l'instant UTC.

### REV-017 - Le devis dépend du fuseau du processus

- Références : `packages/documents/src/quote-default-template.ts:36-38`.
- Scénario : rendez un instant proche de minuit dans deux fuseaux.
- Impact : le même snapshot produit deux dates différentes.
- Correction : imposez `timeZone: 'UTC'` ou le fuseau métier explicite.

### REV-018 - La date d'émission utilise toujours le jour UTC

- Références : `packages/api/src/invoices/invoices.ts:677-678`.
- Scénario : émettez une facture à 00:30 en France pendant l'heure d'été.
- Impact : le jour légal peut différer du jour métier attendu.
- Correction : configurez le fuseau métier et stockez une date d'émission explicite.

### REV-019 - `expectedVersion` est ignoré après l'émission

- Références : `packages/api/src/invoices/invoices.ts:634-659`.
- Scénario : émettez en version 3, puis répétez avec `expectedVersion: 1`.
- Impact : une interface obsolète reçoit un faux succès.
- Correction : acceptez seulement la version finale ou la version ayant déclenché l'émission.

### REV-020 - Deux éditeurs Angular gardent l'identifiant initial

- Références : `packages/web/src/app/pages/back-office/quote-editor/quote-editor.ts:91-93`, `packages/web/src/app/pages/back-office/invoice-editor/invoice-editor.ts:106-108`.
- Scénario : naviguez directement du document A au document B dans la SPA.
- Impact : l'URL affiche B, mais le composant peut lire et modifier A.
- Correction : lisez `paramMap` réactivement et réinitialisez l'état à chaque identifiant.

### REV-021 - Le bouton d'émission reste actif avec des changements non enregistrés

- Références : `packages/web/src/app/pages/back-office/invoice-editor/invoice-editor.ts:177-181`, `packages/web/src/app/pages/back-office/invoice-editor/invoice-editor.html:215`.
- Scénario : modifiez le brouillon, puis activez le bouton d'émission.
- Impact : le bouton ne produit aucun résultat, car `issue()` refuse l'état sale.
- Correction : ajoutez l'état sale, la validité et le statut à `issueDisabled`.

### REV-022 - Le formulaire public masque ses erreurs

- Références : `packages/web/src/app/pages/public-quote/public-quote.html:94-116`, `packages/web/src/app/pages/public-quote/public-quote.ts:71`.
- Scénario : omettez un champ ou dépassez 160 caractères.
- Impact : le bouton reste désactivé sans expliquer la correction nécessaire.
- Correction : affichez chaque erreur avec `aria-invalid` et `aria-describedby`.

### REV-023 - Plusieurs formulaires privés masquent leurs erreurs

- Références : `packages/web/src/app/pages/back-office/issuer-settings/issuer-settings.ts:42-65`, `packages/web/src/app/pages/back-office/clients/clients.ts:48-68`, `packages/web/src/app/pages/back-office/quote-condition-presets/quote-condition-presets.html:9-27`.
- Scénario : dépassez une longueur maximale.
- Impact : le bouton devient désactivé sans désigner le champ incorrect.
- Correction : affichez et reliez les erreurs de chaque contrôle.

### REV-024 - Le chargement initial peut effacer un client créé

- Références : `packages/web/src/app/pages/back-office/clients/clients.ts:73-103`, `packages/web/src/app/pages/back-office/clients/clients.ts:146-153`.
- Scénario : créez un client avant la fin du chargement initial.
- Impact : la réponse initiale tardive remplace la liste enrichie.
- Correction : bloquez la création pendant le chargement ou ignorez la réponse périmée.

### REV-025 - Le rechargement des modèles efface son erreur

- Références : `packages/web/src/app/pages/back-office/quote-condition-presets/quote-condition-presets.ts:66-84`, `packages/web/src/app/pages/back-office/quote-condition-presets/quote-condition-presets.ts:93-98`.
- Scénario : l'enregistrement réussit, puis le rechargement échoue.
- Impact : `cancel()` efface l'erreur et laisse une liste périmée.
- Correction : appelez `cancel()` seulement après un rechargement réussi.

### REV-026 - Le tiroir mobile n'isole pas le reste du document

- Références : `packages/web/src/app/shared/mobile-navigation/mobile-navigation.ts:20-40`.
- Scénario : ouvrez le tiroir avec un lecteur d'écran.
- Impact : les contrôles masqués derrière le tiroir restent parcourables.
- Correction : utilisez un dialogue modal nommé et rendez le contenu extérieur `inert`.

### REV-027 - Les tableaux horizontaux ne sont pas accessibles au clavier

- Références : `packages/web/src/styles.scss:86-100`, `packages/web/src/app/shared/data-table/data-table.ts:3-6`.
- Scénario : un tableau dépasse la largeur sans contrôle focalisable interne.
- Impact : le clavier ne peut pas faire défiler le contenu horizontal.
- Correction : rendez le conteneur focalisable et donnez-lui un nom accessible.

### REV-028 - L'origine de production est imposée dans l'image

- Références : `flake.nix:87-95`, `packages/api/src/server.ts:829-832`.
- Scénario : démarrez l'image sur une origine de préproduction.
- Impact : les mutations échouent et les liens utilisent le domaine de production.
- Correction : fournissez `PUBLIC_ORIGIN` au déploiement. N'imposez pas sa valeur dans le wrapper.

### REV-029 - Deux publications peuvent faire régresser `latest`

- Références : `.github/workflows/ci.yml:25-28`, `.github/workflows/ci.yml:42-59`.
- Scénario : un ancien travail finit après un travail plus récent.
- Impact : l'ancien travail remplace le tag `latest`.
- Correction : ajoutez un groupe `concurrency` et annulez les publications anciennes.

### REV-030 - Skopeo n'est pas lié au `flake.lock`

- Références : `.github/workflows/ci.yml:54-59`, `flake.lock:21-34`.
- Scénario : le registre Nix du runner change entre deux publications.
- Impact : une même révision utilise différentes versions de Skopeo.
- Correction : exposez Skopeo depuis l'entrée verrouillée du flake.

### REV-031 - Une copie de travail modifiée ne peut pas vérifier l'image

- Références : `flake.nix:28-35`, `flake.nix:167`.
- Scénario : exécutez `nix flake check` avant le commit.
- Impact : le contrôle `dockerImage` exige `self.rev` et bloque la validation locale.
- Correction : utilisez `self.dirtyRev` pour les contrôles. Exigez `self.rev` seulement à la publication.

### REV-032 - Le lint exclut des fichiers TypeScript suivis

- Références : `package.json:11`, `packages/api/tsconfig.json:8`, `tools/oxlint/anti-slop/index.ts:1`.
- Scénario : introduisez un défaut lint dans un test, une configuration ou le plugin local.
- Impact : la CI annonce un lint réussi sans examiner ce fichier.
- Correction : analysez tous les fichiers TypeScript suivis et compilez le plugin local.

### REV-033 - Les migrations s'exécutent dans chaque démarrage applicatif

- Références : `packages/api/src/database/database.ts:39-58`, `packages/api/src/main.ts:41`.
- Scénario : déployez une nouvelle image, puis revenez à l'ancienne.
- Impact : l'ancienne image peut lire un schéma déjà transformé.
- Correction : exécutez les migrations dans une étape dédiée avec sauvegarde et contrôle de compatibilité.

### REV-034 - Le jeton CSRF peut entrer dans les traces HTTP

- Références : `packages/api/src/server.ts:181-187`, `packages/api/src/server.ts:810-816`.
- Scénario : une mutation place le jeton dans `x-csrf-token` pendant le traçage.
- Impact : les lecteurs du système de traces peuvent obtenir le jeton.
- Correction : ajoutez cet en-tête à la liste de masquage du traceur.

### REV-035 - `formatTranslation` interprète les séquences `$`

- Références : `packages/l10n/src/index.ts:1805-1813`.
- Scénario : utilisez une valeur comme `$&` dans un paramètre.
- Impact : `replaceAll` injecte le texte trouvé au lieu de la valeur littérale.
- Correction : utilisez `replaceAll(token, () => String(replacement))`.

### REV-036 - La date du portail client accepte des jours impossibles

- Références : `packages/contracts/src/client-portal.ts:14`, `packages/contracts/src/client-portal.ts:46-56`.
- Scénario : décodez `dueDate: '2026-02-31'`.
- Impact : le portail peut afficher une échéance impossible.
- Correction : réutilisez `CalendarDate` depuis le contrat de facture.

### REV-037 - Les snapshots n'imposent pas de limite de lignes

- Références : `packages/contracts/src/quotes.ts:110-126`, `packages/contracts/src/invoices.ts:72-93`.
- Scénario : décodez un snapshot avec plusieurs milliers de lignes.
- Impact : le rendu consomme du temps et de la mémoire sans borne contractuelle.
- Correction : imposez la même limite de 20 lignes que les requêtes.

### REV-038 - Le téléchargement public ne vérifie pas le hash du PDF

- Références : `packages/api/src/quotes/quote-links.ts:265-276`, `packages/api/src/quotes/quote-links.ts:328-330`.
- Scénario : altérez le blob après son stockage, puis téléchargez-le sans signature.
- Impact : le serveur livre un PDF corrompu. Le contrôle existe seulement pendant la signature.
- Correction : vérifiez le hash avant chaque lecture sensible.

## Priorité basse

### REV-039 - L'archivage répété produit de faux événements

- Références : `packages/api/src/clients/clients.ts:178-203`.
- Scénario : archivez deux fois le même client.
- Impact : l'audit contient plusieurs événements pour une seule transition.
- Correction : retournez sans écriture si le client est déjà archivé.

### REV-040 - Le bootstrap utilise un hash SHA-512 rapide

- Références : `packages/api/src/authentication/authentication-config.ts:4`, `packages/api/src/bootstrap/bootstrap.ts:66-70`.
- Scénario : une fuite de configuration expose le hash d'un mot de passe humain.
- Impact : une recherche hors ligne peut retrouver un mot de passe faible.
- Correction : utilisez Argon2id ou scrypt avec sel et paramètres explicites.

### REV-041 - Les versions d'URL dépassent la plage sûre

- Références : `packages/contracts/src/api.ts:86-89`.
- Scénario : décodez `9007199254740993` depuis l'URL.
- Impact : JavaScript arrondit la valeur et peut cibler une autre version.
- Correction : limitez la valeur à `Number.MAX_SAFE_INTEGER`.

### REV-042 - Le schéma de lien accepte des URL invalides

- Références : `packages/contracts/src/quotes.ts:188-197`.
- Scénario : décodez `https://?`.
- Impact : le contrat accepte un lien inutilisable.
- Correction : utilisez une validation URL réelle et exigez HTTPS si le déploiement l'impose.

### REV-043 - Plusieurs noms de réponse acceptent seulement des espaces

- Références : `packages/contracts/src/clients.ts:14`, `packages/contracts/src/orders.ts:19`, `packages/contracts/src/quotes.ts:152`, `packages/contracts/src/invoices.ts:99`.
- Scénario : décodez `displayName: '   '`.
- Impact : les sorties acceptent un état refusé par les entrées.
- Correction : partagez le même schéma contenant `/\S/`.

### REV-044 - La structure publique contient deux éléments `main` imbriqués

- Références : `packages/web/src/app/app.html:4`, `packages/web/src/app/pages/public-quote/public-quote.html:1`.
- Impact : les repères principaux deviennent ambigus pour les lecteurs d'écran.
- Correction : remplacez le `main` interne par `section` ou `div`.

### REV-045 - Une longue description peut dépasser sur mobile

- Références : `packages/web/src/app/pages/public-quote/public-quote.scss:103-114`, `packages/web/src/app/pages/public-quote/public-quote.html:45-53`.
- Scénario : affichez une chaîne longue sans espace.
- Impact : la page déborde horizontalement.
- Correction : ajoutez `min-width: 0` et `overflow-wrap: anywhere`.

### REV-046 - Une page de blog absente conserve les anciennes métadonnées

- Références : `packages/web/src/app/pages/blog-post/blog-post.ts:29-35`, `packages/web/src/app/page-metadata.ts:90`.
- Scénario : naviguez d'un article valide vers un slug inconnu.
- Impact : le titre et les données structurées décrivent encore l'ancien article.
- Correction : effacez les métadonnées quand `post()` devient absent.

### REV-047 - Un nom accessible public reste en français

- Références : `packages/web/src/app/pages/public-quote/public-quote.html:26`.
- Scénario : sélectionnez l'anglais.
- Impact : le lecteur d'écran annonce « Résumé du devis » dans une page anglaise.
- Correction : remplacez le texte statique par une traduction.

### REV-048 - SQLite accepte des dates et numéros trop faibles

- Références : `packages/api/src/database/schema.ts:602-604`, `packages/api/src/database/schema.ts:649-660`.
- Scénario : stockez `2026-02-31` ou un numéro avec un suffixe non numérique.
- Impact : une migration peut créer une ligne rejetée ensuite par les contrats.
- Correction : ajoutez des contraintes qui valident le calendrier et chaque chiffre.

### REV-049 - La commande Podman publie le mauvais port

- Références : `README.md:88-91`, `flake.nix:139-140`.
- Impact : le service ne répond pas sur le port 8080 avec la commande documentée.
- Correction : documentez `-p 8080:3000`.

### REV-050 - Aucun seuil de couverture ne protège les chemins sensibles

- Références : `package.json:9`, `packages/api/package.json:13`, `packages/web/angular.json:101-106`.
- Impact : la suppression de tests ou un nouveau chemin non testé ne fait pas échouer la CI.
- Correction : activez la couverture et imposez des seuils pour l'API, l'authentification et les migrations.

## Ordre de traitement proposé

1. Corrigez les migrations et l'émission de facture.
2. Corrigez le cycle de vie des devis et l'archivage client.
3. Corrigez les contrats et le formatage des montants.
4. Isolez les runners et activez la sandbox Chromium.
5. Réparez la dérivation Nix des tests.
6. Traitez les défauts moyens par domaine.
7. Terminez par les défauts bas et la couverture.

## Limites de la revue

La copie de travail a changé pendant la revue. Ce rapport décrit l'état relu après ces changements.

La revue n'a pas exécuté de test avec un vrai fournisseur OTLP. Vérifiez donc `REV-034` avec la configuration de production.

La revue n'a pas testé l'interface avec un lecteur d'écran réel. Les constats d'accessibilité viennent du DOM et du comportement clavier.
