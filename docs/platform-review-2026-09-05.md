# Revue de la plateforme — 5 septembre 2026

## Conclusion

Le dépôt fournit déjà un parcours client → devis → acceptation → commande → facture → paiement déclaré.
Il ne fournit pas encore une plateforme de gestion commerciale complète.
Les lacunes principales concernent la livraison des courriels, la complétude légale, les paiements, les avoirs et les automatismes.

La priorité est de fiabiliser ce parcours avant de multiplier les modules ou de déplacer l’hébergement.
Cette revue ne certifie ni la conformité juridique, ni la sécurité du déploiement.

## Périmètre et méthode

Révision initiale examinée : `42e1517b`, après récupération de quatre commits par `git pull --ff-only`.

L’examen couvre les domaines suivants :

- les schémas SQLite et les contrats HTTP partagés ;
- les services de devis, signature, commande et facture ;
- l’authentification, les permissions et les en-têtes HTTP ;
- les pages du backoffice et les composants partagés ;
- les tests, le flake Nix et le workflow de publication ;
- la documentation actuelle de Cloudflare, SST et les références réglementaires.

L’examen combine lecture ciblée, recherches transversales, tests existants et contrôles navigateur décrits dans la revue d’interface.
Il ne constitue pas une lecture exhaustive de chaque ligne du dépôt.
Aucune donnée de production ni aucun secret déchiffré n’a été utilisé.

Les outils `backlog_list`, `backlog_add` et `backlog_move` sont absents de cette session.
`BACKLOG.json` a été consulté, mais pas modifié.
Le programme ci-dessous reste une proposition à transférer dans cet outil.

## Capacités existantes

| Domaine      | État observé                                                                   | Limite actuelle                                                       |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Clients      | Création, modification, archivage, adresse, courriel, plusieurs accès portail  | Pas de fiche entreprise structurée ni de contacts métier distincts    |
| Devis        | Révisions, lignes, calculs en unités entières, PDF, liens, expiration, abandon | Le statut `sent` ne prouve aucun envoi                                |
| Signature    | Consentement, nom saisi, contexte réseau, empreintes, preuve JSON              | Pas de vérification d’identité indépendante ni de signature qualifiée |
| Commandes    | Création transactionnelle après acceptation, référence, PDF                    | Un seul état `confirmed`, sans exécution ni livraison                 |
| Factures     | Brouillon, révisions, émission numérotée, PDF durable, reprise après échec     | Une facture par commande, sans acomptes ni avoirs                     |
| Paiement     | Passage manuel à `paid`                                                        | Aucun montant encaissé, paiement partiel, moyen ou rapprochement      |
| Rappels      | Liens `mailto:` dans le détail d’une affaire                                   | Aucun envoi serveur ni calendrier persistant                          |
| Portail      | Documents limités au client connecté, plusieurs comptes                        | Pas d’invitation autonome ni de récupération de compte                |
| Sécurité     | Argon2id, cookies sécurisés, rotation des sessions, permissions, quotas        | Pas de MFA ni de gestion complète des comptes administrateurs         |
| Exploitation | Nix, image non-root, migrations explicites, OTLP, intégrité des PDF            | Sauvegardes et restaurations de production non vérifiées              |

## Constats prioritaires

`P0` désigne un préalable à la promesse de plateforme complète.
`P1` désigne une capacité nécessaire à l’usage quotidien.
`P2` désigne une extension après stabilisation du parcours.
Ces priorités ne sont pas des scores de vulnérabilité.

### P0 — L’envoi de devis ne livre aucun courriel

**Preuve :** `packages/api/src/quote-links/service.ts:124-230`.
La transaction crée un lien, passe le devis à `sent` et retourne son URL.
Elle n’appelle aucun service de messagerie.

**Impact :** l’opérateur peut croire que le client a reçu le devis.
Les relances de `packages/web/src/app/pages/back-office/affair-detail/affair-detail.ts:94-129` ouvrent seulement un logiciel de messagerie.

**Cible :** séparer l’état contractuel du devis de l’état de livraison du message.
Une outbox transactionnelle doit conserver chaque demande d’envoi avant l’appel externe.

**Acceptation :** un redémarrage conserve les messages en attente.
Un échec réseau ne produit pas un faux statut « livré ».
Un doublon d’événement ne déclenche pas une deuxième action métier.

### P0 — Les documents peuvent contenir des parties incomplètes

