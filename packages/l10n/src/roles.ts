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
