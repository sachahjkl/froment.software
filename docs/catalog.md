# Catalogue de prestations

Le catalogue se trouve dans **Configuration → Catalogue**.
Il enregistre la description, la quantité par défaut, le prix unitaire hors taxes et le taux de TVA.
Ce premier lot utilise l’euro, comme les documents actuels.
Le choix de devises supplémentaires reste à réaliser.

## Utilisation

1. Créez une prestation dans le catalogue.
2. Ouvrez un devis en brouillon.
3. Choisissez la prestation dans « Ajouter depuis le catalogue ».
4. Vérifiez la quantité, le prix et la TVA avant d’enregistrer le devis.

L’ajout copie les valeurs dans une ligne indépendante.
Les changements du catalogue ne modifient ni cette ligne ni les versions enregistrées du devis.
Le taux de TVA reste un choix explicite, sans déduction à partir du pays.

Une prestation archivée disparaît du sélecteur de devis.
Elle reste accessible avec le filtre des prestations archivées.
Pour la restaurer, décochez « Archivée », puis enregistrez.

## Contrôles

L’API exige une session authentifiée.
La lecture utilise la permission `quote.create` ; la modification utilise `quote.update`.
Le catalogue n’est pas accessible aux comptes clients.
Les créations et modifications produisent un événement d’audit.
Chaque modification exige `expectedVersion` pour éviter d’écraser une modification concurrente.
En cas de conflit, rechargez la liste et sélectionnez à nouveau la prestation.

Les quantités utilisent des millièmes, les prix des centimes et les taux des points de base.
Les valeurs négatives, les quantités nulles et les taux supérieurs à 100 % sont refusés.
