# changelog.d

Un fichier par changement visible. La publication d’une version les assemble dans `CHANGELOG.md`, puis les supprime. Ne modifiez pas `CHANGELOG.md` à la main.

Un fragment s’appelle `changelog.d/<yyyyMMdd-HHmmss>-<sujet>.md`. Le sujet contient des minuscules, des chiffres et des `-`.

```
type: Changed

**Résumé court** : ce qui change pour le visiteur, en une seule entrée (sans « - » au début).
```

- `type` vaut `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed` ou `Security` ([Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)).
- Le texte est une entrée de la liste. Il peut tenir sur plusieurs lignes, sans ligne vide ni titre.
- Un changement qu’aucun visiteur ne voit n’a pas de fragment.
- Le fragment entre dans le même commit que le changement.
