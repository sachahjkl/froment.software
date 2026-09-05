# Revue d’interface — 5 septembre 2026

## Périmètre et couverture

La demande couvre le site public et le backoffice, sans changement d’identité visuelle.
Cette première correction traite les composants partagés et le parcours d’entrée dans le backoffice.
Elle ne prétend pas terminer la revue de chaque écran métier authentifié.

Le projet utilise Angular 22, des composants internes, SCSS et les variables de `packages/web/src/tokens.css`.
Les conventions consultées sont `AGENTS.md`, `README.md` et `docs/back-office-architecture.md`.
L’atelier `/design` sert de référence aux composants.

Les sept skills `better-interface` et `better-*` ont été installés depuis `jakubkrehel/skills`.
Le fichier `skills-lock.json` enregistre leur provenance.
Les six domaines ont été examinés dans l’ordre prescrit.

| Domaine       | Preuves examinées                                                                      | Résultat                                                             |
| ------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Accessibilité | Formulaires de connexion et d’amorçage, boutons partagés, focus CSS, axe-core          | Validation initiale trompeuse corrigée. Lecture d’écran non vérifiée |
| Layout        | En-tête public, captures à 320 px, géométrie des contrôles                             | Chevauchement du nom du site corrigé                                 |
| Rédaction     | Traductions françaises et anglaises, action de publication du devis, erreurs publiques | Faux envoi et plusieurs erreurs sans action de reprise corrigés      |
| Typographie   | Champs partagés, tailles calculées, règles de retour à la ligne                        | Champs portés à 16 px sous 40 rem. Safari iOS non vérifié            |
| Couleurs      | Boutons dans `/design/actions`, erreurs d’amorçage, thèmes clair et sombre             | Paires insuffisantes corrigées et dégradés conservés                 |
| Finition      | États normaux, survol, actif, désactivé et chargement dans l’atelier                   | Relief et densité conservés. Aucun ajout d’animation                 |

Les captures initiales couvrent les routes suivantes à 320 px dans les deux thèmes :

- `/`, `/about`, `/clients`, `/services` ;
- `/services/developpement`, `/services/audit-renovation`, `/tools`, `/blog` ;
- `/design`, `/backoffice/login`, `/backoffice/bootstrap` ;
- `/quote` sans jeton et `/404`.

Une requête supplémentaire vers `/design/components` atteint une route absente.
Elle ne compte pas comme inspection d’un écran de composants.
L’atelier a ensuite été contrôlé sur ses routes réelles : `actions`, `inputs`, `data`, `feedback` et `navigation`.

## Constats consolidés

Les emplacements désignent la source du problème avant correction.
Les corrections décrites dans « Après » sont appliquées dans ce lot.

