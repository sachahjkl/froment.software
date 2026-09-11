export const passkeyText = {
  fr: {
    'passkey.title': 'Clés d’accès (passkeys)',
    'passkey.description':
      'Connectez-vous avec une clé d’accès et la vérification locale de votre appareil. Le serveur ne reçoit aucune donnée biométrique.',
    'passkey.password_notice':
      'Confirmez votre mot de passe pour ajouter ou retirer une clé. Conservez un moyen de connexion de secours.',
    'passkey.name': 'Nom de la clé',
    'passkey.password': 'Mot de passe actuel',
    'passkey.add': 'Ajouter une clé d’accès',
    'passkey.remove': 'Retirer',
    'passkey.remove_confirm':
      'Retirer cette clé et révoquer les autres sessions du compte ? La clé restera sur votre appareil.',
    'passkey.empty': 'Aucune clé d’accès enregistrée.',
    'passkey.loading': 'Chargement des clés d’accès…',
    'passkey.login': 'Se connecter avec une clé d’accès',
    'passkey.unavailable':
      'Les clés d’accès nécessitent un navigateur compatible et une connexion HTTPS.',
    'passkey.rejected': 'La clé d’accès ou la confirmation a été refusée. Recommencez la demande.',
    'passkey.error':
      'La connexion par clé d’accès n’a pas été confirmée. Réessayez ou utilisez votre mot de passe.',
    'passkey.loadError':
      'Impossible de charger les clés d’accès. Rechargez la page pour réessayer.',
    'passkey.addUnconfirmed':
      'L’ajout de la clé d’accès n’a pas été confirmé. Rechargez la page pour vérifier les clés enregistrées.',
    'passkey.removeUnconfirmed':
      'Le retrait de la clé d’accès reste à confirmer. Rechargez la page pour vérifier les clés enregistrées.',
    'passkey.added': 'Clé d’accès enregistrée.',
    'passkey.removed': 'Clé retirée. Les autres sessions ont été révoquées.',
  },
  en: {
    'passkey.title': 'Passkeys',
    'passkey.description':
      'Sign in with a passkey and local device verification. The server receives no biometric data.',
    'passkey.password_notice':
      'Confirm your password to add or remove a passkey. Keep a backup sign-in method.',
    'passkey.name': 'Passkey name',
    'passkey.password': 'Current password',
    'passkey.add': 'Add a passkey',
    'passkey.remove': 'Remove',
    'passkey.remove_confirm':
      'Remove this passkey and revoke the account’s other sessions? The passkey will remain on your device.',
    'passkey.empty': 'No registered passkeys.',
    'passkey.loading': 'Loading passkeys…',
    'passkey.login': 'Sign in with a passkey',
    'passkey.unavailable': 'Passkeys require a compatible browser and HTTPS.',
    'passkey.rejected': 'The passkey or confirmation was rejected. Start a new request.',
    'passkey.error': 'Passkey sign-in was not confirmed. Try again or use your password.',
    'passkey.loadError': 'Unable to load passkeys. Reload the page to try again.',
    'passkey.addUnconfirmed':
      'Adding the passkey was not confirmed. Reload the page to check registered passkeys.',
    'passkey.removeUnconfirmed':
      'Passkey removal is unconfirmed. Reload the page to check registered passkeys.',
    'passkey.added': 'Passkey registered.',
    'passkey.removed': 'Passkey removed. Other sessions were revoked.',
  },
};
export const passkeyDocumentation = {
  fr: {
    group: {
      title: 'Clés d’accès',
      description: 'Connexion WebAuthn et gestion des clés du compte connecté.',
    },
    operations: {
      passkeyList: {
        summary: 'Lister ses clés d’accès',
        description:
          'Session navigateur requise. Retourne uniquement les clés du compte connecté, sans leur clé publique.',
      },
      passkeyRegisterOptions: {
        summary: 'Préparer une clé d’accès',
        description:
          'Session et mot de passe actuel requis. Le défi expire après cinq minutes et reste lié à cette session. Limite : dix clés par compte.',
      },
      passkeyRegisterVerify: {
        summary: 'Enregistrer une clé d’accès',
        description:
          'Vérifie le défi à usage unique, l’origine, le domaine et la vérification locale de l’utilisateur. Le cookie de défi est obligatoire.',
      },
      passkeyRemove: {
        summary: 'Retirer une clé d’accès',
        description:
          'Session et mot de passe actuel requis. Retire uniquement une clé du compte connecté et révoque ses autres sessions. Ne supprime pas la clé sur l’appareil.',
      },
      passkeyLoginOptions: {
        summary: 'Préparer une connexion par clé',
        description:
          'Crée un défi anonyme à usage unique, valable cinq minutes, lié au navigateur par un cookie HttpOnly. Ne recherche pas de compte par courriel.',
      },
      passkeyLoginVerify: {
        summary: 'Se connecter par clé d’accès',
        description:
          'Vérifie la signature, le défi, l’origine, le domaine, le compte et la vérification locale de l’utilisateur. Crée les cookies de session habituels.',
      },
    },
  },
  en: {
    group: {
      title: 'Passkeys',
      description: 'WebAuthn sign-in and passkey management for the current account.',
    },
    operations: {
      passkeyList: {
        summary: 'List your passkeys',
        description:
          'Requires a browser session. Returns only the current account’s passkeys, without their public keys.',
      },
      passkeyRegisterOptions: {
        summary: 'Prepare a passkey',
        description:
          'Requires a session and current password. The challenge expires after five minutes and is bound to this session. Limit: ten passkeys per account.',
      },
      passkeyRegisterVerify: {
        summary: 'Register a passkey',
        description:
          'Verifies the single-use challenge, origin, domain, and local user verification. Requires the challenge cookie.',
      },
      passkeyRemove: {
        summary: 'Remove a passkey',
        description:
          'Requires a session and current password. Removes only a passkey owned by the current account and revokes its other sessions. Does not delete the passkey from the device.',
      },
      passkeyLoginOptions: {
        summary: 'Prepare passkey sign-in',
        description:
          'Creates an anonymous single-use challenge, valid for five minutes, bound to the browser through an HttpOnly cookie. Does not look up accounts by email.',
      },
      passkeyLoginVerify: {
        summary: 'Sign in with a passkey',
        description:
          'Verifies the signature, challenge, origin, domain, account, and local user verification. Creates the standard session cookies.',
      },
    },
  },
};
