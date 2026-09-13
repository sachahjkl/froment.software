# Spécification de la suite de gestion

## Statut du document

Ce document est la référence du périmètre demandé le 12 septembre 2026.
Il consolide la demande initiale, quatre questionnaires structurés et les ajouts suivants.

Une fonction est terminée seulement si tous les éléments suivants sont présents :

- permissions ;
- contrats et API ;
- règles métier ;
- persistance et migrations ;
- interface ;
- traductions ;
- tests métier ciblés ;
- documentation d’exploitation applicable.

La livraison doit contenir tout le périmètre dans une seule version.
Les lots techniques intermédiaires servent uniquement à sécuriser le développement.

## Règles transversales

- Utiliser uniquement des segments d’URL anglais.
- Ne pas ajouter de redirection pour les anciennes URL.
- Conserver une architecture de packs linguistiques.
- Rendre les nouveaux écrans, documents et erreurs traduisibles.
- Ne pas conserver de constante numérique arbitraire.
- Placer les limites d’exécution dans `RuntimeConfiguration` avec Effect `Config`.
- Placer les limites métier dans des constantes partagées nommées.
- Utiliser l’horloge Effect pour les instants métier.
- Ne jamais exposer un secret applicatif à Angular.
- Chiffrer les secrets configurés dans l’application côté serveur.
- Permettre aux secrets SOPS de fournir les valeurs initiales.
- Permettre une configuration serveur ultérieure sans renvoyer la valeur du secret.
- Ne pas préserver une compatibilité obsolète dans ce produit neuf.
- Exclure Playwright et les tests navigateur des checks Nix, de la CI et de la publication.

## 1. Facturation client

### 1.1 Avoirs

- Autoriser un avoir uniquement sur une facture émise.
- Autoriser les factures partiellement ou totalement encaissées.
- Créer chaque avoir comme un brouillon éditable.
- Figer l’avoir lors de son émission.
- Attribuer le numéro `AV-YYYY-XXXXXX` lors de l’émission.
- Conserver un identifiant technique avant l’émission.
- Proposer les actions **Avoir partiel** et **Avoir intégral** depuis la facture.
- Créer l’avoir intégral comme un brouillon prérempli et modifiable.
- Créer l’avoir partiel comme une copie éditable des lignes sources.
- Verrouiller les prix unitaires et les taux de TVA d’origine.
- Autoriser les quantités et montants crédités dans les soldes disponibles.
- Contrôler le cumul crédité pour chaque ligne source.
- Refuser tout dépassement des quantités ou montants facturés.
- Autoriser un avoir consolidé sur plusieurs factures.
- Exiger le même client, la même devise et la même société.
- Conserver une ventilation visible par ligne et par facture source.
- Créer une dette envers le client si la facture était déjà encaissée.
- Permettre un remboursement explicite de cette dette.
- Permettre une imputation explicite sur une autre facture.
- Ne pas imputer automatiquement la dette.

### 1.2 Encaissements

- Renommer l’action principale **Encaissement**.
- Proposer les variantes **Partiel** et **Intégral**.
- Ouvrir un formulaire vide pour un encaissement partiel.
- Préremplir le solde restant pour un encaissement intégral.
- Laisser ce montant modifiable avant confirmation.
- Refuser un encaissement supérieur au solde restant.
- Aligner le bouton d’export CSV avec les champs de date.

### 1.3 Versions et éditeurs de lignes

- Supprimer les pages de versions séparées.
- Intégrer le sélecteur de version dans les pages des devis, commandes, factures et avoirs.
- Afficher les versions émises en lecture seule.
- Autoriser l’édition uniquement dans un nouveau brouillon.
- Utiliser un composant commun de tableau éditable pour tous les éditeurs de documents.
- Placer l’action d’ajout sous les lignes.
- Afficher des cellules compactes avec les actions sur chaque ligne.
- Utiliser une modale d’édition sur petit écran.

### 1.4 Coordonnées client

- Ajouter le numéro de téléphone facultatif au client.
- Autoriser la création d’un client sans téléphone ni courriel.
- Exiger un téléphone ou un courriel avant l’émission d’un document.
- Copier les coordonnées utilisées dans l’instantané du document émis.
- Ne pas modifier cet instantané après une modification du client.

## 2. Affaires

- Créer une entité Affaire indépendante du devis.
- Utiliser un ULID interne.
- Attribuer un numéro métier `AF-YYYY-XXXXXX`.
- Permettre à une affaire de regrouper plusieurs documents.
- Migrer automatiquement les affaires existantes.
- Le produit neuf ne conserve pas les anciennes URL françaises.

## 3. Fournisseurs et achats

### 3.1 Référentiel fournisseur

- Fournir le CRUD complet.
- Gérer les contacts et les adresses.
- Gérer la recherche, l’archivage et les permissions.
- Gérer les identifiants fiscaux internationaux.
- Couvrir la France, l’Union européenne et les pays hors Union européenne.
- Gérer l’autoliquidation, les taxes locales et les importations applicables.
- Utiliser la validation VIES lorsque le régime le demande.

