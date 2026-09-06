const summaries = {
  providerEmailGet: ['Lire l’état du courriel', 'Read email delivery status'],
  providerEmailCancel: ['Annuler le courriel', 'Cancel email'],
  providerEmailEvents: ['Lire les événements du courriel', 'Read email events'],
  providerEmailVerifyWebhook: [
    'Vérifier une notification de courriel',
    'Verify an email notification',
  ],
  providerSignatureGet: ['Lire le dossier de signature', 'Read signature request'],
  providerSignatureCancel: ['Annuler la signature', 'Cancel signature request'],
  providerSignatureRemind: ['Relancer les signataires', 'Remind signers'],
  providerSignatureDocument: ['Récupérer le document signé', 'Retrieve signed document'],
  providerSignatureProof: ['Récupérer la preuve de signature', 'Retrieve signature evidence'],
  providerSignatureEvents: ['Lire les événements de signature', 'Read signature events'],
  providerSignatureVerifyWebhook: [
    'Vérifier une notification de signature',
    'Verify a signature notification',
  ],
  providerPaymentGet: ['Lire le paiement fournisseur', 'Read provider payment'],
  providerPaymentCancel: ['Annuler le paiement fournisseur', 'Cancel provider payment'],
  providerPaymentCapture: ['Capturer le paiement autorisé', 'Capture an authorized payment'],
  providerPaymentRefund: ['Demander un remboursement', 'Request a refund'],
  providerPaymentGetRefund: ['Lire le remboursement', 'Read refund status'],
  providerPaymentEvents: ['Lire les événements de paiement', 'Read payment events'],
  providerPaymentVerifyWebhook: [
    'Vérifier une notification de paiement',
    'Verify a payment notification',
  ],
  providerBankConnect: ['Préparer une connexion bancaire', 'Prepare a bank connection'],
  providerBankConnection: ['Lire la connexion bancaire', 'Read bank connection'],
  providerBankRevoke: ['Révoquer la connexion bancaire', 'Revoke bank connection'],
  providerBankAccounts: ['Lister les comptes bancaires', 'List bank accounts'],
  providerBankTransactions: ['Lister les opérations bancaires', 'List bank transactions'],
  providerBankVerifyWebhook: ['Vérifier une notification bancaire', 'Verify a bank notification'],
  providerElectronicInvoiceGet: [
    'Lire le statut de facturation électronique',
    'Read electronic invoice status',
  ],
  providerElectronicInvoiceCancel: [
    'Annuler la transmission électronique',
    'Cancel electronic invoice submission',
  ],
  providerElectronicInvoiceDownload: [
    'Récupérer la facture électronique',
    'Retrieve electronic invoice',
  ],
  providerElectronicInvoiceInbox: [
    'Lister les factures électroniques reçues',
    'List received electronic invoices',
  ],
  providerElectronicInvoiceReport: [
    'Transmettre un rapport électronique',
    'Submit an electronic report',
  ],
  providerElectronicInvoiceGetReport: [
    'Lire le statut du rapport',
    'Read electronic report status',
  ],
  providerElectronicInvoiceEvents: [
    'Lire les événements de facturation électronique',
    'Read electronic invoice events',
  ],
  providerElectronicInvoiceVerifyWebhook: [
    'Vérifier une notification de facturation électronique',
    'Verify an electronic invoice notification',
  ],
} as const;

const frenchDescription =
  '> [!important]\n> Implémentation actuelle : mock sans effet externe. `executed: false` est obligatoire en mode simulation. `preview` contient un exemple, jamais un résultat réel.\n\nChaque appel est indépendant. Aucun statut métier, règlement ou document local ne change. Les fichiers restent indisponibles et les notifications restent non vérifiées. Les routes de vérification ne sont pas des récepteurs publics de webhooks.';
const englishDescription =
  '> [!important]\n> Current implementation: mock without external effects. Simulation requires `executed: false`. `preview` contains an example, never an actual result.\n\nEach call is independent. No business status, payment, or local document changes. Files remain unavailable and notifications remain unverified. Verification routes are not public webhook receivers.';
export const providerActionDocumentation = {
  fr: Object.fromEntries(
    Object.entries(summaries).map(([name, [summary]]) => [
      name,
      { summary, description: frenchDescription },
    ]),
  ),
  en: Object.fromEntries(
    Object.entries(summaries).map(([name, [, summary]]) => [
      name,
      { summary, description: englishDescription },
    ]),
  ),
};
