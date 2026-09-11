import type { Language } from './language.js';
import { teamDocumentation } from './team.js';
import { creditDocumentation } from './credit-notes.js';
import { ledgerDocumentation } from './bank-ledger.js';
import { passkeyDocumentation } from './passkeys.js';
import { emailDraftDocumentation } from './email-drafts.js';
import { connectionDocumentation } from './connections.js';
import { checkoutDocumentation } from './checkout.js';
import { auditDocumentation } from './audit.js';
import { workspaceApiDocumentation } from './workspace-api-documentation.js';
import { emailTemplateDocumentation } from './email-templates.js';
import { reminderDocumentation } from './reminders.js';
import { providerActionDocumentation } from './provider-action-documentation.js';

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
      bearer:
        'Utilisez un jeton API `froment_api_v1_…` avec le schéma Bearer. Une session navigateur utilise ses cookies.',
    },
    groups: {
      audit: auditDocumentation.fr.group,
      passkeys: passkeyDocumentation.fr.group,
      team: teamDocumentation.fr.group,
      creditNotes: creditDocumentation.fr.group,
      bankLedger: ledgerDocumentation.fr.group,
      emailDrafts: emailDraftDocumentation.fr.group,
      emailTemplates: emailTemplateDocumentation.fr.group,
      reminders: reminderDocumentation.fr.group,
      providerActions: {
        title: 'Contrats des fournisseurs',
        description:
          'Actions typées des cinq fournisseurs. Implémentations mock sans effet externe.',
      },
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
      blog: { title: 'Blog', description: 'Publications techniques publiques.' },
      catalog: { title: 'Catalogue', description: 'Prestations réutilisables dans les devis.' },
      banking: { title: 'Banque', description: 'Relevés et rapprochement des règlements.' },
      integrations: {
        title: 'Services externes',
        description: 'Adaptateurs et journal des demandes.',
      },
    },
    operations: {
      ...auditDocumentation.fr.operations,
      blogFeed: {
        summary: 'Lire le flux Atom du blog',
        description:
          'Retourne les résumés français des publications au format Atom XML. Aucune authentification requise.',
      },
      ...workspaceApiDocumentation.fr,
      ...passkeyDocumentation.fr.operations,
      ...emailDraftDocumentation.fr.operations,
      ...connectionDocumentation.fr,
      ...checkoutDocumentation.fr,
      integrationRetryList: {
        summary: 'Lire les reprises automatiques',
        description:
          'Retourne les 100 reprises les plus récentes. Chaque reprise conserve la demande et son mode. Cinq tentatives au maximum après l’appel initial.',
      },
      ...emailTemplateDocumentation.fr.operations,
      ...reminderDocumentation.fr.operations,
      ...providerActionDocumentation.fr,
      ...teamDocumentation.fr.operations,
      ...creditDocumentation.fr.operations,
      ...ledgerDocumentation.fr.operations,
      bankPaymentList: {
        summary: 'Lister les soldes rapprochables des règlements',
        description:
          'Retourne les règlements actifs d’une facture et leurs montants disponibles, après déduction de toutes les affectations actives.',
      },
      bankMatchHistory: {
        summary: 'Consulter les rapprochements conservés',
        description:
          'Afficher les 100 derniers rapprochements d’une opération, avec auteurs, dates et motifs de dissociation.',
      },
      bankTransactionList: {
        summary: 'Lister les opérations bancaires',
        description: 'Retourne les 1 000 dernières opérations et leurs rapprochements actifs.',
      },
      bankImport: {
        summary: 'Importer un relevé CSV',
        description:
          'Importe atomiquement les lignes et refuse les références réutilisées avec des valeurs différentes.',
      },
      bankMatch: {
        summary: 'Rapprocher un encaissement',
        description:
          'Affecte amountCents au règlement et amountCents moins feeCents au crédit bancaire. La commission doit être inférieure au montant affecté. Utilisez une clé UUID v4 stable. Ne crée aucun règlement.',
      },
      bankUnmatch: {
        summary: 'Dissocier un rapprochement',
        description: 'Conserve le rapprochement précédent et son motif de dissociation.',
      },
      integrationStatus: {
        summary: 'Lister les modes des adaptateurs',
        description: 'Indique les services simulés et les prestataires connectés.',
      },
      integrationOperationList: {
        summary: 'Consulter les opérations externes',
        description: 'Retourne les 100 dernières demandes et leurs reçus.',
      },
      integrationOperationCreate: {
        summary: 'Soumettre une demande externe',
        description:
          'Enregistre la demande et appelle son adaptateur avec une clé d’idempotence. Une simulation ne réalise aucune opération externe.',
      },
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
      quoteLinkState: {
        summary: 'Consulter l’état du lien de signature',
        description:
          'Retourne l’identifiant et l’expiration du lien courant, sans révéler son jeton.',
      },
      quoteLinkReplace: {
        summary: 'Remplacer un lien de signature',
        description:
          'Révoque le lien attendu et crée un nouveau lien pour le même devis envoyé non signé.',
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
      invoicePaymentCancel: {
        summary: 'Annuler une saisie de règlement',
        description:
          'Conserve le règlement et le motif de correction. Rétablit le solde dû sans modifier le document émis ni effectuer de remboursement.',
      },
      invoicePaymentExport: {
        summary: 'Exporter les règlements',
        description:
          'Exporte les règlements reçus entre from et to inclus, dans un CSV UTF-8. Limite de 10 000 lignes ; aucune troncature silencieuse.',
      },
      invoicePaymentCreate: {
        summary: 'Enregistrer un règlement',
        description:
          'Enregistre un règlement partiel ou complet. Réutilisez requestId avec les mêmes valeurs après une erreur réseau. Le solde ne peut pas devenir négatif.',
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
        summary: 'Renouveler la session',
        description:
          'Renouvelle la session et ses cookies. La réponse contient le mode d’accès et l’expiration, sans jeton secret.',
      },
      passwordChange: {
        summary: 'Changer le mot de passe',
        description:
          'Vérifie le mot de passe actuel et révoque toutes les sessions dans la transaction de changement. Réservé aux sessions navigateur.',
      },
      currentAccount: {
        summary: 'Consulter le compte courant',
        description: 'Retourne le compte authentifié.',
      },
      accountSessionList: {
        summary: 'Lister les sessions actives',
        description:
          'Liste les familles de sessions actives du compte connecté, sans jetons ni empreintes.',
      },
      accountSessionRevoke: {
        summary: 'Fermer une autre session',
        description:
          'Révoque une famille de sessions appartenant au compte connecté. La session actuelle utilise la déconnexion habituelle.',
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
      bearer:
        'Use a `froment_api_v1_…` API token with the Bearer scheme. A browser session uses its cookies.',
    },
    groups: {
      audit: auditDocumentation.en.group,
      clients: { title: 'Clients', description: 'Client records and lifecycle.' },
      passkeys: passkeyDocumentation.en.group,
      team: teamDocumentation.en.group,
      creditNotes: creditDocumentation.en.group,
      bankLedger: ledgerDocumentation.en.group,
      emailDrafts: emailDraftDocumentation.en.group,
      emailTemplates: emailTemplateDocumentation.en.group,
      reminders: reminderDocumentation.en.group,
      providerActions: {
        title: 'Provider contracts',
        description:
          'Typed actions for all five providers. Mock implementations without external effects.',
      },
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
      blog: { title: 'Blog', description: 'Public technical articles.' },
      catalog: { title: 'Catalog', description: 'Reusable services for quotes.' },
      banking: { title: 'Banking', description: 'Statements and payment reconciliation.' },
      integrations: { title: 'External services', description: 'Adapters and request history.' },
    },
    operations: {
      ...auditDocumentation.en.operations,
      blogFeed: {
        summary: 'Read the blog Atom feed',
        description:
          'Returns French article summaries as Atom XML. Authentication is not required.',
      },
      ...workspaceApiDocumentation.en,
      catalogList: { summary: 'List services', description: 'Lists active and archived services.' },
      ...passkeyDocumentation.en.operations,
      ...emailDraftDocumentation.en.operations,
      ...connectionDocumentation.en,
      ...checkoutDocumentation.en,
      integrationRetryList: {
        summary: 'Read automatic retries',
        description:
          'Returns the latest 100 retry records. Each retry preserves the request and its mode. At most five attempts follow the initial call.',
      },
      ...emailTemplateDocumentation.en.operations,
      ...reminderDocumentation.en.operations,
      ...providerActionDocumentation.en,
      ...teamDocumentation.en.operations,
      ...creditDocumentation.en.operations,
      ...ledgerDocumentation.en.operations,
      bankPaymentList: {
        summary: 'List available payment balances for reconciliation',
        description:
          'Returns active invoice payments and their available amounts after deducting all active allocations.',
      },
      bankMatchHistory: {
        summary: 'Read reconciliation history',
        description:
          'Return the latest 100 matches for a transaction, including actors, dates and reasons for removal.',
      },
      bankTransactionList: {
        summary: 'List bank transactions',
        description: 'Returns the latest 1,000 transactions and their active matches.',
      },
      bankImport: {
        summary: 'Import a CSV statement',
        description: 'Imports rows atomically and rejects reused references with changed values.',
      },
      bankMatch: {
        summary: 'Reconcile a receipt',
        description:
          'Allocates amountCents to the payment and amountCents minus feeCents to the bank credit. The fee must be less than the allocated amount. Use a stable UUID v4 key. Creates no payment.',
      },
      bankUnmatch: {
        summary: 'Remove a match',
        description: 'Preserves the previous match and the reason for removing it.',
      },
      integrationStatus: {
        summary: 'List adapter modes',
        description: 'Identifies simulated services and connected providers.',
      },
      integrationOperationList: {
        summary: 'Read external operations',
        description: 'Returns the latest 100 requests and their receipts.',
      },
      integrationOperationCreate: {
        summary: 'Submit an external request',
        description:
          'Records the request and calls its adapter with an idempotency key. A simulation performs no external operation.',
      },
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
      quoteLinkState: {
        summary: 'Read signature link state',
        description:
          'Returns the current link identifier and expiration without revealing its token.',
      },
      quoteLinkReplace: {
        summary: 'Replace a signature link',
        description:
          'Revokes the expected link and creates a new link for the same unsigned sent quote.',
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
      invoicePaymentExport: {
        summary: 'Export payments',
        description:
          'Exports payments received between from and to inclusive as UTF-8 CSV. Limited to 10,000 rows without silent truncation.',
      },
      invoicePaymentCancel: {
        summary: 'Cancel a payment entry',
        description:
          'Keeps the payment and correction reason. Restores the outstanding balance without changing the issued document or making a refund.',
      },
      invoicePaymentCreate: {
        summary: 'Record a payment',
        description:
          'Records a partial or full payment. Reuse requestId with unchanged values after a network error. The balance cannot become negative.',
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
        summary: 'Renew the session',
        description:
          'Renews the session and its cookies. The response contains the access mode and expiration, without a secret token.',
      },
      currentAccount: {
        summary: 'Get current account',
        description: 'Returns the authenticated account.',
      },
      accountSessionList: {
        summary: 'List active sessions',
        description:
          'Lists active session families owned by the signed-in account, without tokens or hashes.',
      },
      accountSessionRevoke: {
        summary: 'Close another session',
        description:
          'Revokes a session family owned by the signed-in account. The current session uses the standard sign-out action.',
      },
      passwordChange: {
        summary: 'Change password',
        description:
          'Verifies the current password and revokes all sessions in the password change transaction. Requires a browser session.',
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