**Preuves :** `packages/contracts/src/documents/contracts.ts:8-24` et `packages/contracts/src/clients/contracts.ts:29-40`.
Les champs d’adresse acceptent des chaînes vides.
Le courriel de l’émetteur possède seulement une limite de longueur.

**Preuve complémentaire :** `packages/api/src/invoices/invoices.ts:744-780`.
L’émission contrôle les dates, puis reprend les parties du snapshot sans contrôle de complétude métier.

**Cible :** autoriser les brouillons incomplets, mais bloquer la publication et l’émission selon le contexte juridique.
Retourner une liste de champs manquants, avec un lien vers leur formulaire.

**Acceptation :** les règles couvrent particulier, entreprise française, entreprise européenne et client hors Union européenne.
Chaque règle s’applique dans l’API, pas seulement dans Angular.

### P0 — La preuve de signature reste locale

**Preuve :** `packages/api/src/quote-links/service.ts:309-479`.
Le signataire possède le lien et saisit un nom.
Le serveur conserve consentement, date, adresse IP, navigateur et empreintes SHA-256.

Cette preuve ne démontre pas à elle seule les exigences d’une signature avancée ou qualifiée.
Un condensat stocké avec son contenu ne protège pas contre leur remplacement conjoint par un acteur privilégié.
Le texte actuel précise déjà que la signature n’est pas qualifiée.

**Cible :** choisir explicitement le niveau de signature selon le risque contractuel.
Pour une signature avancée ou qualifiée, sélectionner un prestataire et une offre adaptés.
Le statut d’un prestataire ne qualifie pas automatiquement toutes ses offres.

**Acceptation :** conserver l’identifiant du dossier, le PDF signé, le dossier de preuve et le résultat de validation.
Vérifier l’authenticité des notifications du prestataire.
Réconcilier les dossiers dont la notification n’arrive pas.
Créer une seule commande malgré les notifications répétées ou désordonnées.

### P0 — Annulation et règlement ne constituent pas une comptabilité

**Preuves :** `packages/api/src/database/schema.ts:689-728` et `packages/api/src/invoices/invoices.ts:853-941`.
Le modèle propose `issued`, `paid` et `void`.
Le passage à `paid` ne conserve pas une opération de paiement.
Le passage à `void` ne crée pas d’avoir.

**Cible :** conserver les factures émises et produire les corrections comptables appropriées.
Ajouter les paiements, allocations, remboursements et avoirs.
Faire valider les règles d’annulation par le comptable avant leur automatisation.

**Acceptation :** un paiement partiel conserve un solde ouvert.
Un avoir possède sa référence, sa date, ses lignes et sa facture d’origine.
L’historique permet de justifier chaque variation du solde.

### P0 — La facturation électronique doit entrer dans le périmètre

**Preuve :** le schéma et les services examinés produisent des PDF, sans connecteur de plateforme agréée.
Un PDF envoyé par courriel ne remplace pas le dispositif réglementaire de facturation électronique.

Au 5 septembre 2026, l’obligation de réception a commencé pour les entreprises françaises assujetties à la TVA concernées.
L’émission devient obligatoire le 1er septembre 2027 pour les PME et microentreprises concernées.
Le périmètre dépend du type de transaction et du régime de l’entreprise.

**Cible :** sélectionner une plateforme agréée et définir les flux de réception, émission, statuts et e-reporting applicables.
Factur-X, UBL ou CII sont des formats, pas une conformité complète à eux seuls.

### P1 — Le workflow est principalement déduit des documents

**Preuve :** `packages/api/src/database/schema.ts:651-685` limite une commande à `confirmed`.
`packages/web/src/app/pages/back-office/dashboard/dashboard.ts:159-215` calcule les prochaines actions depuis les statuts.

**Cible :** ajouter responsable, prochaine action, échéance, tâches, jalons, livraison et réception client.
Commencer par une machine à états explicite, sans éditeur générique de workflows.

**Acceptation :** chaque transition définit ses permissions, préconditions, effets et événements d’audit.
Un rappel se désactive après paiement, refus, abandon ou litige selon sa règle.

### P1 — Les dates de retard ne suivent pas toutes le fuseau métier

**Preuves :** `packages/web/src/app/pages/back-office/dashboard/dashboard.ts:155-160` et `packages/web/src/app/pages/back-office/affair-detail/affair-detail.ts:115`.
Le navigateur emploie `new Date().toISOString().slice(0, 10)`.
L’émission utilise explicitement le fuseau métier, configuré sur `Europe/Paris` en production.

