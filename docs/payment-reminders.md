# Rappels de paiement

Une facture émise permet de préparer un rappel depuis son panneau d’actions.
Le formulaire de courriel charge la facture et la fiche client avec les droits de la session.

Le rappel contient :

- Le destinataire de la fiche client actuelle.
- Le numéro de facture.
- Le solde après déduction des règlements actifs.
- La date d’échéance, sans décalage de fuseau horaire.

Les règlements annulés ne réduisent pas le solde.
Les factures payées, annulées, sans solde ou en brouillon ne permettent pas de préparer ce rappel.

Vérifiez le destinataire, le solde et le texte avant de soumettre le message.
Un règlement enregistré après la préparation peut modifier le solde.
Le formulaire ne joint pas le PDF et ne programme aucun envoi.

Le fournisseur de courriel utilise actuellement la simulation, y compris en production.
La soumission conserve le texte et le résultat simulé dans l’historique des courriels.
Elle ne prouve aucun envoi et ne modifie pas la facture.

Le brouillon reste dans le navigateur tant que le formulaire reste ouvert.
Une confirmation protège sa fermeture par navigation interne, même sans modification manuelle.
Les rappels automatiques et les brouillons persistants ne sont pas encore disponibles.