| Gravité | Domaine       | Emplacement                                                                                                                        | Avant                                                                                                                  | Après                                                                                      | Pourquoi                                                                               |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| HIGH    | Couleurs      | `packages/web/src/app/shared/button/button.scss:43-64`, `packages/web/src/tokens.css:128-141`                                      | Texte blanc sur fonds info, succès et avertissement. Axe mesure respectivement 3,41, 3,13 et 2,27 sur les états actifs | Texte sombre dédié sur ces trois variantes. Haut des dégradés primaire et danger assombri  | Le texte de contrôle exige 4,5:1. Le contrôle couvre aussi les extrémités des dégradés |
| HIGH    | Couleurs      | `packages/web/src/app/pages/back-office/bootstrap/bootstrap.scss:48`, `packages/web/src/app/pages/back-office/login/login.scss:37` | Rouge fixe `#9e1b1b`. Axe mesure 1,79:1 sur le fond sombre `#292934`                                                   | Réutilisation de `--color-danger`, défini dans chaque thème                                | Une erreur doit rester lisible dans les deux thèmes                                    |
| HIGH    | Layout        | `packages/web/src/app/shared/site-header/site-header.scss:26-63`                                                                   | Marque en largeur intrinsèque, sans adaptation étroite. Le nom passe sous les contrôles à 320 px                       | Taille du nom, logo et espacement réduits sous 24 rem                                      | Les contrôles ne doivent pas masquer le nom du site                                    |
| HIGH    | Rédaction     | `packages/l10n/src/translations.ts:448-469`, `packages/api/src/quote-links/service.ts:124-230`                                     | « Envoyer le devis » et « Envoyé », sans appel à un fournisseur                                                        | « Créer le lien de signature », « Signature attendue » et indication d’absence de courriel | Le libellé doit décrire l’effet réel de l’action                                       |
| HIGH    | Rédaction     | `packages/l10n/src/translations.ts:494-497`, `:83`, `:701` et traductions anglaises                                                | Erreurs de devis, PDF, connexion et amorçage sans procédure de reprise                                                 | Demande de nouveau lien, rechargement ou nouvelle tentative selon le cas                   | Une erreur doit indiquer une action de reprise sans provoquer un doublon métier        |
| HIGH    | Couleurs      | `packages/web/src/app/shared/back-office-header/back-office-header.html:23`                                                        | Déconnexion avec variante `danger`                                                                                     | Variante neutre du bouton existant                                                         | Le rouge signale une action destructive, pas une déconnexion ordinaire                 |
| MEDIUM  | Accessibilité | `packages/web/src/styles.scss:297`                                                                                                 | `:invalid:not(:placeholder-shown)` colore les champs requis vides dès l’ouverture                                      | `:user-invalid` et `[aria-invalid="true"]`, également sur les listes                       | Un formulaire vierge ne doit pas annoncer visuellement des erreurs avant interaction   |
| MEDIUM  | Typographie   | `packages/web/src/styles.scss:289`                                                                                                 | Champs à 14 px sur mobile                                                                                              | Taille `--text-base` sous 40 rem                                                           | Les champs conservent une taille de saisie de 16 px sans transformation CSS            |

Le contrôle étendu a aussi détecté un fond gris sur l’état actif des boutons liens en thème sombre.
Dans `packages/web/src/app/shared/button/button.scss:113-139`, cet état produisait un contraste de 1,62:1.
La correction exclut la variante lien des fonds de boutons pleins.
Le survol sombre produisait aussi un contraste de 3,48:1 en assombrissant systématiquement le texte.
Un token `--color-link-hover` propre à chaque thème remplace cette règle sur tous les liens.
Ce constat HIGH appartient à la même cause de contraste des états de boutons recensée dans le tableau.

Les statuts et noms des endpoints restent inchangés dans ce lot.
Leur séparation entre état contractuel et livraison appartient au lot de messagerie.

## Identité visuelle conservée

Les éléments suivants restent en place :

- texture du fond et palette générale ;
- police du texte et police monospace ;
- boutons à dégradés et relief discret ;
- rayons courts et bordures structurantes ;
- densité du backoffice et atelier de composants ;
- thèmes clair et sombre.

Aucune bibliothèque graphique ni animation supplémentaire n’a été ajoutée.
Les changements de couleur corrigent la lisibilité des contrôles, pas la direction artistique.

## Vérification

Le navigateur utilisé est Chromium 152, lancé avec Playwright 1.58.2.
Le contrôle automatique utilise axe-core via `@axe-core/playwright` 4.11.1.
Ces outils ont été installés dans `/tmp/opencode/froment-interface`, hors des dépendances de production.

Commande du serveur local :

```sh
nix develop --command pnpm --filter @froment/web start --host 127.0.0.1
```

Les résultats de l’inspection initiale se trouvent dans `results.json` et `details.json` dans ce répertoire temporaire.
Les captures ont été ouvertes pour examiner le chevauchement et les états des formulaires.
Un contrôle de débordement global seul n’avait pas détecté le chevauchement interne de l’en-tête.

### Résultats du contrôle étendu

Le script `verify.mjs` a exécuté 96 combinaisons : huit routes, trois largeurs, deux langues et deux thèmes.
Il n’a détecté ni débordement global ni chevauchement de l’en-tête après correction.
Il a détecté les défauts supplémentaires des états de boutons liens en thème sombre.

