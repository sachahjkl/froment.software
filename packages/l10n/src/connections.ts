export const connectionText = {
  fr: {
    'connections.title': 'Connexions aux services',
    'connections.intro':
      'Raccordez les prestataires, vérifiez leurs accès et suivez les opérations sans modifier vos documents existants.',
    'connections.safety':
      'Les opérations commerciales et les relances restent simulées. Seul le test Resend ci-dessous peut envoyer un vrai courriel.',
    'connections.credentialsHint':
      'Une clé présente ne confirme pas sa validité. Les clés restent sur le serveur, dans le profil SOPS utilisé au démarrage.',
    'connections.provider': 'Prestataire',
    'connections.usage': 'Utilisation',
    'connections.credentials': 'Identifiants',
    'connections.mode': 'Mode actuel',
    'connections.action': 'Parcours',
    'connections.present': 'Présents sur le serveur',
    'connections.missing': 'À renseigner dans SOPS',
    'connections.restricted': 'Test à destinataire limité',
    'connections.notConnected': 'Pas encore raccordé',
    'connections.resend': 'Resend',
    'connections.stripe': 'Stripe',
    'connections.signwell': 'SignWell',
    'connections.superpdp': 'SUPER PDP',
    'connections.email': 'Courriels transactionnels',
    'connections.payment': 'Paiements par carte — mode test',
    'connections.signature': 'Signatures électroniques — mode test',
    'connections.electronicInvoice': 'Factures électroniques — bac à sable',
    'connections.openResend': 'Vérifier Resend',
    'connections.pending': 'Connecteur en préparation',
    'connections.reload': 'Actualiser les accès',
    'connections.loading': 'Chargement des connexions…',
    'connections.error':
      'Accès indisponible. Vérifiez votre connexion et vos droits d’administration, puis actualisez les accès.',
    'connections.simulations': 'Ouvrir les simulations et leur historique',
    'connections.back': 'Retour aux connexions',
    'connections.breadcrumb': 'Navigation des services',
    'connections.bank':
      'La banque reste indépendante : les imports CSV et les rapprochements restent disponibles.',
    'emailTest.title': 'Resend — vérifier l’envoi',
    'emailTest.intro':
      'Préparez un message de test, vérifiez son aperçu, puis suivez sa prise en charge et sa remise.',
    'emailTest.safety':
      'Ce test envoie un vrai courriel, uniquement à sacha@sacha.house. Il n’active ni les envois clients ni les relances.',
    'emailTest.routing': '1. Vérifier les adresses',
    'emailTest.from': 'Expéditeur',
    'emailTest.replyTo': 'Réponses vers',
    'emailTest.recipient': 'Destinataire autorisé',
    'emailTest.routingHint':
      'Ces adresses sont imposées par le serveur. Aucun destinataire en copie ni aucune pièce jointe ne sont ajoutés.',
    'emailTest.compose': '2. Préparer le message',
    'emailTest.subject': 'Objet',
    'emailTest.subjectHint':
      '160 caractères maximum. Le serveur ajoute « [Test] » au début de l’objet.',
    'emailTest.body': 'Message',
    'emailTest.bodyHint':
      'Texte brut, 20 000 caractères maximum. Les sauts de ligne sont conservés.',
    'emailTest.subjectInvalid': 'Saisissez un objet de 1 à 160 caractères, sans saut de ligne.',
    'emailTest.bodyInvalid': 'Saisissez un message de 1 à 20 000 caractères.',
    'emailTest.preview': 'Aperçu du courriel',
    'emailTest.send': 'Envoyer le test',
    'emailTest.saving': 'Enregistrer le test…',
    'emailTest.confirm':
      'Envoyer ce vrai courriel de test à sacha@sacha.house ? Les autres envois resteront simulés.',
    'emailTest.unsaved': 'Quitter ce message de test sans enregistrer vos modifications ?',
    'emailTest.defaultSubject': 'Vérification de la connexion Resend',
    'emailTest.defaultBody':
      'Bonjour Sacha,\n\nCe message vérifie l’envoi depuis froment.software avec Resend.\nLes envois clients et les relances restent simulés.\n\nVous pouvez répondre à ce message pour vérifier le retour vers la boîte Tuta.',
    'emailTest.progress': '3. Suivre le test',
    'emailTest.status': 'État du test',
    'emailTest.pendingRequest':
      'L’enregistrement reste à confirmer. Actualisez le suivi ou soumettez à nouveau cette même demande. Son contenu reste verrouillé pour éviter les doublons.',
    'emailTest.live':
      'Suivi actualisé toutes les 3 secondes. Le serveur poursuit le test si vous quittez cette page.',
    'emailTest.paused':
      'Suivi suspendu. Les dernières données restent affichées ; le serveur poursuit le test. Actualisez pour reprendre.',
    'emailTest.refresh': 'Actualiser le suivi',
    'emailTest.empty':
      'Aucun test enregistré. Préparez le message ci-dessus pour vérifier cette connexion.',
    'emailTest.queued': 'Enregistré — en attente d’envoi',
    'emailTest.sending': 'Envoi en cours',
    'emailTest.retrying': 'Nouvelle tentative programmée',
    'emailTest.accepted': 'Accepté par Resend — remise non confirmée',
    'emailTest.delivered': 'Remise confirmée par Resend',
    'emailTest.bounced': 'Adresse refusée par le serveur destinataire',
    'emailTest.complained': 'Courriel signalé comme indésirable',
    'emailTest.failed': 'Test arrêté après une erreur',
    'emailTest.blocked': 'Test bloqué avant l’envoi',
    'emailTest.acceptedHint':
      'Une acceptation API ne prouve pas la réception. « Remise confirmée » signifie que le serveur destinataire a accepté le courriel.',
    'emailTest.failureHint':
      'Consultez le détail du test et le journal Resend avant de créer un nouvel envoi. Une réponse réseau perdue peut masquer une acceptation.',
    'emailTest.attempts': 'Tentatives d’envoi',
    'emailTest.nextAttempt': 'Prochaine vérification ou tentative',
    'emailTest.providerId': 'Identifiant Resend',
    'emailTest.requestId': 'Identifiant de la demande',
    'emailTest.updatedAt': 'Dernière vérification',
    'emailTest.createdAt': 'Enregistré le',
    'emailTest.history': 'Historique des tests',
    'emailTest.historyHint':
      'Les demandes et leur contenu sont conservés. Une reprise réutilise la même demande ; elle ne crée pas un nouveau message.',
    'emailTest.details': 'Voir le test',
    'emailTest.error':
      'Impossible de charger ou d’enregistrer le test. Vérifiez votre connexion, puis actualisez le suivi avant de réessayer.',
    'emailTest.credentialsMissing':
      'Clé Resend absente. Renseignez RESEND_API_KEY dans le profil SOPS actif, puis redémarrez l’application.',
    'emailTest.credentialsChanged':
      'La clé Resend a changé. Vérifiez le journal du compte initial avant de créer un autre test.',
    'emailTest.permissionRevoked':
      'Les droits de l’auteur ont été retirés. Demandez à un administrateur de vérifier le test.',
    'emailTest.rejected':
      'Resend a refusé la demande. Vérifiez la clé, ses droits et la validation de mail.froment.software dans Resend.',
    'emailTest.rateLimited':
      'Resend limite les requêtes. Le serveur attend avant la prochaine tentative, dans la limite de cinq tentatives.',
    'emailTest.unavailable':
      'Resend n’a pas confirmé la demande. Consultez le statut et le journal Resend avant tout nouvel envoi.',
    'emailTest.expired':
      'Le délai de reprise sûre est dépassé. Consultez le journal Resend ; ce message ne sera pas renvoyé automatiquement.',
    'emailTest.statusUnavailable':
      'Le statut de remise est indisponible. Vérifiez les droits de lecture de la clé ou consultez le journal Resend.',
    'emailTest.conflict':
      'Cette demande existe avec un autre contenu ou un autre auteur. Actualisez le suivi avant de continuer.',
    'emailTest.active': 'Un test attend déjà son envoi. Attendez sa fin et consultez son suivi.',
    'emailTest.limit':
      'La limite de 100 tests conservés est atteinte. Consultez l’historique ; aucun nouveau message n’a été créé.',
  },
  en: {
    'connections.title': 'Service connections',
    'connections.intro':
      'Connect providers, check access and track operations without changing existing documents.',
    'connections.safety':
      'Business operations and reminders remain simulated. Only the Resend test below can send a real email.',
    'connections.credentialsHint':
      'A stored key does not confirm validity. Keys stay on the server, in the SOPS profile selected at startup.',
    'connections.provider': 'Provider',
    'connections.usage': 'Purpose',
    'connections.credentials': 'Credentials',
    'connections.mode': 'Current mode',
    'connections.action': 'Setup',
    'connections.present': 'Present on the server',
    'connections.missing': 'Required in SOPS',
    'connections.restricted': 'Recipient-restricted test',
    'connections.notConnected': 'Not connected',
    'connections.resend': 'Resend',
    'connections.stripe': 'Stripe',
    'connections.signwell': 'SignWell',
    'connections.superpdp': 'SUPER PDP',
    'connections.email': 'Transactional email',
    'connections.payment': 'Card payments — test mode',
    'connections.signature': 'Electronic signatures — test mode',
    'connections.electronicInvoice': 'Electronic invoices — sandbox',
    'connections.openResend': 'Check Resend',
    'connections.pending': 'Connector in preparation',
    'connections.reload': 'Refresh access status',
    'connections.loading': 'Loading connections…',
    'connections.error':
      'Access unavailable. Check your connection and administrator permissions, then refresh access status.',
    'connections.simulations': 'Open simulations and their history',
    'connections.back': 'Back to connections',
    'connections.breadcrumb': 'Service navigation',
    'connections.bank':
      'Banking stays independent: CSV imports and reconciliation remain available.',
    'emailTest.title': 'Resend — check email sending',
    'emailTest.intro':
      'Prepare a test message, check its preview, then track acceptance and delivery.',
    'emailTest.safety':
      'This test sends a real email to sacha@sacha.house only. It does not enable customer emails or reminders.',
    'emailTest.routing': '1. Check addresses',
    'emailTest.from': 'Sender',
    'emailTest.replyTo': 'Reply to',
    'emailTest.recipient': 'Allowed recipient',
    'emailTest.routingHint':
      'The server enforces these addresses. No copied recipients or attachments are added.',
    'emailTest.compose': '2. Prepare the message',
    'emailTest.subject': 'Subject',
    'emailTest.subjectHint':
      'Maximum 160 characters. The server adds “[Test]” to the start of the subject.',
    'emailTest.body': 'Message',
    'emailTest.bodyHint': 'Plain text, maximum 20,000 characters. Line breaks are preserved.',
    'emailTest.subjectInvalid': 'Enter a subject with 1–160 characters and no line breaks.',
    'emailTest.bodyInvalid': 'Enter a message with 1–20,000 characters.',
    'emailTest.preview': 'Email preview',
    'emailTest.send': 'Send test email',
    'emailTest.saving': 'Record the test…',
    'emailTest.confirm':
      'Send this real test email to sacha@sacha.house? Other emails will remain simulated.',
    'emailTest.unsaved': 'Leave this test message without saving your changes?',
    'emailTest.defaultSubject': 'Resend connection check',
    'emailTest.defaultBody':
      'Hello Sacha,\n\nThis message checks email sending from froment.software through Resend.\nCustomer emails and reminders remain simulated.\n\nReply to this message to check routing to the Tuta mailbox.',
    'emailTest.progress': '3. Track the test',
    'emailTest.status': 'Test status',
    'emailTest.pendingRequest':
      'Recording is not yet confirmed. Refresh the status or submit this same request again. Its content stays locked to prevent duplicates.',
    'emailTest.live':
      'Status refreshes every 3 seconds. The server continues the test when you leave this page.',
    'emailTest.paused':
      'Status refresh paused. The last data remains visible; the server continues the test. Refresh to resume.',
    'emailTest.refresh': 'Refresh test status',
    'emailTest.empty': 'No test recorded. Prepare the message above to check this connection.',
    'emailTest.queued': 'Recorded — waiting to send',
    'emailTest.sending': 'Sending',
    'emailTest.retrying': 'Retry scheduled',
    'emailTest.accepted': 'Accepted by Resend — delivery unconfirmed',
    'emailTest.delivered': 'Delivery confirmed by Resend',
    'emailTest.bounced': 'Rejected by the recipient server',
    'emailTest.complained': 'Reported as spam',
    'emailTest.failed': 'Test stopped after an error',
    'emailTest.blocked': 'Test blocked before sending',
    'emailTest.acceptedHint':
      'API acceptance does not prove receipt. “Delivery confirmed” means the recipient server accepted the email.',
    'emailTest.failureHint':
      'Check the test details and Resend log before sending another email. A lost network response can hide an accepted send.',
    'emailTest.attempts': 'Send attempts',
    'emailTest.nextAttempt': 'Next check or attempt',
    'emailTest.providerId': 'Resend identifier',
    'emailTest.requestId': 'Request identifier',
    'emailTest.updatedAt': 'Last checked',
    'emailTest.createdAt': 'Recorded at',
    'emailTest.history': 'Test history',
    'emailTest.historyHint':
      'Requests and their content are retained. A retry uses the same request; it does not create a new message.',
    'emailTest.details': 'View test',
    'emailTest.error':
      'Unable to load or record the test. Check your connection, then refresh test status before trying again.',
    'emailTest.credentialsMissing':
      'Resend key missing. Set RESEND_API_KEY in the active SOPS profile, then restart the application.',
    'emailTest.credentialsChanged':
      'The Resend key changed. Check the original account log before creating another test.',
    'emailTest.permissionRevoked':
      'The author’s permissions were removed. Ask an administrator to check the test.',
    'emailTest.rejected':
      'Resend rejected the request. Check the key, its permissions and verification of mail.froment.software in Resend.',
    'emailTest.rateLimited':
      'Resend is limiting requests. The server waits before trying again, up to five attempts.',
    'emailTest.unavailable':
      'Resend did not confirm the request. Check the status and Resend log before sending another email.',
    'emailTest.expired':
      'The safe retry window has expired. Check the Resend log; this message will not be sent again automatically.',
    'emailTest.statusUnavailable':
      'Delivery status is unavailable. Check the key’s read permissions or consult the Resend log.',
    'emailTest.conflict':
      'This request exists with different content or a different author. Refresh test status before continuing.',
    'emailTest.active':
      'A test is already waiting to send. Wait for it to finish and check its status.',
    'emailTest.limit':
      'The limit of 100 retained tests has been reached. Check the history; no new message was created.',
  },
} as const;
export const connectionDocumentation = {
  fr: {
    providerConnections: {
      summary: 'Lire les accès des prestataires',
      description:
        'Indique la présence des identifiants dans le profil actif, sans exposer leurs valeurs ni appeler les prestataires.',
    },
    emailTestList: {
      summary: 'Consulter les tests Resend',
      description:
        'Liste les demandes conservées et leur état durable. Une acceptation par Resend ne prouve pas la remise du courriel.',
    },
    emailTestCreate: {
      summary: 'Programmer un vrai courriel de test',
      description:
        'Enregistre la demande avant tout appel externe. Le serveur impose le destinataire sacha@sacha.house. Les courriels clients restent simulés. Réutilisez le même UUID et le même contenu après une réponse incertaine.',
    },
  },
  en: {
    providerConnections: {
      summary: 'Read provider access status',
      description:
        'Reports credential presence in the active profile without exposing values or calling providers.',
    },
    emailTestList: {
      summary: 'List Resend tests',
      description:
        'Lists retained requests and their durable state. Resend acceptance does not prove email delivery.',
    },
    emailTestCreate: {
      summary: 'Queue a real test email',
      description:
        'Records the request before any external call. The server enforces sacha@sacha.house as the recipient. Customer emails remain simulated. Reuse the same UUID and content after an uncertain response.',
    },
  },
} as const;
