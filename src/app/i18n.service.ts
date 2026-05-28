import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type Language = 'fr' | 'en';

export type TranslationKey = keyof typeof translations.fr;

const storageKey = 'froment.software.language';

const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.products': 'Produits',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'brand.home': 'froment.software accueil',
    'nav.primary': 'Navigation principale',

    'page.home': 'froment.software',
    'page.clients': 'Nos clients — froment.software',
    'page.services': 'Nos services — froment.software',
    'page.products': 'Nos produits — froment.software',
    'page.showcase': 'Design system — froment.software',
    'page.description.home': 'Applications sur mesure, outils internes, reprise de legacy et conseil technique pragmatique.',
    'page.description.clients': 'Références, missions publiées et expérience de travail de froment.software.',
    'page.description.services': 'Conception d applications web et desktop, outils internes, maintenance, reprise d existant et consulting.',
    'page.description.products': 'Catalogue des applications et logiciels vendus directement par froment.software.',
    'page.description.showcase': 'Aperçu du système visuel et des composants utilisés par froment.software.',

    'footer.rights': '© {year} froment.software. Tous droits réservés.',
    'footer.language': 'Langue',
    'lang.fr': 'Français',
    'lang.en': 'English',

    'home.hero.title.part1a': 'Applications',
    'home.hero.title.part1b': 'sur mesure',
    'home.hero.title.sep1': 'pour le web, le desktop,',
    'home.hero.title.part2a': 'les outils',
    'home.hero.title.part2b': 'internes',
    'home.hero.title.sep2': 'et la',
    'home.hero.title.part3a': 'reprise',
    'home.hero.title.part3b': 'de legacy',
    'home.hero.lead': 'Web, desktop, CLI, maintenance et conseil.',
    'home.hero.contact': 'Nous contacter',
    'home.hero.book': 'Prendre rendez-vous',

    'home.timeline.title': 'Démos et traces publiques',
    'home.timeline.intro': "En attendant des cas clients publiables, cette timeline montre quelques démonstrations et points d'entrée réels vers notre travail.",
    'home.timeline.albumator.desc': "Upload et navigation d'images dans une application web SvelteKit orientée produit.",
    'home.timeline.albumator.cta': 'Ouvrir la démo',
    'home.timeline.htmx.desc': "Expérimentation HTMX avec Go et Fiber pour piloter l'interface depuis le serveur.",
    'home.timeline.htmx.cta': 'Voir la démo',
    'home.timeline.sacha.desc': "Point d'entrée public vers les projets, les notes et l'historique technique.",
    'home.timeline.sacha.cta': 'Voir le site',
    'home.timeline.empty.title': 'Aucun projet client publié pour le moment',
    'home.timeline.empty.desc': "Les références client seront ajoutées ici quand elles pourront être montrées publiquement.",

    'home.services.title': 'Prestations',
    'home.services.intro': "Nous couvrons la conception, la fabrication et la mise en service, avec une attention particulière aux logiciels internes, aux applications métier et aux reprises de legacy.",
    'home.services.cta': 'Voir nos services',
    'home.services.book': 'Réserver un créneau',
    'home.services.web.title': 'Applications web de A à Z',
    'home.services.web.desc': 'Conception, développement, livraison, mise en service et hébergement managé.',
    'home.services.desktop.title': 'Applications desktop de A à Z',
    'home.services.desktop.desc': '.NET WPF, Electron, interfaces internes et postes de travail métier.',
    'home.services.cli.title': 'Outils internes et CLI',
    'home.services.cli.desc': 'Commandes, scripts et outils opérables pour accélérer les équipes et fiabiliser les usages.',
    'home.services.legacy.title': 'Maintenance et évolution de legacy',
    'home.services.legacy.desc': 'Reprise de code existant, audits, remise à plat progressive et corrections sans casse gratuite.',
    'home.services.consulting.title': 'Consulting',
    'home.services.consulting.desc': 'Analyse, recommandations techniques, cadrage et devis francs sur ce qui vaut vraiment le coup.',

    'home.products.title': 'Produits',
    'home.products.note': '🚧 Under construction',
    'home.products.cta': 'Voir nos produits',
    'home.clients.title': 'Références à venir',
    'home.clients.note': '🚧 Under construction',
    'home.clients.cta': 'Voir la page clients',
    'home.clients.experience': 'Expérience en entreprise',

    'products.kicker': 'Nos produits',
    'products.title': 'Applications et logiciels.',
    'products.lead': "Aucun produit n'est actuellement en vente.",
    'products.catalog.title': 'Produits en vente',
    'products.table.product': 'Produit',
    'products.table.type': 'Type',
    'products.table.license': 'Licence',
    'products.table.price': 'Prix',
    'products.empty.title': 'Aucun produit actuellement en vente',
    'products.empty.copy': 'De nouveaux produits seront présentés ici prochainement.',

    'services.kicker': 'Nos services',
    'services.title': "Applications sur mesure et reprise d'existant.",
    'services.lead': 'Web, desktop, CLI, maintenance et conseil.',
    'services.quote': 'Réaliser un devis',
    'services.book': 'Prendre rendez-vous',
    'services.list.title': 'Prestations',
    'services.quote.subject': 'Demande de devis',
    'services.quote.body': 'Bonjour,\n\nNous souhaiterions un devis pour le projet suivant :\n\n- Contexte :\n- Besoin :\n- Périmètre :\n- Contraintes techniques :\n- Délai souhaité :\n- Budget indicatif :\n\nMerci.',
    'services.entry.web.title': 'Applications web de A à Z',
    'services.entry.web.desc': 'Conception, développement, livraison, mise en service et hébergement managé.',
    'services.entry.desktop.title': 'Applications desktop de A à Z',
    'services.entry.desktop.desc': '.NET WPF, Electron et interfaces métier pour postes de travail.',
    'services.entry.cli.title': 'Outils internes et CLI',
    'services.entry.cli.desc': 'Utilitaires, scripts et commandes pour accélérer les équipes et fiabiliser les usages.',
    'services.entry.legacy.title': 'Maintenance et évolution de legacy',
    'services.entry.legacy.desc': 'Reprise de code existant, remise à plat progressive, corrections et évolution sans réécriture gratuite.',
    'services.entry.consulting.title': 'Consulting',
    'services.entry.consulting.desc': 'Analyse, cadrage, recommandations techniques et devis francs.',

    'clients.kicker': 'Nos clients',
    'clients.title': 'Références et missions.',
    'clients.lead': 'Projets clients, missions publiées et références de travail.',
    'clients.list.title': 'Clients publiés',
    'clients.table.client': 'Client',
    'clients.table.type': 'Type',
    'clients.table.scope': 'Périmètre',
    'clients.table.status': 'Statut',
    'clients.empty.title': 'Aucun client publié actuellement',
    'clients.empty.copy': 'Des références seront ajoutées ici quand elles pourront être montrées publiquement.',

    'showcase.kicker': 'Design system',
    'showcase.title': 'Froment UI',
    'showcase.lead': "Composants rugueux, lisibles, fonctionnels. Relief seulement quand il sert l'affordance.",
    'showcase.colors': 'Couleurs',
    'showcase.buttons': 'Boutons',
    'showcase.execute': 'Exécuter',
    'showcase.cancel': 'Annuler',
    'showcase.dense': 'Mode dense',
    'showcase.form': 'Formulaire',
    'showcase.clientProject': 'Projet client',
    'showcase.production': 'Production',
    'showcase.staging': 'Recette',
    'showcase.option': 'Option activée',
    'showcase.table': 'Table',
    'showcase.table.service': 'Service',
    'showcase.table.status': 'Statut',
    'showcase.table.updated': 'Modifié le',
    'showcase.table.action': 'Action',
    'showcase.table.open': 'ouvrir',
    'showcase.status.ok': 'ok',
    'showcase.status.review': 'revue',
    'showcase.status.error': 'erreur',
    'showcase.block': 'Bloc sombre',
    'showcase.block.title': 'Pas de décoration. Des décisions.',
    'showcase.block.copy': "Le noir sert ici au contraste et à la structure, pas à faire cyberpunk.",
  },
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'brand.home': 'froment.software home',
    'nav.primary': 'Primary navigation',

    'page.home': 'froment.software',
    'page.clients': 'Our clients — froment.software',
    'page.services': 'Our services — froment.software',
    'page.products': 'Our products — froment.software',
    'page.showcase': 'Design system — froment.software',
    'page.description.home': 'Custom software, internal tools, legacy takeovers and pragmatic technical consulting.',
    'page.description.clients': 'Published references, engagements and work experience from froment.software.',
    'page.description.services': 'Web and desktop application design, internal tools, maintenance, legacy takeovers and consulting.',
    'page.description.products': 'Catalog of applications and software sold directly by froment.software.',
    'page.description.showcase': 'Visual system and component preview used by froment.software.',

    'footer.rights': '© {year} froment.software. All rights reserved.',
    'footer.language': 'Language',
    'lang.fr': 'French',
    'lang.en': 'English',

    'home.hero.title.part1a': 'Custom',
    'home.hero.title.part1b': 'applications',
    'home.hero.title.sep1': 'for web, desktop,',
    'home.hero.title.part2a': 'internal',
    'home.hero.title.part2b': 'tools',
    'home.hero.title.sep2': 'and',
    'home.hero.title.part3a': 'legacy',
    'home.hero.title.part3b': 'takeover',
    'home.hero.lead': 'Web, desktop, CLI, maintenance and consulting.',
    'home.hero.contact': 'Contact us',
    'home.hero.book': 'Book a meeting',

    'home.timeline.title': 'Public demos and traces',
    'home.timeline.intro': 'While no publishable client cases are online yet, this timeline shows a few real demos and public entry points into our work.',
    'home.timeline.albumator.desc': 'Image upload and browsing in a product-oriented SvelteKit web app.',
    'home.timeline.albumator.cta': 'Open demo',
    'home.timeline.htmx.desc': 'HTMX experiment with Go and Fiber to drive UI state from the server.',
    'home.timeline.htmx.cta': 'View demo',
    'home.timeline.sacha.desc': 'Public entry point for projects, notes and technical history.',
    'home.timeline.sacha.cta': 'View site',
    'home.timeline.empty.title': 'No published client project yet',
    'home.timeline.empty.desc': 'Client references will appear here when they can be shown publicly.',

    'home.services.title': 'Services',
    'home.services.intro': 'We cover design, implementation and go-live, with a strong focus on internal software, business applications and legacy takeovers.',
    'home.services.cta': 'View our services',
    'home.services.book': 'Book a slot',
    'home.services.web.title': 'End-to-end web applications',
    'home.services.web.desc': 'Design, development, delivery, rollout and managed hosting.',
    'home.services.desktop.title': 'End-to-end desktop applications',
    'home.services.desktop.desc': '.NET WPF, Electron, internal interfaces and business workstations.',
    'home.services.cli.title': 'Internal tools and CLIs',
    'home.services.cli.desc': 'Commands, scripts and operable tools to speed teams up and make usage more reliable.',
    'home.services.legacy.title': 'Legacy maintenance and evolution',
    'home.services.legacy.desc': 'Existing code takeovers, audits, gradual cleanup and fixes without pointless breakage.',
    'home.services.consulting.title': 'Consulting',
    'home.services.consulting.desc': 'Analysis, technical recommendations, scoping and blunt quotes on what is actually worth doing.',

    'home.products.title': 'Products',
    'home.products.note': '🚧 Under construction',
    'home.products.cta': 'View our products',
    'home.clients.title': 'References to come',
    'home.clients.note': '🚧 Under construction',
    'home.clients.cta': 'View clients page',
    'home.clients.experience': 'Corporate experience',

    'products.kicker': 'Our products',
    'products.title': 'Applications and software.',
    'products.lead': 'No product is currently available for sale.',
    'products.catalog.title': 'Products for sale',
    'products.table.product': 'Product',
    'products.table.type': 'Type',
    'products.table.license': 'License',
    'products.table.price': 'Price',
    'products.empty.title': 'No product currently for sale',
    'products.empty.copy': 'New products will be listed here soon.',

    'services.kicker': 'Our services',
    'services.title': 'Custom applications and legacy takeovers.',
    'services.lead': 'Web, desktop, CLI, maintenance and consulting.',
    'services.quote': 'Request a quote',
    'services.book': 'Book a meeting',
    'services.list.title': 'What we do',
    'services.quote.subject': 'Quote request',
    'services.quote.body': 'Hello,\n\nWe would like a quote for the following project:\n\n- Context:\n- Need:\n- Scope:\n- Technical constraints:\n- Desired timeline:\n- Approximate budget:\n\nThank you.',
    'services.entry.web.title': 'End-to-end web applications',
    'services.entry.web.desc': 'Design, development, delivery, rollout and managed hosting.',
    'services.entry.desktop.title': 'End-to-end desktop applications',
    'services.entry.desktop.desc': '.NET WPF, Electron and business interfaces for workstations.',
    'services.entry.cli.title': 'Internal tools and CLIs',
    'services.entry.cli.desc': 'Utilities, scripts and commands to speed teams up and make usage more reliable.',
    'services.entry.legacy.title': 'Legacy maintenance and evolution',
    'services.entry.legacy.desc': 'Existing code takeovers, gradual cleanup, fixes and evolution without pointless rewrites.',
    'services.entry.consulting.title': 'Consulting',
    'services.entry.consulting.desc': 'Analysis, scoping, technical recommendations and blunt quoting.',

    'clients.kicker': 'Our clients',
    'clients.title': 'References and engagements.',
    'clients.lead': 'Client projects, published engagements and work references.',
    'clients.list.title': 'Published clients',
    'clients.table.client': 'Client',
    'clients.table.type': 'Type',
    'clients.table.scope': 'Scope',
    'clients.table.status': 'Status',
    'clients.empty.title': 'No client published yet',
    'clients.empty.copy': 'References will be added here when they can be shared publicly.',

    'showcase.kicker': 'Design system',
    'showcase.title': 'Froment UI',
    'showcase.lead': 'Rugged, readable, functional components. Depth only when it helps affordance.',
    'showcase.colors': 'Colors',
    'showcase.buttons': 'Buttons',
    'showcase.execute': 'Run',
    'showcase.cancel': 'Cancel',
    'showcase.dense': 'Dense mode',
    'showcase.form': 'Form',
    'showcase.clientProject': 'Client project',
    'showcase.production': 'Production',
    'showcase.staging': 'Staging',
    'showcase.option': 'Option enabled',
    'showcase.table': 'Table',
    'showcase.table.service': 'Service',
    'showcase.table.status': 'Status',
    'showcase.table.updated': 'Updated',
    'showcase.table.action': 'Action',
    'showcase.table.open': 'open',
    'showcase.status.ok': 'ok',
    'showcase.status.review': 'review',
    'showcase.status.error': 'error',
    'showcase.block': 'Dark block',
    'showcase.block.title': 'No decoration. Decisions.',
    'showcase.block.copy': 'Black is used here for contrast and structure, not to look cyberpunk.',
  },
} as const;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  protected readonly supportedLanguages: Language[] = ['fr', 'en'];

  readonly language = signal<Language>(this.detectLanguage());

  readonly languages = [
    { code: 'fr' as Language, labelKey: 'lang.fr' as TranslationKey },
    { code: 'en' as Language, labelKey: 'lang.en' as TranslationKey },
  ];

  constructor() {
    effect(() => {
      const language = this.language();
      this.document.documentElement.lang = language;
      this.document.documentElement.setAttribute('data-language', language);
      globalThis.localStorage?.setItem(storageKey, language);
    });
  }

  t(key: TranslationKey): string {
    return translations[this.language()][key];
  }

  tf(key: TranslationKey, params: Record<string, string | number>): string {
    let value = this.t(key);

    for (const [param, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${param}}`, String(replacement));
    }

    return value;
  }

  setLanguage(language: string): void {
    if (this.isSupportedLanguage(language)) {
      this.language.set(language);
    }
  }

  formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.language(), options ?? { dateStyle: 'short' }).format(new Date(date));
  }

  private detectLanguage(): Language {
    const stored = globalThis.localStorage?.getItem(storageKey);
    if (this.isSupportedLanguage(stored)) {
      return stored;
    }

    const browserLanguage = globalThis.navigator?.language?.toLowerCase() ?? 'fr';
    return browserLanguage.startsWith('fr') ? 'fr' : 'en';
  }

  private isSupportedLanguage(language: string | null | undefined): language is Language {
    return language === 'fr' || language === 'en';
  }
}