**Impact :** autour de minuit, le tableau de bord et la date métier peuvent diverger.

**Cible :** calculer les échéances selon une même date métier côté serveur.
Tester minuit, changements d’heure et passage d’année avec une horloge contrôlée.

### P1 — Le cycle de vie des comptes reste incomplet

**Preuves :** `packages/api/src/authentication/handlers.ts:34-124` et `packages/contracts/src/clients/contracts.ts:60-64`.
Les routes couvrent connexion, renouvellement, compte courant et déconnexion.
La création d’accès client reçoit un mot de passe choisi par l’opérateur.

**Cible :** invitations à usage unique, adresse vérifiée, choix du mot de passe, récupération, changement de mot de passe et révocation des sessions.
Ajouter une MFA pour les administrateurs et une procédure de récupération contrôlée.

**Acceptation :** aucune réponse de récupération ne révèle l’existence d’un compte.
Une invitation expirée ou consommée ne crée aucun accès.

### P1 — Le tableau de bord charge les listes complètes

**Preuve :** `packages/web/src/app/pages/back-office/dashboard/dashboard.ts:266-278`.
Le navigateur charge clients, devis, commandes et factures pour calculer indicateurs et recherche.

**Cible :** fournir des agrégats serveur et une pagination avec tri stable.
La virtualisation de l’affichage ne réduit pas les données téléchargées.

**Acceptation :** mesurer les requêtes et le rendu avec 10 000 clients et 100 000 documents synthétiques.
Définir le budget de latence après cette mesure, sans promettre une performance non testée.

### P1 — La couverture annoncée ne couvre pas toute l’API

**Preuve :** `packages/api/vitest.config.ts:7-13` sélectionne cinq fichiers.
La mesure locale donne 38,74 % de lignes et 21,48 % de branches pour `invoices.ts`.
Les seuils de ce fichier restent à 35 % de lignes et 20 % de branches.

**Cible :** couvrir toutes les transitions financières, les permissions, les doublons et les reprises après incident.
Ajouter des tests navigateur sur les parcours métier, en complément des tests HTTP et Angular.

### P1 — La documentation d’authentification est obsolète

**Preuves :** `docs/back-office-architecture.md:133-140` et `packages/api/src/authentication/http.ts:26-53`.
La documentation décrit un jeton d’accès en mémoire JavaScript.
Le code l’émet dans un cookie `HttpOnly`, `Secure`, `SameSite=Strict`.

**Cible :** distinguer architecture actuelle et cible.
Documenter les cookies, les contrôles d’origine et les limites des environnements de développement.

## Champs métier à ajouter

La complétude doit dépendre d’une action et d’un contexte, pas d’un pourcentage décoratif.

| Objet                | Données proposées                                                                                                           | Moment du contrôle            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Entreprise émettrice | Dénomination, forme juridique, immatriculation, SIREN/SIRET applicables, TVA, régime fiscal, adresse, coordonnées bancaires | Avant émission                |
| Client               | Particulier ou entreprise, raison sociale, identifiants fiscaux, pays normalisé, adresses de facturation et livraison       | Avant publication ou émission |
| Contact              | Nom, fonction, courriel, téléphone, langue, rôle de signataire, destinataire comptable                                      | Avant invitation ou envoi     |
| Devis                | Validité contractuelle distincte du lien, périmètre, exclusions, dates, délais, acompte, échéancier, conditions versionnées | Avant publication             |
| Ligne                | Unité, quantité, prix, remise, catégorie de TVA, motif d’exonération applicable                                             | Avant calcul définitif        |
| Facture              | Date de prestation, échéance, conditions de règlement, mentions de retard et recouvrement applicables                       | Avant émission                |
| Paiement             | Montant, devise, date, moyen, référence externe, allocations, justificatif                                                  | Avant rapprochement           |
| Affaire              | Responsable, prochaine action, échéance, jalons, pièces jointes, notes internes, échanges client                            | Pendant exécution             |

Ne pas modifier rétroactivement les snapshots des documents signés ou émis.
Prévoir une correction explicite des parties sur les brouillons de facture.
Le code actuel reprend le client du devis accepté, puis le conserve dans les nouvelles révisions du brouillon.

## Courriels et rappels

### Fournisseur

