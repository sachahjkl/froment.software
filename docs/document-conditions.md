# Conditions des documents

## Rédaction

Les modèles de conditions, les devis et les factures utilisent le même éditeur visuel.
L’éditeur propose les éléments suivants :

- des paragraphes et des retours à la ligne avec Maj+Entrée ;
- des titres et des sous-titres de section ;
- du gras et de l’italique ;
- des listes à puces et des listes numérotées ;
- les commandes Annuler la modification et Rétablir la modification.

La présentation du document fixe la police, les tailles et les couleurs.
L’éditeur ne propose ni image, ni tableau, ni lien, ni code HTML.
La limite reste de 2 000 caractères dans le texte enregistré, marques de mise en forme comprises.

## Emplacement dans le PDF

Le champ **Emplacement dans le PDF** propose deux choix :

- **À la suite du tableau et des totaux** utilise la place disponible après les montants.
- **Commencer sur une nouvelle page** place les conditions après toutes les pages du tableau.

Le second choix ne signifie pas nécessairement « deuxième page ».
Un tableau long peut déjà occuper plusieurs pages.
Des conditions vides ne créent pas une page supplémentaire.
Les mentions légales de facture restent près des totaux lorsque les conditions commencent sur une nouvelle page.

## Modèles et versions

La sélection d’un modèle copie son texte, sa mise en forme et son emplacement dans le devis.
Ces valeurs restent modifiables dans le devis sans modifier le modèle.
La création d’un modèle depuis le devis conserve le devis en cours sans l’enregistrer.

Chaque version conserve le texte et sa présentation.
La commande reprend les conditions du devis accepté.
Les conditions de règlement de la facture restent distinctes des conditions du devis.
Le motif d’un avoir reste distinct des conditions de règlement.

Une modification du modèle ne modifie aucun document existant.
Les textes sans mise en forme restent littéraux à l’ouverture de l’éditeur.
L’éditeur ne les convertit qu’après une modification du texte.
Un changement d’emplacement ne convertit pas le texte.
Les snapshots et les PDF déjà conservés restent inchangés.

## Format enregistré

Le texte mis en forme utilise un sous-ensemble de Markdown.
Le champ `conditionsPresentation` décrit la présentation des modèles, devis et commandes.
Le champ `paymentTermsPresentation` décrit celle des factures.

```json
{
  "format": "markdown",
  "placement": "new-page"
}
```

La valeur `inline` utilise la place disponible après les totaux.
L’absence de présentation désigne un texte littéral.
Le format `plain` conserve aussi le texte littéral, avec un emplacement explicite.

Les contrats valident les éléments Markdown autorisés.
Le site et le moteur PDF utilisent les mêmes blocs typés.
Le moteur PDF n’exécute aucun code Typst provenant des conditions.

## Vérification

Les tests couvrent les contrats, la persistance, la reprise par les commandes et les protections des versions publiées.
Les tests PDF couvrent les paragraphes, les listes et la pagination après un tableau de plusieurs pages.
Les tests unitaires de l’éditeur couvrent la conservation du texte et le verrouillage pendant l’enregistrement.
