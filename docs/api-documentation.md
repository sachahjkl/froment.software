# Documentation de l’API

## Contenu enrichi

Les contrats Effect restent la source des types, valeurs autorisées et contraintes.
Le générateur ajoute les explications sans modifier les règles de validation.

- Chaque énumération conserve sa liste OpenAPI et reçoit une liste lisible dans sa description.
- Les montants, quantités, taux, dates, versions et clés d’idempotence disposent d’explications françaises et anglaises.
- Les exemples complets couvrent les règlements, leurs corrections, les imports bancaires, les rapprochements, les factures et les courriels simulés.
- Les tests valident les sept exemples de requête avec les schémas Effect réellement utilisés.
- Les contraintes existantes restent visibles : champs requis, limites, formats, motifs et valeurs nulles.

Les identifiants et références des exemples sont fictifs.
Remplacez-les par des ressources existantes avant d’exécuter une requête.
Les exemples décrivent le format ; ils ne garantissent pas que les ressources existent ou que la transition métier est autorisée.

## Permissions par endpoint

Scalar affiche les permissions dans une alerte Markdown `note`.
La liste vient de `RequiredPermissions`, qui configure aussi le middleware d’autorisation.
Toutes les permissions listées sont nécessaires : la relation est un ET, pas un OU.
Il s’agit de permissions applicatives, pas de scopes OAuth.

Les endpoints de connexion, de session personnelle, d’initialisation, de lien public et du portail client appliquent des politiques distinctes.
Ils ne deviennent pas publics parce qu’ils n’utilisent pas `RequiredPermissions`.
Le portail vérifie notamment l’identité du client et l’appartenance des documents.

La mention Frontend classe une route ; elle ne constitue pas une restriction d’accès.
Les audiences du registre déterminent quelles permissions peuvent être accordées aux jetons API.

## Revue des permissions

Les modules utilisent maintenant leurs propres permissions :

| Module                | Permissions                                  |
| --------------------- | -------------------------------------------- |
| Banque                | `bank.read`, `bank.import`, `bank.reconcile` |
| Catalogue             | `catalog.read`, `catalog.manage`             |
| Émetteur              | `issuer.read`, `issuer.update`               |
| Conditions            | `condition.read`, `condition.manage`         |
| Export des règlements | `payment.read`                               |

La banque ne réutilise plus le droit d’enregistrer un règlement.
Le catalogue et les conditions ne réutilisent plus les droits de modification des devis.
Les coordonnées émetteur ne réutilisent plus les droits de sélection des modèles.
L’export des règlements ne nécessite plus un droit d’écriture.

La migration attribue ces permissions au rôle administrateur.
Elle n’ajoute aucun droit aux jetons existants.
Pour exporter avec un jeton API, créez un jeton disposant de `payment.read`.
Les nouvelles permissions de configuration et de banque restent réservées aux sessions administrateur.

Un test inspecte chaque endpoint métier : permission déclarée, permission enregistrée, middleware présent et documentation correspondante.
Les exceptions utilisant une politique dédiée sont énumérées explicitement dans ce test.
Un test HTTP vérifie aussi le refus de l’historique bancaire après retrait de `bank.read`.
Un autre contrôle conserve la lecture bancaire après retrait des permissions d’import et de rapprochement.
Les tests de jetons API vérifient la séparation entre export des règlements, écriture des règlements et accès bancaire.

## Références

- https://scalar.com/products/api-references/markdown
- https://scalar.com/products/api-references/localization
- https://pennylane.readme.io/reference/getjournals
