# Connexion Resend

Le parcours se trouve dans **Configuration → Services externes → Vérifier Resend**.
Il envoie un vrai courriel de test. Les courriels clients et les relances restent simulés.

## Adresses autorisées

Le serveur impose les adresses suivantes :

- Expéditeur : `Sacha — froment.software <sacha@mail.froment.software>`.
- Réponses : `sacha@froment.software`.
- Destinataire : `sacha@sacha.house`.

Le formulaire contient seulement l’objet et le message en texte brut.
Le serveur ajoute `[Test]` à l’objet. Il n’ajoute aucune copie ni pièce jointe.

## Accès

La clé `RESEND_API_KEY` provient du profil SecretSpec actif.
L’écran affiche sa présence, jamais sa valeur.
Une clé présente ne prouve pas sa validité ni la validation du domaine.

La permission `integration.configure` contrôle le parcours et ses API.
Seuls les administrateurs reçoivent cette permission.
Les collaborateurs, les comptables et les jetons API ne la reçoivent pas.

## Exécution durable

Le service `EmailTests` enregistre la demande dans SQLite avant tout appel externe.
Son implémentation se trouve dans `email-test-service.ts`. Ses tests automatisés utilisent le suffixe `.spec.ts`.

Le worker Effect examine les demandes toutes les trois secondes.
Chaque demande conserve son auteur, son contenu, ses dates, ses tentatives et son identifiant Resend.
La base interdit la modification du contenu et la suppression de l’historique.

Le worker acquiert un verrou de traitement de deux minutes.
Chaque verrou porte un numéro de génération. Une réponse tardive ne remplace pas le résultat d’un traitement plus récent.
Après une interruption, il reprend la même demande et la même clé d’idempotence.
Il vérifie les droits de l’auteur et l’empreinte de la clé Resend avant chaque envoi.

Les erreurs temporaires autorisent cinq tentatives au total.
Les délais entre tentatives sont de deux, quatre, huit et seize minutes.
Un changement de clé ou une demande âgée de 23 heures bloque toute reprise d’envoi.
Resend conserve ses clés d’idempotence pendant 24 heures.

Le client HTTP Effect limite les appels à deux par seconde dans le processus.
Il lit les indications de limitation de Resend.
L’envoi expire après 20 secondes. Une lecture de statut expire après dix secondes.
Le client libère les ressources HTTP après chaque appel, y compris après un refus de Resend.
Un conflit de requêtes simultanées autorise une reprise avec la même clé.
Un conflit de contenu arrête l’envoi sans changer cette clé.

Une seule demande attend son envoi à la fois.
L’installation conserve au maximum 100 demandes de test.

## Suivi

L’interface actualise les états enregistrés toutes les trois secondes.
Le serveur continue le traitement lorsque la page est fermée.
Si la connexion échoue, l’écran conserve les dernières données et indique que le suivi est suspendu.

Une réponse API réussie signifie **Accepté par Resend**, pas **Remise confirmée**.
Le worker consulte ensuite le statut chez Resend, pendant au maximum 24 heures.
Chaque changement de livraison est enregistré avec son événement d’audit dans une même transaction.
La remise confirme l’acceptation par le serveur destinataire, pas la lecture par une personne.

Si la clé interdit la lecture des courriels, le statut reste accepté avec une explication.
Consultez alors le journal Resend pour vérifier la remise.

Si un envoi échoue sans réponse certaine, consultez le journal Resend avant de créer une nouvelle demande.
Une nouvelle demande représente un nouvel envoi, pas une reprise du précédent.

## Vérification

Les tests couvrent les droits, l’origine HTTP, les reprises, les interruptions, les appels concurrents et les réponses Resend invalides.
Les scénarios Playwright existants couvrent le formulaire, l’aperçu, les confirmations, le suivi et les thèmes clair et sombre.
Les tests automatisés utilisent des valeurs fictives et n’appellent pas Resend.
Un défaut de traitement est signalé sans contenu privé. Le worker reprend à la prochaine échéance.
La fermeture de son périmètre Effect arrête le worker et ses appels en cours.
