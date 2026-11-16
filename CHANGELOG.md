# Changelog

Les changements visibles de froment.software. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/).

Les changements pas encore publiés sont dans [`changelog.d/`](changelog.d/), pas dans une section « Unreleased ». Ainsi, deux branches ne modifient jamais les mêmes lignes de ce fichier.

## [0.20.0] - 2026-11-16

### Added

- **Page des versions** : le pied de page mène à l’historique de toutes les versions du site, avec un filtre, un flux Atom et un lien vers chaque version sur GitHub.

### Changed

- **Nouveau slogan** : la page d’accueil affiche « Making computers compute. », en anglais dans les deux langues du site.

## [0.19.0] - 2026-11-16

### Added

- **Nouveaux logiciels dans les projets** : la liste des projets publics présente papier, inspecteur, classeur, cliche, modus, atelier et shojiwm-desktop.

### Changed

- **Modèle de licence** : l’accueil et ses métadonnées présentent Froment Software comme un éditeur qui vend des licences de ses logiciels et des logiciels créés ou rénovés pour ses clients.
- **Deux prestations** : les prestations de conseil laissent la place à deux pages, création de logiciels et rénovation de logiciels métier.
- **Note de lancement réécrite** : la note « Froment Software arrive sur le marché » présente le modèle de licence.

### Removed

- **Pages Clients et À propos** : ces deux pages et leurs liens quittent le site.

## [0.18.0] - 2026-11-06

### Added

- **Wren dans les projets** : le navigateur Wren apparaît en tête des projets publics.
- **opencode native dans les projets** : le client de bureau opencode native apparaît après Wren.
- **Lien vers how.froment.software** : l’accueil renvoie vers how.froment.software, dans la langue du visiteur. Une note présente cette position sur la façon de faire du logiciel.

## [0.17.0] - 2026-10-24

### Added

- **PetitPécule dans les projets** : PetitPécule apparaît en tête des projets publics, avec sa nouvelle icône et sa propre accroche.

### Changed

- **Logo vectoriel** : le logo de Froment Software existe en SVG et reste net à toutes les tailles.
- **Identité de l’éditeur** : les mentions légales et la politique de confidentialité donnent l’identité complète de l’éditeur.

### Fixed

- **Séparateurs du pied de page** : les séparateurs ne font plus partie des liens.

## [0.16.0] - 2026-09-26

### Added

- **Langue dans l’URL** : chaque page publique a une adresse en `/fr/` et en `/en/`. Le changement de langue conserve la position de défilement.
- **Ancres des notes** : chaque titre d’une note a un lien direct. La navigation et les métadonnées des notes existent dans les deux langues.

### Changed

- **Nouvel accueil** : la page d’accueil est refondue, et les pages de prestations suivent la même composition.
- **Logo et favicon** : l’en-tête affiche un logo carré, et l’onglet du navigateur affiche le logo de l’entreprise.
- **Pied de page simplifié** : le pied de page contient moins d’éléments et se range en grille sur mobile.

### Fixed

- **Actions mobiles de l’accueil** : les boutons de l’accueil s’affichent correctement sur petit écran.

## [0.15.0] - 2026-09-23

### Added

- **Projets sur l’accueil** : l’accueil présente les projets publics en liste, dans un ordre fixe.
- **Schémas Mermaid dans les notes** : le lecteur peut zoomer, dézoomer et afficher un schéma en plein écran.
- **Langue et thème dans le pied de page** : les pages publiques proposent ces deux réglages en bas de page.

### Changed

- **Vitrine recentrée** : le site public met en avant le contact et les projets. Les boutons de contact sont plus grands, et les pages publiques partagent les mêmes boutons et thèmes.
- **Blog renommé en Notes** : les articles s’appellent désormais des notes. Les politiques du site sont alignées sur ce changement.
- **Logo dans l’en-tête** : toutes les pages publiques affichent le logo en haut.
- **Racine du site** : l’adresse racine ouvre directement la vitrine, sans page intermédiaire.

### Removed

- **Back-office séparé du site** : le back-office, le portail client et la gestion des devis et des factures quittent ce site. Ils vivent désormais sur backoffice.froment.software.

## [0.14.0] - 2026-09-17

### Added

