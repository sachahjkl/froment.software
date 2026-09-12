export const roleText = {
  fr: {
    'role.title': 'Rôles personnalisés',
    'role.intro': 'Créez des modèles de permissions pour les membres de l’équipe.',
    'role.backTeam': 'Retour à l’équipe',
    'role.backList': 'Retour aux rôles',
    'role.create': 'Créer un rôle',
    'role.createTitle': 'Créer un rôle personnalisé',
    'role.editTitle': 'Modifier le rôle personnalisé',
    'role.editorIntro': 'Sélectionnez uniquement les permissions nécessaires à ce rôle.',
    'role.name': 'Nom',
    'role.permissions': 'Permissions',
    'role.edit': 'Modifier',
    'role.delete': 'Supprimer',
    'role.save': 'Enregistrer',
    'role.cancel': 'Annuler',
    'role.loading': 'Chargement des rôles…',
    'role.empty': 'Aucun rôle personnalisé.',
    'role.count.one': '{count} rôle personnalisé',
    'role.count.other': '{count} rôles personnalisés',
    'role.deleteConfirm': 'Supprimer le rôle « {name} » ?',
    'role.unsavedChanges': 'Abandonner les modifications de ce rôle ?',
    'role.error': 'Impossible de charger ou d’enregistrer les rôles.',
    'role.not_found': 'Ce rôle est introuvable.',
    'role.name_exists': 'Ce nom de rôle existe déjà.',
    'role.creation_conflict': 'Cette demande de création contient maintenant d’autres données.',
    'role.version_conflict': 'Ce rôle a changé. Actualisez la page avant de recommencer.',
    'role.in_use': 'Ce rôle est utilisé par un membre ou une invitation active.',
    'role.last_administrator': 'Conservez au moins un administrateur actif.',
  },
  en: {
    'role.title': 'Custom roles',
    'role.intro': 'Create permission templates for team members.',
    'role.backTeam': 'Back to team',
    'role.backList': 'Back to roles',
    'role.create': 'Create role',
    'role.createTitle': 'Create custom role',
    'role.editTitle': 'Edit custom role',
    'role.editorIntro': 'Select only the permissions that this role needs.',
    'role.name': 'Name',
    'role.permissions': 'Permissions',
    'role.edit': 'Edit',
    'role.delete': 'Delete',
    'role.save': 'Save',
    'role.cancel': 'Cancel',
    'role.loading': 'Loading roles…',
    'role.empty': 'No custom roles.',
    'role.count.one': '{count} custom role',
    'role.count.other': '{count} custom roles',
    'role.deleteConfirm': 'Delete the “{name}” role?',
    'role.unsavedChanges': 'Discard this role’s changes?',
    'role.error': 'The roles cannot be loaded or saved.',
    'role.not_found': 'This role cannot be found.',
    'role.name_exists': 'This role name already exists.',
    'role.creation_conflict': 'This creation request now contains different data.',
    'role.version_conflict': 'This role changed. Refresh the page before you try again.',
    'role.in_use': 'A member or active invitation uses this role.',
    'role.last_administrator': 'Keep at least one active administrator.',
  },
} as const;

export const roleDocumentation = {
  fr: {
    group: {
      title: 'Rôles personnalisés',
      description: 'Modèles de permissions attribuables aux membres de l’équipe.',
    },
    operations: {
      customRoleList: {
        summary: 'Lister les rôles personnalisés',
        description: 'Retourne les rôles personnalisés et leurs permissions.',
      },
      customRoleGet: {
        summary: 'Lire un rôle personnalisé',
        description: 'Retourne un rôle personnalisé et sa version actuelle.',
      },
      customRoleCreate: {
        summary: 'Créer un rôle personnalisé',
        description: 'Crée un modèle de permissions avec une demande idempotente.',
      },
      customRoleUpdate: {
        summary: 'Modifier un rôle personnalisé',
        description: 'Modifie le nom et les permissions avec contrôle de version.',
      },
      customRoleDelete: {
        summary: 'Supprimer un rôle personnalisé',
        description: 'Supprime un rôle qui n’est utilisé par aucun membre ni invitation active.',
      },
    },
  },
  en: {
    group: {
      title: 'Custom roles',
      description: 'Permission templates that can be assigned to team members.',
    },
    operations: {
      customRoleList: {
        summary: 'List custom roles',
        description: 'Returns custom roles and their permissions.',
      },
      customRoleGet: {
        summary: 'Get a custom role',
        description: 'Returns a custom role and its current version.',
      },
      customRoleCreate: {
        summary: 'Create a custom role',
        description: 'Creates a permission template with an idempotent request.',
      },
      customRoleUpdate: {
        summary: 'Update a custom role',
        description: 'Updates the name and permissions with a version check.',
      },
      customRoleDelete: {
        summary: 'Delete a custom role',
        description: 'Deletes a role that no member or active invitation uses.',
      },
    },
  },
} as const;
