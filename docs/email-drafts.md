# Brouillons de courriels

## Utilisation

La page Courriels permet d’enregistrer un brouillon incomplet sur le serveur.
L’enregistrement ne contacte aucun fournisseur et ne crée aucune opération d’envoi.
Le brouillon conserve le destinataire, la référence, l’objet, le texte et l’indication de relance préparée.

Sélectionnez « Enregistrer le brouillon » pour conserver le formulaire.
Après rechargement, sélectionnez « Ouvrir » dans la liste des brouillons.
Sélectionnez « Nouveau courriel » pour commencer un autre message.
Si le formulaire contient des modifications non enregistrées, confirmez leur abandon avant de changer de brouillon.

Un brouillon enregistré et inchangé ne bloque plus la navigation.
Une modification ultérieure réactive la confirmation de sortie.
Un brouillon de relance conserve l’avertissement de vérification du destinataire et du solde.

## Propriété et versions

La permission `email.draft.manage` autorise la gestion des brouillons.
Elle reste réservée aux sessions administrateur.
Chaque compte voit et modifie uniquement ses propres brouillons.
La limite est de 100 brouillons actifs par compte.

Le client crée un UUID v4 stable pour chaque brouillon.
La création utilise la version attendue zéro.
Chaque modification vérifie la version et produit un événement d’audit.
Une répétition identique de la dernière sauvegarde retourne la même version.
Une version périmée avec un contenu différent provoque un conflit.
Le formulaire conserve alors le texte local ; aucun écrasement automatique n’a lieu.

## Soumission et reprises

La soumission exige toujours un courriel complet et valide.
Le formulaire enregistre les modifications du brouillon avant de préparer sa soumission.
L’identifiant du brouillon devient la clé d’idempotence de la demande.

Dans une même transaction, le serveur :

- vérifie le propriétaire et le contenu courant du brouillon ;
- crée l’opération durable ;
- archive le brouillon pour empêcher toute modification ultérieure.

Le serveur appelle ensuite le fournisseur hors de cette transaction.
Les nouvelles tentatives utilisent la même clé et le même contenu.
Un ancien formulaire ne peut pas soumettre silencieusement un texte différent du brouillon enregistré.

Si la réponse reste incertaine, le formulaire conserve la demande et bloque sa modification.
Après rechargement, l’historique des opérations permet de reprendre une demande en attente.
La liste des brouillons ne présente plus une demande commencée comme un message encore modifiable.

Les opérations soumises suivent les permissions de l’historique des intégrations.
Elles ne restent donc pas privées comme les brouillons non soumis.

## Archivage

L’archivage vérifie le propriétaire et la version.
Il conserve le dernier texte enregistré et l’historique d’audit.
Il ne soumet aucun courriel et n’annule aucune opération déjà commencée.

## Vérification et limites

Les tests HTTP couvrent la propriété, les versions, les répétitions, l’archivage et la soumission idempotente.
Les tests Angular couvrent l’enregistrement incomplet, la reprise et la clé utilisée lors de la soumission.
Les huit contrôles navigateur incluent désormais l’enregistrement et la reprise après rechargement.

Les courriels utilisent toujours le fournisseur simulé actuellement configuré.
Une opération simulée ne signifie pas qu’un courriel a été envoyé.
Les modèles de courriels sont décrits dans `docs/email-templates.md`.
Les reprises automatiques des soumissions sont décrites dans `docs/integration-retries.md`.