- **Suite comptable** : le back-office gère les fournisseurs, leurs factures et leurs lots de paiement. Il gère aussi les réglages comptables de l’entreprise, les taux de change et les rôles personnalisés.
- **Édition en place** : l’administrateur modifie les fiches des clients et des affaires sans quitter la page. La fiche client liste ses affaires.
- **Préférences de notification** : chaque compte choisit l’affichage des messages de confirmation, et ce choix est conservé.
- **Barre de chargement** : une barre bleue pulsée signale une navigation lente.

### Changed

- **Interface unifiée** : les listes, les formulaires, les actions de création et les courriels du back-office suivent les mêmes modèles.
- **Badge d’environnement** : le badge est compact, se trouve dans la barre latérale et renvoie au commit sur GitHub dans un nouvel onglet.
- **Pages sans rechargement manuel** : les pages du back-office ne proposent plus de bouton de rechargement.

### Fixed

- **Aperçus des documents** : les aperçus PDF s’affichent de nouveau dans le lecteur du navigateur et ne relancent plus la session en boucle.
- **Révision de devis** : le sélecteur garde la révision choisie.

## [0.13.0] - 2026-09-11

### Added

- **Mise en forme des conditions commerciales** : l’administrateur met en forme les conditions et les répartit sur plusieurs pages.
- **Remplacement d’un lien de signature** : l’administrateur peut remplacer le lien de signature d’un devis si le client l’a perdu.
- **Ruban d’environnement** : les environnements autres que la production affichent un ruban qui les identifie.
- **Note « Du commit à Nomad »** : une note décrit le déploiement du site.

### Changed

- **Permissions effectives** : le back-office n’affiche que les pages et les actions permises au compte. Un compte limité au téléchargement voit les PDF de ses devis et commandes.
- **Chargement initial** : le site affiche la bonne structure de page pendant le chargement, avec un indicateur centré et plus grand.
- **Messages d’erreur** : les messages tiennent compte du contexte de la demande.

### Fixed

- **PDF** : les documents conservent leurs textes et leurs quantités.
- **Données financières** : les encaissements, les avoirs, les relances et les rapprochements bancaires gardent un état correct après un refus, une reprise ou une annulation.
- **Liens des notes** : les liens, les titres, les schémas et les métadonnées suivent la note affichée. La copie d’une ancre ne déclenche plus de navigation.

### Security

- **Connexion et requêtes** : le serveur réserve les tentatives de connexion, protège les quotas actifs et vérifie l’origine de chaque modification authentifiée par cookie.

## [0.12.0] - 2026-09-10

### Added

- **Connexions Resend et Stripe** : le back-office connecte un compte d’envoi de courriels Resend et propose un paiement Stripe Checkout lié à une facture, en mode test.
- **Flux Atom du blog** : le blog publie un flux Atom, annoncé dans chaque page.
- **Fichiers de découverte** : le site publie `llms.txt`, `security.txt` et un plan de site complet pour les robots et les assistants.
- **Filtres de liste** : les listes du back-office ont des filtres compacts avec recherche, et un tri commun.

### Changed

- **Barre latérale** : le back-office occupe toute la largeur et se navigue depuis une barre latérale. Le menu du compte est en haut, les préférences en bas.
- **Fiches et formulaires séparés** : les clients, le catalogue et les courriels ont chacun une liste, une fiche et un formulaire dédié. Un formulaire modifié demande confirmation avant de le quitter.
- **Page Version** : la page Version devient une page technique autonome et plus simple.

### Fixed

- **Mobile** : la page Version et la recherche globale ne débordent plus sur petit écran.
- **Thème sombre** : les boutons par défaut prennent les couleurs du thème sombre.
- **Saisie conservée** : la recherche globale garde le focus, et le changement d’allocation bancaire conserve la saisie en cours.

## [0.11.0] - 2026-09-07

### Added

- **Passkeys** : chaque compte peut enregistrer une passkey, se connecter avec elle et la révoquer.
- **Invitations d’équipe** : l’administrateur invite des membres par un lien à usage unique et leur donne un profil restreint.
- **Avoirs et remboursements** : l’administrateur émet un avoir total et enregistre un remboursement.
- **Rapprochement bancaire complet** : un virement peut couvrir plusieurs factures ou une partie d’une facture, frais bancaires déduits. L’historique garde chaque correction.
- **Relances programmées et modèles de courriel** : les relances de facture partent à date fixe si un solde reste dû. Les courriels partagent des modèles.
- **Sauvegardes** : l’administrateur crée des sauvegardes vérifiées de la base et les restaure sans écraser les données.

### Changed

