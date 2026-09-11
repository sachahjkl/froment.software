export const auditText = {
  fr: {
    'audit.searchPage': 'Rechercher sur cette page',
    'audit.serverFilters': 'Filtres du journal entier',
    'audit.exportPage': 'Exporter cette page filtrée en CSV, sans identifiants d’acteur',
    'audit.visibleCount.one': '{count} événement affiché',
    'audit.visibleCount.other': '{count} événements affichés',
    'audit.loadedCount.one': 'sur {count} événement chargé.',
    'audit.loadedCount.other': 'sur {count} événements chargés.',
    'audit.title': 'Journal d’audit',
    'audit.readDenied': 'Votre compte ne permet pas de consulter le journal d’audit.',
    'audit.intro':
      'Événements enregistrés dans la base locale. Ce journal ne contient pas les journaux externes des fournisseurs.',
    'audit.open': 'Ouvrir le journal d’audit',
    'audit.action': 'Action',
    'audit.resourceType': 'Type de ressource',
    'audit.resource': 'Ressource',
    'audit.actor': 'Identifiant de l’acteur',
    'audit.actorUnknown': 'Non renseigné',
    'audit.date': 'Date',
    'audit.allActions': 'Toutes les actions',
    'audit.allResources': 'Tous les types de ressource',
    'audit.resourceHint':
      'Filtre exact, par exemple quote, invoice ou client. Laissez ce champ vide pour tous les types.',
    'audit.filterInvalid':
      'Saisissez un type de ressource composé de lettres minuscules et de tirets.',
    'audit.apply': 'Appliquer les filtres',
    'audit.reset': 'Effacer les filtres',
    'audit.reload': 'Recharger cette page',
    'audit.loading': 'Chargement du journal…',
    'audit.empty': 'Aucun événement pour cette page et ces filtres.',
    'audit.invalid_query':
      'Les paramètres de cette adresse sont invalides. Effacez les filtres pour revenir au début du journal.',
    'audit.unavailable': 'Le journal est indisponible. Aucune donnée d’audit n’a été chargée.',
    'audit.navigation': 'Pages du journal d’audit',
    'audit.previous': 'Précédent — plus récents',
    'audit.next': 'Suivant — plus anciens',
    'audit.count.one': '{count} événement sur cette page',
    'audit.count.other': '{count} événements sur cette page',
  },
  en: {
    'audit.searchPage': 'Search this page',
    'audit.serverFilters': 'Filters for the entire log',
    'audit.exportPage': 'Export this filtered page as CSV, without actor identifiers',
    'audit.visibleCount.one': '{count} event displayed',
    'audit.visibleCount.other': '{count} events displayed',
    'audit.loadedCount.one': 'from {count} loaded event.',
    'audit.loadedCount.other': 'from {count} loaded events.',
    'audit.title': 'Audit log',
    'audit.readDenied': 'Your account cannot view the audit log.',
    'audit.intro':
      'Events recorded in the local database. This log does not include external provider logs.',
    'audit.open': 'Open the audit log',
    'audit.action': 'Action',
    'audit.resourceType': 'Resource type',
    'audit.resource': 'Resource',
    'audit.actor': 'Actor identifier',
    'audit.actorUnknown': 'Not recorded',
    'audit.date': 'Date',
    'audit.allActions': 'All actions',
    'audit.allResources': 'All resource types',
    'audit.resourceHint':
      'Exact filter, for example quote, invoice or client. Leave empty for all types.',
    'audit.filterInvalid': 'Enter a resource type that contains lowercase letters and hyphens.',
    'audit.apply': 'Apply filters',
    'audit.reset': 'Clear filters',
    'audit.reload': 'Reload this page',
    'audit.loading': 'Loading the audit log…',
    'audit.empty': 'No events for this page and these filters.',
    'audit.invalid_query':
      'This address contains invalid parameters. Clear the filters to return to the start of the log.',
    'audit.unavailable': 'The log is unavailable. No audit data was loaded.',
    'audit.navigation': 'Audit log pages',
    'audit.previous': 'Previous — newer',
    'audit.next': 'Next — older',
    'audit.count.one': '{count} event on this page',
    'audit.count.other': '{count} events on this page',
  },
} as const;

export const auditDocumentation = {
  fr: {
    group: {
      title: 'Audit',
      description: 'Lecture protégée des événements enregistrés dans la base locale.',
    },
    operations: {
      auditEventList: {
        summary: 'Lire une page du journal d’audit local',
        description:
          'Exige une session autorisée avec la permission `audit.read`. Cette permission n’est pas accordable aux jetons API. Retourne uniquement `id`, `action`, `actorUserId`, `resourceType`, `resourceId` et `occurredAt`. Ne retourne ni métadonnées, ni secrets, ni corrélation de trace ou de requête. Le serveur définit la taille des pages avec `AUDIT_PAGE_SIZE`, chargé par Effect Config. Sans `limit`, la requête utilise cette taille. Une limite explicite doit être un entier positif inférieur ou égal à cette taille. Un dépassement retourne HTTP 400 avec `audit.invalid_query`, sans lecture du journal. Les filtres `action` et `resourceType` sont exacts et se combinent. Sans curseur, la réponse contient les événements les plus récents. Avec `direction=older` ou sans direction, `cursor` exclut cet identifiant et sélectionne les identifiants inférieurs. Avec `direction=newer`, un curseur est obligatoire et la réponse contient les événements immédiatement supérieurs. Toutes les pages sont ordonnées par identifiant ULID décroissant. Les ULID sont créés à la date de l’événement. `previousCursor` s’utilise avec `direction=newer`, et `nextCursor` avec `direction=older`. Une valeur null indique l’absence de page dans cette direction pour les filtres actifs. La pagination ne fournit aucun total ni instantané entre requêtes. La réponse est privée et non mise en cache. Ce journal ne remplace pas les journaux externes des fournisseurs.',
      },
    },
  },
  en: {
    group: {
      title: 'Audit',
      description: 'Protected access to events recorded in the local database.',
    },
    operations: {
      auditEventList: {
        summary: 'Read a page of the local audit log',
        description:
          'Requires an authorized session with the `audit.read` permission. API tokens cannot receive this permission. Returns only `id`, `action`, `actorUserId`, `resourceType`, `resourceId` and `occurredAt`. Excludes metadata, secrets, trace identifiers and request identifiers. The server sets the page size through `AUDIT_PAGE_SIZE`, loaded by Effect Config. Without `limit`, the request uses that size. An explicit limit must be a positive integer no greater than that size. A larger limit returns HTTP 400 with `audit.invalid_query`, without reading the log. The exact `action` and `resourceType` filters apply together. Without a cursor, the response contains the newest events. With `direction=older` or no direction, `cursor` excludes that identifier and selects lower identifiers. With `direction=newer`, a cursor is required and the response contains the immediately higher events. Every page uses descending ULID order. ULIDs are created at the event time. Use `previousCursor` with `direction=newer` and `nextCursor` with `direction=older`. A null value means that no page exists in that direction for the active filters. Pagination provides neither a total nor a snapshot across requests. Responses are private and are not cached. This log does not replace external provider logs.',
      },
    },
  },
} as const;
