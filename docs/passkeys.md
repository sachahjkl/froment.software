# Connexion par clés d’accès

## Utilisation

Les administrateurs et les comptes clients peuvent enregistrer des clés d’accès WebAuthn.
La connexion par mot de passe reste disponible.

1. Connectez-vous avec votre mot de passe.
2. Ouvrez « Sécurité du compte ».
3. Saisissez un nom de clé et votre mot de passe actuel.
4. Sélectionnez « Ajouter une clé d’accès ».
5. Confirmez la création sur votre appareil ou votre clé de sécurité.

À la connexion suivante, sélectionnez « Se connecter avec une clé d’accès ».
Le navigateur propose les clés enregistrées pour cette installation.
L’appareil demande sa vérification locale : code, empreinte ou reconnaissance faciale, selon sa configuration.
Le serveur ne reçoit aucune donnée biométrique.

## Retrait et récupération

Pour retirer une clé, confirmez votre mot de passe dans la même section.
Le retrait révoque aussi les autres sessions du compte.
La session utilisée pour le retrait reste active.
Le retrait serveur ne supprime pas la clé stockée sur l’appareil ou chez son gestionnaire de clés.

Conservez un moyen de connexion de secours.
Cette fonction n’ajoute pas une procédure de récupération de compte.
La connexion par mot de passe reste une méthode distincte ; les passkeys ne lui imposent pas un second facteur.

## Configuration de l’installation

`PUBLIC_ORIGIN` fixe l’origine autorisée et le domaine WebAuthn.
Le serveur ne déduit pas ces valeurs des en-têtes fournis par le navigateur.
En production, utilisez une origine HTTPS stable.
Un changement de domaine nécessite un nouvel enregistrement des clés.
Pour les essais navigateur locaux, utilisez `localhost`.

La migration `20260906144204_passkeys` ajoute les clés publiques et les défis persistants.
Elle ne modifie pas les mots de passe existants.
Chaque compte accepte au plus dix clés.

## Contrôles serveur

- L’ajout et le retrait nécessitent une session navigateur et le mot de passe actuel.
- L’ajout lie le défi au compte et à la session qui l’a demandé.
- La connexion lie le défi au navigateur par un cookie HttpOnly, Secure et SameSite=Strict.
- Chaque défi expire après cinq minutes et ne sert qu’une fois.
- La vérification contrôle l’origine, le domaine, la signature et la vérification locale de l’utilisateur.
- La connexion contrôle aussi le propriétaire, le compteur et l’état actif du compte et de son client éventuel.
- Les mises à jour des compteurs empêchent la validation concurrente d’un compteur périmé.
- Les clés synchronisées dont le compteur reste nul restent acceptées, conformément à WebAuthn.
- Les demandes sont limitées à vingt par minute et par adresse cliente.
- Les ajouts, retraits et connexions produisent des événements d’audit.

Les clés privées restent dans l’authentificateur ou son système de synchronisation.
SimpleWebAuthn effectue les vérifications cryptographiques ; l’application ne réimplémente pas WebAuthn.

## Vérification et limites

Les tests HTTP utilisent des clés EC et de vraies signatures.
Ils couvrent les défis absents, expirés ou rejoués, les compteurs périmés, l’origine incorrecte et l’absence de vérification utilisateur.
Ils vérifient aussi les cookies, les quotas et la révocation des autres sessions.

Les contrôles navigateur utilisent un authentificateur virtuel Chromium pour l’ajout, la connexion et le retrait.
Les routes sont simulées dans ces contrôles ; les tests HTTP vérifient séparément le serveur réel.
Les appareils physiques et les gestionnaires de clés synchronisées nécessitent encore des essais manuels.

Le client SimpleWebAuthn est chargé à la demande.
Le budget maximal du chargement initial passe de 1 Mo à 1,05 Mo pour les nouveaux contrats et textes.
Aucun navigateur n’est ajouté aux dépendances de production.

Référence : https://simplewebauthn.dev/docs/packages/server
