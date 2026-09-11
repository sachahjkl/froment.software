export const reminderText = {
  fr: {
    'reminder.title': 'Relances programmées',
    'reminder.loadError':
      'Impossible de charger les relances. Rechargez la liste pour vérifier les demandes enregistrées.',
    'reminder.scheduleUnconfirmed':
      'L’enregistrement de la relance reste à confirmer. Conservez la demande en cours. Reprenez cette même demande.',
    'reminder.cancelUnconfirmed':
      'L’annulation de la relance reste à confirmer. Actualisez les relances pour vérifier son état.',
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
      'Le résultat de la demande concernant cette relance reste à confirmer. Vérifiez son suivi avant de recommencer.',
    'reminder.conflict':
      'Cet identifiant correspond à une autre demande. Le résultat de votre demande reste inconnu. Conservez la demande d’origine.',
    'reminder.rejected': 'Le serveur a refusé cette programmation avant sa création.',
    'reminder.rejected.invoice-ineligible':
      'Aucune relance créée : la facture n’est plus éligible. Actualisez les factures et choisissez une facture non soldée.',
    'reminder.rejected.invoice-changed':
      'Aucune relance créée : la version de la facture a changé. Actualisez les factures avant de recommencer.',
    'reminder.rejected.recipient-invalid':
      'Aucune relance créée : l’adresse du client est invalide. Corrigez cette adresse avant de recommencer.',
    'reminder.rejected.mode-changed':
      'Aucune relance créée : le mode du fournisseur a changé. Actualisez les accès avant de recommencer.',
    'reminder.rejected.date-invalid':
      'Aucune relance créée : choisissez une date future dans les 366 jours.',
    'reminder.rejected.already-scheduled':
      'Aucune relance créée : cette facture possède déjà une relance programmée. Consultez les relances existantes.',
    'reminder.rejected.limit':
      'Aucune relance créée : la limite de 100 programmations actives est atteinte.',
    'reminder.not_found': 'Cette relance n’existe pas.',
  },
  en: {
    'reminder.title': 'Scheduled reminders',
    'reminder.loadError': 'Unable to load reminders. Reload the list to check recorded requests.',
    'reminder.scheduleUnconfirmed':
      'Reminder scheduling is unconfirmed. Keep the current request. Resume that same request.',
    'reminder.cancelUnconfirmed':
      'Reminder cancellation is unconfirmed. Refresh reminders to check its status.',
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
    'reminder.error':
      'The result of this reminder request is unconfirmed. Check its status before trying again.',
    'reminder.conflict':
      'This identifier belongs to another request. Your request result remains unknown. Keep the original request.',
    'reminder.rejected': 'The server rejected this schedule before creating it.',
    'reminder.rejected.invoice-ineligible':
      'No reminder created: the invoice is no longer eligible. Refresh the invoices and select an unpaid invoice.',
    'reminder.rejected.invoice-changed':
      'No reminder created: the invoice version changed. Refresh the invoices before trying again.',
    'reminder.rejected.recipient-invalid':
      'No reminder created: the client address is invalid. Correct the address before trying again.',
    'reminder.rejected.mode-changed':
      'No reminder created: the provider mode changed. Refresh access before trying again.',
    'reminder.rejected.date-invalid': 'No reminder created: select a future time within 366 days.',
    'reminder.rejected.already-scheduled':
      'No reminder created: this invoice already has a scheduled reminder. Check the existing reminders.',
    'reminder.rejected.limit':
      'No reminder created: the limit of 100 active schedules has been reached.',
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
