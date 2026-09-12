export const supplierInvoiceDocumentation = {
  fr: {
    group: {
      title: 'Factures fournisseurs',
      description: 'Saisie, confirmation et approbation des factures fournisseurs.',
    },
    operations: {
      supplierInvoiceList: {
        summary: 'Lister les factures fournisseurs',
        description: 'Retourne toutes les factures fournisseurs et leurs lignes.',
      },
      supplierInvoiceGet: {
        summary: 'Lire une facture fournisseur',
        description: 'Retourne une facture fournisseur et ses lignes.',
      },
      supplierInvoiceCreate: {
        summary: 'Créer une facture fournisseur',
        description: 'Crée un brouillon manuel ou issu d’une analyse OCR.',
      },
      supplierInvoiceUpdate: {
        summary: 'Modifier une facture fournisseur',
        description: 'Modifie un brouillon avec contrôle de version.',
      },
      supplierInvoiceConfirm: {
        summary: 'Confirmer une facture fournisseur',
        description: 'Fige les données contrôlées du brouillon.',
      },
      supplierInvoiceApprove: {
        summary: 'Approuver une facture fournisseur',
        description: 'Approuve une facture confirmée pour son paiement.',
      },
      supplierInvoiceCancel: {
        summary: 'Annuler une facture fournisseur',
        description: 'Annule un brouillon ou une facture confirmée.',
      },
    },
  },
  en: {
    group: {
      title: 'Supplier invoices',
      description: 'Entry, confirmation, and approval of supplier invoices.',
    },
    operations: {
      supplierInvoiceList: {
        summary: 'List supplier invoices',
        description: 'Returns all supplier invoices and their lines.',
      },
      supplierInvoiceGet: {
        summary: 'Get a supplier invoice',
        description: 'Returns one supplier invoice and its lines.',
      },
      supplierInvoiceCreate: {
        summary: 'Create a supplier invoice',
        description: 'Creates a manual or OCR analysis draft.',
      },
      supplierInvoiceUpdate: {
        summary: 'Update a supplier invoice',
        description: 'Updates a draft with a version check.',
      },
      supplierInvoiceConfirm: {
        summary: 'Confirm a supplier invoice',
        description: 'Freezes the reviewed draft data.',
      },
      supplierInvoiceApprove: {
        summary: 'Approve a supplier invoice',
        description: 'Approves a confirmed invoice for payment.',
      },
      supplierInvoiceCancel: {
        summary: 'Cancel a supplier invoice',
        description: 'Cancels a draft or confirmed invoice.',
      },
    },
  },
} as const;
