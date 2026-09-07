# Accès d’équipe

La page **Configuration → Équipe** crée des invitations pour des collaborateurs et des comptables.
Elle ne modifie pas les comptes administrateurs existants.

## Profils

- Le comptable consulte les clients, devis, commandes, factures, règlements, relevés et informations de l’émetteur.
- Le comptable télécharge les documents et exporte les règlements.
- Le comptable consulte et exporte le journal des débits et commissions, sans créer ni contrepasser d’écriture.
- Le comptable consulte le catalogue et les conditions nécessaires à l’affichage des devis.
- Le collaborateur crée et modifie les clients, devis et factures.
- Le collaborateur publie les documents, enregistre les règlements et gère les rapprochements bancaires.
- Le collaborateur utilise les brouillons de courriels et les services externes simulés.
- Aucun de ces profils ne gère les comptes, les accès clients, les jetons API ou les paramètres de l’émetteur.

La liste exacte des permissions figure dans `packages/contracts/src/team/contracts.ts`.
Le serveur contrôle les permissions à chaque demande.
Le mode de session technique reste `administrator` pour accéder au backoffice.
Ce mode ne donne pas le rôle administrateur ni ses permissions.
Les profils couvrent toutes les données commerciales de l’installation, sans restriction par client.

## Invitation

1. Saisissez le nom et l’adresse de connexion du destinataire.
2. Choisissez son profil.
3. Créez l’invitation.
4. Transmettez le lien par un canal sûr.

Aucun courriel n’est envoyé et aucun fournisseur n’est appelé.
Le lien permet de créer le compte sans autre preuve de possession de la boîte de réception.
Conservez donc ce lien comme un secret.
Il expire après sept jours et ne fonctionne qu’une fois.
L’invité choisit son mot de passe, puis utilise la page de connexion habituelle.
Il peut ensuite ajouter ses propres passkeys.

L’acceptation crée le compte, attribue son profil et consomme l’invitation dans une transaction.
Une invitation annulée, expirée ou créée par un compte sans autorisation ne crée aucun compte.
Deux acceptations concurrentes ne créent pas deux comptes.
Une adresse déjà utilisée par un compte ne reçoit pas de nouveau compte.
Une invitation ne change jamais le mot de passe d’un compte existant.

La base conserve seulement l’empreinte du jeton.
Le jeton utilise un HMAC avec un domaine distinct des liens de devis.
Une nouvelle tentative identique de création retrouve le même lien, sans prolonger son expiration.
Une rotation de la clé des liens invalide cette possibilité de récupération du lien.
Le jeton reste dans le fragment de l’URL, puis la page retire ce fragment de l’historique courant.
La liste des invitations ne retourne aucun jeton.

## Modification et révocation

Le changement de profil et la désactivation exigent une confirmation.
Chaque modification utilise la version attendue du compte.
Une version périmée avec des valeurs différentes produit un conflit.

La modification révoque toutes les sessions et tous les jetons API du compte dans la même transaction.
Les contrôles suivants refusent aussi les anciens jetons d’accès de session.
La réactivation exige une nouvelle connexion ; elle ne réactive aucun ancien jeton.
La désactivation conserve les documents, les règlements, les passkeys et l’historique.
Elle ne supprime aucune clé privée du dispositif de l’utilisateur.

Les invitations, acceptations, annulations et modifications sont auditées sans jeton ni mot de passe.

## Limites et permissions

- `user.read` permet de lister les comptes d’équipe et les invitations.
- `user.create` permet de créer et d’annuler les invitations.
- `user.update` permet de changer un profil, désactiver un compte ou le réactiver.
- Ces permissions ne sont pas accessibles aux jetons API.
- L’acceptation exige une origine autorisée et limite les demandes à dix par minute et adresse cliente.
- L’installation accepte au plus 100 comptes d’équipe, comptes désactivés compris.
- Elle accepte au plus 100 invitations actives simultanément.
- La page affiche au plus 100 invitations, avec priorité aux invitations actives, puis aux plus récentes.

Ce module ne crée pas d’administrateur supplémentaire et ne permet pas de modifier le dernier administrateur.
