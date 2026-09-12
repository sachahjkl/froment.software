# Taux de change

Le système conserve les taux datés avec neuf décimales.
Un taux indique les unités de devise étrangère pour une unité de devise fonctionnelle.

L’import BCE charge les 90 derniers jours publiés.
Si la devise fonctionnelle n’est pas l’euro, le serveur calcule les taux croisés.

Une surcharge manuelle remplace le taux de la même date et de la même paire.
Un nouvel import BCE ne remplace pas une surcharge manuelle.

Chaque import et chaque surcharge produit un événement d’audit.