Après correction, `/design/actions` a été contrôlé à nouveau sur les douze combinaisons de largeur, langue et thème.
Le résultat final ne contient aucune violation axe, aucun chevauchement et aucun rapport de contraste inférieur au seuil testé.
Le serveur Angular a été redémarré pour éliminer des styles SSR périmés conservés pendant le rechargement de développement.

Les captures finales de l’atelier et de la connexion ont été examinées.
Les erreurs d’amorçage restent celles du serveur local sans API, pas une simulation de production.

### Mesures après correction

Les gradients des boutons ont été calculés à partir des couleurs du navigateur.
Le contrôle échantillonne 101 positions entre les deux extrémités, dans l’espace sRGB utilisé par le dégradé.

| Variante      | Rapport minimal mesuré |
| ------------- | ---------------------- |
| Primaire      | 5,12:1                 |
| Info          | 4,62:1                 |
| Succès        | 5,05:1                 |
| Avertissement | 6,94:1                 |
| Danger        | 4,91:1                 |

Le seuil retenu est 4,5:1 pour le texte des contrôles actifs.
Les contrôles désactivés sont exclus de cette mesure.

Le parcours clavier de connexion a été exécuté avec `nix develop --command node /tmp/opencode/froment-interface/keyboard.mjs`.
Le formulaire vide place le focus sur le courriel requis.
La touche Tab atteint le bouton de connexion avec un contour visible de 2 px.
La touche Entrée soumet le formulaire.
Une réponse 503 simulée affiche une erreur de reprise sans violation axe dans le thème sombre.
La taille calculée du champ vaut 16 px à 320 px de largeur.

### Contrôles à reproduire

1. Ouvrir `/design/actions`, `/design/inputs`, `/design/feedback` et `/design/navigation`.
2. Vérifier les thèmes clair et sombre en français et en anglais.
3. Répéter aux largeurs 320, 768 et 1440 px.
4. Comparer le bord droit de la marque au bord gauche des contrôles.
5. Ouvrir `/backoffice/login` sans saisir de valeur.
6. Vérifier que les champs ne présentent pas encore une bordure d’erreur.
7. Soumettre le formulaire vide.
8. Vérifier la validation native et le focus sur le champ requis.
9. Vérifier le contraste des erreurs dans les deux thèmes.
10. Vérifier les variantes de boutons, leurs états actifs et leurs dégradés.

### Limites

- Axe-core ne remplace pas une revue manuelle avec lecteur d’écran.
- Le rendu d’un champ à 16 px ne constitue pas un test Safari iOS.
- Une largeur de 320 px ne constitue pas à elle seule un test de zoom navigateur à 200 %.
- Le parcours de signature avec un vrai jeton n’a pas été parcouru dans le navigateur.
- Les écrans métier authentifiés, leurs données longues et leurs états de panne nécessitent un lot distinct.
- La troncature de l’adresse du compte dans l’en-tête privé nécessite une vérification de récupération de la valeur complète.

## Suite du réalignement

1. Vérifier le parcours client → devis → acceptation → facture avec une base de test représentative.
2. Tester les libellés longs, les coordonnées complètes et les documents à vingt lignes.
3. Contrôler les onglets et les tableaux horizontaux au clavier.
4. Vérifier la récupération des valeurs tronquées sans souris.
5. Vérifier les états vides, chargement, erreur et conflit de modification de chaque écran métier.
6. Comparer les marges et l’alignement du devis public aux composants déjà validés.
7. Ajouter une suite navigateur reproductible aux checks du dépôt.

Le réalignement global n’est pas terminé tant que ces parcours ne sont pas vérifiés.

## Verdict

**Approve — pour le lot de corrections et les états contrôlés ci-dessus.**
Aucun constat HIGH confirmé ne reste ouvert dans ce lot.
Cette approbation ne couvre pas les parcours authentifiés exclus, Safari, les lecteurs d’écran ni le zoom à 200 %.
Elle ne constitue pas une validation globale du site.
