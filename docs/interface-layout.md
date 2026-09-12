# Mise en page de l’interface

## Principes

Le site conserve ses polices, sa texture, ses boutons à dégradés et ses bordures.
Cette reprise concerne la disposition, la hiérarchie et la lisibilité, pas les fonctions métier.

- Alignez l’en-tête, le contenu et le pied de page publics avec `--page-x`.
- Conservez la largeur publique de 60 rem.
- Centrez le contenu du backoffice dans une largeur adaptée à la page.
- Limitez la zone complète, avec son en-tête et ses messages, plutôt que le formulaire seul.
- Utilisez `--panel-padding` pour les sous-groupes qui nécessitent un panneau.
- Sur un formulaire à plusieurs groupes, appliquez le fond à chaque groupe, pas au formulaire entier.
- Regroupez les champs liés avec `.field-grid` et réservez `.wide` aux champs occupant toute la ligne.
- Conservez un seul titre `h1` par page, y compris dans les pages de configuration imbriquées.
- Appliquez `text-wrap: balance` aux titres `h1` à `h6` avec la règle globale, sans répétition locale.
- Rendez la valeur complète accessible lorsqu’un texte est tronqué.

## Surfaces et composition

Le démarrage distingue une route inconnue d’une route publique.
Avant la reconnaissance de la route, l’application affiche un indicateur de chargement sans en-tête public.
Une route backoffice reconnue réserve la place de sa navigation pendant la vérification de session et le chargement des composants.
Les gardes restent responsables de l’accès aux pages et aux données.

Les pages prérendues transmettent leur shell avec `TransferState` pour conserver leur affichage pendant l’hydratation.
Une navigation ultérieure conserve le shell actif jusqu’à sa réussite.
Une navigation annulée ne remplace pas l’écran courant par un écran de chargement.

Le backoffice utilise trois largeurs maximales, définies dans `packages/web/src/tokens.css`.

| Composition                          | Largeur | Application                                   |
| ------------------------------------ | ------- | --------------------------------------------- |
| Formulaire ou tâche                  | 52 rem  | `.detail-page.form-page`, conteneur du compte |
| Fiche ou composition à deux colonnes | 72 rem  | `.detail-page`                                |
| Liste ou composition large           | 80 rem  | `main`, `.detail-page.wide-page`              |

Les largeurs incluent l’espacement intérieur. Les zones utilisent `margin-inline: auto` et restent limitées à la largeur disponible.
L’en-tête, les messages, les résultats et le formulaire partagent les mêmes bords.
Les formulaires internes ne répètent pas une largeur maximale plus étroite.
Les textes de lecture et les contrôles isolés peuvent conserver une largeur locale.

Les formulaires clients, catalogue, conditions, permissions API, invitations, facturation, courriels et paramètres utilisent la largeur de formulaire.
Les fiches commerciales et la composition Resend avec aperçu utilisent la largeur de fiche.
Les listes, l’éditeur de devis avec récapitulatif, les fiches clients et les rapprochements bancaires utilisent la largeur large.
L’impression ne conserve pas ces limites de largeur.

Les alertes utilisent `Notice` sur un paragraphe ou un bloc contenant plusieurs éléments.
Le composant gère la présentation, pas la position dans la page.
Dans une grille ou un conteneur flex, le parent gère l’espacement avec `gap`.
Dans un flux de blocs sans espacement existant, ajoutez `.notice-flow` au parent direct.
Cette classe sépare les alertes de leurs voisins avec `--space-4`.
N’ajoutez pas cette classe à une grille qui possède déjà un `gap`.

Le conteneur `main` reste transparent et gère uniquement la disposition.
Chaque page de premier niveau applique `.page-container`.
Les pages de configuration imbriquées ne répètent pas ce conteneur.

Les groupes de formulaire utilisent `.ds-panel.form-panel` pour leur fond et leur espacement intérieur.
Un formulaire court peut constituer un seul groupe. Un formulaire composé conserve ses actions générales hors des groupes.
Les lignes de devis déjà présentées en panneaux ne reçoivent pas un second panneau parent.

La classe `.field` sépare le libellé de son contrôle par 8 px.
Les classes `.fields` et `.field-grid` séparent les champs entre eux.
`FieldGroup` regroupe les champs sous un `legend`. Ses libellés projetés utilisent aussi `.field`.