Cloudflare Email Service propose désormais Email Sending en bêta sur un plan Workers payant.
Son API REST peut être appelée depuis le serveur actuel.
Email Routing traite la réception et le routage, pas le cycle métier des envois.

Avant sélection, vérifier l’accès du compte, les quotas, les pièces jointes, les événements de livraison et les conditions de traitement des données.
Vérifier aussi SPF, DKIM, DMARC, domaine d’envoi, adresse de réponse et gestion des rebonds.
Le fournisseur ne doit pas être déclaré prêt sans essai réel sur un domaine validé.

### Modèle minimal

- `email_messages` conserve destinataires, langue, modèle versionné, document concerné et identifiant du fournisseur.
- `email_attempts` conserve tentatives, dates, erreurs normalisées et prochain essai.
- `email_events` déduplique les événements externes et conserve leur ordre logique.
- `reminders` conserve règle, échéance, suspension, responsable et dernier résultat.

L’outbox et la transition métier doivent être écrites dans la même transaction locale.
L’appel réseau doit se produire hors de cette transaction.
Une clé d’idempotence fournisseur est nécessaire pour sécuriser la reprise après une réponse perdue.
Sans cette garantie fournisseur, un statut indéterminé nécessite une réconciliation avant nouvel envoi.

Les liens secrets nécessitent un stockage chiffré temporaire dans l’outbox, avec une clé distincte et une durée limitée.
Le HMAC actuel protège la recherche du lien, mais ne permet pas de reconstruire son URL.
Ne pas journaliser ces liens ni activer un suivi de clics qui les expose à un service supplémentaire.

### Parcours à livrer

1. Publier un devis et envoyer son invitation.
2. Confirmer l’acceptation au client et à l’opérateur.
3. Envoyer la facture seulement après disponibilité de son PDF définitif.
4. Planifier les rappels avant et après échéance.
5. Suspendre les rappels lors d’un paiement ou d’un litige.
6. Afficher les échecs et permettre une reprise contrôlée.

Les jours de relance doivent être configurés selon les pratiques de l’entreprise.
Ne pas interpréter une ouverture de courriel comme une acceptation contractuelle.

## Signature eIDAS

L’article 25 protège l’effet juridique et l’admissibilité d’une signature électronique contre un rejet fondé uniquement sur sa forme électronique.
Il attribue à la signature qualifiée l’effet juridique d’une signature manuscrite.
L’article 26 définit les exigences de la signature avancée.

La cible ne doit donc pas se limiter à un bouton « signature eIDAS ».
Elle doit préciser le niveau, l’identification, le document signé et la preuve conservée.

Comparer les offres de prestataires comme Yousign, Universign ou DocuSign selon ces critères :

- niveau exact de signature et validation de l’identité ;
- preuve du pouvoir de représentation du signataire ;
- localisation, conservation, export et suppression des données ;
- API, notifications authentifiées, idempotence et environnement de test ;
- PDF signé, horodatage, validation à long terme et dossier de preuve ;
- prix par dossier et procédure en cas d’indisponibilité.

Ces fournisseurs sont des candidats, pas une sélection validée.
Un code reçu par courriel ne transforme pas automatiquement une signature simple en signature avancée.

## Hébergement Cloudflare et SST

L’accord de principe de l’utilisateur permet d’étudier Cloudflare.
Il ne constitue pas une validation de migration, de coûts ou de modification du DNS de production.

| Option                                                   | Conséquence                                                             | Avis                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Conserver Node/SQLite/Typst et appeler Email Service     | Aucun déplacement nécessaire pour les courriels                         | Option recommandée pour livrer les fonctionnalités     |
| Déplacer les fichiers Angular, conserver une API externe | Routage de même origine, cookies et déploiements à coordonner           | À justifier par une mesure ou un besoin d’exploitation |
| Porter l’application sur Workers                         | Remplacer les dépendances natives et revoir transactions, PDF et tâches | Décision d’architecture distincte                      |

SST sait déclarer un Worker et ses ressources liées.
Il ne rend pas compatibles les dépendances natives du serveur.
La documentation Workers liste `node:child_process` et `node:sqlite` parmi les modules non fonctionnels.
Le processus Typst et `better-sqlite3` ne peuvent donc pas être conservés tels quels dans un Worker.

Une cible Workers exige notamment :

