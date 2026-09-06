# Avoir intégral et remboursements locaux

La fiche facture donne accès à **Avoir et remboursements**.
Une facture émise ou payée peut recevoir un avoir intégral unique.
L’avoir reprend exactement les lignes, les montants HT, la TVA et les parties de la révision émise.
Il possède son propre numéro `AV-AAAA-NNNNNN`, sa date, son auteur et son motif.

L’émission ne modifie ni la facture, ni ses révisions, ni ses PDF.
L’avoir est définitif : aucune route ne permet de le modifier ou de le supprimer.
Cette version ne permet pas encore d’émettre un avoir partiel.

## Créance et encaissements

L’avoir intégral annule la créance restante.
Les encaissements enregistrés restent visibles et ne deviennent pas des remboursements.
Le portail client et les totaux du backoffice déduisent l’avoir du montant à recouvrer.
Les relances programmées deviennent inéligibles et les reprises de relances déjà préparées sont bloquées.
Un nouveau règlement et l’annulation directe de la facture sont refusés après émission de l’avoir.

Le statut historique de la facture reste inchangé.
Le champ `creditedCents` distingue la réduction de créance d’un paiement.
Une ancienne déclaration « payée » sans encaissement enregistré ne crée aucun montant remboursable.

## Remboursements

Enregistrez uniquement un remboursement déjà effectué en dehors de l’application.
Saisissez son montant, sa date et sa référence.
Le serveur refuse les montants supérieurs aux encaissements actifs encore disponibles.
Il refuse les dates futures et les dates antérieures à l’avoir.

Chaque remboursement conserve son auteur et sa date d’enregistrement.
Une correction annule l’enregistrement avec un motif, sans le supprimer.
La correction ne récupère aucun fonds.
L’application refuse l’annulation d’un encaissement qui rend les remboursements actifs supérieurs aux encaissements restants.

Les clés UUID stables empêchent les doublons lors des nouvelles tentatives.
Une nouvelle tentative ne réactive pas un remboursement dont l’enregistrement a été annulé.
Les transactions SQLite empêchent deux remboursements concurrents de consommer le même solde.

## Documents et accès

Le premier téléchargement génère le PDF de l’avoir depuis les données immuables.
Les téléchargements suivants réutilisent le PDF conservé et contrôlent son empreinte SHA-256.
Les PDF utilisent le stockage documentaire existant.
Le client peut télécharger seulement l’avoir de sa propre facture.

- `invoice.credit` permet d’émettre l’avoir.
- `invoice.refund` permet d’enregistrer et de corriger les remboursements.
- `invoice.read` permet de consulter l’avoir et les remboursements.
- Le téléchargement interne exige aussi `document.download`.
- Les permissions d’émission et de remboursement sont attribuées aux administrateurs existants, pas aux jetons API ni aux profils d’équipe.

Aucun fournisseur externe n’est appelé.
Aucune opération de banque, paiement ou remboursement n’est exécutée.