L’éditeur de jetons API empile les groupes de permissions dans un accordéon Angular Aria.
Plusieurs groupes peuvent rester ouverts. Leur compteur conserve la sélection totale du domaine, même lorsque la recherche masque des permissions.
La recherche ouvre les groupes correspondants. Replier un groupe ne modifie pas les permissions sélectionnées.

Les pages publiques conservent leur bordure, leur ombre et leur marge extérieure sur la texture.
Dans le backoffice, la surface de page reste opaque, sans bordure extérieure ni ombre.
La navigation latérale utilise les couleurs du thème existant.
L’impression retire la navigation et les marges extérieures.

Les pages publiques utilisent `.page-intro` pour leur introduction et `.contact-panel` pour leur zone de contact.
Les titres d’introduction utilisent `--text-hero`, sans modifier les titres des éditeurs métier.
Les blocs de contenu réutilisent `.ds-panel` et les couleurs des deux thèmes.
Les blocs internes utilisent un fond uniforme gris neutre, sans dégradé, contour ni ombre.
Le token de marque `--color-panel` définit ce fond : `#f0f0f0` en clair et `#2b2b2b` en sombre.
Les petits arrondis et l’espacement distinguent les groupes de contenu.
Cette règle couvre notamment la recherche, les indicateurs et le bloc « Nos prestations ».
Les boutons, les champs, les alertes et les séparateurs conservent leurs marques de contrôle ou de structure.

L’accueil place les prestations à côté de son introduction sur grand écran.
La grille d’expertise regroupe les sujets dans une surface commune.
Le déroulement d’une mission devient horizontal lorsque cinq étapes tiennent sur la largeur disponible.
Les projets et la présentation personnelle occupent ensuite deux colonnes.
Sur écran étroit, ces groupes suivent l’ordre du document dans une seule colonne.

Les prestations, secteurs clients, projets et articles utilisent des panneaux distincts.
La FAQ conserve les éléments natifs `details` et `summary`.
Un signe moins indique une réponse ouverte ; un signe plus indique une réponse fermée.
La navigation publique donne à la rubrique active une forme d’onglet et une bordure inférieure renforcée.
Le tableau de bord sépare les indicateurs, les actions requises et les documents récemment modifiés.

Ces choix appliquent le regroupement de `better-layout` et la séparation des surfaces de `better-ui`.
Ils conservent les polices, les petits rayons et les dégradés des contrôles existants.

## Éditeurs de documents

Les devis et factures partagent `packages/web/src/app/pages/back-office/_document-editor.scss`.
Sur grand écran, le formulaire et le récapitulatif occupent deux colonnes.
Sur écran étroit, le récapitulatif suit le formulaire dans l’ordre du document.

La largeur du formulaire détermine le regroupement des champs de ligne.
La description occupe une ligne entière.
La quantité, le prix et la TVA occupent trois colonnes lorsque la place le permet.
L’abandon d’un devis reste accessible dans une section dépliable explicitement nommée.

## Autres écrans

Le backoffice possède une navigation latérale avec icônes et un en-tête contenant le lien vers la documentation API.
La rubrique active couvre aussi ses éditeurs associés.
Le menu du compte occupe le haut de la navigation et remplace le titre visible du tiroir.
Il présente le compte actif, sa sécurité et la déconnexion.
La langue et le thème restent dans le pied de la navigation.
Le tiroir conserve son nom accessible et son bouton de fermeture.
L’API actuelle ne fournit pas de liste de comptes disponibles ni de permissions au navigateur.
Les contrôles d’accès serveur restent inchangés.

La navigation regroupe les sujets sans fusionner leurs actions :

- Activité : Tableau de bord, Clients, Affaires, Facturation, Banque, Courriels et Catalogue.
- Administration : Équipe, API, Services externes, Journal d’audit et Configuration.

Configuration contient seulement les réglages de l’entreprise, les conditions des documents et la carte de visite.
Équipe gère les membres et les invitations.
API gère les jetons et leurs permissions.
Services externes sépare les connexions, les tests et les simulations des opérations commerciales.
Le menu du compte conserve les réglages personnels de sécurité.

Les routes Équipe, API, Services externes et Journal d’audit sont indépendantes de Configuration.
Leurs anciens chemins sous Configuration ne sont plus définis.

Sous 64 rem, un tiroir remplace la navigation latérale.
Le composant `Drawer` utilise Angular CDK pour le focus, Échap, le fond modal et le blocage du défilement.
Le contenu `[drawerHeading]` remplace son titre visible sans modifier son nom accessible.
Les confirmations de sortie restent accessibles au-dessus du tiroir.
Une navigation annulée conserve le tiroir et la saisie.

