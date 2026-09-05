import type { Language } from './language.js';

interface ApiDocumentationGroup {
  readonly title: string;
  readonly description: string;
}

interface ApiDocumentationOperation {
  readonly summary: string;
  readonly description: string;
}

interface ApiDocumentation {
  readonly title: string;
  readonly description: string;
  readonly requiredPermission: string;
  readonly security: {
    readonly bearer: string;
  };
  readonly groups: Readonly<Record<string, ApiDocumentationGroup>>;
  readonly operations: Readonly<Record<string, ApiDocumentationOperation>>;
}

export const apiDocumentation = {
  fr: {
    title: 'API Froment Software',
    description: 'API pour les clients, devis, commandes, factures et documents générés.',
    requiredPermission: 'Permission requise : `{permission}`.',
    security: {
      bearer: 'Jeton d’API transmis avec le schéma Bearer.',
    },
    groups: {
      clients: { title: 'Clients', description: 'Fiches clients et cycle de vie.' },
      orders: { title: 'Commandes', description: 'Commandes et documents générés.' },
      quotes: { title: 'Devis', description: 'Devis, révisions, envoi et documents.' },
      quoteLinks: {
        title: 'Liens de devis',
        description: 'Envoi et accès sécurisé aux devis.',
      },
      invoices: {
        title: 'Factures',
        description: 'Factures, révisions, cycle de vie et documents.',
      },
      affairs: { title: 'Affaires', description: 'Historique commercial des clients.' },
      authentication: {
        title: 'Authentification',
        description: 'Connexion, session et déconnexion.',
      },
      bootstrap: {
        title: 'Initialisation',
        description: 'Création du premier compte administrateur.',
      },
      clientPortal: {
        title: 'Espace client',
        description: 'Documents accessibles aux comptes clients.',
      },
      frontend: {
        title: 'Frontend',
        description: 'Routes utilisées par le frontend Froment Software.',
      },
      apiTokens: {
        title: 'Jetons d’API',
        description: 'Jetons Bearer et permissions associées.',
      },
      issuerSettings: {
        title: 'Paramètres émetteur',
        description: 'Coordonnées utilisées dans les documents.',
      },
      quoteConditionPresets: {
        title: 'Préréglages de devis',
        description: 'Conditions réutilisables dans les devis.',
      },
      status: { title: 'État', description: 'Santé et version du déploiement.' },
      catalog: { title: 'Catalogue', description: 'Prestations réutilisables dans les devis.' },
    },
    operations: {
      catalogList: {
        summary: 'Lister les prestations',
        description: 'Liste les prestations actives et archivées.',
      },
      catalogCreate: {
        summary: 'Créer une prestation',
        description:
          'Enregistre une description, une quantité, un prix en euros et un taux de TVA.',
      },
      catalogUpdate: {
        summary: 'Modifier une prestation',
        description:
          'Modifie ou archive une prestation si sa version correspond à expectedVersion. Les lignes de devis restent inchangées.',
      },
      clientList: {
        summary: 'Lister les clients',
        description: 'Liste les clients actifs et archivés.',
      },
      clientGet: {
        summary: 'Obtenir un client',
        description: 'Renvoie un client par identifiant.',
      },
      clientCreate: { summary: 'Créer un client', description: 'Crée un client.' },
      clientUpdate: { summary: 'Modifier un client', description: 'Modifie un client actif.' },
      clientArchive: { summary: 'Archiver un client', description: 'Archive un client.' },
      clientReactivate: {
        summary: 'Réactiver un client',
        description: 'Réactive un client archivé.',
      },
      orderList: {
        summary: 'Lister les commandes',
        description: 'Liste les commandes créées depuis les devis acceptés.',
      },
      orderPdfDownload: {
        summary: 'Télécharger le PDF d’une commande',
        description: 'Télécharge le PDF existant d’une commande.',
      },
      quoteList: {
        summary: 'Lister les devis',
        description: 'Liste les devis et leur dernière révision.',
      },
      quoteGet: {
        summary: 'Obtenir un devis',
        description: 'Renvoie un devis et toutes ses révisions.',
      },
      quotePdfDownload: {
        summary: 'Télécharger le PDF d’un devis',
        description: 'Télécharge le PDF existant d’une révision de devis.',
      },
      quoteCreate: {
        summary: 'Créer un devis',
        description: 'Crée la première révision d’un devis.',
      },
      quoteSend: {
        summary: 'Envoyer un devis',
        description: 'Crée un lien public de consultation pour un devis rendu.',
      },
      quoteCancel: { summary: 'Annuler un devis', description: 'Annule un devis modifiable.' },
      quoteRevisionCreate: {
        summary: 'Créer une révision de devis',
        description: 'Crée une révision d’un devis modifiable.',
      },
      invoiceList: {
        summary: 'Lister les factures',
        description: 'Liste les factures et leur état actuel.',
      },
      invoiceGet: {
        summary: 'Obtenir une facture',
        description: 'Renvoie une facture et ses révisions.',
      },
      invoicePdfDownload: {
        summary: 'Télécharger le PDF d’une facture',
        description: 'Télécharge le PDF existant d’une révision de facture.',
      },
      invoiceCreate: {
        summary: 'Créer une facture',
        description: 'Crée un brouillon de facture depuis une commande.',
      },
      invoiceRevisionCreate: {
        summary: 'Créer une révision de facture',
        description: 'Crée une révision de brouillon de facture.',
      },
      invoiceIssue: {
        summary: 'Émettre une facture',
        description: 'Attribue le numéro légal et émet la facture.',
      },
      invoiceMarkPaid: {
        summary: 'Marquer une facture comme payée',
        description: 'Passe une facture émise à l’état payé.',
      },
      invoiceVoid: { summary: 'Annuler une facture', description: 'Annule une facture.' },
      affairEventList: {
        summary: 'Lister les événements d’une affaire',
        description: 'Liste les événements commerciaux liés à un client.',
      },
      bootstrapCreate: {
        summary: 'Créer le premier administrateur',
        description: 'Initialise le premier compte administrateur.',
      },
      bootstrapStatus: {
        summary: 'Obtenir l’état de l’initialisation',
        description: 'Indique si la création du premier administrateur reste disponible.',
      },
      clientAccessCreate: {
        summary: 'Créer un accès client',
        description: 'Crée un nouveau compte d’accès pour un client.',
      },
      clientAccessList: {
        summary: 'Lister les accès client',
        description: 'Liste les comptes qui peuvent accéder au portail d’un client.',
      },
      clientAccessRevoke: {
        summary: 'Supprimer un accès client',
        description: 'Supprime un compte du portail et révoque ses sessions.',
      },
      clientInvoiceList: {
        summary: 'Lister les factures du client',
        description: 'Liste les factures accessibles au client connecté.',
      },
      clientInvoicePdf: {
        summary: 'Télécharger une facture du client',
        description: 'Télécharge le PDF d’une facture accessible au client connecté.',
      },
      clientOrderList: {
        summary: 'Lister les commandes du client',
        description: 'Liste les commandes accessibles au client connecté.',
      },
      clientOrderPdf: {
        summary: 'Télécharger une commande du client',
        description: 'Télécharge le PDF d’une commande accessible au client connecté.',
      },
      clientQuoteList: {
        summary: 'Lister les devis du client',
        description: 'Liste les devis accessibles au client connecté.',
      },
      clientQuotePdf: {
        summary: 'Télécharger un devis du client',
        description: 'Télécharge le PDF d’un devis accessible au client connecté.',
      },
      health: {
        summary: 'Vérifier la santé du service',
        description: 'Renvoie l’état de santé du service et de ses dépendances.',
      },
      apiTokenCreate: {
        summary: 'Créer un jeton d’API',
        description: 'Crée un jeton Bearer et révèle son secret une seule fois.',
      },
      apiTokenList: {
        summary: 'Lister les jetons d’API',
        description: 'Liste les jetons actifs, expirés et révoqués.',
      },
      apiTokenRevoke: {
        summary: 'Révoquer un jeton d’API',
        description: 'Révoque définitivement un jeton.',
      },
      invoicePdfRender: {
        summary: 'Générer le PDF d’une facture',
        description: 'Génère et conserve le PDF d’une révision de facture.',
      },
      invoicePreview: {
        summary: 'Prévisualiser une facture',
        description: 'Génère un aperçu sans créer de document conservé.',
      },
      issuerSettingsGet: {
        summary: 'Obtenir les paramètres émetteur',
        description: 'Renvoie les coordonnées utilisées dans les documents.',
      },
      issuerSettingsUpdate: {
        summary: 'Modifier les paramètres émetteur',
        description: 'Modifie les coordonnées utilisées dans les futurs documents.',
      },
      login: {
        summary: 'Se connecter',
        description: 'Authentifie un compte et crée une session.',
      },
      logout: { summary: 'Se déconnecter', description: 'Révoque la session active.' },
      refresh: {
        summary: 'Rafraîchir la connexion',
        description: 'Fait tourner le jeton de rafraîchissement et renvoie un jeton d’accès.',
      },
      currentAccount: {
        summary: 'Obtenir le compte courant',
        description: 'Renvoie le compte associé au jeton d’accès.',
      },
      orderPdfRender: {
        summary: 'Générer le PDF d’une commande',
        description: 'Génère et conserve le PDF d’une commande.',
      },
      orderPreview: {
        summary: 'Prévisualiser une commande',
        description: 'Génère un aperçu sans créer de document conservé.',
      },
      publicQuoteGet: {
        summary: 'Consulter un devis public',
        description: 'Ouvre un devis avec un lien public valide.',
      },
      publicQuotePdfDownload: {
        summary: 'Télécharger un devis public',
        description: 'Télécharge le PDF associé à un lien public valide.',
      },
      publicQuoteSign: {
        summary: 'Signer un devis public',
        description: 'Accepte et signe un devis avec un lien public valide.',
      },
      quoteConditionPresetCreate: {
        summary: 'Créer un préréglage de devis',
        description: 'Crée un jeu de conditions réutilisable.',
      },
      quoteConditionPresetDelete: {
        summary: 'Supprimer un préréglage de devis',
        description: 'Supprime un jeu de conditions réutilisable.',
      },
      quoteConditionPresetList: {
        summary: 'Lister les préréglages de devis',
        description: 'Liste les jeux de conditions réutilisables.',
      },
      quoteConditionPresetUpdate: {
        summary: 'Modifier un préréglage de devis',
        description: 'Modifie un jeu de conditions réutilisable.',
      },
      quotePdfRender: {
        summary: 'Générer le PDF d’un devis',
        description: 'Génère et conserve le PDF d’une révision de devis.',
      },
      quotePreview: {
        summary: 'Prévisualiser un devis',
        description: 'Génère un aperçu sans créer de document conservé.',
      },
      version: {
        summary: 'Obtenir la version du service',
        description: 'Renvoie les métadonnées du déploiement actif.',
      },
    },
  },
  en: {
    title: 'Froment Software API',
    description: 'API for client records, quotes, orders, invoices, and generated documents.',
    requiredPermission: 'Required permission: `{permission}`.',
    security: {
      bearer: 'API token sent with the Bearer scheme.',
    },
    groups: {
      clients: { title: 'Clients', description: 'Client records and lifecycle.' },
      orders: { title: 'Orders', description: 'Orders and their generated documents.' },
      quotes: { title: 'Quotes', description: 'Quotes, revisions, delivery, and documents.' },
      quoteLinks: {
        title: 'Quote links',
        description: 'Quote delivery and secure access.',
      },
      invoices: {
        title: 'Invoices',
        description: 'Invoices, revisions, lifecycle, and documents.',
      },
      affairs: { title: 'Affairs', description: 'Client commercial history.' },
      authentication: {
        title: 'Authentication',
        description: 'Login, session, and logout.',
      },
      bootstrap: {
        title: 'Bootstrap',
        description: 'First administrator account creation.',
      },
      clientPortal: {
        title: 'Client portal',
        description: 'Documents available to client accounts.',
      },
      frontend: {
        title: 'Frontend',
        description: 'Routes used by the Froment Software frontend.',
      },
      apiTokens: {
        title: 'API tokens',
        description: 'Bearer tokens and their permissions.',
      },
      issuerSettings: {
        title: 'Issuer settings',
        description: 'Issuer details used in documents.',
      },
      quoteConditionPresets: {
        title: 'Quote presets',
        description: 'Reusable quote terms.',
      },
      status: { title: 'Status', description: 'Deployment health and version.' },
      catalog: { title: 'Catalog', description: 'Reusable services for quotes.' },
    },
    operations: {
      catalogList: { summary: 'List services', description: 'Lists active and archived services.' },
      catalogCreate: {
        summary: 'Create a service',
        description: 'Stores a description, quantity, price in euros and VAT rate.',
      },
      catalogUpdate: {
        summary: 'Update a service',
        description:
          'Updates or archives a service when its version matches expectedVersion. Quote lines remain unchanged.',
      },
      clientList: { summary: 'List clients', description: 'Lists active and archived clients.' },
      clientGet: { summary: 'Get a client', description: 'Returns one client by identifier.' },
      clientCreate: { summary: 'Create a client', description: 'Creates a client.' },
      clientUpdate: { summary: 'Update a client', description: 'Updates an active client.' },
      clientArchive: { summary: 'Archive a client', description: 'Archives a client.' },
      clientReactivate: {
        summary: 'Reactivate a client',
        description: 'Reactivates an archived client.',
      },
      orderList: {
        summary: 'List orders',
        description: 'Lists orders created from accepted quotes.',
      },
      orderPdfDownload: {
        summary: 'Download an order PDF',
        description: 'Downloads an existing order PDF.',
      },
      quoteList: { summary: 'List quotes', description: 'Lists quotes and their latest revision.' },
      quoteGet: {
        summary: 'Get a quote',
        description: 'Returns a quote and all of its revisions.',
      },
      quotePdfDownload: {
        summary: 'Download a quote PDF',
        description: 'Downloads an existing quote revision PDF.',
      },
      quoteCreate: {
        summary: 'Create a quote',
        description: 'Creates the first revision of a quote.',
      },
      quoteSend: {
        summary: 'Send a quote',
        description: 'Creates a public consultation link for a rendered quote.',
      },
      quoteCancel: { summary: 'Cancel a quote', description: 'Cancels an editable quote.' },
      quoteRevisionCreate: {
        summary: 'Create a quote revision',
        description: 'Creates a new revision of an editable quote.',
      },
      invoiceList: {
        summary: 'List invoices',
        description: 'Lists invoices and their current state.',
      },
      invoiceGet: {
        summary: 'Get an invoice',
        description: 'Returns an invoice and its revisions.',
      },
      invoicePdfDownload: {
        summary: 'Download an invoice PDF',
        description: 'Downloads an existing invoice revision PDF.',
      },
      invoiceCreate: {
        summary: 'Create an invoice',
        description: 'Creates a draft invoice from an order.',
      },
      invoiceRevisionCreate: {
        summary: 'Create an invoice revision',
        description: 'Creates a new draft invoice revision.',
      },
      invoiceIssue: {
        summary: 'Issue an invoice',
        description: 'Assigns the legal invoice number and issues the invoice.',
      },
      invoiceMarkPaid: {
        summary: 'Mark an invoice as paid',
        description: 'Transitions an issued invoice to paid.',
      },
      invoiceVoid: { summary: 'Void an invoice', description: 'Voids an invoice.' },
      affairEventList: {
        summary: 'List affair events',
        description: 'Lists the commercial events related to a client.',
      },
      bootstrapCreate: {
        summary: 'Create the first administrator',
        description: 'Creates the first administrator account.',
      },
      bootstrapStatus: {
        summary: 'Get bootstrap status',
        description: 'Reports whether first administrator creation remains available.',
      },
      clientAccessCreate: {
        summary: 'Create client access',
        description: 'Creates a new access account for a client.',
      },
      clientAccessList: {
        summary: 'List client access accounts',
        description: 'Lists the accounts that can access a client portal.',
      },
      clientAccessRevoke: {
        summary: 'Remove client access',
        description: 'Removes a portal account and revokes its sessions.',
      },
      clientInvoiceList: {
        summary: 'List client invoices',
        description: 'Lists invoices available to the authenticated client.',
      },
      clientInvoicePdf: {
        summary: 'Download a client invoice',
        description: 'Downloads an invoice PDF available to the authenticated client.',
      },
      clientOrderList: {
        summary: 'List client orders',
        description: 'Lists orders available to the authenticated client.',
      },
      clientOrderPdf: {
        summary: 'Download a client order',
        description: 'Downloads an order PDF available to the authenticated client.',
      },
      clientQuoteList: {
        summary: 'List client quotes',
        description: 'Lists quotes available to the authenticated client.',
      },
      clientQuotePdf: {
        summary: 'Download a client quote',
        description: 'Downloads a quote PDF available to the authenticated client.',
      },
      health: {
        summary: 'Check service health',
        description: 'Returns the health of the service and its dependencies.',
      },
      apiTokenCreate: {
        summary: 'Create an API token',
        description: 'Creates a Bearer token and reveals its secret once.',
      },
      apiTokenList: {
        summary: 'List API tokens',
        description: 'Lists active, expired, and revoked tokens.',
      },
      apiTokenRevoke: {
        summary: 'Revoke an API token',
        description: 'Permanently revokes a token.',
      },
      invoicePdfRender: {
        summary: 'Render an invoice PDF',
        description: 'Renders and stores an invoice revision PDF.',
      },
      invoicePreview: {
        summary: 'Preview an invoice',
        description: 'Renders a preview without creating a stored document.',
      },
      issuerSettingsGet: {
        summary: 'Get issuer settings',
        description: 'Returns the issuer details used in documents.',
      },
      issuerSettingsUpdate: {
        summary: 'Update issuer settings',
        description: 'Updates the issuer details used in future documents.',
      },
      login: { summary: 'Log in', description: 'Authenticates an account and creates a session.' },
      logout: { summary: 'Log out', description: 'Revokes the active session.' },
      refresh: {
        summary: 'Refresh authentication',
        description: 'Rotates the refresh token and returns an access token.',
      },
      currentAccount: {
        summary: 'Get current account',
        description: 'Returns the account associated with the access token.',
      },
      orderPdfRender: {
        summary: 'Render an order PDF',
        description: 'Renders and stores an order PDF.',
      },
      orderPreview: {
        summary: 'Preview an order',
        description: 'Renders a preview without creating a stored document.',
      },
      publicQuoteGet: {
        summary: 'Open a public quote',
        description: 'Opens a quote with a valid public link.',
      },
      publicQuotePdfDownload: {
        summary: 'Download a public quote',
        description: 'Downloads the PDF for a valid public link.',
      },
      publicQuoteSign: {
        summary: 'Sign a public quote',
        description: 'Accepts and signs a quote with a valid public link.',
      },
      quoteConditionPresetCreate: {
        summary: 'Create a quote preset',
        description: 'Creates a reusable set of quote terms.',
      },
      quoteConditionPresetDelete: {
        summary: 'Delete a quote preset',
        description: 'Deletes a reusable set of quote terms.',
      },
      quoteConditionPresetList: {
        summary: 'List quote presets',
        description: 'Lists reusable sets of quote terms.',
      },
      quoteConditionPresetUpdate: {
        summary: 'Update a quote preset',
        description: 'Updates a reusable set of quote terms.',
      },
      quotePdfRender: {
        summary: 'Render a quote PDF',
        description: 'Renders and stores a quote revision PDF.',
      },
      quotePreview: {
        summary: 'Preview a quote',
        description: 'Renders a preview without creating a stored document.',
      },
      version: {
        summary: 'Get service version',
        description: 'Returns the active deployment metadata.',
      },
    },
  },
} as const satisfies Record<Language, ApiDocumentation>;
