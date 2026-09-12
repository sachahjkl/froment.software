# Avoirs client et remboursements locaux

La fiche facture donne accès à **Avoir et remboursements**.
Une facture émise ou payée peut recevoir plusieurs avoirs dans la limite de ses lignes disponibles.

## Brouillons et émission

Créez un avoir partiel en sélectionnant les quantités à créditer.
Créez un avoir intégral en utilisant toutes les quantités restantes.
Ajoutez plusieurs factures si elles utilisent le même client, la même société et la même devise.

Chaque enregistrement conserve toutes ses versions.
Une ancienne version reste disponible en lecture seule.
Le brouillon courant reste modifiable.

L’émission attribue le numéro `AV-AAAA-NNNNNN`.
Elle fige le motif, les lignes, les montants, l’auteur et la date.
Le serveur contrôle de nouveau chaque quantité pendant l’émission.
Il refuse les crédits cumulés supérieurs à la quantité de la ligne source.

L’émission ne modifie pas les factures, leurs révisions ou leurs PDF.

## Créance client

Le portail client et le backoffice déduisent les avoirs émis du montant à recouvrer.
Un avoir sur une facture payée crée une dette client égale au trop-perçu.
Un avoir sur une facture partiellement payée crée seulement la dette qui dépasse le solde restant.

Les encaissements enregistrés restent visibles.
Un encaissement peut compléter le solde restant après un avoir partiel.
Les relances et les paiements en ligne utilisent ce solde net.

## Remboursements

Enregistrez uniquement un remboursement déjà effectué en dehors de l’application.
Saisissez son montant, sa date et sa référence.
Le serveur refuse un montant supérieur à la dette client disponible.
Il refuse une date future ou antérieure au premier avoir émis.

Chaque remboursement conserve son auteur et sa date d’enregistrement.
Une correction annule l’enregistrement avec un motif, sans le supprimer.
La correction ne récupère aucun fonds.

Les clés UUID stables empêchent les doublons pendant les nouvelles tentatives.
Les transactions SQLite protègent le solde remboursable contre les demandes concurrentes.

## Documents et accès

Le premier téléchargement génère le PDF depuis la version émise.
Les téléchargements suivants contrôlent et réutilisent l’artefact immuable.
Un avoir consolidé indique toutes les factures sources.
Le client peut télécharger seulement un avoir lié à son compte.

- `invoice.credit` permet de créer, modifier et émettre un avoir.
- `invoice.refund` permet d’enregistrer et de corriger un remboursement.
- `invoice.read` permet de consulter les avoirs et remboursements.
- `document.download` complète l’autorisation de téléchargement interne.

Aucun fournisseur externe n’est appelé.
Aucune opération bancaire n’est exécutée.
