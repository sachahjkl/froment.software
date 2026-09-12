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
    'credit.cancelReason': 'Motif de correction du remboursement',
    'credit.cancelled': 'Enregistrement annulé :',
    'credit.cancelRefund': 'Corriger cet enregistrement',
    'credit.fullHint':
      'L’avoir intégral reprend les lignes et la TVA de la facture émise. Il annule toute sa créance sans modifier la facture ni son PDF.',
    'credit.reason': 'Motif de l’avoir intégral',
    'credit.issue': 'Émettre l’avoir intégral',
    'credit.create': 'Émettre un avoir',
    'credit.options': 'Choisir le type d’avoir',
    'credit.partial': 'Avoir partiel',
    'credit.full': 'Avoir intégral',
    'credit.credited': 'Montant couvert par un avoir :',
    'credit.confirmIssue':
      'Émettre un avoir intégral définitif ? La créance sera annulée. La facture et ses règlements seront conservés. Aucun remboursement ne sera exécuté.',
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
    'credit.cancelReason': 'Reason for correcting the refund',
    'credit.cancelled': 'Record cancelled:',
    'credit.cancelRefund': 'Correct this record',
    'credit.fullHint':
      'The full credit note copies the issued invoice lines and VAT. It cancels the entire debt without changing the invoice or its PDF.',
    'credit.reason': 'Reason for the full credit note',
    'credit.issue': 'Issue full credit note',
    'credit.create': 'Issue a credit note',
    'credit.options': 'Select the credit note type',
    'credit.partial': 'Partial credit note',
    'credit.full': 'Full credit note',
    'credit.credited': 'Amount covered by a credit note:',
    'credit.confirmIssue':
      'Issue a final full credit note? The debt will be cancelled. The invoice and payments will be kept. No refund will be executed.',
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
        'Avoirs intégraux immuables et enregistrement local des remboursements. Aucun transfert de fonds.',
    },
    operations: {
      invoiceCreditsGet: {
        summary: 'Consulter l’avoir et les remboursements',
        description:
          'Retourne l’avoir intégral, les remboursements conservés et le montant encore remboursable sur les encaissements actifs.',
      },
      invoiceCreditIssue: {
        summary: 'Émettre un avoir intégral',
        description:
          'Copie les montants HT et TVA de la facture émise dans un avoir numéroté. Préserve la facture, sa version et ses PDF. Une clé UUID stable protège les nouvelles tentatives.',
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
        'Immutable full credit notes and local refund records. No funds are transferred.',
    },
    operations: {
      invoiceCreditsGet: {
        summary: 'Read the credit note and refunds',
        description:
          'Returns the full credit note, preserved refunds and the amount still available for refund from active receipts.',
      },
      invoiceCreditIssue: {
        summary: 'Issue a full credit note',
        description:
          'Copies net amounts and VAT from the issued invoice into a numbered credit note. Preserves the invoice, version and PDFs. A stable UUID key protects retries.',
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