La déconnexion passe par `/backoffice/sign-out` après les protections de sortie du formulaire.
Une sortie refusée ne modifie pas la session.
Un échec de déconnexion affiche une erreur et une action de nouvelle tentative.

Le composant `PageHeader` sépare le titre des actions avec retour à la ligne.
La référence `/design/page-header` présente ce composant.
Les listes d’entités présentent un titre fixe et une description, sans surtitre.
Facturation conserve son titre dans les vues Factures, Encaissements, Avoirs et Remboursements.
Les onglets nomment les vues sans répéter leur nom dans le titre principal.

Les fiches et tâches du backoffice utilisent `PageHeader` avec `layout="stacked"`.
Le module Sass `shared/page-header/detail-page` gère leur composition, leur espacement et la taille du titre.
Les pages ne redéfinissent pas ces valeurs localement.

L’en-tête suit cet ordre :

1. Le slot `pageBack` contient un retour simple ou un fil d’Ariane, en 14 px.
2. Le titre présente le document ou l’opération, en 26 px.
3. La description utilise 16 px. Sur une fiche commerciale, elle contient le nom du client cliquable.
4. Le slot `pageBadges` regroupe les états et la version disponibles.
5. Le slot `pageActions` regroupe les actions, sur une rangée distincte avec retour à la ligne.

Les devis et commandes reviennent à leur affaire. L’affaire revient à la liste Affaires.
La facture revient à sa liste d’origine dans Facturation.
Les retours conservent les critères de navigation autorisés.
Les actions ne contiennent ni retour supplémentaire, ni nom de client isolé.

Les parcours imbriqués utilisent `Breadcrumbs` à la place du retour simple.
Les devis et commandes affichent leur liste et leur affaire parentes.
Les tâches de facturation affichent leur liste d’origine et leur facture parentes.
L’éditeur de conditions affiche Configuration et Conditions.
Chaque lien possède ses propres `queryParams`, fournis par les fonctions de navigation validées.
Le composant ne copie pas les paramètres de l’URL courante.

Une tâche revient à son document parent, lorsqu’il existe.
Ses boutons Annuler et de retour après succès restent dans le formulaire ou le résultat.
Les messages de résultat ne possèdent pas le retour principal de la page.

Les listes gardent leur titre principal et la disposition `inline`.
Les panneaux du compte gardent leur titre `h2`, sous le titre commun du compte.
Les éditeurs en modale gardent leur titre `h2` et leur commande de fermeture, sans retour de page.

Les couleurs complètent les libellés des badges. Elles ne remplacent pas les informations de statut.
Les documents liés forment une section distincte, avec type, référence, état, date et montant lorsque ces données sont disponibles.
Une référence absente reste absente. L’interface n’invente pas de numéro de document.

#### Inventaire des écarts corrigés

Les chemins ci-dessous sont relatifs à `packages/web/src/app/pages/back-office/`.

| Famille                                                           | Écart relevé                                                                              | Règle appliquée                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `affair-detail`, `quote-detail`, `order-detail`, `invoice-detail` | Retours de 14 ou 16 px, navigation mêlée aux actions, client répété.                      | En-tête commun, retour unique, client cliquable dans la description. |
| `affair-detail`                                                   | Trois références isolées, dont une facture brouillon portant la référence de sa commande. | Documents identifiés par type et état. Aucun numéro inventé.         |
| Tâches de facturation                                             | Retour placé après le résumé et les messages dans `TaskFeedback`.                         | Navigation dans l’en-tête. Messages séparés.                         |
| `quote-editor`, `invoice-editor`, `quote-publication`             | En-têtes locaux et parents de retour différents en modification.                          | Retour vers le document modifié et mêmes zones d’en-tête.            |
| `client-detail`, `client-editor`, accès client                    | Marges propres autour de `PageHeader` et retours à la taille du corps.                    | Socle de fiche partagé. Critères des tableaux conservés.             |
| Courriels et banque                                               | Titres et espaces hérités de socles distincts.                                            | Même en-tête, sans modifier les panneaux métier.                     |
| Catalogue, conditions, équipe et jetons API                       | Titres autonomes, retours et commandes Annuler disparates.                                | Même en-tête de page. Modales et étapes de révélation conservées.    |
| Connexions et tests fournisseurs                                  | Retours hors de l’en-tête et styles de titre propres.                                     | Même en-tête. Onglets et protections des demandes conservés.         |
| Configuration                                                     | Retour du conteneur ajouté au retour de la tâche enfant.                                  | Un seul propriétaire du retour : la page affichée.                   |

