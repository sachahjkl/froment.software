# Sécurité du compte

## Changement de mot de passe

1. Ouvrez le menu de votre adresse électronique.
2. Choisissez « Sécurité du compte ».
3. Saisissez le mot de passe actuel et le nouveau mot de passe.
4. Confirmez le nouveau mot de passe, puis validez le changement.
5. Reconnectez-vous avec le nouveau mot de passe.

Le nouveau mot de passe contient entre 12 et 256 caractères.
Il doit différer du mot de passe actuel.
Le serveur conserve une empreinte Argon2id, pas le mot de passe.
L’interface efface les champs après chaque tentative envoyée.

Le changement révoque toutes les sessions navigateur du compte, y compris la session courante.
Les jetons d’accès et de renouvellement associés ne permettent plus de requêtes authentifiées.
Les jetons API restent inchangés ; leur révocation utilise leur écran dédié.
Les autres comptes ne sont pas déconnectés.

Le changement, la révocation et l’événement d’audit utilisent une seule transaction SQLite.
L’audit ne contient ni le mot de passe ni son empreinte.
Une connexion concurrente ne crée pas de session avec une empreinte remplacée pendant la vérification du mot de passe.

## API

`POST /api/auth/password` reçoit `currentPassword` et `newPassword`.
Cette route exige une session navigateur et vérifie l’origine de la requête.
Elle accepte cinq tentatives par minute et par compte dans le processus API.
Une réponse `204` efface les cookies de session.
Un mot de passe incorrect, identique ou une session devenue inactive produit une réponse `409`.

Si la réponse est perdue, essayez de vous connecter avec le nouveau mot de passe.
L’application ne réessaie pas automatiquement une modification de mot de passe.
Si la session a expiré, reconnectez-vous avant de recommencer.

## Sessions actives

La page « Sécurité du compte » liste les sessions actives de votre compte.
Chaque connexion possède un identifiant stable, même après le renouvellement de ses jetons.
La liste indique la date de connexion, le dernier renouvellement et l’expiration.
Le dernier renouvellement ne représente pas la dernière action effectuée.
Aucun nom d’appareil ni aucune localisation ne sont déduits de ces dates.

1. Repérez la session à fermer grâce à sa date et son identifiant.
2. Choisissez « Fermer cette session ».
3. Confirmez la fermeture.

La fermeture révoque tous les jetons de cette session, sans changer le mot de passe.
Votre session actuelle reste ouverte.
Pour fermer la session actuelle, utilisez le bouton de déconnexion du bandeau.
Pour vérifier une fermeture après une erreur réseau, actualisez la liste.

`GET /api/auth/sessions` liste les familles de sessions actives du compte connecté.
`POST /api/auth/sessions/:sessionId/revoke` révoque une autre famille appartenant au même compte.
Le serveur vérifie l’origine de cette requête et limite les révocations à dix tentatives par minute et par compte.
La révocation est transactionnelle et produit un événement d’audit sans jeton ni empreinte.
Une nouvelle tentative ne produit pas un second événement.
Une session étrangère ou inconnue retourne `404` ; la session actuelle retourne `409`.
Les sessions expirées et révoquées ne figurent plus dans la liste.

## Limites

La récupération d’un mot de passe oublié, les invitations et la MFA restent à implémenter.
Ce changement ne configure aucun service de courriel.
