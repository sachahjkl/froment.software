# Relevés bancaires et rapprochement

La page **Banque** importe les relevés CSV et associe les encaissements aux règlements déjà enregistrés.
Ces opérations utilisent les données réelles de l’installation, pas les adaptateurs simulés.
Elles ne déclenchent aucun virement et ne créent aucun règlement supplémentaire.

## Format du relevé

Utilisez un fichier UTF-8 avec ces colonnes, dans cet ordre :

```csv
transaction_id,booked_on,amount,currency,description
BANK-001,2026-09-01,100.00,EUR,Encaissement client
BANK-002,2026-09-02,-2.50,EUR,Frais bancaires
```

Le fichier accepte les guillemets CSV, les descriptions multilignes et un BOM UTF-8.
L’import accepte au maximum 1 000 opérations par fichier et 500 ko depuis l’interface.
Les montants utilisent un point et exactement deux décimales.
Seuls les montants non nuls en euros sont acceptés.

Conservez un identifiant stable pour chaque compte et chaque opération bancaire.
Le serveur ignore les opérations déjà importées avec les mêmes valeurs.
Si une référence existante contient des valeurs différentes, le serveur refuse tout le fichier.
Une erreur ne produit aucun import partiel.

## Rapprochement

Enregistrez d’abord le règlement dans la facture.
Sélectionnez ensuite le crédit bancaire, la facture et le règlement.
Le serveur exige un règlement actif du même montant.
Une opération et un règlement ne peuvent avoir qu’un rapprochement actif.

La page signale les règlements annulés après leur rapprochement.
Dissociez le rapprochement avant de choisir un autre règlement.
La dissociation exige un motif et conserve le rapprochement précédent.
Elle ne change ni le relevé, ni le règlement, ni le PDF de la facture.
L’identifiant du rapprochement protège la dissociation contre une sélection périmée.

## Accès et limites

Les routes exigent la permission `invoice.mark-paid`.
Les mutations valident l’origine du navigateur.
Les écritures et leurs événements d’audit partagent une transaction SQLite.
La page affiche les 1 000 opérations les plus récentes.

Le rapprochement actuel associe un crédit à un règlement exact.
Les règlements groupés, les commissions déduites et la comptabilité des débits restent hors de ce rapprochement.
Les différences restent visibles et ne sont pas corrigées automatiquement.

# Historique consultable

Chaque opération donne accès aux 100 derniers rapprochements conservés.
L’historique indique la facture, les dates, les identifiants des auteurs et les motifs de dissociation.
La route `GET /api/banking/transactions/:transactionId/history` exige les droits de gestion des règlements.
Les clients ne peuvent pas consulter cet historique interne.