### 3.2 Factures et avoirs fournisseur

- Commencer le cycle d’achat à la facture fournisseur.
- Ne pas inclure les demandes, commandes et réceptions d’achat.
- Gérer la saisie, les échéances, les paiements, les pièces et la TVA.
- Gérer les avoirs fournisseur.
- Produire les écritures comptables.
- Rapprocher les paiements avec les opérations bancaires.

### 3.3 Analyse assistée des factures

- Autoriser la saisie manuelle sans service externe.
- Ajouter une analyse facultative des factures par modèle de vision.
- Utiliser des adaptateurs serveur configurables.
- Fournir un adaptateur OpenAI initial sans coupler le domaine à OpenAI.
- Extraire un JSON structuré pour préremplir le brouillon.
- Exiger une confirmation humaine avant l’enregistrement.
- Afficher les champs, les lignes et les alertes détectées.
- Afficher le fournisseur externe avant chaque envoi.
- Exiger un consentement avant chaque envoi externe.
- Journaliser l’envoi sans conserver indéfiniment la réponse brute.

### 3.4 Paiements fournisseur

- Enregistrer les paiements fournisseur.
- Générer des virements SEPA `pain.001.001.03`.
- Conserver chaque fichier généré comme un artefact immuable.
- Rapprocher ensuite le paiement avec le mouvement bancaire.
- Ne pas intégrer une API bancaire d’exécution directe dans ce périmètre.

## 4. Devises

- Choisir une devise fonctionnelle lors de l’initialisation comptable.
- Interdire son changement après la première comptabilisation.
- Gérer les devises dans les ventes, les achats et la comptabilité.
- Conserver la devise, le taux daté et la contre-valeur fonctionnelle.
- Comptabiliser les gains et pertes de change.
- Importer les taux de la Banque centrale européenne.
- Autoriser une surcharge manuelle auditée.

## 5. Comptabilité intégrée

### 5.1 Cadre général

- Gérer une société configurable par installation.
- Utiliser des modules par juridiction.
- Définir des interfaces stables entre le domaine et chaque juridiction.
- Livrer un module France complet.
- Ne pas coder les règles françaises dans le noyau commun.
- Fournir une comptabilité interne complète.
- Conserver les exports destinés aux logiciels externes.
- Activer les modules comptabilité, achats et IA par configuration.

### 5.2 Initialisation

- Supposer une installation sans données comptables de production.
- Démarrer sans migration de données comptables historiques.
- Permettre ensuite l’import d’une balance d’ouverture.
- Utiliser un CSV configurable avec prévisualisation.
- Mapper les comptes, libellés, débits et crédits.
- Contrôler l’équilibre avant validation.

### 5.3 Plan, journaux et écritures

- Fournir un modèle PCG versionné et éditable.
- Autoriser l’ajout et l’archivage de comptes.
- Gérer les journaux et le lettrage.
- Rendre les écritures validées immuables.
- Corriger une écriture validée uniquement par extourne tracée.
- Gérer les périodes ouvertes, verrouillées et clôturées.
- Autoriser une réouverture auditée avant la clôture définitive.
- Autoriser les exercices non calendaires.
- Proposer douze mois par défaut.

### 5.4 États et fiscalité française

- Produire les journaux, le grand livre et la balance.
- Produire le bilan et le compte de résultat.
- Produire les états de TVA et le FEC.
- Préparer les cases de la déclaration CA3.
- Toujours fournir un export standard contrôlable.
- Fournir une interface d’adaptation EDI sans imposer un prestataire.
- Permettre une télédéclaration facultative après configuration d’un prestataire.

### 5.5 Pièces et conservation

- Stocker les fichiers justificatifs, leurs métadonnées et leurs empreintes.
- Lier les pièces aux écritures.
- Journaliser les accès.
- Conserver les pièces et traces pendant dix ans au minimum.
- Rendre cette durée configurable uniquement au-dessus du minimum.
- Expliquer le minimum légal dans l’interface.

### 5.6 Permissions

- Fournir les profils administrateur, collaborateur, comptable, valideur comptable et lecteur comptable.
- Séparer saisie, validation, clôture et lecture.
- Permettre aussi la création de rôles personnalisés.
- Permettre aux administrateurs d’attribuer et de retirer le rôle administrateur.
- Journaliser ces changements.
- Interdire la rétrogradation, la désactivation ou la suppression du dernier administrateur actif.

## 6. Banque

### 6.1 Imports

- Importer `CAMT.053`.
- Importer `OFX`.
- Importer un CSV configurable.
- Configurer les colonnes, le séparateur, le format de date et le séparateur décimal.
- Prévisualiser et valider tout le relevé avant écriture.
- Détecter les doublons par compte et référence source.
- Refuser tout le relevé si une référence existante contient des données différentes.

### 6.2 Rapprochement

- Proposer des correspondances par montant, date, référence et tiers.
- Exiger une confirmation humaine.
- Rapprocher les encaissements client et les paiements fournisseur.
- Ne pas valider automatiquement une suggestion.
- Conserver l’historique des rapprochements et des annulations.

## 7. Données de démonstration

