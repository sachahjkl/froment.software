# Contrats programmatiques des fournisseurs

## Sens de la simulation

Les contrats définissent les entrées, les sorties et les erreurs des actions, indépendamment du choix des fournisseurs.
Les cinq services Effect restent interchangeables par injection de couches.
À ce stade, seule la couche mock est raccordée, y compris en production.

Une action mock retourne :

```json
{
  "mode": "simulation",
  "executed": false,
  "requestId": "91ff5717-c394-4708-bef2-6b5f5cafbdaa",
  "preview": {
    "available": false
  }
}
```

`preview` respecte le schéma du résultat de l’action concernée.
Il contient des données fictives ou indique qu’un fichier n’est pas disponible.
Il ne représente jamais une livraison, un paiement, une signature ou un dépôt effectué.
Le contrat réserve `mode: live`, `executed: true` et `result` aux futures implémentations réelles.

Chaque action s’arrête à cette réponse.
Une annulation mock ne change pas le résultat de la consultation suivante.
Les appels ne partagent pas de données mutables.
Aucune action mock ne déclenche une autre action métier.

## Surface définie

La soumission initiale conserve ses cinq requêtes existantes et son journal local.
Les services exposent aussi les actions suivantes :

| Service Effect              | Actions supplémentaires                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `EmailProvider`             | `get`, `cancel`, `events`, `verifyWebhook`                                                  |
| `SignatureProvider`         | `get`, `cancel`, `remind`, `signedDocument`, `proof`, `events`, `verifyWebhook`             |
| `PaymentProvider`           | `get`, `cancel`, `capture`, `refund`, `getRefund`, `events`, `verifyWebhook`                |
| `BankingProvider`           | `connect`, `getConnection`, `revokeConnection`, `accounts`, `transactions`, `verifyWebhook` |
| `ElectronicInvoiceProvider` | `get`, `cancel`, `download`, `inbox`, `report`, `getReport`, `events`, `verifyWebhook`      |

Les schémas définissent notamment :

- les statuts autorisés et les codes d’erreur ;
- les montants entiers en centimes et la devise EUR ;
- les dates civiles et les instants UTC ;
- les curseurs de pagination et les limites ;
- les signataires et leurs états ;
- les fichiers, leur contenu encodé et leur empreinte ;
- les demandes de remboursement et leurs états ;
- les connexions, comptes et opérations bancaires ;
- les factures électroniques entrantes et sortantes ;
- les rapports électroniques et les notifications à vérifier.

Les erreurs distinguent une ressource absente, un refus, une limite de débit, une demande invalide et une indisponibilité.

## HTTP et documentation

Les 32 actions disposent de routes `POST /api/providers/{domaine}/{action}`.
Ces routes appellent les méthodes des services Effect ; elles ne contiennent pas une seconde implémentation mock.
Les corps JSON et les réponses proviennent des mêmes contrats partagés.
Scalar documente chaque route en français et en anglais, avec ses permissions et un avertissement de simulation.

Les routes nécessitent `integration.manage`, une session administrateur et une origine autorisée.
Chaque route autorise au plus 60 demandes par minute et par principal.
Les réponses ne sont pas mises en cache.
Les routes `verify-webhook` ne sont pas des récepteurs publics pour des fournisseurs externes.

## Absence d’effets métier

Les mocks de notification retournent `verified: false` et une liste vide d’événements.
Les mocks de document signé, de preuve et de facture électronique retournent `available: false`.
Les opérations bancaires fictives restent dans l’aperçu : elles ne deviennent pas des lignes de relevé importées.
Une capture ou un remboursement fictif ne modifie aucun règlement local.

Le journal local des soumissions existantes reste fonctionnel.
Les fonctions locales déjà livrées, comme les factures, les passkeys et les sauvegardes, restent inchangées.
Ce contrat fournisseur ne remplace pas les contrats métier encore manquants, notamment ceux des avoirs et de la facturation fractionnée.

## Vérification

Un test HTTP parcourt les 32 actions et valide chaque réponse avec son schéma.
Il vérifie les permissions, l’origine et le refus d’un montant invalide.
Il compare les comptes de règlements, opérations bancaires, signatures, documents et opérations d’intégration avant et après les appels.
Un test de service vérifie l’indépendance des actions et l’isolation de leurs aperçus.
