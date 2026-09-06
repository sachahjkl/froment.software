# Aperçus PDF

Les aperçus de devis, factures et commandes portent un filigrane « PREVIEW » sur chaque page.
Le filigrane reste présent lorsque le fichier est ouvert ou enregistré depuis le navigateur.

Le titre intégré au PDF contient le type de document, sa référence et son intitulé.
Les devis et factures indiquent aussi leur version.
Une facture non numérotée porte la mention « brouillon » et son identifiant.

Le serveur fournit aussi un nom de fichier distinct avec `Content-Disposition: inline`.
Exemples :

- `preview-devis-DE-2026-000001-v2.pdf` ;
- `preview-facture-FA-2026-000001-v3.pdf` ;
- `preview-commande-CO-2026-000001.pdf`.

Selon le navigateur, l’onglet affiche le titre PDF ou le nom du fichier.
Les deux identifient l’aperçu au lieu d’afficher seulement le dernier segment `/preview` de l’URL.

## Séparation des documents définitifs

Le serveur applique le filigrane uniquement aux routes d’aperçu.
Les routes de génération, de téléchargement et du portail client restent sans filigrane.
Un aperçu ne crée aucun document conservé et ne remplace aucun PDF existant.
Il ne modifie ni les versions enregistrées ni les documents signés.

## Vérification locale

Si le shell utilise des modèles Nix déjà construits, pointez les tests vers les modèles modifiés :

```sh
DOCUMENT_TEMPLATES_PATH="$PWD/packages/documents/templates" pnpm --recursive --if-present test
```

Les tests vérifient le titre, le filigrane sur chaque page et son absence dans les PDF définitifs.
