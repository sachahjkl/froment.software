export const reminderText = {
  fr: {
    'reminder.title': 'Relances programmées',
    'reminder.info':
      'La relance utilise le solde et l’adresse client au moment de sa préparation automatique. Une facture soldée ou annulée ne produit aucun courriel.',
    'reminder.content':
      'La programmation utilise le rappel standard dans la langue actuelle, pas le texte du formulaire. Elle reste indépendante de ce brouillon.',
    'reminder.date': 'Date et heure locales',
    'reminder.schedule': 'Programmer la relance',
    'reminder.confirm':
      'Programmer ce rappel standard ? Le mode affiché restera fixé et le serveur vérifiera la facture au moment prévu.',
    'reminder.saved': 'Relance enregistrée sur le serveur.',
    'reminder.cancel': 'Annuler la programmation',
    'reminder.cancelConfirm': 'Annuler cette relance programmée ?',
    'reminder.empty': 'Aucune relance programmée.',
    'reminder.scheduled': 'Programmée',
    'reminder.cancelled': 'Annulée',
    'reminder.skipped': 'Non soumise',
    'reminder.queued':
      'Préparée : consultez le résultat dans l’historique des courriels et des reprises.',
    'reminder.invoice-ineligible': 'La facture est soldée, annulée ou son client est désactivé.',
    'reminder.recipient-invalid': 'L’adresse actuelle du client est invalide.',
    'reminder.permission-revoked':
      'Le compte initiateur est désactivé ou ses permissions ont changé.',
    'reminder.mode-changed': 'Le mode du fournisseur a changé. Aucun envoi automatique.',
    'reminder.error':
      'Impossible de traiter la programmation. Les données du formulaire restent inchangées.',
    'reminder.conflict':
      'Vérifiez la facture, la date future et le mode. Une seule relance active par facture est autorisée, dans la limite de 100.',
    'reminder.not_found': 'Cette relance n’existe pas.',
  },
  en: {
    'reminder.title': 'Scheduled reminders',
    'reminder.info':
      'The reminder uses the balance and client address at automatic preparation time. A settled or void invoice produces no email.',
    'reminder.content':
      'Scheduling uses the standard reminder in the current language, not the form text. It remains independent of this draft.',
    'reminder.date': 'Local date and time',
    'reminder.schedule': 'Schedule reminder',
    'reminder.confirm':
      'Schedule this standard reminder? The displayed mode remains fixed and the server checks the invoice at the scheduled time.',
    'reminder.saved': 'Reminder saved on the server.',
    'reminder.cancel': 'Cancel schedule',
    'reminder.cancelConfirm': 'Cancel this scheduled reminder?',
    'reminder.empty': 'No scheduled reminders.',
    'reminder.scheduled': 'Scheduled',
    'reminder.cancelled': 'Cancelled',
    'reminder.skipped': 'Not submitted',
    'reminder.queued': 'Prepared: check the email and retry history for the result.',
    'reminder.invoice-ineligible': 'The invoice is settled or void, or its client is disabled.',
    'reminder.recipient-invalid': 'The current client email address is invalid.',
    'reminder.permission-revoked': 'The initiating account is disabled or its permissions changed.',
    'reminder.mode-changed': 'The provider mode changed. No automatic submission.',
    'reminder.error': 'The scheduling operation failed. The form data remains unchanged.',
    'reminder.conflict':
      'Check the invoice, future date, and mode. Only one active reminder per invoice is allowed, with a limit of 100.',
    'reminder.not_found': 'This reminder does not exist.',
  },
};
export const reminderDocumentation = {
  fr: {
    group: {
      title: 'Relances programmées',
      description:
        'Rappels de paiement ponctuels, persistants et annulables avant leur préparation.',
    },
    operations: {
      reminderList: {
        summary: 'Lister les relances programmées',
        description:
          'Retourne 100 relances, avec priorité aux programmations actives. Le résultat externe reste dans l’opération associée.',
      },
      reminderCreate: {
        summary: 'Programmer une relance de facture',
        description:
          'Utilisez un UUID v4 stable. Exige une facture émise avec un solde positif et une date future dans les 366 jours. Le serveur relit le solde et le destinataire à la date prévue.',
      },
      reminderCancel: {
        summary: 'Annuler une relance programmée',
        description:
          'Annule uniquement une relance encore programmée. Une relance déjà préparée possède une opération indépendante qui ne peut pas être annulée par cette route.',
      },
    },
  },
  en: {
    group: {
      title: 'Scheduled reminders',
      description: 'Persistent, one-time payment reminders, cancellable before preparation.',
    },
    operations: {
      reminderList: {
        summary: 'List scheduled reminders',
        description:
          'Returns 100 reminders, with active schedules first. The linked operation contains the external result.',
      },
      reminderCreate: {
        summary: 'Schedule an invoice reminder',
        description:
          'Use a stable UUID v4. Requires an issued invoice with a positive balance and a future time within 366 days. The server reads the balance and recipient again at the scheduled time.',
      },
      reminderCancel: {
        summary: 'Cancel a scheduled reminder',
        description:
          'Cancels only a reminder that is still scheduled. A prepared reminder has an independent operation that this route cannot cancel.',
      },
    },
  },
};
