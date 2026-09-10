# État de la refonte UX — 10 septembre 2026

La refonte reste sur `wip/ux-handoff-2026-09-10`. Elle n’est pas encore intégrée à `master`.
La dernière révision confirmée en production est `eaba432d`.

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

Ces résultats concernent le dernier instantané intégré, avant le padding Audit et le flux Atom en cours.

- La compilation Angular passe avec un chargement initial de **826,47 kB**, sous la limite inchangée de **1,05 MB**.
- **775 tests frontend** passent dans 135 fichiers.
- **78 tests de localisation** passent dans 10 fichiers. Le contrôle TypeScript de ce package passe.
- Le lint ne signale aucune erreur ni aucun avertissement.
- Le formatage passe. Les deux fichiers chiffrés restent exclus du formatage général.
- L’analyse des imports confirme le chargement différé du dictionnaire de référence et de Mermaid.
- Une vérification antérieure a validé **51 tests de contrats** et **142 tests API** ciblés.

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

Le commit indépendant `57320523`, consacré aux surfaces de découverte publiques, est conservé.

## Travail restant

1. Vérifiez et livrez le padding du message vide Audit : 8 px verticalement et 12 px horizontalement.
2. Terminez le flux Atom du blog dans une unité séparée.
3. Validez la source finale sans relancer la suite navigateur exhaustive.
4. Intégrez les unités validées à `master`.
5. Vérifiez la CI et la publication de l’image.
6. Confirmez séparément la révision déployée avec `/api/version`.

## Preuves locales

- Instantané : `/tmp/nix-shell.7rmpGh/opencode/workspace-verification-2`.
- Compilation et tests intégrés : `/tmp/nix-shell.7rmpGh/opencode/workspace-integrated-checks-4.log`.
- Contrats et API : `/tmp/nix-shell.7rmpGh/opencode/workspace-api-checks-3.log`.
- Dernière inspection navigateur : `/tmp/nix-shell.7rmpGh/opencode/workspace-interface-resume-9.log`.
- Captures : `test-results/interface-resume-9` dans l’instantané.

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
