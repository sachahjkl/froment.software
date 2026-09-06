# Reprises automatiques des fournisseurs

Une demande enregistrée sans reçu devient éligible une minute après sa création.
Le serveur examine les demandes toutes les 15 secondes.
Chaque passage traite au plus 20 demandes, une à la fois.

Le service Effect `IntegrationRetries` expose `list` et `runPending`.
La couche `IntegrationRetryWorkerLive` exécute les passages dans la portée du serveur.
SQLite conserve le nombre de tentatives, leur état, la prochaine date et la dernière erreur.
Un redémarrage ne remet pas le compteur à zéro.

## Bornes et sécurité

Chaque demande reçoit au plus cinq tentatives automatiques après l’appel initial.
Les délais après échec sont de deux, quatre, huit et seize minutes.
Une tentative dispose de 30 secondes.
Une réservation de deux minutes empêche deux travailleurs de traiter simultanément la même ligne.
Si une réservation expire, le passage suivant récupère la ligne sans effacer le compteur.

Chaque reprise conserve le contenu, la clé d’idempotence et le mode attendu.
Un fournisseur réel doit respecter cette clé, y compris après une interruption ou un appel manuel concurrent.
Un changement de mode bloque la reprise ; il ne transforme pas une simulation en action réelle.
Un reçu existant termine la reprise sans nouvel appel fournisseur.

Avant chaque tentative, le serveur vérifie le compte initiateur.
Ce compte doit être un administrateur actif avec la permission `integration.manage`.
Une permission retirée ou un compte désactivé bloque la reprise.
Une demande invalide ou un conflit bloque également la reprise.
Les erreurs temporaires consomment une tentative et programment la suivante.

## Consultation et intervention

La page **Configuration → Services externes** affiche les reprises et leur dernière erreur.
Cliquez sur **Recharger** pour actualiser les résultats.
La route `GET /api/integrations/retries` expose les 100 enregistrements les plus récents.
Elle exige `integration.manage` et interdit la mise en cache.

Les états bloqués et les tentatives épuisées nécessitent une intervention.
La reprise manuelle existante reste disponible dans l’historique des opérations.
Elle ne remet pas le compteur automatique à zéro.
Si une reprise manuelle obtient un reçu, le passage suivant marque la reprise comme terminée.

Les cinq fournisseurs raccordés restent des mocks.
Une reprise réussie en simulation conserve un reçu de simulation, jamais une preuve d’effet externe.
