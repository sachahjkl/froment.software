# Espace Courriels

L’espace Courriels sépare les listes et les tâches.

- Messages affiche les 100 derniers messages accessibles, sans texte complet dans les lignes.
- Brouillons affiche les brouillons actifs du compte. Un brouillon peut rester incomplet.
- Relances affiche au maximum 100 relances. L’API charge les relances programmées en priorité.
- Modèles affiche les modèles actifs partagés. Un modèle contient un objet et un texte.

Les listes proposent une recherche, un compteur et des contrôles de tri sur les colonnes disponibles.
Le tri couvre l’objet, la date, le destinataire et l’état selon la vue.
Les messages, brouillons et relances proposent aussi un filtre d’état.
Toutes les vues proposent une période, selon la date affichée et le fuseau horaire du navigateur.
Les paramètres `q`, `state`, `from`, `to` et `sort` conservent le contexte lors du retour depuis une tâche.

L’export CSV contient uniquement les métadonnées des résultats filtrés et chargés, dans l’ordre affiché.
Il ne contient aucun corps de message ni texte de modèle.
Les limites de 100 résultats restent applicables aux exports des messages et des relances.

## Pages dédiées

- `/backoffice/courriels/new` prépare un message.
- `/backoffice/courriels/drafts/:draftId/edit` modifie un brouillon.
- `/backoffice/courriels/messages/:operationId` affiche un message enregistré.
- `/backoffice/courriels/templates/new` crée un modèle.
- `/backoffice/courriels/templates/:templateId/edit` modifie un modèle.
- `/backoffice/courriels/reminders/new` programme une relance.

Le paramètre `invoice` prépare un rappel ou sélectionne une facture pour une relance.
La sélection d’un modèle change uniquement l’objet et le texte du message.
La modification d’un modèle ne change pas les brouillons et messages existants.

## Protection des demandes

Les courriels clients et les relances restent simulés. Ces pages n’autorisent aucun envoi réel.
La simulation d’un message conserve l’identifiant de son brouillon.
Les erreurs de version conservent les champs saisis.

Avant une soumission, le navigateur conserve la demande exacte dans `sessionStorage`.
Le compte et le type de demande déterminent la clé de stockage.
Une relance conserve aussi la version de facture présentée avant confirmation.
Une nouvelle tentative ne recharge pas cette version.

Après un rechargement, la page recherche une confirmation dans la liste accessible.
Sans confirmation, elle conserve la demande et attend une action explicite.
Elle ne crée pas automatiquement une autre demande.
Si le stockage est indisponible ou invalide, la page bloque la soumission.

Les gardes de sortie demandent confirmation pour les modifications non enregistrées.
Les opérations en cours bloquent la navigation et déclenchent la protection native de fermeture.

## Limites des API

Les API existantes ne proposent pas de lecture individuelle des messages, brouillons ou modèles.
Le détail recherche donc l’identifiant dans la liste protégée existante.
Un message absent des 100 résultats n’est pas présenté comme supprimé.

La référence d’un message reste un texte. Elle ne prouve pas un lien durable avec un document.
La réception d’une demande par un prestataire ne prouve ni sa livraison ni sa lecture.

## Contrôles

Le sélecteur partagé `ObjectPicker` utilise une fenêtre CDK et une recherche Fuse.
Le clavier permet de choisir un résultat ou de fermer la fenêtre avec Échap.
La fenêtre restaure le focus sur son bouton.
La page `/design/object-picker` contient une démonstration interactive de ce sélecteur.

Les scénarios navigateur couvrent les listes, formulaires, conflits, confirmations et reprises sans doublon.
Le scénario existant de zoom Chromium vérifie aussi Courriels avec un zoom navigateur réel de 200 %.