- **Catalogue** : le catalogue utilise des tableaux compacts avec recherche approximative.
- **Sélecteur de langue** : le sélecteur n’affiche plus de texte visible, mais garde un libellé accessible.

### Fixed

- **Relances après avoir** : une facture couverte par un avoir total ne propose plus de relance.
- **Invitations** : les invitations actives apparaissent avant l’historique, et un conflit d’invitation donne sa raison exacte.

## [0.10.0] - 2026-09-06

### Added

- **Catalogue de prestations** : l’administrateur gère un catalogue et insère ses prestations dans les lignes d’un devis.
- **Paiements** : l’administrateur enregistre des paiements partiels, les annule sans perdre l’historique et les exporte en CSV comptable. Le portail client affiche les paiements et le solde restant.
- **Import des relevés bancaires** : l’administrateur importe un relevé et le rapproche des paiements de factures.
- **Sécurité du compte** : chaque compte change son mot de passe, voit ses sessions actives et révoque une connexion à distance.
- **Courriels** : l’administrateur rédige des courriels et des relances de paiement, et consulte l’historique des envois.
- **Documentation API** : la documentation de l’API s’affiche en français ou en anglais selon le navigateur, avec les permissions requises et des exemples.

### Changed

- **Interface du back-office** : les pages ont des surfaces distinctes, des panneaux plats et un meilleur contraste.
- **Dialogues de confirmation** : des dialogues accessibles remplacent les confirmations natives du navigateur.
- **Montants et aperçus** : les montants s’affichent avec leurs décimales exactes. Les aperçus PDF ont un titre et un filigrane sur chaque page.

### Fixed

- **Dates** : les dates restent les mêmes quel que soit le fuseau horaire du navigateur.
- **Coordonnées des documents** : le back-office vérifie les coordonnées avant la publication d’un devis ou l’émission d’une facture.

## [0.9.0] - 2026-08-24

### Added

- **Jetons d’API** : l’administrateur crée des jetons d’API avec des permissions précises et consulte leur journal d’usage.
- **Tableau de bord** : le tableau de bord propose des actions rapides et signale les factures proches de leur échéance.
- **Plusieurs accès par client** : un client peut avoir plusieurs comptes de portail, listés sur l’onglet Accès et révocables un par un.
- **Série sur l’architecture** : le blog affiche des schémas Mermaid et publie trois articles bilingues sur l’architecture, la sécurité et l’exploitation du site.

### Changed

- **Connexion unique** : un seul formulaire de connexion par courriel et mot de passe sert à tous les comptes.
- **Documents PDF** : les devis, commandes et factures ont une nouvelle mise en page, et leurs aperçus sont de vrais PDF.
- **Recherche globale** : la recherche tolère les fautes de frappe, surligne les correspondances et affiche de longues listes sans ralentir.
- **En-tête du back-office** : le back-office a son propre en-tête. Sur mobile, il tient sur une ligne avec un bouton de déconnexion compact.

### Fixed

- **Permaliens de devis** : un devis accepté reste consultable par son lien, même après rechargement de la page.
- **Après un déploiement** : le site se recharge correctement après une nouvelle mise en ligne.
- **Mise en page** : les longues références du blog passent à la ligne sur petit écran, et les titres placés en haut d’une page n’ont plus de marge en trop.

## [0.8.0] - 2026-08-21

### Added

- **Affaires** : chaque affaire regroupe ses devis, commandes et factures, avec un journal des événements et les actions suivantes proposées.
- **Relances et échéances** : l’administrateur relance un devis ou une facture en retard. Les factures affichent leur échéance et leur retard.
- **Recherche globale** : une recherche couvre les clients et les documents.
- **Actions groupées** : l’administrateur relance ou télécharge plusieurs factures à la fois.
- **Annulation et réactivation** : l’administrateur annule un devis avec un motif et réactive un client archivé.
- **Permaliens du portail** : chaque document du portail client a une adresse stable.

### Changed

- **Back-office organisé par tâche** : le back-office s’organise autour des flux de travail, avec un tableau de bord des priorités et des onglets qui gardent leur sélection dans l’URL.
- **Documents unifiés** : les commandes ont leur PDF, et les devis, commandes et factures partagent un même modèle sur fond blanc.

## [0.7.0] - 2026-08-20

### Added

