# Revue des alertes et des confirmations

## Périmètre

La revue des sources couvre les alertes des pages publiques, du backoffice et de la démonstration.
Elle examine les composants partagés, les templates, les styles et les textes concernés.
Elle ne constitue pas une validation exhaustive de chaque état de chaque page.

Les règles du projet viennent de `AGENTS.md`, `docs/interface-layout.md` et des skills d’interface.
L’implémentation conserve Angular, les composants existants, les tokens, les polices et les thèmes.

## Constats traités

| Niveau | Emplacement                                                                                     | Avant                                                                                                        | Après                                                                        | Raison                                                                       |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Élevé  | `shared/notice/notice.ts`, catalogue, fiche client, `shared/document-issues/document-issues.ts` | Le sélecteur acceptait uniquement les paragraphes. Les blocs `div appNotice` ne recevaient pas le composant. | Le composant accepte les paragraphes et les blocs structurés.                | Les avertissements métier utilisent désormais le même rendu.                 |
| Moyen  | Banque, courriels, sécurité du compte, devis public, récapitulatifs des documents               | Certains flux de blocs ne séparaient pas les alertes de leurs voisins.                                       | Les parents concernés utilisent `.notice-flow`.                              | L’espacement appartient au parent, sans doubler les espacements des grilles. |
| Moyen  | Connexion et initialisation                                                                     | Les erreurs utilisaient une présentation locale différente.                                                  | Elles utilisent `Notice`, avec la variante `danger` et `role="alert"`.       | Les erreurs suivent le même langage visuel.                                  |
| Moyen  | `pages/design/design.component.*`                                                               | La démonstration ne permettait pas d’essayer les confirmations.                                              | Deux exemples utilisent le service réel, sans effet métier.                  | Le clavier, l’annulation et la confirmation sont vérifiables.                |
| Moyen  | `api/src/documentation`, ressources Angular                                                     | Effect embarquait Scalar 1.43.5, sans localisation des contrôles.                                            | Le site distribue Scalar 1.67.0 et sélectionne un document OpenAPI localisé. | La langue de l’interface et celle du contenu sont configurées séparément.    |

Les chemins de composants sont relatifs à `packages/web/src/app`, sauf indication contraire.

## Vérifications

- Les huit contrôles Playwright existants passent, sans ajout de contrôle supplémentaire.
- Les contrôles utilisent une largeur de 320 pixels en clair et de 1440 pixels en sombre.
- Les contrôles Axe passent sur les parcours inspectés, y compris la confirmation ouverte.
- Le clavier vérifie le focus initial, le confinement, Échap et le retour au bouton déclencheur.
- Les contrôles vérifient la séparation rendue des alertes des courriels et de la banque.
- Le navigateur exécute le bundle Scalar réel et vérifie les contrôles français et anglais.
- Les tests HTTP vérifient la négociation, les routes explicites et les en-têtes de langue.

La lecture avec un lecteur d’écran réel, le zoom à 200 % et tous les états d’erreur restent non vérifiés.
Les audits automatisés ne remplacent pas ces vérifications.

## Conclusion

Les défauts relevés dans le périmètre inspecté sont corrigés.
Cette conclusion ne vaut pas certification d’accessibilité de l’ensemble du site.
