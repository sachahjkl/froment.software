# Versions

`CHANGELOG.md`, à la racine du dépôt, est la seule source de l’historique des versions. La page `/fr/changelog` (`/en/changelog`) et le flux Atom `/changelog/feed` le lisent avec le même analyseur, `@froment/l10n/changelog`. Ils ne peuvent donc pas diverger.

## Décisions

- **Le fichier est intégré au build, pas lu à l’exécution.** Angular et esbuild chargent `CHANGELOG.md` comme texte. Le serveur n’a ni fichier à lire ni configuration à ajouter. Un changement de changelog suit toujours un nouveau déploiement.
- **Un mini-rendu Markdown.** Les entrées n’utilisent que le gras, le code et les liens. `entryHtml` couvre ces trois règles et échappe le reste. `marked` aurait alourdi le bundle du serveur.
- **Une frise, pas des `details`.** Les autres projets replient chaque version. Ici, les règles de l’interface réservent `details` aux disclosures éditoriaux. Les versions restent donc ouvertes sur une frise, et le filtre remplace le repli.
- **Les entrées restent en français.** La page anglaise traduit l’interface, pas l’historique. Son introduction le dit.
- **Une version = un tag `vX.Y.Z` et une release GitHub.** Chaque version renvoie vers sa release par les liens de référence en bas de `CHANGELOG.md`.

## Historique reconstruit

Les versions 0.1.0 à 0.19.0 ont été reconstruites le 2026-11-16, à partir des commits et de l’ancien `BACKLOG.json`. 0.1.0 est le premier commit publié (2026-05-28). Les numéros des `package.json` de l’époque (0.1.0 puis 0.2.0 à 0.2.5, en août) ont été ignorés. Les tags pointent sur le dernier commit de chaque jalon.

## Points subtils

- L’analyseur refuse une section inconnue (`### Misc`). Une faute de frappe casse donc le build au lieu de disparaître de la page.
- Le formateur `oxfmt` ajoute une ligne vide après chaque `###`. L’analyseur les ignore.
