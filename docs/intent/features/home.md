# Accueil

L’accueil parle la même langue que les sites des logiciels (atelier, papier) : un hero centré, un titre en monospace, de gros boutons, une grande capture, puis des grilles de cartes. Une personne qui passe d’un site à l’autre reconnaît la même maison.

## Structure

1. **Hero** : logo, « Froment Software », le slogan, une phrase qui dit le métier, puis deux boutons de même forme (icône, libellé, détail) : écrire et prendre rendez-vous. Seule la couleur les distingue.
2. **Capture d’atelier** : la suite entière en une image.
3. **Suite de bureau** : ce qu’atelier installe. Le classement est un fait, pas un jugement.
4. **Sur commande** : les deux offres et la méthode `how.`.
5. **Quoi de neuf** : les trois dernières versions, lues dans `CHANGELOG.md` (`app/releases.ts`, partagé avec la page des versions).
6. **Autres projets** : une liste dense sur deux colonnes, plus légère que les offres.

## Décisions

- **Le métier sous le slogan.** Le slogan seul ne dit pas ce que l’entreprise vend. La phrase « Logiciels de bureau natifs, et logiciels métier écrits ou rénovés sur commande » le dit, et aucune autre ligne du haut de page ne le répète.
- **Une seule police, celle du site.** L’accueil reprend la mise en page des sites des logiciels, pas leurs polices. Le mélange d’une police système pour le texte et d’une monospace pour les titres a été essayé puis refusé : deux polices sur une page, c’était une de trop.
- **Fira Sans, servie par le site.** Le site déclarait Trebuchet MS, absente de Linux et non servable sans licence : chaque système la remplaçait par autre chose (Liberation Sans, un clone d’Arial, sous Linux). Fira Sans est la police libre la plus proche de Trebuchet. Chaque graisse CSS prend la coupe Fira un cran plus légère (400 Book, 600 Medium, 700 SemiBold), et le titre de l’accueil est en Medium : les coupes normales étaient trop grasses. Les schémas Mermaid et l’image de partage utilisent la même police.
- **Le vert de la marque, texte blanc.** Le bouton principal est un dégradé vert profond avec un texte blanc : le texte sombre sur le vert vif était trop peu lisible.
- **Une colonne de 60rem.** Les cartes et la capture demandent plus de place que les 48rem des autres pages. Le pied de page lit la même largeur par `--page-column`.

## Refusé

- **Une preuve chiffrée par la barre d’état de Wren.** La capture de Wren était obsolète, donc ses mesures aussi. Aucun chiffre n’apparaît tant qu’il n’existe pas de mesure à jour.
- **Une page épurée en liste.** Jugée trop nue : l’adresse seule à droite du nom ne faisait pas un appel à l’action.
- **Un classement « Logiciels / Outils / Expériences ».** « Expériences » était un jugement creux. La suite de bureau est définie par ce qu’atelier installe.
- **L’étiquette « Now live ».** Le site est en ligne depuis mai : elle ne disait plus rien et compliquait chaque mise en page.

## Points ouverts

- La capture d’atelier montre la version 0.5.1. Il faudra la remplacer par une capture à jour.
- Wren est vendu sous licence mais n’a qu’une ligne dans « Autres projets ». Une capture récente lui rendrait une place à part.
