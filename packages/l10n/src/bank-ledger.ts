export const ledgerText = {
  fr: {
    'ledger.bankDate': 'Date bancaire',
    'ledger.postingDate': 'Date comptable',
    'ledger.title': 'Écritures des débits et commissions',
    'ledger.loadError':
      'Impossible de charger les écritures ou leurs sources. Rechargez ces données avant de continuer.',
    'ledger.postUnconfirmed':
      'La comptabilisation reste à confirmer. Reprenez la même demande sans modifier ses valeurs.',
    'ledger.reverseUnconfirmed':
      'La contrepassation reste à confirmer. Reprenez la même demande sans modifier ses valeurs.',
    'ledger.hint':
      'Choisissez les comptes comptables avec votre comptable. Chaque écriture porte le même montant au débit et au crédit. Aucune TVA n’est déduite et aucun transfert n’est exécuté.',
    'ledger.from': 'Date de début',
    'ledger.to': 'Date de fin',
    'ledger.load': 'Charger la période',
    'ledger.export': 'Exporter les écritures en CSV',
    'ledger.loading': 'Chargement des écritures…',
    'ledger.post': 'Comptabiliser',
    'ledger.debitAccount': 'Compte à débiter',
    'ledger.creditAccount': 'Compte à créditer',
    'ledger.label': 'Libellé',
    'ledger.close': 'Fermer le formulaire',
    'ledger.reverse': 'Contrepasser',
    'ledger.reason': 'Motif de contrepassation',
    'ledger.date': 'Date de contrepassation',
    'ledger.sources': 'Débits et commissions de la période',
    'ledger.entries': 'Écritures de la période',
    'ledger.fee': 'Commission déduite',
    'ledger.debit': 'Débit bancaire',
    'ledger.posted': 'Écriture active :',
    'ledger.select': 'Préparer une écriture',
    'ledger.empty': 'Aucun élément dans cette période.',
    'ledger.entryId': 'Écriture :',
    'ledger.actor': 'Enregistrée par :',
    'ledger.reverses': 'Contrepasse :',
    'ledger.reversed': 'Contrepassée par :',
    'ledger.saved': 'Écriture enregistrée.',
    'ledger.error':
      'Le résultat de cette demande reste à confirmer. Consultez les écritures avant de recommencer.',
    'ledger.conflict':
      'Opération refusée. Vérifiez les comptes, les dates et l’état de la source. Si la période contient plus de 10 000 éléments, réduisez-la.',
    'ledger.confirmPost':
      'Comptabiliser {amount} au débit du compte {debit} et au crédit du compte {credit} ? La correction exigera une contrepassation.',
    'ledger.confirmReverse':
      'Créer une écriture inverse définitive ? L’écriture initiale sera conservée. Aucun fonds ne sera transféré.',
  },
  en: {
    'ledger.bankDate': 'Bank date',
    'ledger.postingDate': 'Posting date',
    'ledger.title': 'Debit and fee entries',
    'ledger.loadError':
      'Unable to load entries or their sources. Reload this data before continuing.',
    'ledger.postUnconfirmed':
      'Posting the entry is unconfirmed. Resume the same request without changing its values.',
    'ledger.reverseUnconfirmed':
      'Reversing the entry is unconfirmed. Resume the same request without changing its values.',
    'ledger.hint':
      'Choose ledger accounts with your accountant. Each entry debits and credits the same amount. No VAT is deducted and no transfer is executed.',
    'ledger.from': 'Start date',
    'ledger.to': 'End date',
    'ledger.load': 'Load period',
    'ledger.export': 'Export entries as CSV',
    'ledger.loading': 'Loading entries…',
    'ledger.post': 'Post entry',
    'ledger.debitAccount': 'Account to debit',
    'ledger.creditAccount': 'Account to credit',
    'ledger.label': 'Label',
    'ledger.close': 'Close form',
    'ledger.reverse': 'Reverse entry',
    'ledger.reason': 'Reversal reason',
    'ledger.date': 'Reversal date',
    'ledger.sources': 'Debits and fees in the period',
    'ledger.entries': 'Entries in the period',
    'ledger.fee': 'Deducted fee',
    'ledger.debit': 'Bank debit',
    'ledger.posted': 'Active entry:',
    'ledger.select': 'Prepare an entry',
    'ledger.empty': 'No items in this period.',
    'ledger.entryId': 'Entry:',
    'ledger.actor': 'Recorded by:',
    'ledger.reverses': 'Reverses:',
    'ledger.reversed': 'Reversed by:',
    'ledger.saved': 'Entry recorded.',
    'ledger.error':
      'The result of this request is unconfirmed. Check the entries before trying again.',
    'ledger.conflict':
      'Operation rejected. Check accounts, dates and source status. If the period contains more than 10,000 items, reduce it.',
    'ledger.confirmPost':
      'Post {amount} to debit account {debit} and credit account {credit}? Corrections will require a reversal.',
    'ledger.confirmReverse':
      'Create a final reverse entry? The original entry will be kept. No funds will be transferred.',
  },
} as const;

export const ledgerDocumentation = {
  fr: {
    group: {
      title: 'Écritures bancaires',
      description:
        'Écritures équilibrées des débits importés et commissions déduites. Correction par contrepassation, sans transfert ni calcul de TVA.',
    },
    operations: {
      bankLedgerList: {
        summary: 'Consulter les écritures et leurs sources',
        description:
          'Filtre les dates comptables inclusivement. Refuse une période dépassant 10 000 écritures ou sources. Les commissions exigent une affectation et un encaissement actifs.',
      },
      bankLedgerPost: {
        summary: 'Comptabiliser un débit ou une commission',
        description:
          'Reprend le montant et la date de la source. Exige deux comptes distincts. Une source possède au plus une écriture non contrepassée. La clé UUID protège les reprises.',
      },
      bankLedgerReverse: {
        summary: 'Contrepasser une écriture',
        description:
          'Crée une écriture immuable avec les comptes inversés. Conserve le motif, l’auteur et la date. Refuse une date future ou antérieure à l’écriture initiale.',
      },
      bankLedgerExport: {
        summary: 'Exporter le journal bancaire en CSV',
        description:
          'Produit deux lignes équilibrées par écriture, contrepassations comprises. Le CSV utilise EUR et des montants décimaux exacts. Ce fichier ne constitue pas un FEC.',
      },
    },
  },
  en: {
    group: {
      title: 'Bank ledger entries',
      description:
        'Balanced entries for imported debits and deducted fees. Corrections use reversals, without transfers or VAT calculations.',
    },
    operations: {
      bankLedgerList: {
        summary: 'List entries and sources',
        description:
          'Filters inclusive accounting dates. Rejects periods with more than 10,000 entries or sources. Fees require active allocations and receipts.',
      },
      bankLedgerPost: {
        summary: 'Post a debit or fee',
        description:
          'Copies the source amount and date. Requires two different accounts. Each source has at most one unreversed entry. A UUID key protects retries.',
      },
      bankLedgerReverse: {
        summary: 'Reverse an entry',
        description:
          'Creates an immutable entry with inverted accounts. Preserves the reason, actor and date. Rejects future dates and dates before the original entry.',
      },
      bankLedgerExport: {
        summary: 'Export the bank journal as CSV',
        description:
          'Produces two balanced rows per entry, including reversals. Uses EUR and exact decimal amounts. This file is not a French FEC.',
      },
    },
  },
} as const;
