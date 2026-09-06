# Langues, montants et dates

## Montants

`packages/l10n/src/money.ts` utilise `Intl.NumberFormat` pour afficher les montants.
La fonction conserve les unités monétaires entières jusqu’au formatage.
Elle transmet une chaîne décimale exacte à `Intl`, sans division en virgule flottante.

La devise détermine le nombre de décimales.
La langue détermine les séparateurs, le groupement et la position du symbole.
Les tests couvrent les montants négatifs, les limites entières sûres, l’euro, le yen et le dinar koweïtien.
Les documents commerciaux utilisent encore l’euro : le formateur ne change pas cette règle métier.

## Dates

Node.js 26 fournit Temporal sans option expérimentale.
Les services Effect utilisent `Clock` et `DateTime` pour les horloges testables et les fuseaux explicites.
L’interface utilise `Intl.DateTimeFormat`.
Une date civile sans heure doit rester une date civile, sans décalage selon le fuseau du navigateur.

## Négociation HTTP

Les routes `/api/docs` et `/api/openapi.json` choisissent entre le français et l’anglais selon `Accept-Language`.
La bibliothèque `negotiator` traite les priorités `q` et les variantes régionales.
Le français reste la langue par défaut si aucune langue disponible ne correspond.
Les réponses négociées indiquent `Vary: Accept-Language` et `Content-Language`.

Les routes explicites `/api/docs/fr`, `/api/docs/en` et `/api/openapi.fr.json` ou `.en.json` ignorent cette préférence.
Les données JSON conservent leurs montants entiers et leurs dates ISO.
Les exports comptables gardent leur format machine stable.
L’en-tête ne modifie jamais la langue ou le contenu des PDF conservés et signés.
