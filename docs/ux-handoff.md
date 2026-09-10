# État de la refonte UX — 10 septembre 2026

La refonte est validée pour l’intégration à `master` depuis `wip/ux-handoff-2026-09-10`.
La dernière révision confirmée en production avant cette livraison est `eaba432d`.
La CI, la publication de l’image et la révision déployée se vérifient séparément.

## Règle de validation

L’utilisateur a retiré les tests d’intégration navigateur des checks et des critères de livraison.
La réussite de huit scénarios Playwright ou d’une matrice de zoom ne bloque plus la livraison.
Les outils navigateur restent disponibles pour des inspections visuelles locales et ponctuelles.
N’ajoutez pas de tests qui figent le DOM, les libellés, l’ordre des contrôles ou les détails visuels.
La règle est inscrite dans `AGENTS.md`.

La compilation, le lint, le formatage et les tests métier, API et unitaires existants restent applicables.
Les dernières modifications non validées des scénarios navigateur ont été retirées.
Le changement du lien bancaire destiné uniquement à contourner une simulation navigateur a aussi été retiré.

## Périmètre réalisé

- Les modules partagent les contrôles de recherche, de filtre, de tri et d’export.
- Les listes, les détails et les tâches ont des routes séparées.
- La navigation distingue Activité et Administration.
- Les pages client restent séparées de la navigation administrative.
- La recherche globale reste réservée aux administrateurs.
- La référence contient 56 composants et une composition de démonstration séparée.
- Le dictionnaire de référence et Mermaid restent hors du chargement initial.
- Les limites financières, les permissions et les historiques conservent leurs protections serveur.
- Les formulaires conservent leurs validations, confirmations et protections contre la perte de saisie.
- Les pluriels utilisent `Intl.PluralRules`. Les paramètres insérés restent littéraux.

Les dates natives Angular peuvent marquer une valeur inchangée comme modifiée pendant une animation de validité.
Les formulaires concernés comparent leurs valeurs à un état initial et conservent la protection des erreurs de saisie natives.
Les conflits, les opérations en cours et les secrets gardent leurs protections indépendantes.

## Vérifications acquises

Ces résultats concernent l’instantané intégré avec le padding Audit et l’endpoint Atom public.

- La compilation Angular passe avec un chargement initial de **826,99 kB**, sous la limite inchangée de **1,05 MB**.
- **775 tests frontend** passent dans 135 fichiers.
- **78 tests de localisation** passent dans 10 fichiers. Le contrôle TypeScript de ce package passe.
- Le lint ne signale aucune erreur ni aucun avertissement.
- Le formatage passe. Les deux fichiers chiffrés restent exclus du formatage général.
- L’analyse des imports confirme le chargement différé du dictionnaire de référence et de Mermaid.
- **51 tests de contrats** passent.
- Les **285 tests API** précédant l’endpoint Atom passent avec les seuils de couverture existants, dans 69 fichiers.
- Après l’ajout de l’endpoint, les **27 tests ciblés** du serveur, de la documentation et du flux passent.
- Le serveur compilé répond en HTTP 200 à `/api/blog/feed`, sans authentification, avec quatre entrées XML et l’origine configurée.
- Le type MIME est `application/atom+xml`. La langue déclarée est `fr`.
- La compilation ne contient plus de fichier Atom statique.
- Le message vide Audit présente un padding mesuré de 8 px verticalement et de 12 px horizontalement.

Les inspections navigateur ont couvert la référence, plusieurs parcours commerciaux, la navigation au clavier et une partie du zoom réel à 200 %.
Elles ne certifient pas toute l’accessibilité. Les derniers scénarios complets comportent encore des échecs et ne sont plus des critères de livraison.

## Commits signés et poussés sur la branche de travail

- `5c753290` : point de reprise initial, non validé au moment du commit.
- `e73d9653` : tri des statuts dans la langue active.
- `7d11b0b5` : protections des dates natives et des conflits.
- `76ffac76` : pluriels et erreurs des téléchargements PDF.
- `f4ad8247` : focus et références ARIA de la recherche globale.
- `b8c769b8` : référence complète et dictionnaire différé.
- `3c25d5e7` : protection de la saisie lors du changement d’affectation bancaire.
- `fae8ef9e` : exclusion des fichiers SOPS du formatage général.
- `137acc4b` : délais bornés et rapports des anciennes inspections de devis public.
- `b115550f` : retrait des scénarios navigateur des checks et des critères de livraison.
- `d3c20498` : padding compact du message vide Audit.
- `267e1fa4` : première version statique du flux Atom, refusée et remplacée par `58d83e2f`.
- `d292e426` : délai local adapté au test API des listes financières de 10 000 lignes.
- `58d83e2f` : endpoint Atom public généré depuis les métadonnées partagées du blog.

Le commit indépendant `57320523`, consacré aux surfaces de découverte publiques, est conservé.

La CI `34483706906` a validé `d292e426` sans lancer Playwright.

## Livraison

1. Intégrez les unités validées à `master`.
2. Vérifiez la CI et la publication de l’image.
3. Confirmez séparément la révision déployée avec `/api/version`.

## Flux Atom

`GET /api/blog/feed` est public et déclaré dans OpenAPI.
L’API génère le XML depuis `@froment/l10n/blog-posts`, également utilisé par le frontend.
Le flux contient les résumés français. Les corps Markdown restent côté web.
Les liens absolus utilisent l’origine configurée du serveur.
Le fichier XML statique, sa déclaration TypeScript et son test de synchronisation sont supprimés.

## Preuves locales

- Instantané : `/tmp/nix-shell.7rmpGh/opencode/workspace-verification-2`.
- Compilation et tests intégrés : `/tmp/nix-shell.7rmpGh/opencode/workspace-integrated-checks-4.log`.
- Contrats et API : `/tmp/nix-shell.7rmpGh/opencode/workspace-api-checks-3.log`.
- Dernière inspection navigateur : `/tmp/nix-shell.7rmpGh/opencode/workspace-interface-resume-9.log`.
- Captures : `test-results/interface-resume-9` dans l’instantané.
- Vérifications finales : `/tmp/nix-shell.7rmpGh/opencode/ux-final-with-atom-checks-2.log`.
- Compilation, lint, formatage et inspection Audit : `/tmp/nix-shell.7rmpGh/opencode/ux-final-inspection.log`.
- Suite API et couverture : `/tmp/nix-shell.7rmpGh/opencode/ux-api-coverage-check.log`.
- Compilation et tests après l’endpoint Atom : `/tmp/nix-shell.7rmpGh/opencode/ux-final-public-atom-checks-2.log`.
- Contrats, API, lint, formatage et requête HTTP finale : `/tmp/nix-shell.7rmpGh/opencode/ux-final-public-atom-checks-3.log`.

## Limites maintenues

- Gardez les secrets chiffrés avec SOPS. L’utilisateur a approuvé les deux fichiers chiffrés du point de reprise.
- Ne modifiez pas les sauvegardes, le DNS de production ou les MX Tuta.
- N’activez aucun service payant ou financier réel.
- Gardez les messages commerciaux simulés et les prestataires financiers en mode test ou sandbox.
- Ne renvoyez pas les tests Resend acceptés. Ne créez pas de nouvelle session Stripe de vérification.
- Préservez les documents immuables, l’audit, l’idempotence, les passkeys et les permissions.
- Préservez les versions des outils et les entrées Nix épinglées.
- Ne lancez pas de `nix flake check` local complet.
- Ne cumulez pas une vérification locale lourde et la CI auto-hébergée.
- Les outils backlog sont absents. Ne modifiez pas `BACKLOG.json` directement.