- **Back-office** : l’administrateur se connecte et gère les clients, avec fiche détaillée et édition.
- **Devis** : l’administrateur crée des devis révisables avec des conditions réutilisables, les prévisualise et les envoie au client par un lien sécurisé.
- **Signature en ligne** : le client consulte et signe son devis en ligne. La signature crée la commande.
- **Factures** : l’administrateur crée, numérote et émet les factures, avec leur PDF, puis les marque payées ou annulées.
- **Portail client** : le client se connecte et télécharge ses devis, commandes et factures.
- **Page Version** : une page affiche la version déployée du site.

### Security

- **Accès** : les devis expirent, et l’archivage d’un client révoque ses accès et ses liens publics.

## [0.6.0] - 2026-08-19

### Added

- **Mode sombre** : le visiteur choisit un thème sombre, et ce choix est conservé.
- **Pages de prestation** : chaque prestation a sa page détaillée. L’audit et la rénovation de logiciels passent en premier.

### Changed

- **Carte de partage** : l’image des réseaux sociaux reprend le design du site et le logo officiel. Le titre de l’accueil est plus court.
- **Boutons** : les boutons adoptent un style inspiré de Bootstrap 2, avec des variantes à icône.
- **Parcours et expertise** : la chronologie est plus simple, et l’expertise technique est plus claire.

### Fixed

- **Menu mobile** : le menu défile verticalement, ses éléments ne rétrécissent plus, il s’ouvre avec une animation et se pilote au clavier.

## [0.5.0] - 2026-08-13

### Added

- **Menu mobile** : un tiroir de navigation remplace le menu sur petit écran.
- **Carte de visite** : une page protégée affiche la carte de visite de Froment Software, en plusieurs versions personnalisables.

### Fixed

- **Manifeste web** : le site sert son manifeste avec le bon type, et l’installation sur mobile fonctionne.

## [0.4.0] - 2026-08-12

### Added

- **Blog** : le site publie des articles.

### Changed

- **Refonte du contenu** : le site présente le développement et la rénovation de logiciels métier, avec une photo et une navigation plus claire. Les prestations sont détaillées, dont le développement multiplateforme.

### Fixed

- **Fichiers statiques** : les images et les fichiers du site s’affichent de nouveau.

## [0.3.0] - 2026-07-13

### Changed

- **Nouveau design** : le site change d’apparence et garde une identité orientée développeur.
- **Pages prérendues** : les pages arrivent déjà construites, et l’affichage initial est plus rapide.
- **Navigation** : le lien de la page courante est plus visible.

### Removed

- **Vitrine de démonstration** : la page de démonstration et les faux libellés de terminal disparaissent.

### Fixed

- **Favicon et espacements** : le favicon s’affiche correctement, et les panneaux ont un espacement régulier.

## [0.2.1] - 2026-06-18

### Fixed

- **Année du pied de page** : le pied de page affiche l’année en cours.

## [0.2.0] - 2026-05-30

### Added

- **Page À propos** : une page présente Froment Software.
- **Pages légales** : le site publie ses mentions légales, sa politique de confidentialité et sa politique de cookies.
- **FAQ** : la FAQ répond sur la technique, la méthode, le travail à distance, la confidentialité, les délais, la maintenance, le prix au forfait et la disponibilité.
- **Page 404** : une page dédiée s’affiche pour une adresse inconnue.

### Changed

- **Accroche** : l’accroche présente un profil polyvalent, « Du web au bare metal. ».
- **Pied de page** : le pied de page est réorganisé.

### Fixed

- **Groupes de boutons** : les boutons et les badges gardent un espacement régulier quand ils passent à la ligne.
- **Liens directs** : une page ouverte par son adresse directe s’affiche au lieu d’une erreur.

## [0.1.0] - 2026-05-28

### Added

- **Premier site** : froment.software présente Froment Software en français et en anglais, avec un accueil, les prestations, les clients, les outils et une vitrine de démonstration.

[0.20.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.20.0
[0.19.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.19.0
[0.18.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.18.0
[0.17.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.17.0
[0.16.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.16.0
[0.15.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.15.0
[0.14.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.14.0
[0.13.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.13.0
[0.12.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.12.0
[0.11.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.11.0
[0.10.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.10.0
[0.9.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.9.0
[0.8.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.8.0
[0.7.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.7.0
[0.6.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.6.0
[0.5.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.5.0
[0.4.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.4.0
[0.3.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.3.0
[0.2.1]: https://github.com/sachahjkl/froment.software/releases/tag/v0.2.1
[0.2.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.2.0
[0.1.0]: https://github.com/sachahjkl/froment.software/releases/tag/v0.1.0