- Limiter la fonction aux environnements autorisés, dont staging.
- Ajouter une commande serveur protégée de réinitialisation.
- Ajouter une action réservée aux administrateurs staging.
- Remplacer les données staging par un jeu déterministe.
- Ne pas réinitialiser les données à chaque déploiement.
- Créer un compte pour chaque profil standard.
- Documenter les accès de démonstration sans publier de secret réel.
- Utiliser des dates glissantes autour du jour de chargement.
- Créer environ 50 clients.
- Créer environ 30 fournisseurs.
- Créer environ 100 affaires.
- Créer plusieurs centaines de documents et opérations.
- Représenter tous les états métier.
- Couvrir brouillons, émissions, versions, retards, avoirs et paiements.
- Couvrir devises, TVA, banque, rapprochements et clôtures.
- Utiliser des simulateurs locaux pour l’IA, le change et la télédéclaration.
- Ne pas appeler de service facturé pendant la réinitialisation.

## 8. Page publique de signature

Traiter ce bloc après tous les autres blocs fonctionnels.

- Retirer le bandeau et la navigation du site public.
- Rendre la page autonome.
- Conserver l’identité nécessaire au document et à la confiance du signataire.
- Revoir sa composition, ses états et son accessibilité.
- Aligner sa présentation avec le design du backoffice.

## 9. Livraison et exploitation

- Livrer tout le périmètre comme une version unique.
- Déployer staging sur `https://staging.froment.software`.
- Déployer production sur `https://froment.software`.
- Garder staging public sans authentification HTTP.
- Ajouter `X-Robots-Tag: noindex, nofollow` sur staging.
- Utiliser `APP_ENV=development | staging | production`.
- Utiliser `NODE_ENV=production` sur staging et production.
- Garder `SITE_PHASE=construction | live` indépendant de `APP_ENV`.
- Afficher `EN CONSTRUCTION!` en production avant le lancement.
- Déployer depuis les runners GitHub à travers Tailscale.
- Réserver le runner homelab à `nixconfig` et au cache Nix.
- Promouvoir en production le digest exact validé sur staging.
- Séparer les chemins, permissions, volumes et variables par environnement.

## 10. Matrice de suivi

Cette matrice indique l’état observé au 13 septembre 2026.
Elle ne remplace pas les critères de fin définis au début du document.

| Bloc                               | État observé | Travail restant principal                     |
| ---------------------------------- | ------------ | --------------------------------------------- |
| Déploiement Nomad                  | Réalisé      | Validation du nouveau digest sur staging      |
| URL anglaises                      | Réalisé      | Aucun                                         |
| Téléphone client                   | Réalisé      | Aucun                                         |
| Référentiel fournisseur            | Réalisé      | Aucun                                         |
| Factures fournisseur               | Réalisé      | Aucun                                         |
| Analyse assistée fournisseur       | Réalisé      | Rotation des secrets exposés                  |
| Rôles personnalisés                | Réalisé      | Aucun                                         |
| Paramètres comptables société      | Réalisé      | Aucun                                         |
| Taux de change                     | Réalisé      | Aucun                                         |
| Virements fournisseur              | Réalisé      | Aucun                                         |
| Imports bancaires CAMT, OFX et CSV | Réalisé      | Aucun                                         |
| Avoirs partiels et consolidés      | Réalisé      | Aucun                                         |
| Encaissements scindés              | Réalisé      | Aucun                                         |
| Sélecteurs de version intégrés     | Réalisé      | Aucun                                         |
| Tableau éditable commun            | Réalisé      | Aucun                                         |
| Entité Affaire indépendante        | Réalisé      | Aucun                                         |
| Comptabilité intégrée              | Réalisé      | Aucun                                         |
| Suggestions de rapprochement       | Réalisé      | Aucun                                         |
| Données de démonstration           | Réalisé      | Validation de la réinitialisation sur staging |
| Page autonome de signature         | Réalisé      | Revue visuelle avec un navigateur connecté    |

## 11. Ordre d’exécution restant

1. Exécuter les checks complets.
2. Déployer le nouveau digest sur staging.
3. Valider la réinitialisation des données de démonstration.
4. Revoir la page de signature avec un navigateur connecté.
5. Promouvoir le digest staging validé en production.
6. Remplacer les secrets exposés avec les accès aux fournisseurs et à Nomad.

## 12. Provenance des décisions

L’historique contient quatre questionnaires structurés entre 09:57 et 10:49 UTC.
Ils ont fixé les décisions suivantes :

1. Le premier questionnaire a défini la livraison unique, les avoirs, les versions, les fournisseurs, les affaires et la cible comptable.
2. Le deuxième questionnaire a précisé les dettes client, les achats, les devises, les clôtures, les états, les pièces et les permissions.
3. Le troisième questionnaire a précisé la démonstration, l’IA, les secrets et la conservation.
4. Le quatrième questionnaire a précisé la société, les juridictions, l’initialisation, les imports et les virements SEPA.

Les demandes ajoutées après les questionnaires concernent la page de signature, les URL anglaises et les constantes nommées.
