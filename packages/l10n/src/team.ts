export const teamText = {
  fr: {
    'team.reload': 'Recharger les comptes et invitations',
    'team.title': 'Équipe',
    'team.intro':
      'Invitez un collaborateur ou un comptable. Les comptes administrateurs existants ne sont pas modifiés ici.',
    'team.profiles':
      'Le comptable consulte les documents, règlements et relevés, sans modification. Le collaborateur gère les clients, documents commerciaux, règlements et rapprochements. Aucun profil ne gère les comptes ni les jetons API.',
    'team.saved': 'Modification enregistrée.',
    'team.name': 'Nom',
    'team.email': 'Adresse de connexion',
    'team.profile': 'Profil',
    'team.accountant': 'Comptable — lecture seule',
    'team.collaborator': 'Collaborateur',
    'team.invite': 'Créer une invitation',
    'team.link': 'Lien d’invitation',
    'team.linkHint':
      'Aucun courriel n’a été envoyé. Transmettez ce lien confidentiel au destinataire par un canal sûr. Il expire après sept jours.',
    'team.linkSaved': 'J’ai conservé le lien',
    'team.members': 'Comptes de l’équipe',
    'team.active': 'Actif',
    'team.disabled': 'Désactivé',
    'team.disable': 'Désactiver l’accès',
    'team.enable': 'Réactiver l’accès',
    'team.changeProfile': 'Changer de profil',
    'team.empty': 'Aucun élément.',
    'team.invitations': 'Les 100 dernières invitations',
    'team.expires': 'Expiration :',
    'team.accepted': 'Acceptée',
    'team.cancelled': 'Annulée',
    'team.expired': 'Expirée',
    'team.cancel': 'Annuler l’invitation',
    'team.confirmCancel':
      'Annuler cette invitation ? Son lien ne permettra plus de créer un compte.',
    'team.confirmUpdate':
      'Modifier cet accès ? Toutes les sessions et tous les jetons API de ce compte seront révoqués.',
    'team.leave':
      'Quitter cette page ? Les données non enregistrées et le lien affiché ne seront pas conservés.',
    'team.error': 'Opération impossible. Vérifiez vos droits et rechargez les données.',
    'team.conflict':
      'Modification refusée. Vérifiez les données, les invitations existantes et la version du compte.',
    'team.invitation_rejected':
      'Invitation indisponible, expirée ou déjà utilisée. Demandez une nouvelle invitation à l’administrateur.',
    'team.join': 'Rejoindre l’équipe',
    'team.joinHint':
      'Le lien crée un compte pour l’adresse et le profil choisis par l’administrateur. Choisissez votre mot de passe.',
    'team.password': 'Mot de passe',
    'team.confirmPassword': 'Confirmer le mot de passe',
    'team.passwordHint': 'Utilisez entre 12 et 256 caractères.',
    'team.passwordInvalid': 'Utilisez entre 12 et 256 caractères et deux mots de passe identiques.',
    'team.accept': 'Créer mon compte',
    'team.joined': 'Compte créé. Connectez-vous avec l’adresse invitée et votre mot de passe.',
    'team.login': 'Se connecter',
  },
  en: {
    'team.reload': 'Reload accounts and invitations',
    'team.title': 'Team',
    'team.intro':
      'Invite a collaborator or an accountant. Existing administrator accounts are not changed here.',
    'team.profiles':
      'The accountant reads documents, payments and statements without changes. The collaborator manages clients, commercial documents, payments and reconciliation. Neither profile manages accounts or API tokens.',
    'team.saved': 'Change saved.',
    'team.name': 'Name',
    'team.email': 'Login email',
    'team.profile': 'Profile',
    'team.accountant': 'Accountant — read only',
    'team.collaborator': 'Collaborator',
    'team.invite': 'Create invitation',
    'team.link': 'Invitation link',
    'team.linkHint':
      'No email was sent. Share this confidential link with the recipient through a secure channel. It expires after seven days.',
    'team.linkSaved': 'I have saved the link',
    'team.members': 'Team accounts',
    'team.active': 'Active',
    'team.disabled': 'Disabled',
    'team.disable': 'Disable access',
    'team.enable': 'Enable access',
    'team.changeProfile': 'Change profile',
    'team.empty': 'No items.',
    'team.invitations': 'Latest 100 invitations',
    'team.expires': 'Expires:',
    'team.accepted': 'Accepted',
    'team.cancelled': 'Cancelled',
    'team.expired': 'Expired',
    'team.cancel': 'Cancel invitation',
    'team.confirmCancel': 'Cancel this invitation? Its link will no longer create an account.',
    'team.confirmUpdate':
      'Change this access? All sessions and API tokens for this account will be revoked.',
    'team.leave': 'Leave this page? Unsaved data and the displayed link will not be kept.',
    'team.error': 'Cannot complete the operation. Check your permissions and reload the data.',
    'team.conflict': 'Change rejected. Check the data, existing invitations and account version.',
    'team.invitation_rejected':
      'Invitation unavailable, expired or already used. Ask the administrator for a new invitation.',
    'team.join': 'Join the team',
    'team.joinHint':
      'This link creates an account with the email and profile selected by the administrator. Choose your password.',
    'team.password': 'Password',
    'team.confirmPassword': 'Confirm password',
    'team.passwordHint': 'Use between 12 and 256 characters.',
    'team.passwordInvalid': 'Use between 12 and 256 characters and two identical passwords.',
    'team.accept': 'Create my account',
    'team.joined': 'Account created. Sign in with the invited email and your password.',
    'team.login': 'Sign in',
  },
} as const;
export const teamDocumentation = {
  fr: {
    group: {
      title: 'Équipe',
      description:
        'Invitations à usage unique et profils limités. Aucun courriel réel n’est envoyé.',
    },
    operations: {
      teamList: {
        summary: 'Lister les comptes et invitations',
        description:
          'Retourne les comptes collaborateurs et comptables et les 100 dernières invitations, sans jeton secret.',
      },
      teamInvite: {
        summary: 'Créer une invitation',
        description:
          'Retourne un lien confidentiel valable sept jours. Une nouvelle tentative identique conserve le même lien et la même expiration. Aucun courriel n’est envoyé.',
      },
      teamInvitationCancel: {
        summary: 'Annuler une invitation',
        description:
          'Invalide une invitation non acceptée. Une nouvelle annulation reste sans effet.',
      },
      teamMemberUpdate: {
        summary: 'Modifier un accès d’équipe',
        description:
          'Change le profil ou désactive le compte avec contrôle de version. Révoque toutes ses sessions et tous ses jetons API. Ne modifie aucun administrateur existant.',
      },
      teamInvitationAccept: {
        summary: 'Accepter une invitation',
        description:
          'Crée le compte et consomme le jeton en une transaction. Exige une origine autorisée et un mot de passe valide. Limite : dix demandes par minute et adresse cliente.',
      },
    },
  },
  en: {
    group: {
      title: 'Team',
      description: 'Single-use invitations and limited profiles. No real email is sent.',
    },
    operations: {
      teamList: {
        summary: 'List accounts and invitations',
        description:
          'Returns collaborator and accountant accounts and the latest 100 invitations without secret tokens.',
      },
      teamInvite: {
        summary: 'Create an invitation',
        description:
          'Returns a confidential link valid for seven days. An identical retry keeps the same link and expiry. Sends no email.',
      },
      teamInvitationCancel: {
        summary: 'Cancel an invitation',
        description:
          'Invalidates an invitation that has not been accepted. Repeated cancellation has no additional effect.',
      },
      teamMemberUpdate: {
        summary: 'Change team access',
        description:
          'Changes the profile or disables the account with a version check. Revokes all its sessions and API tokens. Does not change existing administrators.',
      },
      teamInvitationAccept: {
        summary: 'Accept an invitation',
        description:
          'Creates the account and consumes the token in one transaction. Requires an allowed origin and valid password. Limit: ten requests per minute per client address.',
      },
    },
  },
} as const;
