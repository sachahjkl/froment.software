export const checkoutText = {
  fr: {
    'checkout.openSettings': 'Tester Stripe Checkout',
    'checkout.title': 'Stripe Checkout — mode test',
    'checkout.intro':
      'Créez une page de paiement hébergée à partir du solde d’une facture émise. Suivez ensuite le résultat du test.',
    'checkout.safety':
      'Aucun argent réel ne circule. Un paiement de test ne solde pas la facture et ne crée aucun encaissement local.',
    'checkout.connection': '1. Vérifier les accès',
    'checkout.loading': 'Chargement des accès et des factures…',
    'checkout.key': 'Clé Stripe',
    'checkout.testKey': 'Clé de test présente. Sa présence ne prouve pas sa validité.',
    'checkout.webhook': 'Notifications Stripe',
    'checkout.webhookPresent':
      'Secret de signature présent. La réception des notifications reste à vérifier.',
    'checkout.webhookAbsent':
      'Secret de signature absent. Le suivi fonctionne par interrogation de Stripe.',
    'checkout.polling':
      'Le serveur consulte Stripe toutes les 30 secondes. Une notification signée déclenche une vérification anticipée.',
    'checkout.refresh': 'Actualiser les accès et le suivi',
    'checkout.reconcile': 'Vérifier la session auprès de Stripe',
    'checkout.reconcileUnconfirmed':
      'Le résultat de cette vérification reste à confirmer. Actualisez le suivi de cette session Stripe.',
    'checkout.reconcileHint':
      'Le suivi automatique est arrêté. Cette action consulte uniquement la session existante avec la clé de test actuelle. Elle ne crée aucun paiement.',
    'checkout.reconcileDenied':
      'Votre compte ne permet pas de vérifier cette session Stripe. Les permissions de configuration des connexions et de lecture des factures sont requises.',
    'checkout.notFound': 'Cette demande Stripe n’existe pas.',
    'checkout.statusWindowExceeded':
      'La période de suivi automatique est terminée. Le résultat reste inconnu. Vous pouvez demander une vérification de la session existante.',
    'checkout.prepare': '2. Préparer la page de paiement',
    'checkout.invoice': 'Facture',
    'checkout.chooseInvoice': 'Choisir une facture émise',
    'checkout.invoiceHint':
      'Les factures éligibles sont émises, sans avoir, avec un solde compris entre 0,50 € et 999 999,99 €. Le serveur vérifie à nouveau le solde.',
    'checkout.noInvoices':
      'Aucune facture éligible. Émettez une facture avec un solde restant, puis actualisez cette page.',
    'checkout.invoiceRequired':
      'Choisissez une facture éligible avant de créer la page de paiement.',
    'checkout.amount': 'Montant du test',
    'checkout.client': 'Client de la facture',
    'checkout.total': 'Total de la facture',
    'checkout.recordedPaid': 'Encaissements locaux actifs',
    'checkout.version': 'Version de la facture',
    'checkout.viewInvoice': 'Consulter la facture',
    'checkout.transmitted':
      'Stripe reçoit le numéro de facture, le montant, les identifiants de suivi et l’adresse de test sacha@sacha.house. Les coordonnées du client restent locales.',
    'checkout.create': 'Créer la page de test',
    'checkout.saving': 'Enregistrement…',
    'checkout.retryRequest': 'Reprendre la même demande',
    'checkout.confirm':
      'Créer une page Stripe en mode test avec le solde affiché ? Aucun encaissement réel ne sera enregistré.',
    'checkout.pending':
      'L’enregistrement reste à confirmer. Le choix de facture est verrouillé et conservé dans cet onglet après rechargement. Actualisez le suivi ou reprenez la même demande.',
    'checkout.recoveryUnavailable':
      'La reprise locale est indisponible. Vérifiez la connexion au compte et le stockage de session du navigateur, puis actualisez le suivi. Aucune nouvelle création ne démarre sans cet enregistrement.',
    'checkout.progress': '3. Suivre le test',
    'checkout.paused':
      'L’actualisation du suivi est suspendue. Les dernières données restent affichées. Actualisez le suivi pour réessayer.',
    'checkout.noTests': 'Aucune page de paiement de test enregistrée.',
    'checkout.historyLoading': 'Chargement des tests enregistrés…',
    'checkout.historyUnknown': 'Historique indisponible. Actualisez le suivi.',
    'checkout.requestNotFound':
      'Cette demande ne figure pas dans l’historique chargé. Vérifiez son identifiant et actualisez le suivi.',
    'checkout.queued': 'Demande enregistrée',
    'checkout.creating': 'Création chez Stripe en cours',
    'checkout.retrying': 'Nouvelle tentative programmée',
    'checkout.open': 'Page créée — paiement non confirmé',
    'checkout.paid': 'Paiement de test confirmé par Stripe',
    'checkout.expired': 'Expiration confirmée par Stripe',
    'checkout.failed': 'Création échouée',
    'checkout.blocked': 'Création bloquée',
    'checkout.attempts': 'Tentatives de création',
    'checkout.expiresAt': 'Expiration prévue',
    'checkout.updatedAt': 'Dernière mise à jour du suivi',
    'checkout.nextAttempt': 'Prochaine vérification ou tentative',
    'checkout.openStripe': 'Ouvrir Stripe — nouvel onglet',
    'checkout.testCard':
      'Dans Stripe, utilisez la carte de test 4242 4242 4242 4242, une date future et trois chiffres quelconques. N’utilisez aucune vraie carte.',
    'checkout.returnHint':
      'Fermer Stripe ou revenir ici ne confirme ni le paiement ni l’annulation. Le serveur vérifie le résultat auprès de Stripe.',
    'checkout.identifiers': 'Identifiants de suivi',
    'checkout.requestId': 'Demande locale',
    'checkout.sessionId': 'Session Stripe',
    'checkout.history': 'Historique des tests',
    'checkout.createdAt': 'Créé le',
    'checkout.historyHint':
      'L’installation conserve jusqu’à 100 demandes. Chaque nouvelle demande crée un nouveau test. Les tests restent séparés de l’historique financier.',
    'checkout.status': 'État du test',
    'checkout.details': 'Détails',
    'checkout.detailsFor': 'Afficher le test de la facture {invoice}',
    'checkout.unsaved':
      'Quitter ce formulaire ? Le choix non soumis sera perdu. Une demande déjà enregistrée continuera sur le serveur.',
    'checkout.credentialsMissing':
      'La clé Stripe manque. Renseignez STRIPE_SECRET_KEY dans le profil SOPS actif, puis redémarrez le serveur.',
    'checkout.testKeyRequired':
      'Cette clé n’est pas une clé de test. Le serveur interdit les appels Stripe réels. Utilisez une clé sk_test_ ou rk_test_.',
    'checkout.credentialsChanged':
      'La clé utilisée pour ce test a changé. Vérifiez le test dans le compte Stripe associé à la clé précédente.',
    'checkout.permissionRevoked':
      'Le compte à l’origine du test n’est plus autorisé à poursuivre le traitement automatique. Consultez le résultat dans Stripe.',
    'checkout.invoiceChanged':
      'Le solde ou l’état de la facture a changé. Consultez la facture avant de préparer un nouveau test.',
    'checkout.deadline':
      'La reprise n’est plus autorisée. Vérifiez les sessions Stripe avant de créer un nouveau test.',
    'checkout.unavailable':
      'Stripe n’a pas confirmé la création. Le serveur conserve la demande. Consultez les tentatives avant de créer un nouveau test.',
    'checkout.rejected':
      'Stripe a refusé la demande. Vérifiez les droits de la clé et les journaux Stripe.',
    'checkout.rateLimited':
      'Stripe limite les appels. Le serveur conserve la même demande pour la prochaine tentative.',
    'checkout.statusUnavailable':
      'Le résultat Stripe reste à confirmer. Consultez Stripe et vérifiez les accès. Aucun paiement local n’a été enregistré.',
    'checkout.responseMismatch':
      'La réponse Stripe ne correspond pas à la demande de test. Le serveur arrête la création. Consultez les journaux Stripe.',
    'checkout.conflict':
      'Cette demande existe avec un autre contenu ou un autre auteur. Actualisez l’historique avant de poursuivre.',
    'checkout.active':
      'Un test reste actif pour cette facture. Consultez son suivi avant de créer une autre page.',
    'checkout.limit': 'La limite de 100 tests est atteinte. Consultez l’historique existant.',
    'checkout.invoiceIneligible':
      'La facture n’est plus éligible ou sa version a changé. Actualisez la liste et vérifiez son solde.',
    'checkout.error':
      'Le résultat de la demande reste à confirmer. Actualisez le suivi ou reprenez la même demande pour éviter les doublons.',
    'checkout.loadError':
      'Impossible de charger les accès ou les factures. Actualisez cette page avant de créer un test.',
  },
  en: {
    'checkout.openSettings': 'Test Stripe Checkout',
    'checkout.title': 'Stripe Checkout — test mode',
    'checkout.intro':
      'Create a hosted payment page from an issued invoice’s balance. Then track the test result.',
    'checkout.safety':
      'No real money moves. A test payment does not settle the invoice or create a local receipt.',
    'checkout.connection': '1. Check access',
    'checkout.loading': 'Loading access status and invoices…',
    'checkout.key': 'Stripe key',
    'checkout.testKey': 'Test key present. Its presence does not prove its validity.',
    'checkout.webhook': 'Stripe notifications',
    'checkout.webhookPresent':
      'Signing secret present. Notification delivery still needs verification.',
    'checkout.webhookAbsent':
      'Signing secret absent. The server tracks the session by polling Stripe.',
    'checkout.polling':
      'The server checks Stripe every 30 seconds. A signed notification triggers an earlier check.',
    'checkout.refresh': 'Refresh access and status',
    'checkout.reconcile': 'Check the session with Stripe',
    'checkout.reconcileUnconfirmed':
      'The result of this check is unconfirmed. Refresh the status of this Stripe session.',
    'checkout.reconcileHint':
      'Automatic tracking has stopped. This action only reads the existing session with the current test key. It creates no payment.',
    'checkout.reconcileDenied':
      'Your account cannot check this Stripe session. Connection configuration and invoice read permissions are required.',
    'checkout.notFound': 'This Stripe request does not exist.',
    'checkout.statusWindowExceeded':
      'The automatic tracking period has ended. The result remains unknown. You can request a check of the existing session.',
    'checkout.prepare': '2. Prepare the payment page',
    'checkout.invoice': 'Invoice',
    'checkout.chooseInvoice': 'Choose an issued invoice',
    'checkout.invoiceHint':
      'Eligible invoices are issued, have no credit note, and have a balance from €0.50 to €999,999.99. The server checks the balance again.',
    'checkout.noInvoices':
      'No eligible invoice. Issue an invoice with an outstanding balance, then refresh this page.',
    'checkout.invoiceRequired': 'Choose an eligible invoice before creating the payment page.',
    'checkout.amount': 'Test amount',
    'checkout.client': 'Invoice client',
    'checkout.total': 'Invoice total',
    'checkout.recordedPaid': 'Active local receipts',
    'checkout.version': 'Invoice version',
    'checkout.viewInvoice': 'View invoice',
    'checkout.transmitted':
      'Stripe receives the invoice number, amount, tracking identifiers and test address sacha@sacha.house. Client contact details stay local.',
    'checkout.create': 'Create test page',
    'checkout.saving': 'Recording…',
    'checkout.retryRequest': 'Resume the same request',
    'checkout.confirm':
      'Create a Stripe test page with the displayed balance? No real receipt will be recorded.',
    'checkout.pending':
      'Recording is not yet confirmed. The invoice choice is locked and retained in this tab after a reload. Refresh the status or resume the same request.',
    'checkout.recoveryUnavailable':
      'Local recovery is unavailable. Check account access and browser session storage, then refresh the status. No new creation starts without this record.',
    'checkout.progress': '3. Track the test',
    'checkout.paused':
      'Status updates are paused. The last data remains visible. Refresh the status to try again.',
    'checkout.noTests': 'No test payment page recorded.',
    'checkout.historyLoading': 'Loading recorded tests…',
    'checkout.historyUnknown': 'History unavailable. Refresh the status.',
    'checkout.requestNotFound':
      'This request is not in the loaded history. Check its identifier and refresh the status.',
    'checkout.queued': 'Request recorded',
    'checkout.creating': 'Creating page in Stripe',
    'checkout.retrying': 'Retry scheduled',
    'checkout.open': 'Page created — payment unconfirmed',
    'checkout.paid': 'Test payment confirmed by Stripe',
    'checkout.expired': 'Expiration confirmed by Stripe',
    'checkout.failed': 'Creation failed',
    'checkout.blocked': 'Creation blocked',
    'checkout.attempts': 'Creation attempts',
    'checkout.expiresAt': 'Scheduled expiration',
    'checkout.updatedAt': 'Last status update',
    'checkout.nextAttempt': 'Next check or attempt',
    'checkout.openStripe': 'Open Stripe — new tab',
    'checkout.testCard':
      'In Stripe, use test card 4242 4242 4242 4242, a future date and any three digits. Do not use a real card.',
    'checkout.returnHint':
      'Closing Stripe or returning here does not confirm payment or cancellation. The server checks the result with Stripe.',
    'checkout.identifiers': 'Tracking identifiers',
    'checkout.requestId': 'Local request',
    'checkout.sessionId': 'Stripe session',
    'checkout.history': 'Test history',
    'checkout.createdAt': 'Created',
    'checkout.historyHint':
      'The installation retains up to 100 requests. Each new request creates a new test. Tests stay separate from financial history.',
    'checkout.status': 'Test status',
    'checkout.details': 'Details',
    'checkout.detailsFor': 'Show test for invoice {invoice}',
    'checkout.unsaved':
      'Leave this form? The unsubmitted choice will be lost. Any recorded request will continue on the server.',
    'checkout.credentialsMissing':
      'The Stripe key is missing. Set STRIPE_SECRET_KEY in the active SOPS profile, then restart the server.',
    'checkout.testKeyRequired':
      'This is not a test key. The server blocks live Stripe calls. Use an sk_test_ or rk_test_ key.',
    'checkout.credentialsChanged':
      'The key used for this test has changed. Check the test in the Stripe account associated with the previous key.',
    'checkout.permissionRevoked':
      'The account that started the test is no longer authorized to continue automatic processing. Check the result in Stripe.',
    'checkout.invoiceChanged':
      'The invoice balance or status changed. Check the invoice before preparing another test.',
    'checkout.deadline':
      'This request cannot be retried. Check Stripe sessions before creating a new test.',
    'checkout.unavailable':
      'Stripe did not confirm creation. The server retains the request. Check its attempts before creating a new test.',
    'checkout.rejected': 'Stripe rejected the request. Check key permissions and Stripe logs.',
    'checkout.rateLimited':
      'Stripe is limiting calls. The server retains the same request for the next attempt.',
    'checkout.statusUnavailable':
      'The Stripe result is unconfirmed. Check Stripe and access permissions. No local payment was recorded.',
    'checkout.responseMismatch':
      'The Stripe response does not match the test request. The server stops creation. Check Stripe logs.',
    'checkout.conflict':
      'This request exists with different content or a different author. Refresh history before continuing.',
    'checkout.active':
      'A test remains active for this invoice. Check its status before creating another page.',
    'checkout.limit': 'The limit of 100 tests is reached. Check the existing history.',
    'checkout.invoiceIneligible':
      'The invoice is no longer eligible or its version changed. Refresh the list and check its balance.',
    'checkout.error':
      'The request result is unconfirmed. Refresh the status or resume the same request to prevent duplicates.',
    'checkout.loadError':
      'Cannot load access status or invoices. Refresh this page before creating a test.',
  },
} as const;