- un stockage relationnel dont les garanties transactionnelles couvrent numérotation et acceptation ;
- un stockage documentaire, par exemple R2, avec contrôle d’intégrité et règles de conservation ;
- une exécution persistante des tâches et rappels ;
- une solution de rendu PDF testée, sans dégrader les documents actuels ;
- un mécanisme de mots de passe compatible et testé ;
- des tests de concurrence reproduisant les garanties actuelles.

Ne pas traiter D1 comme un remplacement direct de la connexion SQLite synchrone.
Ne pas répartir une transaction financière entre plusieurs services sans définir sa reprise après incident.

## Programme de livraison proposé

| Lot | Résultat utilisable                | Conditions de fin                                                                    |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Interface et vocabulaire cohérents | Contrôles partagés vérifiés, revue mobile, actions décrites sans faux envoi          |
| 2   | Documents prêts à publier          | Champs structurés, validation serveur, erreurs liées aux champs, snapshots conservés |
| 3   | Courriels transactionnels          | Domaine validé, outbox, reprises, résultats visibles, tests de panne                 |
| 4   | Comptes autonomes                  | Invitations, récupération, MFA administrateur, révocation                            |
| 5   | Signature avec prestataire         | Niveau choisi, notifications vérifiées, preuves exportables, commande unique         |
| 6   | Facturation et paiements           | Acomptes, plusieurs factures, paiements partiels, avoirs, rapprochement              |
| 7   | Rappels et exécution               | Tâches persistantes, fuseau métier, suspension, journal d’actions                    |
| 8   | Facturation électronique           | Plateforme agréée choisie, flux applicables testés avec le comptable                 |
| 9   | Exploitation vérifiable            | Sauvegarde hors hôte, restauration testée, alertes, procédures de reprise            |
| 10  | Pilotage                           | Recherche paginée, balance âgée, exports comptables, indicateurs documentés          |

La réception réglementaire des factures nécessite une solution immédiate si elle n’existe pas déjà hors de cette application.
Elle ne doit pas attendre le développement du lot 8.

Après ces lots, envisager catalogue de prestations, temps passé, abonnements, factures récurrentes et dépenses fournisseurs.
Ne pas ajouter de multi-tenant, moteur BPMN ou comptabilité générale sans besoin métier explicite.

## Vérification technique initiale

| Commande                                           | Résultat                                                        |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `git pull --ff-only`                               | Quatre commits récupérés, sans conflit                          |
| `nix develop --command pnpm lint`                  | Réussi                                                          |
| `nix develop --command pnpm test`                  | Réussi : 278 tests, dont 91 tests API et 129 tests Angular      |
| `nix develop --command pnpm format:check`          | Échec sur `secrets/froment-software/production.yaml`            |
| `nix flake check "path:$PWD" --no-write-lock-file` | Réussi sur x86_64-linux, plusieurs dérivations déjà construites |

Le contrôle Nix de formatage utilise un fileset qui exclut le fichier de secrets.
Cela explique la différence avec le contrôle local sur tout le dépôt.
`nix develop --command pnpm audit --prod --json` ne retourne aucun avis de vulnérabilité pour les dépendances de production.
Ce résultat dépend de la base d’avis consultée et ne prouve pas l’absence de vulnérabilité.

Les contrôles aarch64-linux n’ont pas été exécutés.
La couverture API affichée concerne seulement les cinq fichiers configurés.

Le shell Nix a détecté d’anciens hooks Python.
Les hooks générés ont été remplacés par `prek`, conformément au flake.
Aucun script de hook personnalisé n’a été supprimé.

## Points non vérifiés

- Sauvegardes, alertes, TLS et en-têtes ajoutés par le proxy en production.
- Coûts, quotas et activation effective du compte Cloudflare.
- Contrat, niveau de signature et traitement des données chez un prestataire.
- Obligations fiscales exactes de l’entreprise et de chaque transaction.
- Tests de charge, tests d’intrusion et audit par lecteur d’écran.
- Parcours navigateur authentifiés sur une base réelle représentative.

## Sources externes

Sources consultées le 5 septembre 2026 :

- [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
- [Compatibilité Node.js de Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Composant Worker de SST](https://sst.dev/docs/component/cloudflare/worker/)
- [Règlement eIDAS consolidé, articles 25 et 26](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02014R0910-20241018)
- [Service Public : obligations de facturation](https://entreprendre.service-public.gouv.fr/vosdroits/F23208)
- [Ministère de l’Économie : facturation électronique](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises)
