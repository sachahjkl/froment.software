# Traductions et compteurs

Les traductions utilisent le dictionnaire plat existant.
`t` traduit un libellé.
`tf` remplace les paramètres `{nom}` d’un texte.
`plural` choisit une variante de compteur, puis applique la même interpolation que `tf`.

## Définir un compteur

Ajoutez les variantes `.one` et `.other` dans chaque langue.
Conservez la même clé de base.
Utilisez `{count}` pour afficher le compteur.

```ts
fr: {
  'listControls.optionCount.one': '{count} résultat',
  'listControls.optionCount.other': '{count} résultats',
},
en: {
  'listControls.optionCount.one': '{count} result',
  'listControls.optionCount.other': '{count} results',
},
```

Aucun registre supplémentaire n’est nécessaire.
`PluralTranslationKey` accepte une clé de base uniquement lorsque les deux variantes existent.
Les suffixes `.one` et `.other` ne font pas partie de la clé passée à `plural`.

## Afficher un compteur

Passez un entier sûr positif ou nul dans `count`.
Utilisez la clé de base sans suffixe.

```ts
import { formatPluralTranslation } from "@froment/l10n";

formatPluralTranslation("fr", "listControls.optionCount", { count: 2 });
// Résultat : « 2 résultats ».

i18n.plural("listControls.optionCount", { count: results.length });
```

```html
<p role="status">{{ i18n.plural('listControls.optionCount', { count: results().length }) }}</p>
```

`I18nService.plural` utilise la langue courante du service.
`count` est obligatoire, même lorsqu’une variante n’affiche pas sa valeur.
Sa valeur doit appartenir à l’intervalle `0` à `Number.MAX_SAFE_INTEGER`.
Les fractions, les nombres négatifs, les infinis et `NaN` déclenchent une `RangeError`.
Le message est `Le compteur de traduction doit être un entier sûr positif ou nul.`

Pour un dictionnaire chargé à la demande, utilisez `formatPluralText(language, forms, params)`.
`forms` contient les propriétés `one` et `other`.
Ce formateur réutilise les règles, le cache et le parseur de `formatPluralTranslation`.
Les paramètres sont déduits des deux formes.
Le dictionnaire peut ainsi rester dans le module différé, comme celui de la référence de composants.

## Choix de la variante

Deux instances `Intl.PluralRules` sont conservées, une par langue.
La catégorie `one` sélectionne `.one`.
Toutes les autres catégories sélectionnent `.other`.
Cette règle inclut la catégorie française `many`, utilisée pour un million.

| Compteur  | Français            | Anglais           |
| --------- | ------------------- | ----------------- |
| 0         | `0 résultat`        | `0 results`       |
| 1         | `1 résultat`        | `1 result`        |
| 2         | `2 résultats`       | `2 results`       |
| 1 000 000 | `1000000 résultats` | `1000000 results` |

L’interpolation conserve le format numérique actuel de `tf`.
Elle n’ajoute pas de séparateur de milliers.

## Paramètres supplémentaires

`PluralTranslationParameters<Key>` déduit les paramètres des deux variantes dans les langues disponibles.
`count` accepte uniquement un `number`.
Les autres paramètres acceptent un `string` ou un `number`.
Tous les paramètres déclarés sont obligatoires, même lorsqu’ils apparaissent dans une seule variante.

La clé `configurationWorkspace.tokenConfirm` contient `{count}` et `{name}`.

```ts
i18n.plural("configurationWorkspace.tokenConfirm", {
  count: 2,
  name: "Lecture seule",
});
```

Le type des paramètres de cette clé correspond à :

```ts
Readonly<{ count: number; name: string | number }>;
```

`TranslationParameters` et la signature de `formatTranslation` restent inchangés.

## Affichage du texte

`translation-template.ts` compile chaque texte en nœuds de texte et de paramètres.
Le parseur lit les caractères une seule fois, sans expression régulière.
Le formateur conserve cette compilation en cache après le premier usage du texte.

La syntaxe reconnaît uniquement les paramètres non vides entre accolades, comme `{name}`.
Les accolades incomplètes et les paramètres absents restent littéraux.
Le parseur n’interprète ni les apostrophes ni des instructions de formatage supplémentaires.
Le rendu ne parse jamais les valeurs insérées.

Affichez le résultat avec l’interpolation Angular ou `textContent`.
N’utilisez pas `innerHTML` pour afficher une traduction.

Les paramètres restent du texte littéral.
Le formateur ne parse pas le HTML et ne désinfecte pas les paramètres.
Les caractères `<`, `>` et les séquences comme `$&` restent présents dans la chaîne retournée.
L’interpolation Angular les affiche comme du texte.

## Remplacer un ancien compteur

Remplacez l’appel `tf` du compteur par `plural`.
Ajoutez les deux variantes dans le dictionnaire existant.
Supprimez l’ancienne clé sans suffixe après adaptation des appels.
Vérifiez les cas `0`, `1`, `2` et `1000000` dans les deux langues.
