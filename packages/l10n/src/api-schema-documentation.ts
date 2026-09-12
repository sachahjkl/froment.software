export interface ApiFieldDocumentation {
  readonly description: string;
  readonly examples?: readonly (string | number | boolean)[];
}

export const apiSchemaDocumentation = {
  fr: {
    allowed: 'Valeurs autorisées',
    permissions:
      'Toutes les permissions suivantes sont requises. Ces permissions applicatives ne sont pas des scopes OAuth.',
    fields: {
      requestId: {
        description:
          'UUID v4 créé pour cette demande. Réutilisez la même clé et le même contenu après une réponse incertaine. Une clé réutilisée avec un contenu différent est refusée.',
        examples: ['8e26a042-4f52-4a6b-8e15-520ccb10a426'],
      },
      expectedVersion: {
        description:
          'Version actuelle du document. Une version périmée provoque un conflit. Rechargez le document avant de préparer une nouvelle modification.',
        examples: [1],
      },
      amountCents: {
        description:
          'Montant entier en centimes, sans virgule flottante. 12500 représente 125,00 EUR. Un débit bancaire est négatif ; un règlement doit être positif.',
        examples: [12500],
      },
      unitPriceCents: {
        description: 'Prix unitaire hors taxe en centimes. 9900 représente 99,00 EUR.',
        examples: [9900],
      },
      quantityMilli: {
        description: 'Quantité en millièmes. 1500 représente 1,5 unité.',
        examples: [1500],
      },
      vatRateBasisPoints: {
        description:
          'Taux de TVA en points de base. 2000 représente 20 %. Le pays ne détermine pas automatiquement le taux.',
        examples: [2000],
      },
      totalCents: {
        description: 'Total toutes taxes comprises en centimes, calculé à partir des lignes.',
      },
      netTotalCents: { description: 'Total hors taxe en centimes, calculé à partir des lignes.' },
      vatTotalCents: { description: 'Total de TVA en centimes, calculé à partir des lignes.' },
      recordedPaidCents: {
        description: 'Somme des règlements actifs enregistrés. Les règlements annulés sont exclus.',
      },
      remainingCents: {
        description:
          'Solde restant en centimes. Une ancienne déclaration de paiement ne crée pas de règlement fictif.',
      },
      paidOn: {
        description: 'Date civile du règlement au format AAAA-MM-JJ. Une date future est refusée.',
        examples: ['2026-09-01'],
      },
      bookedOn: {
        description:
          'Date civile de comptabilisation fournie par le relevé bancaire, sans fuseau horaire.',
        examples: ['2026-09-01'],
      },
      dueDate: {
        description: 'Date civile d’échéance au format AAAA-MM-JJ.',
        examples: ['2026-10-01'],
      },
      expectedMode: {
        description:
          'Mode du fournisseur lors de la préparation. Un changement de mode bloque la demande pour empêcher un envoi réel inattendu.',
      },
      refreshParties: {
        description:
          'Actualiser explicitement les coordonnées émetteur et client lors de la création de cette révision de facture.',
        examples: [false],
      },
      cancelledAt: {
        description: 'Instant UTC de l’annulation, ou null si la saisie reste active.',
      },
      cancellationReason: {
        description: 'Motif conservé avec l’annulation. L’historique reste consultable.',
      },
      matchId: {
        description:
          'Identifiant exact du rapprochement à dissocier. Un ancien identifiant ne permet pas de dissocier un nouveau rapprochement.',
      },
      archived: {
        description:
          'Indique si l’élément est archivé. L’archivage ne modifie pas les documents existants.',
        examples: [false],
      },
      content: {
        description:
          'Contenu CAMT.053, OFX ou CSV UTF-8, limité à 1 000 opérations et 500 000 caractères. Réimporter une référence modifiée refuse tout l’import.',
        examples: [
          'transaction_id,booked_on,amount,currency,description\nBANK-001,2026-09-01,125.00,EUR,Payment',
        ],
      },
    } satisfies Record<string, ApiFieldDocumentation>,
  },
  en: {
    allowed: 'Allowed values',
    permissions:
      'All permissions below are required. These application permissions are not OAuth scopes.',
    fields: {
      requestId: {
        description:
          'UUID v4 created for this request. Reuse the same key and payload after an uncertain response. A key reused with different content is rejected.',
        examples: ['8e26a042-4f52-4a6b-8e15-520ccb10a426'],
      },
      expectedVersion: {
        description:
          'Current document version. A stale version causes a conflict. Reload the document before preparing another change.',
        examples: [1],
      },
      amountCents: {
        description:
          'Integer amount in cents, without floating point. 12500 means EUR 125.00. Bank debits are negative; recorded payments must be positive.',
        examples: [12500],
      },
      unitPriceCents: {
        description: 'Unit price excluding tax, in cents. 9900 means EUR 99.00.',
        examples: [9900],
      },
      quantityMilli: {
        description: 'Quantity in thousandths. 1500 means 1.5 units.',
        examples: [1500],
      },
      vatRateBasisPoints: {
        description:
          'VAT rate in basis points. 2000 means 20%. The country does not automatically determine the rate.',
        examples: [2000],
      },
      totalCents: { description: 'Total including tax, in cents, calculated from the lines.' },
      netTotalCents: { description: 'Total excluding tax, in cents, calculated from the lines.' },
      vatTotalCents: { description: 'VAT total in cents, calculated from the lines.' },
      recordedPaidCents: {
        description: 'Sum of active recorded payments. Cancelled payments are excluded.',
      },
      remainingCents: {
        description:
          'Remaining balance in cents. A historical paid declaration does not create a fictitious payment.',
      },
      paidOn: {
        description: 'Payment calendar date in YYYY-MM-DD format. Future dates are rejected.',
        examples: ['2026-09-01'],
      },
      bookedOn: {
        description: 'Booking calendar date from the bank statement, without a time zone.',
        examples: ['2026-09-01'],
      },
      dueDate: { description: 'Due calendar date in YYYY-MM-DD format.', examples: ['2026-10-01'] },
      expectedMode: {
        description:
          'Provider mode when preparing the request. A mode change blocks the request to prevent an unexpected live submission.',
      },
      refreshParties: {
        description:
          'Explicitly refresh issuer and client details when creating this invoice revision.',
        examples: [false],
      },
      cancelledAt: {
        description: 'UTC cancellation timestamp, or null while the entry remains active.',
      },
      cancellationReason: {
        description: 'Reason retained with the cancellation. The history remains available.',
      },
      matchId: {
        description:
          'Exact identifier of the match to remove. A stale identifier cannot remove a newer match.',
      },
      archived: {
        description: 'Whether the item is archived. Archival does not change existing documents.',
        examples: [false],
      },
      content: {
        description:
          'CAMT.053, OFX, or UTF-8 CSV content limited to 1,000 transactions and 500,000 characters. Reusing a changed reference rejects the complete import.',
        examples: [
          'transaction_id,booked_on,amount,currency,description\nBANK-001,2026-09-01,125.00,EUR,Payment',
        ],
      },
    } satisfies Record<string, ApiFieldDocumentation>,
  },
};
