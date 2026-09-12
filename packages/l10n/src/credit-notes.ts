export const creditText = {
  fr: {
    'credit.title': 'Avoir et remboursements',
    'credit.loadError':
      'Impossible de charger l’avoir et les remboursements. Rechargez ces données avant de continuer.',
    'credit.noTransfer':
      'Ces opérations enregistrent des faits locaux. Aucun virement ni remboursement bancaire n’est exécuté.',
    'credit.saved': 'Opération enregistrée.',
    'credit.reload': 'Recharger l’avoir et les remboursements',
    'credit.pdf': 'Télécharger le PDF de l’avoir',
    'credit.refunds': 'Remboursements enregistrés',
    'credit.refundable': 'Encaissements restant à rembourser :',
    'credit.amount': 'Montant remboursé (EUR)',
    'credit.refundedOn': 'Date du remboursement effectué',
    'credit.reference': 'Référence du remboursement',
    'credit.recordRefund': 'Enregistrer le remboursement effectué',
    'credit.allocate': 'Imputer sur une facture',
    'credit.allocations': 'Imputations',
    'credit.targetInvoice': 'Facture cible',
    'credit.allocatedOn': 'Date d’imputation',
    'credit.cancelReason': 'Motif de correction du remboursement',
    'credit.cancelled': 'Enregistrement annulé :',
    'credit.cancelRefund': 'Corriger cet enregistrement',
    'credit.cancelAllocation': 'Annuler l’imputation',
    'credit.cancelAllocationHint':
      'L’annulation restaure la dette client et le solde de la facture cible.',
    'credit.fullHint':
      'L’avoir intégral reprend les lignes et la TVA de la facture émise. Il annule toute sa créance sans modifier la facture ni son PDF.',
    'credit.reason': 'Motif de l’avoir',
    'credit.issue': 'Émettre l’avoir intégral',
    'credit.create': 'Émettre un avoir',
    'credit.options': 'Choisir le type d’avoir',
    'credit.partial': 'Avoir partiel',
    'credit.full': 'Avoir intégral',
    'credit.draftHint':
      'Sélectionnez les quantités à créditer. Enregistrez le brouillon ou émettez ensuite l’avoir définitif.',
    'credit.details': 'Détails de l’avoir',
    'credit.lines': 'Lignes créditées',
    'credit.linesHint':
      'Une quantité nulle exclut la ligne. Les quantités déjà créditées ne sont plus disponibles.',
    'credit.quantityFor': 'Quantité créditée pour {description}',
    'credit.availableQuantity': 'Disponible : {quantity}',
    'credit.noAvailableLines': 'Aucune ligne ne reste disponible pour un avoir.',
    'credit.addInvoice': 'Ajouter une facture du même client',
    'credit.selectInvoice': 'Sélectionnez une facture',
    'credit.add': 'Ajouter',
    'credit.removeInvoice': 'Retirer la facture',
    'credit.saveDraft': 'Enregistrer le brouillon',
    'credit.issueDraft': 'Émettre l’avoir',
    'credit.editDraft': 'Modifier le brouillon d’avoir',
    'credit.draft': 'Brouillon',
    'credit.issued': 'Émis',
    'credit.readonlyVersion': 'Cette version est figée et disponible uniquement en lecture.',
    'credit.credited': 'Montant couvert par un avoir :',
    'credit.confirmIssue':
      'Émettre cet avoir définitif ? Les factures et leurs règlements seront conservés. Aucun remboursement ne sera exécuté.',
    'credit.confirmRefund':
      'Enregistrer un remboursement déjà effectué ? Cette action ne transfère aucun fonds.',
    'credit.confirmCancel':
      'Annuler cet enregistrement erroné ? Le motif sera conservé. Cette action ne récupère aucun fonds.',
    'credit.error':
      'Le résultat de cette demande reste à confirmer. Consultez l’avoir et les remboursements avant de recommencer.',
    'invoice.credit_conflict':
      'Opération refusée. Vérifiez la facture, l’avoir existant, les encaissements disponibles, la date et la clé de la demande.',
    'invoice.credit_request_conflict':
      'Cette demande correspond à une opération déjà enregistrée avec d’autres données. Vérifiez l’avoir et les remboursements existants.',
  },
  en: {
    'credit.title': 'Credit note and refunds',
    'credit.loadError':
      'Unable to load the credit note and refunds. Reload this data before continuing.',
    'credit.noTransfer':
      'These operations record local facts. No bank transfer or refund is executed.',
    'credit.saved': 'Operation recorded.',
    'credit.reload': 'Reload the credit note and refunds',
    'credit.pdf': 'Download credit note PDF',
    'credit.refunds': 'Recorded refunds',
    'credit.refundable': 'Receipts still available for refund:',
    'credit.amount': 'Refunded amount (EUR)',
    'credit.refundedOn': 'Date of the completed refund',
    'credit.reference': 'Refund reference',
    'credit.recordRefund': 'Record completed refund',
    'credit.allocate': 'Allocate to an invoice',
    'credit.allocations': 'Allocations',
    'credit.targetInvoice': 'Target invoice',
    'credit.allocatedOn': 'Allocation date',
    'credit.cancelReason': 'Reason for correcting the refund',
    'credit.cancelled': 'Record cancelled:',
    'credit.cancelRefund': 'Correct this record',
    'credit.cancelAllocation': 'Cancel allocation',
    'credit.cancelAllocationHint':
      'Cancellation restores the customer debt and the target invoice balance.',
    'credit.fullHint':
      'The full credit note copies the issued invoice lines and VAT. It cancels the entire debt without changing the invoice or its PDF.',
    'credit.reason': 'Credit note reason',
    'credit.issue': 'Issue full credit note',
    'credit.create': 'Issue a credit note',
    'credit.options': 'Select the credit note type',
    'credit.partial': 'Partial credit note',
    'credit.full': 'Full credit note',
    'credit.draftHint':
      'Select the quantities to credit. Save the draft or issue the final credit note.',
    'credit.details': 'Credit note details',
    'credit.lines': 'Credited lines',
    'credit.linesHint':
      'A zero quantity excludes the line. Quantities already credited are unavailable.',
    'credit.quantityFor': 'Credited quantity for {description}',
    'credit.availableQuantity': 'Available: {quantity}',
    'credit.noAvailableLines': 'No line remains available for a credit note.',
    'credit.addInvoice': 'Add an invoice for this client',
    'credit.selectInvoice': 'Select an invoice',
    'credit.add': 'Add',
    'credit.removeInvoice': 'Remove invoice',
    'credit.saveDraft': 'Save draft',
    'credit.issueDraft': 'Issue credit note',
    'credit.editDraft': 'Edit credit note draft',
    'credit.draft': 'Draft',
    'credit.issued': 'Issued',
    'credit.readonlyVersion': 'This version is frozen and available as read-only.',
    'credit.credited': 'Amount covered by a credit note:',
    'credit.confirmIssue':
      'Issue this final credit note? The invoices and payments will be kept. No refund will be executed.',
    'credit.confirmRefund':
      'Record a refund that has already occurred? This action transfers no funds.',
    'credit.confirmCancel':
      'Cancel this incorrect record? The reason will be kept. This action recovers no funds.',
    'credit.error':
      'The result of this request is unconfirmed. Check the credit note and refunds before trying again.',
    'invoice.credit_conflict':
      'Operation rejected. Check the invoice, existing credit note, available receipts, date and request key.',
    'invoice.credit_request_conflict':
      'This request refers to an operation already recorded with different data. Check the existing credit note and refunds.',
  },
} as const;
export const creditDocumentation = {
  fr: {
    group: {
      title: 'Avoirs et remboursements',
      description:
        'Brouillons d’avoirs partiels ou consolidés, émission immuable et enregistrement local des remboursements.',
    },
    operations: {
      invoiceCreditsGet: {
        summary: 'Consulter l’avoir et les remboursements',
        description:
          'Retourne l’avoir intégral, les remboursements conservés et le montant encore remboursable sur les encaissements actifs.',
      },
      creditNoteGet: {
        summary: 'Consulter un avoir',
        description: 'Retourne un brouillon modifiable ou un avoir émis immuable avec ses lignes.',
      },
      creditNoteCreate: {
        summary: 'Créer un brouillon d’avoir',
        description:
          'Crée un avoir partiel ou consolidé pour les factures compatibles sélectionnées.',
      },
      creditNoteUpdate: {
        summary: 'Modifier un brouillon d’avoir',
        description: 'Remplace le motif et les lignes d’un brouillon avec contrôle de version.',
      },
      creditNoteIssue: {
        summary: 'Émettre un avoir',
        description: 'Fige les lignes du brouillon et attribue une référence AV-AAAA-NNNNNN.',
      },
      invoiceRefundRecord: {
        summary: 'Enregistrer un remboursement effectué',
        description:
          'Enregistre un fait local sans opération bancaire. Exige un avoir et des encaissements disponibles. Refuse les dates futures et antérieures à l’avoir.',
      },
      invoiceRefundCancel: {
        summary: 'Corriger un remboursement enregistré',
        description:
          'Annule l’enregistrement avec un motif conservé. Ne récupère aucun fonds et ne modifie pas l’avoir.',
      },
      invoiceCreditPdf: {
        summary: 'Télécharger l’avoir',
        description:
          'Génère le PDF au premier accès depuis les données immuables. Conserve ensuite le PDF et contrôle son empreinte SHA-256.',
      },
      clientCreditPdf: {
        summary: 'Télécharger son avoir',
        description:
          'Exige une session cliente autorisée et une facture appartenant au client associé au compte.',
      },
    },
  },
  en: {
    group: {
      title: 'Credit notes and refunds',
      description:
        'Partial or consolidated credit note drafts, immutable issue, and local refund records.',
    },
    operations: {
      invoiceCreditsGet: {
        summary: 'Read the credit note and refunds',
        description:
          'Returns the full credit note, preserved refunds and the amount still available for refund from active receipts.',
      },
      creditNoteGet: {
        summary: 'Read a credit note',
        description: 'Returns an editable draft or an immutable issued credit note with its lines.',
      },
      creditNoteCreate: {
        summary: 'Create a credit note draft',
        description:
          'Creates a partial or consolidated credit note for selected compatible invoices.',
      },
      creditNoteUpdate: {
        summary: 'Update a credit note draft',
        description: 'Replaces the reason and lines of a draft with version control.',
      },
      creditNoteIssue: {
        summary: 'Issue a credit note',
        description: 'Freezes the draft lines and assigns an AV-YYYY-NNNNNN reference.',
      },
      invoiceRefundRecord: {
        summary: 'Record a completed refund',
        description:
          'Records a local fact without a bank operation. Requires a credit note and available receipts. Rejects future dates and dates before the credit note.',
      },
      invoiceRefundCancel: {
        summary: 'Correct a recorded refund',
        description:
          'Cancels the record with a preserved reason. Recovers no funds and does not change the credit note.',
      },
      invoiceCreditPdf: {
        summary: 'Download the credit note',
        description:
          'Generates the PDF on first access from immutable data. Then preserves the PDF and checks its SHA-256 digest.',
      },
      clientCreditPdf: {
        summary: 'Download your credit note',
        description:
          'Requires an authorized client session and an invoice owned by the client linked to the account.',
      },
    },
  },
} as const;
