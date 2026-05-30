import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type Language = 'fr' | 'en';

export type TranslationKey = keyof typeof translations.fr;

const storageKey = 'froment.software.language';

const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.about': 'À propos',
    'nav.products': 'Produits',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'nav.legal': 'Mentions légales',
    'nav.privacy': 'Privacy policy',
    'nav.cookies': 'Cookies',
    'brand.home': 'froment.software accueil',
    'nav.primary': 'Navigation principale',

    'page.home': 'froment.software',
    'page.clients': 'Nos clients — froment.software',
    'page.services': 'Nos services — froment.software',
    'page.products': 'Nos produits — froment.software',
    'page.showcase': 'Design system — froment.software',

    'page.about': 'À propos — froment.software',
    'page.description.about': "Sacha FROMENT, ingénieur logiciel — expertise en applications d entreprise, legacy et consulting.",

    'page.legal': 'Mentions légales — froment.software',
    'page.description.legal': 'Mentions légales de froment.software, éditeur et responsable de traitement.',

    'page.privacy': 'Politique de confidentialité — froment.software',
    'page.description.privacy': 'Politique de confidentialité et de protection des données de froment.software.',

    'page.cookies': 'Cookies — froment.software',
    'page.description.cookies': "Politique d'utilisation des cookies de froment.software.",
    'page.not_found': 'Page introuvable — froment.software',
    'page.description.not_found': 'Oh non ! Page introuvable.',
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
    'clients.ref.title': 'Références clients',
    'clients.ref.copy': 'Nous travaillons avec des entreprises de divers secteurs. Les références détaillées sont disponibles sur demande.',
    'clients.ref.contact_title': 'Contact',
    'clients.ref.contact_copy': 'Vous souhaitez en savoir plus sur nos missions passées ? Contactez-nous.',
    'clients.ref.contact_cta': 'Nous contacter',
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

    'about.kicker': 'À propos',
    'about.title': 'Sacha FROMENT.',
    'about.lead': 'Ingénieur logiciel, 5 ans d\'expérience en logiciels d\'entreprise. De la maintenance de code ancien à l\'innovation sur des applications modernes.',
    'about.bio.title': 'Qui je suis',
    'about.bio.intro': 'Je suis Sacha FROMENT, ingénieur logiciel spécialisé dans les applications d\'entreprise. Mon quotidien oscille entre maintenance et évolution de systèmes legacy au long vécu, et innovation, montées de version et greenfield sur des applications plus récentes.',
    'about.bio.experience': 'Ces 5 dernières années, j\'ai travaillé sur des projets allant de la reprise d\'applications vieillissantes — remise à plat progressive, refactoring sans réécriture gratuite — à la conception et la livraison de nouvelles solutions pour le web, le desktop et le CLI.',
    'about.bio.years': 'Années d\'exp.',
    'about.bio.ref1': 'Industrie ferroviaire',
    'about.bio.ref2': 'Assurance',
    'about.bio.ref3': 'Funéraire',
    'about.faq.title': 'Questions fréquentes',
    'about.faq.intro': 'En attendant que je rédige les réponses, voici les questions que l\'on me pose le plus souvent.',
    'about.faq.placeholder': 'Réponse à venir…',
    'about.faq.process.q': 'Quel est votre processus de travail ?',
    'about.faq.stack.q': 'Stack technique "habituelle" ?',
    'about.faq.remote.q': 'Travaillez-vous en remote ?',
    'about.faq.nda.q': 'Acceptez-vous les NDAs ?',
    'about.faq.timeline.q': 'Quels sont les délais typiques ?',
    'about.faq.maintenance.q': 'Proposez-vous de la maintenance après livraison ?',
    'about.faq.pricing.q': 'Comment sont facturés vos services ?',
    'about.faq.availability.q': 'Quelle est votre disponibilité actuelle ?',
    'about.faq.process.a': 'Découverte → devis → développement → livraison → support.',
    'about.faq.stack.a': 'SvelteKit (Svelte 5), ASP.NET 10, Angular 17-21, WinForm/WPF, Linux (NixOS), SQLite/PostgreSQL, Odin, Go (Fiber, orchestrators).',
    'about.faq.remote.a': 'Oui, 100% remote.',
    'about.faq.nda.a': 'Sur demande.',
    'about.faq.timeline.a': "Ça dépend de l'envergure du projet — à déterminer dans le devis.",
    'about.faq.maintenance.a': 'Oui, possibilité de maintenance après livraison.',
    'about.faq.pricing.a': 'Forfait.',
    'about.faq.availability.a': 'Temps partiel.',
    'not_found.title': 'Perdu·e ?',
    'not_found.lead': "J'ai pas vu cette page passer.",
    'not_found.sub': 'Elle est peut-être en cours de construction, ou alors t\'as tapé de travers.',
    'not_found.cta': 'Retour à l\'accueil',


    'about.contact.title': 'Travaillons ensemble',
    'about.contact.copy': 'Vous avez un projet en tête ? Parlons-en.',
    'about.contact.mail': 'M\'écrire',
    'about.contact.book': 'Réserver un créneau',

    'legal.kicker': 'Mentions légales',
    'legal.title': 'Mentions légales',
    'legal.updated': 'Dernière mise à jour : mai 2026',
    'legal.publisher.title': '1. Éditeur du site',
    'legal.publisher.content': 'En cours de création — aucune entité légale immatriculée à ce jour. Contact : contact@froment.software',
    'legal.hosting.title': '2. Hébergement',
    'legal.hosting.content': 'Auto-hébergé sur infrastucture personnelle (homelab). Alternatives possibles : OVH, Scaleway, Hetzner.',
    'legal.ip.title': '3. Propriété intellectuelle',
    'legal.ip.content': 'L\'ensemble du contenu du site froment.software est protégé par le droit d\'auteur. Toute reproduction sans autorisation est interdite.',
    'legal.contact.title': '4. Contact',
    'legal.contact.content': 'contact@froment.software',

    'privacy.kicker': 'Confidentialité',
    'privacy.title': 'Politique de confidentialité',
    'privacy.updated': 'Dernière mise à jour : mai 2026',
    'privacy.who.title': '1. Qui sommes-nous ?',
    'privacy.who.content': 'froment.software est édité par Sacha FROMENT. Contact : contact@froment.software.',
    'privacy.data.title': '2. Données collectées',
    'privacy.data.content': 'Ce site ne collecte aucune donnée personnelle sans consentement explicite. Aucun formulaire, aucun cookie tiers, aucun tracker. Les logs serveur peuvent contenir l\'adresse IP, conservés 14 jours maximum.',
    'privacy.cookies.title': '3. Cookies',
    'privacy.cookies.content': 'Ce site utilise des cookies strictement nécessaires à son fonctionnement (session, préférences de langue). Aucun cookie publicitaire ou de suivi n\'est déposé. Voir la page Cookies pour plus de détails.',
    'privacy.rights.title': '4. Vos droits',
    'privacy.rights.content': 'Conformément au RGPD, vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données. Pour l\'exercer : contact@froment.software.',
    'privacy.contact.title': '5. Contact',
    'privacy.contact.content': 'Pour toute question relative à vos données : contact@froment.software.',

    'cookies.kicker': 'Cookies',
    'cookies.title': "Politique d\'utilisation des cookies",
    'cookies.updated': 'Dernière mise à jour : mai 2026',
    'cookies.what.title': '1. Que sont les cookies ?',
    'cookies.what.content': 'Les cookies sont de petits fichiers texte déposés sur votre navigateur lors de la visite d\'un site. froment.software en utilise le minimum possible.',
    'cookies.why.title': '2. Cookies utilisés',
    'cookies.why.content': 'Cookies essentiels : session utilisateur, préférence de langue. Aucun cookie tiers, analytics ou publicitaire.',
    'cookies.control.title': '3. Gestion des cookies',
    'cookies.control.content': 'Vous pouvez configurer vos préférences via les paramètres de votre navigateur. Le blocage des cookies essentiels peut affecter le fonctionnement du site.',
    'cookies.contact.title': '4. Contact',
    'cookies.contact.content': 'contact@froment.software',
  },
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.products': 'Products',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'nav.legal': 'Legal notice',
    'nav.privacy': 'Privacy policy',
    'nav.cookies': 'Cookies',
    'brand.home': 'froment.software home',
    'nav.primary': 'Primary navigation',

    'page.home': 'froment.software',
    'page.clients': 'Our clients — froment.software',
    'page.services': 'Our services — froment.software',
    'page.products': 'Our products — froment.software',
    'page.showcase': 'Design system — froment.software',

    'page.about': 'About — froment.software',
    'page.description.about': 'Sacha FROMENT, software engineer — enterprise applications, legacy and consulting expertise.',

    'page.legal': 'Legal notice — froment.software',
    'page.description.legal': 'Legal notice of froment.software, publisher and data controller.',

    'page.privacy': 'Privacy policy — froment.software',
    'page.description.privacy': 'Privacy policy and data protection of froment.software.',

    'page.cookies': 'Cookies — froment.software',
    'page.description.cookies': "Cookie usage policy of froment.software.",
    'page.not_found': 'Page not found — froment.software',
    'page.description.not_found': 'Oops! Page not found.',
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
    'clients.ref.title': 'Client references',
    'clients.ref.copy': 'We work with companies across various industries. Detailed references are available on request.',
    'clients.ref.contact_title': 'Get in touch',
    'clients.ref.contact_copy': 'Want to know more about our past engagements? Contact us.',
    'clients.ref.contact_cta': 'Contact us',
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

    'about.kicker': 'About',
    'about.title': 'Sacha FROMENT.',
    'about.lead': 'Software engineer, 5 years of experience in enterprise software. From legacy maintenance to innovation on modern applications.',
    'about.bio.title': 'Who I am',
    'about.bio.intro': "I'm Sacha FROMENT, a software engineer specialized in enterprise applications. My day-to-day ranges from maintaining and evolving long-lived legacy systems to innovating, upgrading and building greenfield on newer applications.",
    'about.bio.experience': 'Over the last 5 years, I have worked on projects from taking over aging applications — gradual cleanup, refactoring without pointless rewrites — to designing and delivering new solutions for web, desktop and CLI.',
    'about.bio.years': 'Years of exp.',
    'about.bio.ref1': 'Railway industry',
    'about.bio.ref2': 'Insurance',
    'about.bio.ref3': 'Funeral services',
    'about.faq.title': 'Frequently asked questions',
    'about.faq.intro': 'While I write the answers, here are the questions I get asked the most.',
    'about.faq.placeholder': 'Answer coming soon…',
    'about.faq.process.q': 'What is your work process?',
    'about.faq.stack.q': 'What is your usual tech stack?',
    'about.faq.remote.q': 'Do you work remotely?',
    'about.faq.nda.q': 'Do you accept NDAs?',
    'about.faq.timeline.q': 'What are typical timelines?',
    'about.faq.maintenance.q': 'Do you offer post-delivery maintenance?',
    'about.faq.pricing.q': 'How are your services billed?',
    'about.faq.availability.q': 'What is your current availability?',
    'about.faq.process.a': 'Discovery → quote → development → delivery → support.',
    'about.faq.stack.a': 'SvelteKit (Svelte 5), ASP.NET 10, Angular 17-21, WinForm/WPF, Linux (NixOS), SQLite/PostgreSQL, Odin, Go (Fiber, orchestrators).',
    'about.faq.remote.a': 'Yes, 100% remote.',
    'about.faq.nda.a': 'On request.',
    'about.faq.timeline.a': "Depends on the project scope — defined in the quote.",
    'about.faq.maintenance.a': 'Yes, post-delivery maintenance available.',
    'about.faq.pricing.a': 'Fixed price.',
    'about.faq.availability.a': 'Part-time.',
    'not_found.title': 'Lost?',
    'not_found.lead': "I didn't see that page around.",
    'not_found.sub': 'Maybe it\'s being built, or maybe you typed wrong.',
    'not_found.cta': 'Back home',


    'about.contact.title': "Let's work together",
    'about.contact.copy': 'Have a project in mind? Let\'s talk.',
    'about.contact.mail': 'Email me',
    'about.contact.book': 'Book a slot',

    'legal.kicker': 'Legal',
    'legal.title': 'Legal notice',
    'legal.updated': 'Last updated: May 2026',
    'legal.publisher.title': '1. Publisher',
    'legal.publisher.content': 'Being set up — no registered legal entity yet. Contact: contact@froment.software',
    'legal.hosting.title': '2. Hosting',
    'legal.hosting.content': 'Self-hosted on personal infrastructure (homelab). Alternatives: OVH, Scaleway, Hetzner.',
    'legal.ip.title': '3. Intellectual property',
    'legal.ip.content': 'All content of froment.software is protected by copyright. Any reproduction without permission is prohibited.',
    'legal.contact.title': '4. Contact',
    'legal.contact.content': 'contact@froment.software',

    'privacy.kicker': 'Privacy',
    'privacy.title': 'Privacy policy',
    'privacy.updated': 'Last updated: May 2026',
    'privacy.who.title': '1. Who we are',
    'privacy.who.content': 'froment.software is published by Sacha FROMENT. Contact: contact@froment.software.',
    'privacy.data.title': '2. Data collected',
    'privacy.data.content': 'This site does not collect any personal data without explicit consent. No forms, no third-party cookies, no trackers. Server logs may contain IP addresses, retained for a maximum of 14 days.',
    'privacy.cookies.title': '3. Cookies',
    'privacy.cookies.content': 'This site uses strictly necessary cookies (session, language preference). No advertising or tracking cookies are placed. See the Cookies page for details.',
    'privacy.rights.title': '4. Your rights',
    'privacy.rights.content': 'Under GDPR, you have the right to access, rectify and delete your data. To exercise it: contact@froment.software.',
    'privacy.contact.title': '5. Contact',
    'privacy.contact.content': 'For any questions about your data: contact@froment.software.',

    'cookies.kicker': 'Cookies',
    'cookies.title': 'Cookie policy',
    'cookies.updated': 'Last updated: May 2026',
    'cookies.what.title': '1. What are cookies?',
    'cookies.what.content': 'Cookies are small text files stored on your browser when visiting a website. froment.software uses the bare minimum.',
    'cookies.why.title': '2. Cookies used',
    'cookies.why.content': 'Essential cookies: user session, language preference. No third-party, analytics or advertising cookies.',
    'cookies.control.title': '3. Cookie management',
    'cookies.control.content': 'You can configure your preferences via your browser settings. Blocking essential cookies may affect site functionality.',
    'cookies.contact.title': '4. Contact',
    'cookies.contact.content': 'contact@froment.software',
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
