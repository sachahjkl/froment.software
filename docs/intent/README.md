# froment.software : intention

Ce dossier suit <https://srcmd.org>. Il garde les raisons des choix du site : les décisions, les options refusées et les points subtils. Le reste de `docs/` contient la documentation d’exploitation et les revues ; ce dossier ne la répète pas.

## Vue d’ensemble

Le site est la vitrine de Froment Software. Il s’adresse à un public technique : des personnes qui voient la lenteur et le poids des logiciels actuels, et qui veulent des outils rapides et sobres.

Le site est pré-rendu par Angular (`packages/web`) et servi par un serveur Effect (`packages/marketing`). Il n’a ni base de données ni API métier. Les textes des deux langues sont dans `packages/l10n`.

## Points subtils

- Une même clé de traduction peut garder un texte identique en français et en anglais. C’est voulu pour le slogan.

## File Index

- [features/slogan.md](features/slogan.md) : le slogan, son public, et pourquoi il reste en anglais.
