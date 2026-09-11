# Configuration d’exécution

`packages/api/src/runtime-config.ts` regroupe la configuration d’exécution non secrète.
`RuntimeConfig` décrit les valeurs avec Effect `Config`.
`RuntimeConfigurationLive` charge ces valeurs au démarrage.
Les services utilisent la configuration injectée avec `yield* RuntimeConfiguration`.

## Pagination du journal d’audit

`AUDIT_PAGE_SIZE` définit `audit.pageSize`.
La valeur par défaut est 50.
Cette valeur par défaut reste définie uniquement dans `defaultRuntimeConfig.audit.pageSize`.

La valeur doit être un entier sûr strictement positif.
Si la valeur fournie est invalide, le chargement de la configuration échoue.
Seule l’absence de valeur active la valeur par défaut.
Le fournisseur Effect considère une chaîne vide comme une valeur absente.

`GET /api/audit-events` applique cette taille lorsque `limit` est absent.
Une limite explicite doit être inférieure ou égale à cette taille.
Si la limite dépasse cette taille, l’API retourne HTTP 400 avec `audit.invalid_query` avant toute lecture du journal.

Le lecteur capture la configuration pendant la construction de sa couche Effect.
La requête SQL et la validation des lignes utilisent cette même taille.
Les contrats partagés valident la structure, sans imposer une taille propre au déploiement.
La recherche, le tri et l’export de l’interface portent uniquement sur la page chargée.

## Quotas de requêtes

`REQUEST_LIMITER_CAPACITY` limite les compteurs ordinaires à 10 000 entrées.
`REQUEST_LIMITER_PUBLIC_CAPACITY` limite séparément les compteurs des devis publics à 10 000 entrées.
`REQUEST_LIMITER_WINDOW_MILLIS` définit leur fenêtre fixe, de 60 000 ms par défaut.
Chaque compteur reste présent jusqu’à la fin de sa fenêtre, sans prolongation lors d’un refus.
Si la capacité est atteinte, les nouvelles clés sont refusées jusqu’à la libération de compteurs expirés.
Les compteurs actifs ne sont jamais évincés.
Une adresse publique déjà limitée ne crée aucun compteur de jeton.
Ces limites sont locales au processus et sont remises à zéro au redémarrage.

## Tests

Pour tester le chargement, fournissez `ConfigProvider.layer(ConfigProvider.fromUnknown(...))` à `RuntimeConfigurationLive`.
Pour tester un service avec une configuration déjà validée, fournissez `Layer.succeed(RuntimeConfiguration, configuration)`.
Ne modifiez pas l’environnement global pendant les tests.
