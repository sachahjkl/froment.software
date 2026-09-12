# Relevés bancaires et rapprochement

La page **Banque** importe les relevés CAMT.053, OFX et CSV.
Elle associe les encaissements aux règlements déjà enregistrés.
Ces opérations utilisent les données réelles de l’installation, pas les adaptateurs simulés.
Elles ne déclenchent aucun virement et ne créent aucun règlement supplémentaire.

## Formats du relevé

### CAMT.053

Importez un relevé XML ISO 20022 `camt.053`.
Le serveur lit les montants, devises, dates comptables, références et libellés des écritures.
Il utilise la référence du gestionnaire de compte si la référence d’écriture est absente.

### OFX

Importez un relevé OFX contenant une liste `BANKTRANLIST`.
Le serveur lit `FITID`, `DTPOSTED`, `TRNAMT`, `NAME` et `MEMO` pour chaque opération.

### CSV configurable

Configurez les éléments suivants avant la prévisualisation :

- le séparateur de colonnes ;
- les colonnes de référence, de date, de montant, de devise et de libellé ;
- le format de date ;
- le séparateur décimal.

Laissez la colonne de devise vide pour utiliser EUR.
Le modèle téléchargeable fournit la configuration par défaut.

Utilisez un fichier UTF-8 avec ces colonnes, dans cet ordre :

```csv
transaction_id,booked_on,amount,currency,description
BANK-001,2026-09-01,100.00,EUR,Encaissement client
BANK-002,2026-09-02,-2.50,EUR,Frais bancaires
```

Le CSV accepte les guillemets, les descriptions multilignes et un BOM UTF-8.
L’import accepte au maximum 1 000 opérations et 500 ko depuis l’interface.
Les montants utilisent exactement deux décimales.
Seuls les montants non nuls en euros sont acceptés.

Conservez un identifiant stable pour chaque compte et chaque opération bancaire.
Le serveur ignore les opérations déjà importées avec les mêmes valeurs.
Si une référence existante contient des valeurs différentes, le serveur refuse tout le fichier.
Une erreur ne produit aucun import partiel.
La prévisualisation ne crée ni opération, ni événement d’audit.
La confirmation valide une seconde fois le contenu avant toute écriture.

## Rapprochement

Enregistrez d’abord le règlement dans la facture.
Sélectionnez ensuite le crédit bancaire, la facture et le règlement.
Saisissez le montant à affecter au règlement.
Le serveur vérifie les montants encore disponibles du crédit et du règlement.
Une opération peut couvrir plusieurs règlements, y compris ceux de factures différentes.
Un règlement peut être réparti entre plusieurs opérations bancaires.
Chaque affectation conserve son montant, son identifiant, son auteur et sa date.

Exemple : un crédit de 150 EUR peut couvrir 60 EUR d’un règlement et 90 EUR d’un autre.
Un second crédit peut couvrir les soldes restants de ces règlements.
Les montants affectés ne peuvent dépasser le règlement.
Les montants nets affectés ne peuvent dépasser le crédit bancaire.
Les contrôles utilisent tous les rapprochements enregistrés, pas uniquement les opérations affichées.

La page signale les règlements annulés après leur rapprochement.
Dissociez l’affectation concernée pour libérer son montant.
La dissociation exige un motif et conserve le rapprochement précédent.
Elle ne change ni le relevé, ni le règlement, ni le PDF de la facture.
L’identifiant du rapprochement protège la dissociation contre une sélection périmée.

## Accès et limites

La lecture exige `bank.read`.
L’import exige `bank.import`.
L’affectation et la dissociation exigent `bank.reconcile`.
La lecture des montants disponibles d’une facture exige aussi `invoice.read`.
Les mutations valident l’origine du navigateur.
Les écritures et leurs événements d’audit partagent une transaction SQLite.
La page affiche les 1 000 opérations les plus récentes.

Une opération accepte au plus 100 affectations actives.
Les débits ne sont pas assimilés à des règlements clients.
Les différences restent visibles et ne sont pas corrigées automatiquement.

## Contrat des affectations

La route `POST /api/banking/transactions/:transactionId/match` exige `paymentId`, `amountCents`, `feeCents` et un `requestId` UUID v4.
Conservez la même clé lors d’une nouvelle tentative.
Une demande identique ne crée pas une deuxième affectation.
Un contenu différent sous la même clé produit un conflit.
Une nouvelle tentative ne réactive pas une affectation déjà dissociée.

La liste des opérations retourne le montant net rapproché dans `matchedCents` et le tableau `allocations`.
Chaque affectation contient sa facture, son règlement, son montant et l’état d’annulation du règlement.
La route `GET /api/banking/invoices/:invoiceId/payments` retourne les montants encore disponibles des règlements actifs.
Le serveur recalcule ces montants dans une transaction lors de chaque affectation.
Deux demandes concurrentes ne peuvent pas consommer deux fois le même solde.

La mise à jour conserve les anciens rapprochements et leurs motifs de dissociation.
Leur montant correspond au règlement complet associé par l’ancienne règle d’égalité.

## Commissions déduites

Le champ **Montant à affecter** contient le montant du règlement, commission incluse.
Le champ **Commission déduite** contient les frais retenus avant le crédit bancaire.
Une commission nulle correspond à un rapprochement sans frais.
La commission doit être positive ou nulle et inférieure au montant affecté.

Exemple : pour un règlement de 103 EUR et un crédit de 100 EUR, affectez 103 EUR avec une commission de 3 EUR.
Le serveur consomme 103 EUR sur le règlement et 100 EUR sur le crédit bancaire.
Chaque affectation conserve sa propre commission, y compris après dissociation.
La dissociation libère séparément le montant du règlement et le montant bancaire net.

Le rapprochement n’invente aucun règlement et ne modifie aucune facture.
Il ne détermine ni la TVA des frais ni leur compte comptable.
Les anciennes affectations conservent une commission nulle.

Le [journal des débits et commissions](bank-ledger.md) permet de choisir les comptes et de comptabiliser ces sources.
Avant de dissocier une affectation dont la commission est comptabilisée, contrepassez son écriture.

## Historique consultable

Chaque opération donne accès aux 100 derniers rapprochements conservés.
L’historique indique la facture, le montant affecté, les dates, les auteurs et les motifs de dissociation.
La route `GET /api/banking/transactions/:transactionId/history` exige `bank.read`.
Les clients ne peuvent pas consulter cet historique interne.
