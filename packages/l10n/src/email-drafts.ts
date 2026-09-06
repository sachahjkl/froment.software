export const emailDraftText = {
  fr: {
    'emailDraft.title': 'Brouillons enregistrés',
    'emailDraft.save': 'Enregistrer le brouillon',
    'emailDraft.new': 'Nouveau courriel',
    'emailDraft.open': 'Ouvrir',
    'emailDraft.archive': 'Archiver',
    'emailDraft.saved': 'Brouillon enregistré sur le serveur.',
    'emailDraft.hint':
      'Les brouillons peuvent être incomplets. Leur enregistrement ne soumet aucun courriel. Ils restent privés jusqu’à leur soumission.',
    'emailDraft.empty': 'Aucun brouillon enregistré.',
    'emailDraft.unnamed': 'Sans objet',
    'emailDraft.archiveConfirm':
      'Archiver ce brouillon et abandonner ses modifications locales éventuelles ? Aucun courriel ne sera soumis.',
    'emailDraft.error':
      'L’opération sur le brouillon a échoué. Votre texte reste dans le formulaire.',
    'email_draft.conflict':
      'Ce brouillon a changé, a été soumis ou la limite de 100 brouillons est atteinte. Rechargez la liste avant de continuer.',
    'email_draft.not_found': 'Ce brouillon n’est pas accessible à votre compte.',
  },
  en: {
    'emailDraft.title': 'Saved drafts',
    'emailDraft.save': 'Save draft',
    'emailDraft.new': 'New email',
    'emailDraft.open': 'Open',
    'emailDraft.archive': 'Archive',
    'emailDraft.saved': 'Draft saved on the server.',
    'emailDraft.hint':
      'Drafts can be incomplete. Saving a draft submits no email. Drafts remain private until submission.',
    'emailDraft.empty': 'No saved drafts.',
    'emailDraft.unnamed': 'No subject',
    'emailDraft.archiveConfirm':
      'Archive this draft and discard any local changes? No email will be submitted.',
    'emailDraft.error': 'The draft operation failed. Your text remains in the form.',
    'email_draft.conflict':
      'This draft changed, was submitted, or the limit of 100 drafts was reached. Reload the list before continuing.',
    'email_draft.not_found': 'This draft is not available to your account.',
  },
};
export const emailDraftDocumentation = {
  fr: {
    group: {
      title: 'Brouillons de courriels',
      description: 'Brouillons privés, persistants et versionnés.',
    },
    operations: {
      emailDraftList: {
        summary: 'Lister ses brouillons',
        description:
          'Retourne les brouillons non archivés et non soumis du compte connecté. Les demandes soumises restent dans l’historique des opérations.',
      },
      emailDraftSave: {
        summary: 'Enregistrer un brouillon',
        description:
          'Accepte un contenu incomplet. Utilisez un UUID v4 stable comme identifiant. La version attendue vaut zéro à la création. Une soumission commencée bloque toute modification.',
      },
      emailDraftArchive: {
        summary: 'Archiver un brouillon',
        description:
          'Vérifie le propriétaire et la version. Conserve le texte et l’historique. N’annule pas une opération déjà soumise.',
      },
    },
  },
  en: {
    group: { title: 'Email drafts', description: 'Private, persistent and versioned drafts.' },
    operations: {
      emailDraftList: {
        summary: 'List your drafts',
        description:
          'Returns the current account’s unarchived and unsubmitted drafts. Submitted requests remain in operation history.',
      },
      emailDraftSave: {
        summary: 'Save a draft',
        description:
          'Accepts incomplete content. Use a stable UUID v4 identifier. Expected version is zero on creation. A started submission blocks all further edits.',
      },
      emailDraftArchive: {
        summary: 'Archive a draft',
        description:
          'Checks ownership and version. Retains content and history. Does not cancel an operation that was already submitted.',
      },
    },
  },
};
