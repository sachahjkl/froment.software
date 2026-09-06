export const emailTemplateText = {
  fr: {
    'emailTemplate.title': 'Modèles de courriels',
    'emailTemplate.hint':
      'Les modèles partagent uniquement l’objet et le texte entre les comptes autorisés. Leur utilisation conserve le destinataire et la référence du formulaire.',
    'emailTemplate.save': 'Créer un modèle avec ce texte',
    'emailTemplate.update': 'Mettre à jour le modèle ouvert',
    'emailTemplate.use': 'Utiliser ce modèle',
    'emailTemplate.empty': 'Aucun modèle enregistré.',
    'emailTemplate.saved': 'Modèle enregistré. Le courriel du formulaire n’a pas été soumis.',
    'emailTemplate.applied':
      'Texte du modèle copié. Vérifiez le destinataire, la référence et le contenu avant de soumettre le courriel.',
    'emailTemplate.archiveConfirm':
      'Archiver ce modèle partagé ? Les courriels et brouillons existants restent inchangés.',
    'emailTemplate.updateConfirm': 'Remplacer le texte du modèle partagé par celui du formulaire ?',
    'emailTemplate.error':
      'L’opération sur le modèle a échoué. Le texte du formulaire est conservé.',
    'email_template.conflict':
      'Ce modèle a changé, a été archivé ou la limite de 100 modèles est atteinte. Rechargez la liste.',
    'email_template.not_found': 'Ce modèle n’existe pas.',
  },
  en: {
    'emailTemplate.title': 'Email templates',
    'emailTemplate.hint':
      'Templates share only the subject and body between authorized accounts. Using a template preserves the form’s recipient and reference.',
    'emailTemplate.save': 'Create a template from this text',
    'emailTemplate.update': 'Update the open template',
    'emailTemplate.use': 'Use this template',
    'emailTemplate.empty': 'No saved templates.',
    'emailTemplate.saved': 'Template saved. The email in the form was not submitted.',
    'emailTemplate.applied':
      'Template text copied. Check the recipient, reference, and content before submitting the email.',
    'emailTemplate.archiveConfirm':
      'Archive this shared template? Existing emails and drafts remain unchanged.',
    'emailTemplate.updateConfirm': 'Replace the shared template text with the form text?',
    'emailTemplate.error': 'The template operation failed. The form text is preserved.',
    'email_template.conflict':
      'This template changed, was archived, or the limit of 100 templates was reached. Reload the list.',
    'email_template.not_found': 'This template does not exist.',
  },
};
export const emailTemplateDocumentation = {
  fr: {
    group: {
      title: 'Modèles de courriels',
      description:
        'Modèles partagés, versionnés et archivables. Texte brut sans exécution de variables.',
    },
    operations: {
      emailTemplateList: {
        summary: 'Lister les modèles de courriels',
        description:
          'Retourne les modèles actifs partagés entre les comptes autorisés. Aucun destinataire n’est conservé dans un modèle.',
      },
      emailTemplateSave: {
        summary: 'Enregistrer un modèle de courriel',
        description:
          'Utilisez un UUID v4 stable et la version zéro à la création. Les mises à jour vérifient la version attendue. Limite de 100 modèles actifs. Aucun envoi.',
      },
      emailTemplateArchive: {
        summary: 'Archiver un modèle de courriel',
        description:
          'Vérifie la version attendue. Conserve le contenu et l’audit. Ne modifie aucun brouillon ou courriel existant.',
      },
    },
  },
  en: {
    group: {
      title: 'Email templates',
      description:
        'Shared, versioned templates with archival. Plain text without variable execution.',
    },
    operations: {
      emailTemplateList: {
        summary: 'List email templates',
        description:
          'Returns active templates shared between authorized accounts. Templates store no recipient.',
      },
      emailTemplateSave: {
        summary: 'Save an email template',
        description:
          'Use a stable UUID v4 and version zero on creation. Updates check the expected version. Limit of 100 active templates. Sends nothing.',
      },
      emailTemplateArchive: {
        summary: 'Archive an email template',
        description:
          'Checks the expected version. Preserves content and audit history. Changes no existing draft or email.',
      },
    },
  },
};