Le thème, les listes, les panneaux du compte et les mises en page imprimées ne font pas partie de cette harmonisation.

Le composant `Tabs` utilise une surface et une ombre pour l’onglet actif.
Le composant ne définit aucune marge extérieure.
Le conteneur de page gère l’espacement avec `gap`, sans ajouter de marge sur les onglets.

La recherche globale ressemble à un champ de recherche et ouvre une modale au clic.
Son déclencheur conserve la sémantique d’un bouton et affiche le raccourci Ctrl+K ou Cmd+K.
La référence `/design/drawer` présente le tiroir interactif.

### Parcours Clients

La liste `/backoffice/clients` contient les onglets, la recherche et le tableau.
La recherche Fuse couvre le nom, l’adresse e-mail, la ville et le pays.
Les cellules longues reviennent à la ligne sur ordinateur.
Le tableau conserve un défilement horizontal local sur écran étroit.

La création utilise `/backoffice/clients/new`.
La fiche `/backoffice/clients/:clientId/profile` présente les coordonnées sans formulaire.
La modification utilise `/backoffice/clients/:clientId/edit`.
Les onglets Documents et Accès restent associés à la fiche.
Les tableaux Affaires, Documents et Accès utilisent les contrôles de liste partagés.
Chaque tableau conserve sa recherche, ses filtres et son tri dans des paramètres d’URL distincts.
Leurs paramètres ne remplacent pas ceux de la liste Clients.
L’archivage se trouve dans les actions de la fiche et nécessite une confirmation.

Le formulaire sépare l’identité de l’adresse de facturation.
Sa largeur locale maximale est de 44 rem.
Les modifications conservent le contrôle de version et les erreurs détaillées.
Les formulaires protègent les champs modifiés et les requêtes en cours lors d’une sortie de page.
Les documents publiés restent inchangés.

`ListToolbar` regroupe la recherche, les filtres et les actions de liste.
Les compteurs et les limites de chargement apparaissent sous les tableaux dans `.list-summary`.
Les informations d’export apparaissent dans l’infobulle du bouton d’export, sans séparer les contrôles.
`EntityIcon` place une icône décorative devant la référence ou le titre de chaque entité.
Les fonctions typées des pages associent les statuts aux couleurs. Les libellés de statut restent visibles.
`EmptyState` sépare le titre, l’explication et l’action de création.
Il conserve 16 px entre ces zones. Les boutons et liens-boutons directs rejoignent automatiquement la zone d’actions.
Le slot `emptyActions` permet de projeter un groupe d’actions explicite.

`Hint` prend la largeur de son bouton. L’ancrage se trouve sur le déclencheur, pas sur la cellule de grille.
`FilterMenu` aligne son bord de début sur celui du bouton, à gauche en français et en anglais.
Il change de position uniquement si l’espace disponible ne suffit pas.
`DataTable` propose le mode `fluid` pour répartir les colonnes et autoriser le retour à la ligne.
Ce mode ne fixe pas de largeur minimale au-delà du conteneur.
Le mode `scroll` conserve le texte sur une ligne et défile uniquement lorsque le contenu dépasse le conteneur.
Sur les tableaux métier à nombreuses colonnes, la classe `.wide-table` conserve une largeur minimale de 40 rem.
Cette contrainte explicite évite de réduire leurs colonnes à quelques caractères sur mobile.
La composition `/design/workflows` présente une recherche interactive.
La référence `/design/data-table` présente le tableau fluide.
La référence `/design/empty-state` présente l’état vide.

### Parcours Catalogue

Le catalogue utilise `/backoffice/catalog`, hors de Configuration.
Les vues Actives, Archivées et Toutes présentent uniquement la recherche et le tableau.
Le tri porte sur la description ou le prix unitaire hors taxes.
La recherche et le tri restent dans l’URL lors des changements de vue et des retours depuis l’éditeur.
Un changement de paramètres de recherche ne déplace pas le focus vers `main`.