export const checkoutDocumentation = {
  fr: {
    checkoutConnection: {
      summary: 'Lire les accès Stripe',
      description:
        'Indique la présence de la clé de test et du secret de webhook. Aucun appel Stripe n’est effectué.',
    },
    checkoutList: {
      summary: 'Consulter les pages de paiement de test',
      description:
        'Liste les demandes et leurs états durables. Un paiement de test ne crée aucun encaissement local.',
    },
    checkoutCreate: {
      summary: 'Préparer un Checkout Stripe de test',
      description:
        'Fige le solde de la version émise, puis programme la création. Réutilisez le même UUID après une réponse incertaine. Le serveur refuse les clés réelles.',
    },
    checkoutReconcile: {
      summary: 'Vérifier une session de test après arrêt du suivi',
      description:
        'Consulte uniquement la session existante avec la clé de test actuelle. Vérifie les droits du demandeur et les données de session. Ne crée aucun paiement.',
    },
  },
  en: {
    checkoutConnection: {
      summary: 'Read Stripe access status',
      description: 'Reports the test key and webhook secret presence. Does not call Stripe.',
    },
    checkoutList: {
      summary: 'List test payment pages',
      description:
        'Lists requests and their durable states. A test payment creates no local receipt.',
    },
    checkoutCreate: {
      summary: 'Prepare a test Stripe Checkout',
      description:
        'Freezes the issued version’s balance, then queues creation. Reuse the same UUID after an uncertain response. The server rejects live keys.',
    },
    checkoutReconcile: {
      summary: 'Check a test session after tracking stops',
      description:
        'Only reads the existing session with the current test key. Checks caller permissions and session data. Creates no payment.',
    },
  },
} as const;
