export const companyWorkspaceText = {
  fr: {
    'company.title': 'Paramètres de la société',
    'company.intro': 'Configurez la juridiction, la comptabilité, les modules et la conservation.',
    'company.loading': 'Chargement des paramètres de la société…',
    'company.error': 'Impossible de charger ou d’enregistrer les paramètres de la société.',
    'company.saved': 'Les paramètres de la société sont enregistrés.',
    'company.legal': 'Juridiction et devise',
    'company.jurisdiction': 'Juridiction',
    'company.functionalCurrency': 'Devise fonctionnelle',
    'company.accountingInitialized':
      'La comptabilité est initialisée. La devise fonctionnelle est définitive.',
    'company.accountingNotInitialized':
      'Vous pouvez modifier la devise avant l’initialisation comptable.',
    'company.fiscalYear': 'Exercice comptable',
    'company.fiscalMonth': 'Mois de début',
    'company.fiscalDay': 'Jour de début',
    'company.fiscalDuration': 'Un nouvel exercice dure douze mois par défaut.',
    'company.modules': 'Modules activés',
    'company.module.sales': 'Ventes',
    'company.module.purchasing': 'Achats',
    'company.module.banking': 'Banque',
    'company.module.accounting': 'Comptabilité',
    'company.module.tax': 'Fiscalité France',
    'company.module.demonstration': 'Démonstration',
    'company.retention': 'Conservation',
    'company.retentionYears': 'Durée de conservation en années',
    'company.retentionExplanation':
      'La durée minimale de dix ans couvre les obligations françaises pour les pièces comptables.',
    'company.save': 'Enregistrer',
    'company.initializeAccounting': 'Initialiser la comptabilité',
    'company.initializeConfirm':
      'Initialiser la comptabilité ? La devise fonctionnelle deviendra définitive.',
    'company.unsavedChanges': 'Abandonner les modifications des paramètres de la société ?',
    'company.settings_conflict':
      'Les paramètres ont changé. Actualisez la page avant de recommencer.',
    'company.functional_currency_locked':
      'La devise fonctionnelle est définitive après l’initialisation comptable.',
    'company.accounting_already_initialized': 'La comptabilité est déjà initialisée.',
  },
  en: {
    'company.title': 'Company settings',
    'company.intro': 'Configure jurisdiction, accounting, modules, and retention.',
    'company.loading': 'Loading company settings…',
    'company.error': 'The company settings cannot be loaded or saved.',
    'company.saved': 'The company settings are saved.',
    'company.legal': 'Jurisdiction and currency',
    'company.jurisdiction': 'Jurisdiction',
    'company.functionalCurrency': 'Functional currency',
    'company.accountingInitialized':
      'Accounting is initialized. The functional currency is permanent.',
    'company.accountingNotInitialized':
      'You can change the currency before accounting initialization.',
    'company.fiscalYear': 'Fiscal year',
    'company.fiscalMonth': 'Start month',
    'company.fiscalDay': 'Start day',
    'company.fiscalDuration': 'A new fiscal year lasts twelve months by default.',
    'company.modules': 'Enabled modules',
    'company.module.sales': 'Sales',
    'company.module.purchasing': 'Purchasing',
    'company.module.banking': 'Banking',
    'company.module.accounting': 'Accounting',
    'company.module.tax': 'France tax',
    'company.module.demonstration': 'Demonstration',
    'company.retention': 'Retention',
    'company.retentionYears': 'Retention period in years',
    'company.retentionExplanation':
      'The ten-year minimum covers French retention rules for accounting records.',
    'company.save': 'Save',
    'company.initializeAccounting': 'Initialize accounting',
    'company.initializeConfirm':
      'Initialize accounting? The functional currency will become permanent.',
    'company.unsavedChanges': 'Discard the company settings changes?',
    'company.settings_conflict': 'The settings changed. Refresh the page before you try again.',
    'company.functional_currency_locked':
      'The functional currency is permanent after accounting initialization.',
    'company.accounting_already_initialized': 'Accounting is already initialized.',
  },
} as const;
