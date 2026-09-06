# Règlements de facture

Le backoffice enregistre les règlements reçus, sans déclencher d’opération bancaire.
Chaque règlement contient un montant en centimes d’euro, une date de réception, un moyen de paiement et une référence.
L’application conserve aussi la date d’enregistrement et le compte de l’opérateur.

## Enregistrement

1. Ouvrez une facture émise.
2. Saisissez le règlement dans la section « Règlements ».
3. Vérifiez le montant et la référence dans vos justificatifs.
4. Confirmez l’enregistrement.

Un règlement partiel laisse la facture à l’état `issued`.
Le dernier règlement fait passer la facture à l’état `paid` lorsque le total reçu atteint le total facturé.
Les indicateurs du tableau de bord et de facturation déduisent les règlements enregistrés du montant restant à encaisser.
Les versions du document et leur PDF restent inchangés.

## Protection des données

Le serveur refuse les montants nuls, négatifs ou supérieurs au solde.
Il refuse les dates futures selon le fuseau métier et les dates inexistantes.
Il exige la permission `invoice.mark-paid`.
Il enregistre le règlement, le statut et l’événement d’audit dans une seule transaction SQLite.
Il refuse l’annulation d’une facture qui possède des règlements.

L’API utilise `POST /api/invoices/:invoiceId/payments`.
Elle remplace l’ancien endpoint `/mark-paid`.
Chaque demande contient un `requestId` UUID et la version du document dans `expectedVersion`.
Une nouvelle tentative avec le même identifiant et les mêmes valeurs ne crée pas de doublon.
Une réutilisation avec des valeurs différentes est refusée.

Après une erreur réseau, réessayez avec les mêmes valeurs.
Avant de modifier ces valeurs, rechargez la facture pour vérifier si le règlement a été enregistré.

## Export pour la comptabilité

Dans **Facturation**, ouvrez « Exporter les règlements pour la comptabilité ».
Choisissez les dates de réception, puis téléchargez le CSV.
Les deux dates sont incluses.
Les cases de sélection des factures ne limitent pas cet export.

Le fichier contient les règlements détaillés, pas les anciennes déclarations de facture payée.
Il utilise UTF-8 avec BOM, des virgules comme séparateurs et un point décimal pour les montants.
Les noms de colonnes et les codes de moyens de paiement sont stables et en anglais.
Une apostrophe neutralise les textes qui commencent comme une formule de tableur.
Cette protection ne modifie pas les données stockées.

L’export conserve le nom du client enregistré dans la version émise de la facture.
Il est limité à 10 000 règlements par période.
Si cette limite est dépassée, réduisez la période.
Le serveur refuse l’export au lieu de supprimer silencieusement des lignes.

L’API est `GET /api/invoice-payments/export?from=YYYY-MM-DD&to=YYYY-MM-DD`.
Elle exige la permission `invoice.mark-paid` et interdit la mise en cache.
Cet export n’est pas un FEC et ne remplace pas les écritures comptables validées.

## Limites

Les anciennes déclarations de facture payée restent dans leur état existant.
L’application ne leur invente aucun montant, moyen de paiement ou justificatif détaillé.
La section affiche uniquement les règlements réellement enregistrés par ce module.

Ce lot ne fournit pas encore de rapprochement bancaire, de remboursement, de correction de règlement ou d’avoir.
La référence est un texte, pas une pièce jointe.
Les règlements sont conservés sans modification ni suppression depuis l’API.
L’import de relevés, les corrections et les liens de paiement restent des lots distincts.