La création utilise `/backoffice/catalog/new`.
La modification utilise `/backoffice/catalog/:itemId/edit`.
Le formulaire regroupe la description, les valeurs par défaut et la disponibilité.
Une modification de disponibilité exige une confirmation.
Les requêtes conservent la version chargée et les montants entiers du contrat métier.
Un conflit conserve les champs saisis.
Les documents existants restent inchangés.

Le formulaire de devis ouvre aussi les éditeurs Catalogue et Conditions dans des modales.
La création conserve la saisie du devis et utilise les mêmes API que les pages dédiées.
L’article enregistré est ajouté au devis. Le remplacement de conditions existantes demande une confirmation.
Une requête en cours bloque la fermeture. Une création incertaine interdit une nouvelle soumission dans l’éditeur ouvert.

`TableSort` nomme la colonne et le prochain sens de tri.
La cellule d’en-tête expose le sens actuel avec `aria-sort`.
Les clics suivent le cycle croissant, décroissant, puis ordre initial.
La réinitialisation retire le paramètre de tri de l’URL sans effacer la recherche ni les filtres.
L’ordre initial reste celui du module, même lorsque sa colonne ne porte aucune flèche de tri actif.
`FilterChip` montre un filtre actif et son action de retrait.
La composition `/design/workflows` présente les deux contrôles dans son tableau interactif.

### Parcours Facturation

Les liens entre listes, fiches et tâches transportent uniquement le contexte de navigation autorisé.
Le retour restaure la liste d’origine, ses critères et l’onglet de la fiche.
Les URL de retour libres et les paramètres inconnus ne font pas partie de ce contexte.

Une tâche affiche une seule alerte principale pour un conflit ou un résultat incertain.
Les erreurs de validation restent associées à leurs champs.
Les actions de rechargement nomment la ressource concernée ou utilisent le libellé partagé « Recharger ».

### Formulaires administratifs

Un refus définitif d’invitation conserve la saisie et rend les champs modifiables.
Un résultat incertain conserve la demande et son identifiant pour éviter une nouvelle opération involontaire.
Les composants de liste et d’éditeur n’héritent pas les uns des autres.
Les services locaux partagent seulement les données et les opérations nécessaires aux écrans concernés.

Les pages Stripe et Resend utilisent les onglets partagés pour la configuration et les tests.
Les autres connexions ne présentent pas d’onglet de test sans écran correspondant.

La page Configuration ne contient pas de lien vers elle-même.
Ses sous-pages présentent un lien « Retour à la configuration ».

Le menu du compte affiche la déconnexion avec la couleur de danger.

### Parcours Courriels

Les vues Messages, Brouillons, Relances et Modèles séparent les listes des tâches.
Le [guide Courriels](email-workspace.md) décrit les routes, les contrôles de version et la reprise des demandes incertaines.
Le sélecteur `ObjectPicker` apparaît dans les tâches et dans la référence `/design/object-picker`.

Le scénario navigateur du Catalogue vérifie le zoom Chromium à 200 % dans un profil de test isolé.
Il utilise le réglage du navigateur, sans zoom CSS ni changement du facteur de pincement.
Il contrôle la liste, les erreurs de formulaire et les confirmations au-dessus du tiroir de navigation.

Les actions rapides du tableau de bord se trouvent dans son en-tête.
Les indicateurs utilisent deux colonnes sur mobile.
Le menu du compte affiche l’adresse complète sans imposer sa largeur à l’en-tête.
Les champs du devis public restent contenus dans le panneau de signature.
Les formulaires de connexion ont une largeur limitée sur grand écran.
La référence `/design/field-group` présente la grille de champs partagée.

## Vérification

```sh
nix develop --command pnpm lint
nix develop --command pnpm --filter @froment/web build
nix develop --command pnpm --filter @froment/web test
```

Les scénarios navigateur existants restent disponibles pour une inspection locale ponctuelle :

```sh
nix develop --command pnpm test:interface
```

Cette commande est facultative. Elle ne fait partie ni des checks Nix, ni de la CI, ni des critères de livraison.
Les scénarios utilisent des données fictives et des réponses HTTP simulées. Certaines assertions ne suivent plus l’interface actuelle.
N’ajoutez pas de scénarios ou d’assertions exhaustives pour figer une interface qui change régulièrement.
Préférez une inspection visuelle ciblée au besoin. Ne modifiez pas le produit pour satisfaire un scénario fragile.

Le shell de développement fournit Chromium pour ces inspections locales.
L’image de production conserve le contrôle qui interdit Chromium et Playwright dans sa closure.
