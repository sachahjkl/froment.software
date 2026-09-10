export const workspaceApiDocumentation = {
  fr: {
    invoiceReceiptList: {
      summary: 'Lister les encaissements enregistrés',
      description:
        'Retourne les encaissements actifs et annulés avec leur facture et leur client. Inclut la date, l’auteur et le motif des corrections. Cette lecture ne crée aucun encaissement. Les paiements de test Stripe sont exclus. La limite est de 10 000 lignes. Au-delà, retourne 413 avec invoice.workspace_limit, sans résultat partiel.',
    },
    creditNoteList: {
      summary: 'Lister les avoirs émis',
      description:
        'Retourne les avoirs persistés avec leur facture, leur commande et leur client. Les montants proviennent de l’avoir immuable. Cette lecture ne modifie aucun document. La limite est de 10 000 lignes. Au-delà, retourne 413 avec invoice.workspace_limit, sans résultat partiel.',
    },
    invoiceRefundList: {
      summary: 'Lister les remboursements enregistrés',
      description:
        'Retourne les saisies actives et annulées avec leur facture et leur client. Une saisie locale ne prouve aucun virement bancaire. Cette lecture ne déclenche aucun remboursement. La limite est de 10 000 lignes. Au-delà, retourne 413 avec invoice.workspace_limit, sans résultat partiel.',
    },
    invoiceHistory: {
      summary: 'Lire l’historique d’une facture',
      description:
        'Retourne les événements persistés de la facture et de ses documents, par date décroissante. Exige aussi audit.read. Aucun événement n’est déduit du statut actuel. Une facture absente produit une réponse 404. La limite est de 10 000 événements, documents compris. Au-delà, retourne 413 avec invoice.workspace_limit, sans résultat partiel.',
    },
    bankTransactionGet: {
      summary: 'Consulter une opération bancaire',
      description:
        'Retourne une opération importée avec ses affectations et ses montants restants. La lecture par identifiant ne dépend pas de la limite de la liste. Elle ne contacte aucune banque.',
    },
    bankImportPreview: {
      summary: 'Valider un relevé avant import',
      description:
        'Valide le compte et toutes les lignes CSV avec le parseur utilisé par l’import. Distingue les opérations nouvelles des opérations déjà présentes. Ne persiste aucune ligne. La confirmation revalide le relevé dans la transaction d’import.',
    },
    bankLedgerEntryGet: {
      summary: 'Consulter une écriture bancaire',
      description:
        'Retourne une écriture persistée par identifiant, indépendamment de la période du journal. Inclut la référence de sa source et ses lignes comptables. Ne crée aucune écriture ni contrepassation.',
    },
    bankLedgerSourceGet: {
      summary: 'Consulter une source à comptabiliser',
      description:
        'Retourne le contexte d’un débit bancaire ou d’une commission de rapprochement. La comptabilisation reste une action distincte et explicite. Ce journal local ne constitue pas une comptabilité générale.',
    },
  },
  en: {
    invoiceReceiptList: {
      summary: 'List recorded receipts',
      description:
        'Returns active and cancelled receipts with their invoice and client. Includes the date, actor and reason for corrections. This read creates no receipt. Stripe test payments are excluded. The limit is 10,000 rows. Larger results return 413 with invoice.workspace_limit and no partial result.',
    },
    creditNoteList: {
      summary: 'List issued credit notes',
      description:
        'Returns persisted credit notes with their invoice, order and client. Amounts come from the immutable credit note. This read changes no document. The limit is 10,000 rows. Larger results return 413 with invoice.workspace_limit and no partial result.',
    },
    invoiceRefundList: {
      summary: 'List recorded refunds',
      description:
        'Returns active and cancelled records with their invoice and client. A local record does not prove a bank transfer. This read initiates no refund. The limit is 10,000 rows. Larger results return 413 with invoice.workspace_limit and no partial result.',
    },
    invoiceHistory: {
      summary: 'Read invoice history',
      description:
        'Returns persisted invoice and document events in descending date order. Also requires audit.read. No event is inferred from the current status. A missing invoice returns 404. The limit is 10,000 events, including document events. Larger results return 413 with invoice.workspace_limit and no partial result.',
    },
    bankTransactionGet: {
      summary: 'Read a bank transaction',
      description:
        'Returns an imported transaction with its allocations and remaining amounts. Access by identifier does not depend on the list limit. This read contacts no bank.',
    },
    bankImportPreview: {
      summary: 'Validate a statement before import',
      description:
        'Validates the account and all CSV rows with the import parser. Separates new transactions from existing transactions. Persists no row. Confirmation validates the statement again within the import transaction.',
    },
    bankLedgerEntryGet: {
      summary: 'Read a bank ledger entry',
      description:
        'Returns a persisted entry by identifier, independently of the journal period. Includes its source reference and accounting lines. Creates no entry or reversal.',
    },
    bankLedgerSourceGet: {
      summary: 'Read a source to post',
      description:
        'Returns the context of a bank debit or reconciliation fee. Posting remains a separate, explicit action. This local journal is not general accounting.',
    },
  },
} as const;
