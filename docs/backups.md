# Sauvegarde et restauration

## Périmètre

`froment-software-backup` crée, vérifie et restaure une copie SQLite.
La copie inclut les documents PDF, leurs preuves stockées, les comptes, les clés publiques des passkeys et l’historique métier.
La sauvegarde utilise l’API SQLite, pas une copie du fichier principal susceptible d’ignorer son journal WAL.
Le serveur peut continuer à fonctionner pendant la sauvegarde.

L’outil ne sauvegarde pas les secrets de configuration, les journaux externes ou les clés privées des appareils.
Conservez séparément les secrets PASETO, HMAC et la configuration de l’installation.
Protégez aussi les moyens nécessaires pour déchiffrer vos secrets de déploiement.

## Sécurité

Les sauvegardes contiennent des données personnelles, des empreintes de mots de passe et des données de session.
L’outil crée les fichiers avec les permissions `0600`.
Il refuse de remplacer un fichier existant, pendant la sauvegarde comme pendant la restauration.

Les fichiers SQLite produits ne sont pas chiffrés.
Utilisez un volume chiffré et un répertoire accessible uniquement au compte d’exploitation.
Chiffrez les fichiers avant tout transfert hors de ce volume avec votre outil de sauvegarde habituel.
Définissez une rétention et testez régulièrement la restauration sur une installation isolée.

## Créer une sauvegarde

Créez d’abord un répertoire protégé sur le même hôte.
Choisissez un nouveau nom de fichier pour chaque exécution.

```sh
install -d -m 700 /srv/froment-backups
BACKUP_ACTION=create \
DATABASE_PATH=/var/lib/froment-software/froment.sqlite \
BACKUP_PATH=/srv/froment-backups/froment-2026-09-06.sqlite \
froment-software-backup
```

Le nom et le chemin de la base active dépendent de votre configuration.
La commande vérifie la copie avant de retourner un succès.
Attendez sa fin avant de transférer le fichier.
Si le processus est interrompu, vérifiez la copie avant de l’utiliser.

## Vérifier une copie

```sh
BACKUP_ACTION=verify \
BACKUP_PATH=/srv/froment-backups/froment-2026-09-06.sqlite \
froment-software-backup
```

La vérification contrôle :

- l’intégrité SQLite ;
- les contraintes de clés étrangères ;
- la liste et les empreintes des migrations de cette version ;
- l’empreinte SHA-256 de chaque document stocké.

Un succès retourne un objet JSON avec les nombres de migrations et de documents vérifiés.
Une erreur produit un code de sortie non nul.
Les empreintes détectent les altérations accidentelles ; elles ne prouvent pas l’authenticité d’une sauvegarde issue d’un tiers.

## Restaurer sans écraser la base active

Utilisez la version de l’application qui correspond à la sauvegarde.
Arrêtez le serveur avant de changer le chemin de sa base.
Restaurez toujours vers un nouveau fichier.

```sh
BACKUP_ACTION=restore \
BACKUP_PATH=/srv/froment-backups/froment-2026-09-06.sqlite \
DATABASE_PATH=/var/lib/froment-software/restored.sqlite \
froment-software-backup
```

Après vérification, configurez `DATABASE_PATH` avec le chemin restauré.
Conservez l’ancienne base et son journal jusqu’à la validation de la restauration.
Redémarrez l’application avec les secrets et l’origine de l’installation restaurée.
Contrôlez la connexion, les soldes et le téléchargement de documents avant de rouvrir les accès.

Une restauration remet aussi les comptes et sessions dans leur état sauvegardé.
Révoquez les sessions et clés compromises après une restauration liée à un incident.

## Développement et tests

Dans le dépôt, exécutez `node packages/api/dist/backup.cjs` après compilation.
Définissez aussi `MIGRATIONS_ROOT=packages/api/drizzle`.
Utilisez `nix develop -c` pour ces commandes.

Les tests sauvegardent un serveur de test actif, avec un PDF réellement généré.
Ils vérifient la restauration, les permissions des fichiers, le refus d’écrasement et le rejet d’un document altéré.
Ils exécutent aussi la commande compilée de vérification.
Ces tests ne constituent pas un exercice de restauration de la production.
L’outil ne configure ni planification, ni rétention, ni stockage distant.
