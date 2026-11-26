# froment.software : intention

Ce dossier suit <https://srcmd.org>. Il garde les raisons des choix du site : les décisions, les options refusées et les points subtils. Le reste de `docs/` contient la documentation d’exploitation et les revues ; ce dossier ne la répète pas.

## Vue d’ensemble

Le site est la vitrine de Froment Software. Il s’adresse à un public technique : des personnes qui voient la lenteur et le poids des logiciels actuels, et qui veulent des outils rapides et sobres.

Le site est pré-rendu par Angular (`packages/web`) et servi par un serveur Effect (`packages/marketing`). Il n’a ni base de données ni API métier. Les textes des deux langues sont dans `packages/l10n`.

## Points subtils

- Une même clé de traduction peut garder un texte identique en français et en anglais. C’est voulu pour le slogan.
- La racine `/` redirige vers `/en`, et `x-default` désigne l’anglais. Les logiciels de la suite visent un public mondial, et un recruteur ou un client étranger lit l’anglais ; le français reste à un clic. La détection par `Accept-Language` a été refusée : la racine reste une simple redirection, sans variation selon le visiteur.

## File Index

- [features/home.md](features/home.md) : l’accueil, sa structure et les mises en page refusées.
- [features/changelog.md](features/changelog.md) : la page des versions, le flux Atom et l’historique reconstruit.
- [features/slogan.md](features/slogan.md) : le slogan, son public, et pourquoi il reste en anglais.
- [features/filigrane.md](features/filigrane.md) : la page secrète du QR code gravé, première étape de la chasse.
