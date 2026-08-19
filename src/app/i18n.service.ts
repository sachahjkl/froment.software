import { DOCUMENT } from '@angular/common';
import { afterNextRender, effect, inject, Injectable, signal } from '@angular/core';

export type Language = 'fr' | 'en';

export type TranslationKey = keyof typeof translations.fr;

const storageKey = 'froment.software.language';
const isoDateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.about': 'FAQ',
    'nav.products': 'Projets',
    'nav.services': 'Prestations',
    'nav.clients': 'Clients',
    'nav.legal': 'Mentions légales',
    'nav.privacy': 'Confidentialité',
    'nav.cookies': 'Cookies',
    'nav.blog': 'Blog',
    'brand.home': 'froment.software accueil',
    'nav.primary': 'Navigation principale',
    'shell.skip': 'Aller au contenu',
    'shell.menu': 'Menu',
    'shell.menu.open': 'Ouvrir le menu',
    'shell.menu.close': 'Fermer le menu',
    'shell.legal_nav': 'Navigation juridique',
    'shell.copy_link': 'Copier le lien vers cette section',
    'shell.link_copied': 'Lien copié dans le presse-papiers',
    'shell.theme.dark': 'Activer le mode sombre',
    'shell.theme.light': 'Activer le mode clair',

    'page.home': 'Froment Software | Audit et rénovation de logiciels',
    'page.clients': 'Références | froment.software',
    'page.services': 'Prestations | froment.software',
    'page.service.renovation': 'Audit et rénovation | froment.software',
    'page.service.development': 'Développement tout compris | froment.software',
    'page.products': 'Projets publics | froment.software',
    'page.design': 'Proposition visuelle | froment.software',
    'page.description.design':
      'Proposition de mise en page sobre et directe pour le site de Sacha Froment, ingénieur logiciel indépendant.',

    'page.about': 'À propos | froment.software',
    'page.description.about':
      'Questions fréquentes sur les missions, les technologies, les délais, la maintenance et la facturation.',

    'page.legal': 'Mentions légales | froment.software',
    'page.description.legal':
      'Édition, hébergement, propriété intellectuelle et contact du site froment.software.',

    'page.privacy': 'Confidentialité | froment.software',
    'page.description.privacy':
      'Données techniques, stockage local et contacts liés à la confidentialité sur froment.software.',

    'page.cookies': 'Cookies et stockage local | froment.software',
    'page.description.cookies':
      'Cookies, préférence de langue et contrôle du stockage local utilisé par froment.software.',
    'page.not_found': 'Page introuvable | froment.software',
    'page.blog': 'Blog technique | froment.software',
    'page.description.blog':
      'Articles techniques, retours d’expérience et idées de Froment Software.',
    'page.back_office': 'Back office',
    'page.description.back_office': 'Accès privé aux documents de Froment Software.',
    'page.business_card': 'Carte de visite',
    'page.description.business_card': 'Aperçu imprimable de la carte de visite Froment Software.',
    'page.description.not_found': 'La page demandée n’existe pas ou a changé d’adresse.',
    'page.description.home':
      'Audit, reprise et rénovation de logiciels existants. Développement complet d’applications métier sur mesure.',
    'page.description.clients': 'Secteurs d’expérience de Sacha Froment.',
    'page.description.services':
      'Audit et rénovation d’applications existantes, ou développement complet de logiciels métier.',
    'page.description.service.renovation':
      'Audit technique, plan d’amélioration et rénovation progressive de logiciels métier existants.',
    'page.description.service.development':
      'Conception, réalisation, tests et déploiement de logiciels métier sur mesure.',
    'page.description.products': 'Prototypes, démonstrations et sites publics de Sacha Froment.',
    'meta.socialImageAlt': 'Logo Froment Software',

    'footer.rights': '© {year} froment.software. Tous droits réservés.',
    'footer.language': 'Langue',
    'lang.fr': 'Français',
    'lang.en': 'English',

    'design.hero.title': 'Nous construisons et reprenons des logiciels métier.',
    'design.hero.lead':
      'Applications web, logiciels de bureau et outils internes. Nous intervenons aussi sur les bases de code qui fonctionnent encore, mais que plus personne ne veut toucher.',
    'design.hero.mail': 'Nous écrire',
    'design.hero.work': 'Voir notre travail',
    'design.facts.title': 'En pratique',
    'design.facts.schedule': 'Missions à temps partiel',
    'design.facts.price': 'Forfait après cadrage',
    'design.facts.languages': 'Français et anglais',
    'design.facts.handover': 'Code et documentation transmis',
    'design.work.label': 'Notre travail',
    'design.work.title': 'Trois types de missions.',
    'design.work.build.title': 'Créer un outil',
    'design.work.build.copy':
      'Transformer un processus concret en application utilisable, déployée et documentée.',
    'design.work.build.web': 'application web ou desktop',
    'design.work.build.internal': 'outil interne ou ligne de commande',
    'design.work.build.delivery': 'interface, données et mise en service',
    'design.work.renovate.title': 'Rénover un existant',
    'design.work.renovate.copy':
      'Comprendre une application fragile, la remettre au propre puis la faire évoluer sans tout réécrire.',
    'design.work.renovate.read': 'lecture et exécution du code',
    'design.work.renovate.upgrade': 'corrections et mises à niveau',
    'design.work.renovate.refactor': 'refactorisation progressive',
    'design.work.decide.title': 'Débloquer une décision',
    'design.work.decide.copy':
      'Examiner un problème technique avant qu’il ne devienne un projet trop gros ou une mauvaise réécriture.',
    'design.work.decide.audit': 'audit ciblé',
    'design.work.decide.scope': 'cadrage et options chiffrées',
    'design.work.decide.report': 'recommandation écrite',
    'design.profile.label': 'Qui fait le travail ?',
    'design.profile.role':
      'Ingénieur logiciel. Vous parlez avec la personne qui lit le code, propose la solution et la livre.',
    'design.profile.copy':
      'Nous avons travaillé sur des applications utilisées dans le ferroviaire, l’assurance et les services. Notre terrain couvre Angular, SvelteKit, ASP.NET, WPF, Go, Linux et PostgreSQL.',
    'design.method.label': 'Fonctionnement',
    'design.method.title': 'Pas de grand cérémonial.',
    'design.method.copy':
      'Il faut surtout un problème réel, un interlocuteur disponible et un moyen de vérifier le résultat.',
    'design.method.explain.title': 'Vous expliquez.',
    'design.method.explain.copy': 'Contexte, logiciel, contrainte et échéance.',
    'design.method.review.title': 'Nous vérifions.',
    'design.method.review.copy': 'Adéquation, risques et première étape utile.',
    'design.method.scope.title': 'On cadre.',
    'design.method.scope.copy': 'Périmètre, livrables, prix et validations.',
    'design.method.deliver.title': 'Nous livrons.',
    'design.method.deliver.copy': 'Par étapes visibles, jusqu’à la mise en service.',
    'design.contact.label': 'Premier échange',
    'design.contact.title': 'Qu’est-ce qui vous bloque ?',
    'design.contact.copy':
      'Un e-mail de quelques lignes suffit. Ajoutez le contexte, le problème principal et l’échéance connue.',
    'design.contact.book': 'Prendre rendez-vous',
    'design.components.title': 'Référence des composants',
    'design.components.intro': 'Éléments réellement disponibles sur le site.',
    'design.components.buttons': 'Boutons',
    'design.components.default': 'Défaut',
    'design.components.primary': 'Principal',
    'design.components.info': 'Information',
    'design.components.success': 'Succès',
    'design.components.warning': 'Attention',
    'design.components.danger': 'Danger',
    'design.components.dark': 'Sombre',
    'design.components.link_button': 'Bouton lien',
    'design.components.disabled': 'Désactivé',
    'design.components.links': 'Liens',
    'design.components.forms': 'Formulaire',
    'design.components.name': 'Nom',
    'design.components.email': 'E-mail',
    'design.components.subject': 'Sujet',
    'design.components.message': 'Message',
    'design.components.password': 'Mot de passe',
    'design.components.search': 'Recherche',
    'design.components.phone': 'Téléphone',
    'design.components.url': 'URL',
    'design.components.number': 'Nombre',
    'design.components.date': 'Date',
    'design.components.time': 'Heure',
    'design.components.datetime': 'Date et heure',
    'design.components.month': 'Mois',
    'design.components.week': 'Semaine',
    'design.components.color': 'Couleur',
    'design.components.file': 'Fichier',
    'design.components.range': 'Plage',
    'design.components.checkboxes': 'Cases à cocher',
    'design.components.radios': 'Boutons radio',
    'design.components.option_one': 'Première option',
    'design.components.option_two': 'Deuxième option',
    'design.components.notices': 'Messages',
    'design.components.data': 'Tableau',
    'design.components.service': 'Service',
    'design.components.status': 'Statut',
    'design.components.details': 'Détails natifs',
    'design.components.details_summary': 'Afficher les conditions de livraison',
    'design.components.details_copy':
      'Le code, la documentation et les instructions de mise en service font partie de la livraison.',

    'home.hero.title.part1a': 'Applications',
    'home.hero.title.part1b': 'sur mesure',
    'home.hero.title.sep1': 'pour le web, le desktop,',
    'home.hero.title.part2a': 'les outils',
    'home.hero.title.part2b': 'internes',
    'home.hero.title.sep2': 'et la',
    'home.hero.title.part3a': 'rénovation',
    'home.hero.title.part3b': 'de legacy',
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Audit et rénovation de logiciels métier.',
    'home.hero.lead':
      'Nous analysons vos applications, identifions leurs points faibles, puis modernisons leur code et leur environnement.',
    'home.hero.book': 'Prendre rendez-vous',
    'home.engage.title': 'Contact',
    'home.engage.mail': 'Nous écrire',
    'home.engage.subject': 'Premier échange',
    'home.engage.body':
      'Bonjour,\n\nJe vous contacte au sujet du besoin suivant :\n\n- Contexte :\n- Problème principal :\n- Échéance connue :\n\nMerci.',

    'home.timeline.title': 'Projets publics',
    'home.expertise.title': 'Expertise technique',
    'home.expertise.development.title': 'Développement logiciel',
    'home.expertise.development.beforeGo': 'Utilisation de',
    'home.expertise.development.afterGo':
      'comme langage de prédilection. Chaîne complète et reproductible, du build à l’installation, pour',
    'home.expertise.upgrades':
      'Montée de version des dépendances et bibliothèques, traitement des incompatibilités et validation par les tests.',
    'home.expertise.build.before': 'Builds reproductibles avec',
    'home.expertise.build.after':
      ': dépendances déclarées, environnements identiques et cache partagé.',
    'home.expertise.ci':
      'Optimisation de CI existantes par suppression des tâches inutiles, parallélisation et mise en cache.',
    'home.expertise.tests':
      'Mise en place de tests unitaires, d’intégration et d’architecture pour stabiliser l’existant et vérifier automatiquement le fonctionnement de l’application.',
    'home.expertise.environments':
      'Environnements de développement reproductibles et automatisés avec',
    'home.expertise.secrets.before':
      'Gestion centralisée des secrets sur site, dans le cloud ou avec une solution légère :',
    'home.expertise.secrets.after': 'Injection automatisée dans les applications avec',
    'home.expertise.secrets.scan':
      'Détection des secrets présents dans le code et l’historique Git avec',
    'home.expertise.ai.before':
      'Agents spécialisés pour la préparation du backlog, l’analyse en réunion et le prototypage en direct avec',
    'home.expertise.ai.after': 'Suivi des volumes, modèles et coûts avec',
    'home.expertise.metrics.before':
      'Mesure des temps de réponse, de test, de build, de CI et de déploiement. Publication d’indicateurs dans',
    'home.expertise.metrics.after': 'à partir de valeurs mesurées.',
    'home.expertise.infrastructure':
      'Infrastructure et déploiements reproductibles sur site ou dans le cloud avec NixOS, cache de build et infrastructure as code via',
    'home.timeline.intro':
      'Trois points d’entrée consultables pour examiner des choix de produit, d’interface et d’architecture.',
    'home.timeline.albumator.desc': 'Gestion et partage de bibliothèques d’images.',
    'home.timeline.albumator.cta': 'Ouvrir Albumator',
    'home.timeline.htmx.desc': 'Démonstration HTMX avec un serveur Go et Fiber.',
    'home.timeline.htmx.cta': 'Ouvrir la démonstration',
    'home.timeline.sacha.desc': 'Site personnel de Sacha Froment.',
    'home.timeline.sacha.cta': 'Voir le site',
    'home.timeline.clockin.desc': 'Application de pointage et de suivi du temps.',
    'home.timeline.clockin.cta': 'Ouvrir Clockin',
    'home.timeline.empty.title': 'Travaux non publics',
    'home.timeline.empty.desc':
      'Cette sélection se limite aux travaux consultables sans contexte confidentiel.',

    'home.services.title': 'Nos prestations',
    'home.services.cta': 'Voir nos prestations',
    'home.services.book': 'Réserver un créneau',
    'home.services.renovation.title': 'Audit et rénovation',
    'home.services.renovation.desc':
      'Analyser les projets, leur environnement et leurs lacunes, puis corriger et moderniser l’existant avec des résultats mesurables.',
    'home.services.development.title': 'Développement tout compris',
    'home.services.development.desc':
      'Concevoir, réaliser, tester et déployer une application métier ou un outil interne prêt à l’emploi.',
    'home.products.title': 'Produits',
    'home.products.note':
      'Aucun logiciel standard n’est commercialisé actuellement ; les besoins sont traités sur mesure.',
    'home.products.cta': 'Consulter le catalogue',
    'home.clients.title': 'Parcours',
    'home.clients.cv': 'Voir le CV complet',
    'home.clients.experience': 'Organisations de référence',
    'home.about.title': 'Qui sommes-nous ?',
    'home.about.sacha.role': 'Ingénieur logiciel.',
    'home.about.sacha.website': 'Visiter le site personnel de Sacha Froment',
    'home.about.cta': 'Consulter la FAQ',

    'products.title': 'Projets publics',
    'products.table.product': 'Produit',
    'products.table.type': 'Type',
    'products.table.license': 'Licence',
    'products.table.price': 'Prix',
    'products.empty.title': 'Aucun produit commercialisé',
    'products.empty.copy':
      'Les besoins actuels sont pris en charge sous forme de prestations sur mesure.',
    'products.catalog.intro':
      'Trois points d’entrée consultables, présentés comme des expérimentations et non comme des études de cas client.',
    'products.status.prototype': 'Prototype',
    'products.status.experiment': 'Expérimentation',
    'products.status.public': 'Espace public',

    'services.kicker': 'Prestations',
    'services.title': 'Auditer l’existant. Rénover ce qui compte.',
    'services.lead':
      'Nous proposons deux prestations : audit et rénovation, ou développement tout compris.',
    'services.quote': 'Demander un devis',
    'services.book': 'Prendre rendez-vous',
    'services.list.title': 'Nos prestations',
    'services.quote.subject': 'Demande de devis',
    'services.quote.body':
      'Bonjour,\n\nNous souhaitons échanger au sujet du projet suivant :\n\n- Contexte :\n- Besoin :\n- Périmètre :\n- Contraintes techniques :\n- Échéance souhaitée :\n- Budget indicatif :\n\nMerci.',
    'services.offer.renovation.title': 'Audit et rénovation',
    'services.offer.renovation.desc':
      'Nous analysons vos projets, leur environnement, leurs risques et leurs lacunes. Nous proposons ensuite des corrections, des mises à niveau, des automatisations et une refactorisation progressive.',
    'services.offer.renovation.cta': 'Voir le détail de l’audit et de la rénovation',
    'services.offer.development.title': 'Développement tout compris',
    'services.offer.development.desc':
      'Nous prenons en charge la conception, la réalisation, les tests et le déploiement d’une application métier ou d’un outil interne.',
    'services.offer.development.cta': 'Voir le détail du développement',
    'serviceDetail.back': 'Retour aux prestations',
    'serviceDetail.renovation.title': 'Audit et rénovation',
    'serviceDetail.renovation.lead':
      'Comprendre les problèmes réels avant d’investir, puis moderniser l’existant sans réécriture systématique.',
    'serviceDetail.renovation.scope.title': 'Ce que nous analysons et améliorons',
    'serviceDetail.renovation.scope.projects.title': 'Projets et architecture',
    'serviceDetail.renovation.scope.projects.desc':
      'Structure du code, dépendances, flux de données, points de fragilité et capacité d’évolution.',
    'serviceDetail.renovation.scope.delivery.title': 'Chaîne de livraison',
    'serviceDetail.renovation.scope.delivery.desc':
      'Builds, tests, intégration continue, déploiements et délais entre une modification et sa mise en service.',
    'serviceDetail.renovation.scope.quality.title': 'CVE, failles et secrets',
    'serviceDetail.renovation.scope.quality.desc':
      'Recherche de CVE et de failles avec des outils d’analyse statique adaptés aux langages. Détection des secrets présents dans le code et l’historique Git.',
    'serviceDetail.renovation.scope.quality.staticAnalysis': 'Outils d’analyse statique',
    'serviceDetail.renovation.scope.quality.trufflehog': 'TruffleHog',
    'serviceDetail.renovation.scope.environment.title': 'Environnement de travail',
    'serviceDetail.renovation.scope.environment.desc':
      'Installation locale, secrets, documentation, outils et difficultés rencontrées par l’équipe existante.',
    'serviceDetail.renovation.deliverables.title': 'Ce que vous recevez',
    'serviceDetail.renovation.deliverables.audit':
      'Un constat documenté, factuel et classé par niveau de risque.',
    'serviceDetail.renovation.deliverables.plan':
      'Un plan d’amélioration priorisé avec les coûts, les dépendances et les résultats attendus.',
    'serviceDetail.renovation.deliverables.work':
      'Les corrections et rénovations retenues dans le devis, validées sur votre environnement.',
    'serviceDetail.renovation.deliverables.handover':
      'Le code, les tests et les instructions nécessaires pour maintenir et faire évoluer le logiciel.',
    'serviceDetail.renovation.fit.title': 'Cette prestation est adaptée si…',
    'serviceDetail.renovation.fit.desc':
      'Votre logiciel reste utile, mais il devient lent à modifier, difficile à déployer ou risqué à maintenir.',
    'serviceDetail.development.title': 'Développement tout compris',
    'serviceDetail.development.lead':
      'Un interlocuteur unique pour transformer un besoin métier en logiciel testé, déployé et documenté.',
    'serviceDetail.development.scope.title': 'Une prestation complète',
    'serviceDetail.development.scope.design.title': 'Conception',
    'serviceDetail.development.scope.design.desc':
      'Clarification des usages, parcours, données, contraintes et critères de validation.',
    'serviceDetail.development.scope.build.title': 'Réalisation',
    'serviceDetail.development.scope.build.desc':
      'Développement de l’interface, des règles métier, des intégrations et des automatisations nécessaires.',
    'serviceDetail.development.scope.tests.title': 'Tests',
    'serviceDetail.development.scope.tests.desc':
      'Tests automatisés et validations fonctionnelles ciblés sur les usages et les risques du produit.',
    'serviceDetail.development.scope.deploy.title': 'Déploiement',
    'serviceDetail.development.scope.deploy.desc':
      'Mise en service reproductible, configuration des environnements et préparation de l’exploitation.',
    'serviceDetail.development.deliverables.title': 'Ce qui est inclus',
    'serviceDetail.development.deliverables.product':
      'Une application web, une application de bureau ou un outil interne conforme au périmètre validé.',
    'serviceDetail.development.deliverables.source':
      'Le code source et les dépendances nécessaires pour construire le produit.',
    'serviceDetail.development.deliverables.tests':
      'Les tests automatisés et les critères utilisés pour valider la livraison.',
    'serviceDetail.development.deliverables.operations':
      'La documentation et les instructions de déploiement, d’utilisation et de maintenance.',
    'serviceDetail.development.fit.title': 'Cette prestation est adaptée si…',
    'serviceDetail.development.fit.desc':
      'Vous avez un besoin métier précis et souhaitez confier toute la réalisation jusqu’à la mise en service.',
    'services.examples.title': 'Cas concrets',
    'services.examples.upgrades.title': 'Montées de version',
    'services.examples.upgrades.desc':
      'Mettre à niveau les dépendances et bibliothèques, traiter les incompatibilités puis valider le comportement par les tests.',
    'services.examples.build.title': 'Chaîne de build',
    'services.examples.build.before': 'Rendre les builds reproductibles avec',
    'services.examples.build.after':
      ': dépendances déclarées, environnements identiques et cache partagé.',
    'services.examples.ci.title': 'Intégration continue',
    'services.examples.ci.desc':
      'Reprendre une CI existante, supprimer les tâches inutiles, paralléliser les étapes et mettre en cache les résultats réutilisables.',
    'services.examples.tests.title': 'Tests automatisés',
    'services.examples.tests.desc':
      'Mettre en place des tests unitaires, d’intégration et d’architecture pour stabiliser l’existant et vérifier automatiquement le fonctionnement de l’application.',
    'services.examples.environments.title': 'Environnements de développement',
    'services.examples.environments.before':
      'Déclarer et automatiser des environnements reproductibles avec',
    'services.examples.secrets.title': 'Gestion des secrets',
    'services.examples.secrets.before':
      'Centraliser les secrets dans un coffre sur site, un service cloud ou une solution légère :',
    'services.examples.secrets.through': 'Automatiser leur injection dans les applications avec',
    'services.examples.ai.title': 'Agents IA',
    'services.examples.ai.before':
      'Intégrer des agents spécialisés aux échanges de conception : préparation du backlog, analyse pendant les réunions et prototypage en direct avec',
    'services.examples.ai.usage': 'Suivre les volumes, les modèles et les coûts avec',
    'services.examples.metrics.title': 'Mesures techniques',
    'services.examples.metrics.before':
      'Mesurer les temps de réponse, de test, de build, de CI et de déploiement. Publier des indicateurs horodatés dans',
    'services.examples.metrics.after':
      'afin de suivre des valeurs mesurées plutôt que des estimations.',
    'services.examples.infrastructure.title': 'Infrastructure et déploiement',
    'services.examples.infrastructure.before':
      'Déclarer, tester et reproduire les déploiements sur site ou dans le cloud avec NixOS, cache de build et infrastructure as code via',
    'services.examples.or': 'ou',
    'services.process.kicker': 'Méthode de livraison',
    'services.process.title': 'Déroulement d’une mission',
    'services.process.analysis.title': 'Qualifier le besoin',
    'services.process.analysis.desc':
      'Nous réalisons un examen initial limité pour comprendre le contexte et préparer le devis. L’audit approfondi commence après validation.',
    'services.process.quote.title': 'Établir le devis',
    'services.process.quote.desc':
      'Nous vous remettons un devis détaillé. Il précise les prestations, les livrables, le calendrier et le prix.',
    'services.process.agreement.title': 'Valider le cadre',
    'services.process.agreement.desc':
      'Vous acceptez la proposition. Si nous précisons ensuite un objectif ou le périmètre, nous vous soumettons un devis mis à jour avant de commencer.',
    'services.process.delivery.title': 'Réaliser la mission',
    'services.process.delivery.desc':
      'Nous réalisons la mission au contact de vos interlocuteurs et de votre équipe de développement existante.',
    'services.process.validation.title': 'Valider la livraison',
    'services.process.validation.desc':
      'Vous validez les livrables selon les critères du devis, puis vous réglez le solde de la mission.',
    'services.practical.title': 'En pratique',
    'services.practical.method': 'Méthode',
    'services.practical.method.desc':
      'Le devis fixe le périmètre, le prix, les livrables et les critères d’acceptation.',
    'services.practical.schedule': 'Délais',
    'services.practical.schedule.desc':
      'Le calendrier est défini selon le périmètre, les dépendances et les validations attendues.',
    'services.practical.deliverables': 'Livrables',
    'services.practical.deliverables.desc':
      'Code source, tests, documentation et instructions de mise en service selon la mission.',
    'services.criteria.title': 'Éléments utiles pour commencer',
    'services.criteria.context': 'Le contexte et les utilisateurs concernés.',
    'services.criteria.problem': 'Le problème principal ou le résultat attendu.',
    'services.criteria.deadline': 'L’échéance connue et les contraintes techniques.',
    'serviceDetail.contact.title': 'Échanger sur votre besoin',

    'clients.title': 'Expérience',
    'clients.sectors.title': 'Secteurs d’expérience',
    'clients.cv': 'Voir le CV complet',
    'clients.sector.industry': 'Industrie',
    'clients.sector.insurance': 'Assurance',
    'clients.sector.services': 'Services',

    'about.faq.title': 'Questions fréquentes',
    'about.faq.intro': 'Des réponses directes sur le fonctionnement d’une collaboration.',
    'about.faq.process.q': 'Comment se déroule une mission ?',
    'about.faq.stack.q': 'Comment choisissez-vous les technologies ?',
    'about.faq.remote.q': 'Travaillez-vous à distance ?',
    'about.faq.nda.q': 'Acceptez-vous les accords de confidentialité ?',
    'about.faq.timeline.q': 'Comment fixez-vous le calendrier ?',
    'about.faq.maintenance.q': 'Proposez-vous une maintenance après livraison ?',
    'about.faq.pricing.q': 'Comment les prestations sont-elles facturées ?',
    'about.faq.availability.q': 'Quelle est votre disponibilité ?',
    'about.faq.process.a':
      'Un premier échange précise le besoin, les contraintes et les critères de réussite. Le devis fixe ensuite le périmètre, les livrables et les modalités de suivi avant le développement et la mise en service.',
    'about.faq.stack.a':
      'Le choix dépend du produit, de l’équipe et du système existant. Technologies utilisées : Angular, SvelteKit, ASP.NET, WPF, Go, Linux et PostgreSQL.',
    'about.faq.remote.a':
      'Oui, le travail se fait principalement à distance, avec des points de suivi convenus selon la mission.',
    'about.faq.nda.a':
      'Oui, après accord sur les obligations, la durée et les informations concernées.',
    'about.faq.timeline.a':
      'Le calendrier dépend du périmètre, des dépendances et des validations attendues. Il est défini dans le devis plutôt que promis avant le cadrage.',
    'about.faq.maintenance.a':
      'Oui. Correctifs, mises à jour et évolutions peuvent être prévus dès le devis ou convenus après la livraison.',
    'about.faq.pricing.a':
      'Au forfait lorsque le périmètre est suffisamment stable. Les incertitudes sont d’abord isolées dans une phase de cadrage.',
    'about.faq.availability.a':
      'Les missions sont planifiées à temps partiel. La date de début est confirmée avant le devis.',
    'not_found.title': 'Cette page n’existe pas.',
    'not_found.lead': 'Vérifiez l’adresse ou revenez à l’accueil.',
    'not_found.cta': 'Retour à l’accueil',
    'not_found.links_label': 'Prochaines étapes',
    'not_found.services': 'Voir les prestations',
    'not_found.contact': 'Écrire à Froment Software',

    'about.contact.title': 'Contact',
    'about.contact.mail': 'Nous écrire',
    'about.contact.book': 'Prendre rendez-vous',
    'blog.title': 'Blog',
    'blog.lead': 'Notes techniques, retours d’expérience et idées.',
    'blog.topics': 'Sujets',
    'blog.back': 'Retour au blog',
    'blog.missing': 'Article introuvable',

    'legal.kicker': 'Informations du site',
    'legal.title': 'Mentions légales',
    'legal.lead':
      'Les informations essentielles sur l’édition, l’hébergement et l’utilisation des contenus de froment.software.',
    'legal.updated': 'Mis à jour le 13 juillet 2026',
    'legal.summary.title': 'En bref',
    'legal.summary.content':
      'froment.software présente l’activité et les services de conseil en ingénierie logicielle de Sacha FROMENT. Aucun achat ni compte utilisateur n’est proposé sur ce site.',
    'legal.publisher.title': 'Édition du site',
    'legal.publisher.content':
      'Le site froment.software est édité et maintenu par Sacha FROMENT. Les demandes administratives ou juridiques peuvent être adressées par e-mail.',
    'legal.hosting.title': 'Hébergement',
    'legal.hosting.content':
      'Le site est servi comme un site statique et hébergé sur une infrastructure privée administrée par l’éditeur. Les demandes techniques relatives à l’hébergement peuvent être envoyées au même contact.',
    'legal.ip.title': 'Contenus et propriété intellectuelle',
    'legal.ip.content':
      'Sauf mention contraire, les textes, éléments graphiques et composants propres à froment.software restent la propriété de leur auteur. Une citation courte avec attribution est possible ; toute autre réutilisation doit faire l’objet d’un accord préalable.',
    'legal.links.title': 'Liens externes',
    'legal.links.content':
      'Le site renvoie vers des démonstrations, un service de prise de rendez-vous et d’autres sites. Leur contenu et leurs pratiques relèvent de leurs éditeurs respectifs.',
    'legal.contact.title': 'Contact',
    'legal.contact.content':
      'Pour une question relative au site, à un contenu ou à une demande juridique :',
    'legal.related.title': 'Documents associés',
    'legal.related.content':
      'Consultez également les informations sur les données techniques et le stockage du choix de langue.',
    'legal.related.privacy': 'Politique de confidentialité',
    'legal.related.cookies': 'Cookies et stockage local',

    'privacy.kicker': 'Données et navigation',
    'privacy.title': 'Politique de confidentialité',
    'privacy.lead':
      'Ce que ce site traite automatiquement, ce qu’il conserve dans votre navigateur et comment poser une question.',
    'privacy.updated': 'Mis à jour le 13 juillet 2026',
    'privacy.summary.title': 'À retenir',
    'privacy.summary.content':
      'Le site n’intègre ni formulaire de contact, ni outil publicitaire, ni mesure d’audience. Le serveur peut toutefois journaliser les requêtes techniques, et le navigateur conserve le choix de langue dans son stockage local.',
    'privacy.who.title': 'Responsable du site',
    'privacy.who.content':
      'Sacha FROMENT édite froment.software et répond aux demandes relatives aux données traitées par ce site.',
    'privacy.data.title': 'Journaux techniques du serveur',
    'privacy.data.content':
      'Lors du chargement d’une page ou d’un fichier, le serveur peut journaliser automatiquement des données de requête telles que l’adresse IP, la date et l’heure, le chemin demandé, l’agent utilisateur et le code de réponse. Cette journalisation technique résulte de la requête adressée au serveur ; elle n’est pas présentée comme reposant sur un consentement. Elle peut servir au diagnostic, à la disponibilité et à la sécurité du service.',
    'privacy.retention.title': 'Conservation des journaux',
    'privacy.retention.content':
      'Aucune durée fixe n’est annoncée ici, car elle dépend de la configuration d’exploitation. Vous pouvez demander les informations à jour sur la conservation ou le traitement d’une requête précise.',
    'privacy.storage.title': 'Préférence de langue',
    'privacy.storage.content':
      'Le site enregistre la langue choisie dans le stockage local du navigateur sous la clé « froment.software.language », avec la valeur « fr » ou « en ». Ce réglage persiste jusqu’à sa modification ou sa suppression depuis le navigateur. Il ne s’agit ni d’un cookie ni d’une session.',
    'privacy.external.title': 'E-mail et services externes',
    'privacy.external.content':
      'Les liens de contact ouvrent votre logiciel de messagerie ; aucun message n’est envoyé par le site lui-même. Si vous suivez un lien vers un autre domaine, ce service applique ses propres règles de traitement.',
    'privacy.rights.title': 'Demandes relatives aux données',
    'privacy.rights.content':
      'Vous pouvez demander quelles données techniques sont disponibles, signaler une erreur ou solliciter une suppression lorsque la requête peut être identifiée. Une adresse IP, une date et une plage horaire peuvent être nécessaires pour retrouver une ligne de journal. Cette présentation est informative et ne constitue pas un conseil juridique.',
    'privacy.contact.title': 'Contact',
    'privacy.contact.content': 'Pour une question ou une demande liée à la confidentialité :',
    'privacy.related.title': 'À lire aussi',
    'privacy.related.cookies': 'Détail des cookies et du stockage local',
    'privacy.related.legal': 'Mentions légales',

    'cookies.kicker': 'Stockage du navigateur',
    'cookies.title': 'Cookies et stockage local',
    'cookies.lead':
      'Le site ne dépose pas de cookie. Il mémorise uniquement la langue d’affichage dans le stockage local du navigateur.',
    'cookies.updated': 'Mis à jour le 13 juillet 2026',
    'cookies.summary.title': 'Situation actuelle',
    'cookies.summary.content':
      'Aucun cookie de session, de préférence, de mesure d’audience ou de publicité n’est créé par l’application froment.software.',
    'cookies.what.title': 'Différence entre cookie et stockage local',
    'cookies.what.content':
      'Un cookie peut être envoyé automatiquement au serveur avec une requête. Le stockage local reste dans le navigateur et n’est pas transmis automatiquement. froment.software utilise uniquement ce second mécanisme pour la langue.',
    'cookies.why.title': 'Réglage enregistré',
    'cookies.why.content':
      'La clé « froment.software.language » contient « fr » ou « en ». En l’absence de valeur valide, le site choisit le français si la langue du navigateur commence par « fr », et l’anglais dans les autres cas, puis mémorise ce choix localement.',
    'cookies.control.title': 'Modifier ou supprimer le réglage',
    'cookies.control.content':
      'Utilisez le sélecteur de langue dans l’en-tête pour remplacer la valeur. Vous pouvez aussi supprimer les données du site dans les réglages de votre navigateur. Le site continuera de fonctionner et détectera de nouveau la langue au prochain chargement.',
    'cookies.privacy.title': 'Données techniques',
    'cookies.privacy.content':
      'Le stockage local est distinct des journaux techniques que le serveur peut produire lorsqu’il répond à une requête.',
    'cookies.privacy.link': 'Lire la politique de confidentialité',
    'cookies.contact.title': 'Contact',
    'cookies.contact.content': 'Pour une question sur ce réglage ou le fonctionnement du site :',
  },
  en: {
    'nav.home': 'Home',
    'nav.about': 'FAQ',
    'nav.products': 'Projects',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'nav.legal': 'Legal notice',
    'nav.privacy': 'Privacy policy',
    'nav.cookies': 'Cookies',
    'nav.blog': 'Blog',
    'brand.home': 'froment.software home',
    'nav.primary': 'Primary navigation',
    'shell.skip': 'Skip to content',
    'shell.menu': 'Menu',
    'shell.menu.open': 'Open menu',
    'shell.menu.close': 'Close menu',
    'shell.legal_nav': 'Legal navigation',
    'shell.copy_link': 'Copy link to this section',
    'shell.link_copied': 'Link copied to clipboard',
    'shell.theme.dark': 'Use dark mode',
    'shell.theme.light': 'Use light mode',

    'page.home': 'Froment Software | Software audit and renovation',
    'page.clients': 'References | froment.software',
    'page.services': 'Services | froment.software',
    'page.service.renovation': 'Audit and renovation | froment.software',
    'page.service.development': 'All-inclusive development | froment.software',
    'page.products': 'Public projects | froment.software',
    'page.design': 'Visual proposal | froment.software',
    'page.description.design':
      'Plain, direct layout proposal for the website of independent software engineer Sacha Froment.',

    'page.about': 'About | froment.software',
    'page.description.about':
      'Frequently asked questions about engagements, technologies, schedules, maintenance and billing.',

    'page.legal': 'Legal notice | froment.software',
    'page.description.legal':
      'Publishing, hosting, intellectual property and contact information for froment.software.',

    'page.privacy': 'Privacy | froment.software',
    'page.description.privacy':
      'Technical request data, local storage and privacy contacts for froment.software.',

    'page.cookies': 'Cookies and local storage | froment.software',
    'page.description.cookies':
      'Cookies, language preference and local-storage controls used by froment.software.',
    'page.not_found': 'Page not found | froment.software',
    'page.blog': 'Technical blog | froment.software',
    'page.description.blog':
      'Technical articles, experience reports and ideas from Froment Software.',
    'page.back_office': 'Back office',
    'page.description.back_office': 'Private access to Froment Software documents.',
    'page.business_card': 'Business card',
    'page.description.business_card': 'Printable preview of the Froment Software business card.',
    'page.description.not_found':
      'Page not found. Return to the froment.software home page or services.',
    'page.description.home':
      'Audit, takeover and renovation of existing software. Complete custom business application development.',
    'page.description.clients': 'Sacha Froment’s industry experience.',
    'page.description.services':
      'Audit and renovation of existing applications, or complete business software development.',
    'page.description.service.renovation':
      'Technical audit, improvement plan and gradual renovation of existing business software.',
    'page.description.service.development':
      'Design, implementation, testing and deployment of custom business software.',
    'page.description.products': 'Public prototypes, demonstrations and websites by Sacha Froment.',
    'meta.socialImageAlt': 'Froment Software logo',

    'footer.rights': '© {year} froment.software. All rights reserved.',
    'footer.language': 'Language',
    'lang.fr': 'French',
    'lang.en': 'English',

    'design.hero.title': 'We build and take over business software.',
    'design.hero.lead':
      'Web applications, desktop software and internal tools. We also work on existing codebases.',
    'design.hero.mail': 'Email us',
    'design.hero.work': 'See our work',
    'design.facts.title': 'In practice',
    'design.facts.schedule': 'Part-time engagements',
    'design.facts.price': 'Fixed price after scoping',
    'design.facts.languages': 'French and English',
    'design.facts.handover': 'Code and documentation handed over',
    'design.work.label': 'Our work',
    'design.work.title': 'Three types of engagement.',
    'design.work.build.title': 'Build a tool',
    'design.work.build.copy':
      'Turn a real process into a usable, deployed and documented application.',
    'design.work.build.web': 'web or desktop application',
    'design.work.build.internal': 'internal tool or command line utility',
    'design.work.build.delivery': 'interface, data and rollout',
    'design.work.renovate.title': 'Renovate an existing system',
    'design.work.renovate.copy':
      'Understand a fragile application, clean it up and evolve it without rewriting everything.',
    'design.work.renovate.read': 'code review and local execution',
    'design.work.renovate.upgrade': 'fixes and upgrades',
    'design.work.renovate.refactor': 'gradual refactoring',
    'design.work.decide.title': 'Unblock a decision',
    'design.work.decide.copy':
      'Review a technical problem before it becomes an oversized project or a bad rewrite.',
    'design.work.decide.audit': 'focused audit',
    'design.work.decide.scope': 'scoping and costed options',
    'design.work.decide.report': 'written recommendation',
    'design.profile.label': 'Who does the work?',
    'design.profile.role':
      'Software engineer. You speak with the person who reads the code, proposes the solution and delivers it.',
    'design.profile.copy':
      'We have worked on applications used in railway, insurance and service businesses. Our working stack includes Angular, SvelteKit, ASP.NET, WPF, Go, Linux and PostgreSQL.',
    'design.method.label': 'How it works',
    'design.method.title': 'No grand ceremony.',
    'design.method.copy':
      'The essentials are a real problem, an available contact and a way to verify the result.',
    'design.method.explain.title': 'You explain.',
    'design.method.explain.copy': 'Context, software, constraint and deadline.',
    'design.method.review.title': 'We review.',
    'design.method.review.copy': 'Fit, risks and the first useful step.',
    'design.method.scope.title': 'We scope.',
    'design.method.scope.copy': 'Scope, deliverables, price and approvals.',
    'design.method.deliver.title': 'We deliver.',
    'design.method.deliver.copy': 'In visible steps, through rollout.',
    'design.contact.label': 'First conversation',
    'design.contact.title': 'What is blocking you?',
    'design.contact.copy':
      'A short email is enough. Include the context, main problem and known deadline.',
    'design.contact.book': 'Book an appointment',
    'design.components.title': 'Component reference',
    'design.components.intro': 'Elements that are actually available across the website.',
    'design.components.buttons': 'Buttons',
    'design.components.default': 'Default',
    'design.components.primary': 'Primary',
    'design.components.info': 'Information',
    'design.components.success': 'Success',
    'design.components.warning': 'Warning',
    'design.components.danger': 'Danger',
    'design.components.dark': 'Dark',
    'design.components.link_button': 'Link button',
    'design.components.disabled': 'Disabled',
    'design.components.links': 'Links',
    'design.components.forms': 'Form',
    'design.components.name': 'Name',
    'design.components.email': 'Email',
    'design.components.subject': 'Subject',
    'design.components.message': 'Message',
    'design.components.password': 'Password',
    'design.components.search': 'Search',
    'design.components.phone': 'Phone',
    'design.components.url': 'URL',
    'design.components.number': 'Number',
    'design.components.date': 'Date',
    'design.components.time': 'Time',
    'design.components.datetime': 'Date and time',
    'design.components.month': 'Month',
    'design.components.week': 'Week',
    'design.components.color': 'Color',
    'design.components.file': 'File',
    'design.components.range': 'Range',
    'design.components.checkboxes': 'Checkboxes',
    'design.components.radios': 'Radio buttons',
    'design.components.option_one': 'First option',
    'design.components.option_two': 'Second option',
    'design.components.notices': 'Messages',
    'design.components.data': 'Table',
    'design.components.service': 'Service',
    'design.components.status': 'Status',
    'design.components.details': 'Native details',
    'design.components.details_summary': 'Show delivery terms',
    'design.components.details_copy':
      'Code, documentation and rollout instructions are part of delivery.',

    'home.hero.title.part1a': 'Custom',
    'home.hero.title.part1b': 'applications',
    'home.hero.title.sep1': 'for web, desktop,',
    'home.hero.title.part2a': 'internal',
    'home.hero.title.part2b': 'tools',
    'home.hero.title.sep2': 'and',
    'home.hero.title.part3a': 'legacy',
    'home.hero.title.part3b': 'renovation',
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Business software audit and renovation.',
    'home.hero.lead':
      'We assess your applications, identify their weak points, then modernize their code and environment.',
    'home.hero.book': 'Book an appointment',
    'home.engage.title': 'Contact',
    'home.engage.mail': 'Email us',
    'home.engage.subject': 'Initial discussion',
    'home.engage.body':
      'Hello,\n\nI am contacting you about the following need:\n\n- Context:\n- Main problem:\n- Known deadline:\n\nThank you.',

    'home.timeline.title': 'Public projects',
    'home.expertise.title': 'Technical expertise',
    'home.expertise.development.title': 'Software development',
    'home.expertise.development.beforeGo': 'Use of',
    'home.expertise.development.afterGo':
      'as our preferred language. Complete, reproducible pipeline from build to installation for',
    'home.expertise.upgrades':
      'Dependency and library upgrades, incompatibility resolution and test-based validation.',
    'home.expertise.build.before': 'Reproducible builds with',
    'home.expertise.build.after':
      ': declared dependencies, identical environments and shared caches.',
    'home.expertise.ci':
      'Existing CI optimization through work removal, parallel execution and caching.',
    'home.expertise.tests':
      'Unit, integration and architecture tests to stabilize existing software and automatically verify application behaviour.',
    'home.expertise.environments': 'Reproducible, automated development environments with',
    'home.expertise.secrets.before':
      'Centralized secret management on premises, in the cloud or with a lightweight solution:',
    'home.expertise.secrets.after': 'Automated injection into applications with',
    'home.expertise.secrets.scan': 'Detection of secrets in source code and Git history with',
    'home.expertise.ai.before':
      'Specialized agents for backlog preparation, meeting analysis and live prototyping with',
    'home.expertise.ai.after': 'Usage, model and cost tracking with',
    'home.expertise.metrics.before':
      'Measurement of response, test, build, CI and deployment times. Indicator publication to',
    'home.expertise.metrics.after': 'from measured values.',
    'home.expertise.infrastructure':
      'Reproducible on-premises or cloud infrastructure and deployments with NixOS, build caching and infrastructure as code through',
    'home.timeline.intro':
      'Three public entry points for examining product, interface and architecture decisions.',
    'home.timeline.albumator.desc': 'Image library management and sharing.',
    'home.timeline.albumator.cta': 'Open Albumator',
    'home.timeline.htmx.desc': 'HTMX demonstration with a Go and Fiber server.',
    'home.timeline.htmx.cta': 'Open demonstration',
    'home.timeline.sacha.desc': 'Sacha Froment’s personal website.',
    'home.timeline.sacha.cta': 'View site',
    'home.timeline.clockin.desc': 'Clock-in and time-tracking application.',
    'home.timeline.clockin.cta': 'Open Clockin',
    'home.timeline.empty.title': 'Non-public work',
    'home.timeline.empty.desc':
      'This selection is limited to work that can be viewed without confidential context.',

    'home.services.title': 'Our services',
    'home.services.cta': 'View our services',
    'home.services.book': 'Book a slot',
    'home.services.renovation.title': 'Audit and renovation',
    'home.services.renovation.desc':
      'Assess projects, their environment and their gaps, then fix and modernize existing software with measurable results.',
    'home.services.development.title': 'All-inclusive development',
    'home.services.development.desc':
      'Design, build, test and deploy a business application or internal tool that is ready to use.',
    'home.products.title': 'Products',
    'home.products.note':
      'No standard software is currently sold; current needs are handled as custom engagements.',
    'home.products.cta': 'View the catalogue',
    'home.clients.title': 'Background',
    'home.clients.cv': 'View full CV',
    'home.clients.experience': 'Reference organisations',
    'home.about.title': 'Who are we?',
    'home.about.sacha.role': 'Software engineer.',
    'home.about.sacha.website': 'Visit Sacha Froment’s personal website',
    'home.about.cta': 'Read the FAQ',

    'products.title': 'Public projects',
    'products.table.product': 'Product',
    'products.table.type': 'Type',
    'products.table.license': 'Licence',
    'products.table.price': 'Price',
    'products.empty.title': 'No product currently sold',
    'products.empty.copy':
      'Current needs are handled as custom consulting and delivery engagements.',
    'products.catalog.intro':
      'Three public entry points, presented as experiments rather than client case studies.',
    'products.status.prototype': 'Prototype',
    'products.status.experiment': 'Experiment',
    'products.status.public': 'Public space',

    'services.kicker': 'Services',
    'services.title': 'Audit what exists. Renovate what matters.',
    'services.lead': 'We provide two services: audit and renovation, or all-inclusive development.',
    'services.quote': 'Request a quote',
    'services.book': 'Book a meeting',
    'services.list.title': 'Our services',
    'services.quote.subject': 'Quote request',
    'services.quote.body':
      'Hello,\n\nWe would like to discuss the following project:\n\n- Context:\n- Need:\n- Scope:\n- Technical constraints:\n- Desired deadline:\n- Approximate budget:\n\nThank you.',
    'services.offer.renovation.title': 'Audit and renovation',
    'services.offer.renovation.desc':
      'We assess your projects, environment, risks and gaps. We then propose fixes, upgrades, automation and gradual refactoring.',
    'services.offer.renovation.cta': 'View audit and renovation details',
    'services.offer.development.title': 'All-inclusive development',
    'services.offer.development.desc':
      'We handle the design, implementation, testing and deployment of a business application or internal tool.',
    'services.offer.development.cta': 'View development details',
    'serviceDetail.back': 'Back to services',
    'serviceDetail.renovation.title': 'Audit and renovation',
    'serviceDetail.renovation.lead':
      'Understand the real problems before investing, then modernize existing software without a systematic rewrite.',
    'serviceDetail.renovation.scope.title': 'What we assess and improve',
    'serviceDetail.renovation.scope.projects.title': 'Projects and architecture',
    'serviceDetail.renovation.scope.projects.desc':
      'Code structure, dependencies, data flows, weak points and capacity for further change.',
    'serviceDetail.renovation.scope.delivery.title': 'Delivery pipeline',
    'serviceDetail.renovation.scope.delivery.desc':
      'Builds, tests, continuous integration, deployments and lead time from a change to production.',
    'serviceDetail.renovation.scope.quality.title': 'CVEs, vulnerabilities and secrets',
    'serviceDetail.renovation.scope.quality.desc':
      'CVE and vulnerability detection with static analysis tools suited to each language. Detection of secrets in source code and Git history.',
    'serviceDetail.renovation.scope.quality.staticAnalysis': 'Static analysis tools',
    'serviceDetail.renovation.scope.quality.trufflehog': 'TruffleHog',
    'serviceDetail.renovation.scope.environment.title': 'Working environment',
    'serviceDetail.renovation.scope.environment.desc':
      'Local setup, secrets, documentation, tools and problems faced by the existing team.',
    'serviceDetail.renovation.deliverables.title': 'What you receive',
    'serviceDetail.renovation.deliverables.audit':
      'A documented, factual assessment ranked by risk level.',
    'serviceDetail.renovation.deliverables.plan':
      'A prioritized improvement plan with costs, dependencies and expected results.',
    'serviceDetail.renovation.deliverables.work':
      'The fixes and renovation agreed in the quote, validated in your environment.',
    'serviceDetail.renovation.deliverables.handover':
      'The code, tests, documentation and instructions required for subsequent work.',
    'serviceDetail.renovation.fit.title': 'This service fits if…',
    'serviceDetail.renovation.fit.desc':
      'Your software remains useful, but it is slow to change, hard to deploy or risky to maintain.',
    'serviceDetail.development.title': 'All-inclusive development',
    'serviceDetail.development.lead':
      'One contact to turn a business need into tested, deployed and documented software.',
    'serviceDetail.development.scope.title': 'End-to-end delivery',
    'serviceDetail.development.scope.design.title': 'Design',
    'serviceDetail.development.scope.design.desc':
      'Clarification of uses, journeys, data, constraints and approval criteria.',
    'serviceDetail.development.scope.build.title': 'Implementation',
    'serviceDetail.development.scope.build.desc':
      'Development of the interface, business rules, integrations and required automation.',
    'serviceDetail.development.scope.tests.title': 'Testing',
    'serviceDetail.development.scope.tests.desc':
      'Automated tests and functional checks focused on product uses and risks.',
    'serviceDetail.development.scope.deploy.title': 'Deployment',
    'serviceDetail.development.scope.deploy.desc':
      'Reproducible rollout, environment configuration and preparation for operations.',
    'serviceDetail.development.deliverables.title': 'What is included',
    'serviceDetail.development.deliverables.product':
      'A web application, desktop application or internal tool that meets the approved scope.',
    'serviceDetail.development.deliverables.source':
      'The source code and dependencies required to build the product.',
    'serviceDetail.development.deliverables.tests':
      'Automated tests and the criteria used to approve delivery.',
    'serviceDetail.development.deliverables.operations':
      'Documentation and instructions for deployment, use and maintenance.',
    'serviceDetail.development.fit.title': 'This service fits if…',
    'serviceDetail.development.fit.desc':
      'You have a precise business need and want to delegate delivery through production rollout.',
    'services.examples.title': 'Concrete examples',
    'services.examples.upgrades.title': 'Version upgrades',
    'services.examples.upgrades.desc':
      'Upgrade dependencies and libraries, resolve incompatibilities, then validate behaviour through tests.',
    'services.examples.build.title': 'Build pipeline',
    'services.examples.build.before': 'Make builds reproducible with',
    'services.examples.build.after':
      ': declared dependencies, identical environments and shared caches.',
    'services.examples.ci.title': 'Continuous integration',
    'services.examples.ci.desc':
      'Take over an existing CI pipeline, remove unnecessary work, parallelize stages and cache reusable results.',
    'services.examples.tests.title': 'Automated tests',
    'services.examples.tests.desc':
      'Add unit, integration and architecture tests to stabilize existing software and automatically verify application behaviour.',
    'services.examples.environments.title': 'Development environments',
    'services.examples.environments.before':
      'Declare and automate reproducible development environments with',
    'services.examples.secrets.title': 'Secret management',
    'services.examples.secrets.before':
      'Centralize secrets in an on-premises vault, a cloud service or a lightweight solution:',
    'services.examples.secrets.through': 'Automate their injection into applications with',
    'services.examples.ai.title': 'AI agents',
    'services.examples.ai.before':
      'Integrate specialized agents into design discussions: backlog preparation, meeting analysis and live prototyping with',
    'services.examples.ai.usage': 'Track usage, models and costs with',
    'services.examples.metrics.title': 'Technical measurements',
    'services.examples.metrics.before':
      'Measure response, test, build, CI and deployment times. Publish timestamped indicators to',
    'services.examples.metrics.after': 'to track measured values instead of estimates.',
    'services.examples.infrastructure.title': 'Infrastructure and deployment',
    'services.examples.infrastructure.before':
      'Declare, test and reproduce on-premises or cloud deployments with NixOS, build caching and infrastructure as code through',
    'services.examples.or': 'or',
    'services.process.kicker': 'Delivery method',
    'services.process.title': 'How an engagement works',
    'services.process.analysis.title': 'Qualify the need',
    'services.process.analysis.desc':
      'We perform a limited initial review to understand the context and prepare the quote. The full audit starts after approval.',
    'services.process.quote.title': 'Prepare the quote',
    'services.process.quote.desc':
      'We provide a detailed quote. It defines the services, deliverables, schedule and price.',
    'services.process.agreement.title': 'Approve the scope',
    'services.process.agreement.desc':
      'You accept the proposal. If we then refine an objective or the scope, we submit an updated quote before work starts.',
    'services.process.delivery.title': 'Deliver the work',
    'services.process.delivery.desc':
      'We deliver the work in close contact with your stakeholders and existing development team.',
    'services.process.validation.title': 'Approve delivery',
    'services.process.validation.desc':
      'You approve the deliverables against the quote criteria, then pay the remaining balance.',
    'services.practical.title': 'In practice',
    'services.practical.method': 'Method',
    'services.practical.method.desc':
      'The quote defines scope, price, deliverables and acceptance criteria.',
    'services.practical.schedule': 'Schedule',
    'services.practical.schedule.desc':
      'The schedule is defined from the scope, dependencies and expected approvals.',
    'services.practical.deliverables': 'Deliverables',
    'services.practical.deliverables.desc':
      'Source code, tests, documentation and rollout instructions appropriate to the engagement.',
    'services.criteria.title': 'Useful information to get started',
    'services.criteria.context': 'The context and affected users.',
    'services.criteria.problem': 'The main problem or expected result.',
    'services.criteria.deadline': 'The known deadline and technical constraints.',
    'serviceDetail.contact.title': 'Discuss your need',

    'clients.title': 'Experience',
    'clients.sectors.title': 'Industry experience',
    'clients.cv': 'View full CV',
    'clients.sector.industry': 'Industry',
    'clients.sector.insurance': 'Insurance',
    'clients.sector.services': 'Services',

    'about.faq.title': 'Frequently asked questions',
    'about.faq.intro': 'Direct answers about how a collaboration works.',
    'about.faq.process.q': 'How does an engagement work?',
    'about.faq.stack.q': 'How do you choose technologies?',
    'about.faq.remote.q': 'Do you work remotely?',
    'about.faq.nda.q': 'Do you accept confidentiality agreements?',
    'about.faq.timeline.q': 'How do you set the schedule?',
    'about.faq.maintenance.q': 'Do you offer maintenance after delivery?',
    'about.faq.pricing.q': 'How are services billed?',
    'about.faq.availability.q': 'What is your availability?',
    'about.faq.process.a':
      'An initial discussion identifies the need, constraints and success criteria. The quote then defines scope, deliverables and follow-up terms before development and go-live.',
    'about.faq.stack.a':
      'The choice depends on the product, team and existing system. Technologies used: Angular, SvelteKit, ASP.NET, WPF, Go, Linux and PostgreSQL.',
    'about.faq.remote.a':
      'Yes. Work is mainly remote, with review points agreed for each engagement.',
    'about.faq.nda.a': 'Yes, after agreement on the obligations, duration and information covered.',
    'about.faq.timeline.a':
      'The schedule depends on scope, dependencies and expected approvals. It is defined in the quote rather than promised before scoping.',
    'about.faq.maintenance.a':
      'Yes. Fixes, upgrades and further changes can be included in the quote or agreed after delivery.',
    'about.faq.pricing.a':
      'Fixed-price when the scope is stable enough. Uncertainty is first isolated in a scoping phase.',
    'about.faq.availability.a':
      'Engagements are scheduled part-time. The start date is confirmed before the quote.',
    'not_found.title': 'This page does not exist.',
    'not_found.lead': 'Check the address or return to the home page.',
    'not_found.cta': 'Back to home',
    'not_found.links_label': 'Next steps',
    'not_found.services': 'View services',
    'not_found.contact': 'Email Froment Software',

    'about.contact.title': 'Contact',
    'about.contact.mail': 'Email us',
    'about.contact.book': 'Book an appointment',
    'blog.title': 'Blog',
    'blog.lead': 'Technical notes, experience reports and ideas.',
    'blog.topics': 'Topics',
    'blog.back': 'Back to the blog',
    'blog.missing': 'Article not found',

    'legal.kicker': 'Site information',
    'legal.title': 'Legal notice',
    'legal.lead':
      'Essential information about the publishing, hosting and use of froment.software content.',
    'legal.updated': 'Updated 13 July 2026',
    'legal.summary.title': 'At a glance',
    'legal.summary.content':
      'froment.software presents Sacha FROMENT’s software-engineering consultancy work and services. This site does not offer purchases or user accounts.',
    'legal.publisher.title': 'Site publisher',
    'legal.publisher.content':
      'froment.software is published and maintained by Sacha FROMENT. Administrative or legal requests can be sent by email.',
    'legal.hosting.title': 'Hosting',
    'legal.hosting.content':
      'The site is served as a static website and hosted on private infrastructure administered by the publisher. Technical requests relating to hosting can be sent to the same contact.',
    'legal.ip.title': 'Content and intellectual property',
    'legal.ip.content':
      'Unless stated otherwise, text, graphics and components created for froment.software remain their author’s property. Short quotations with attribution are permitted; any other reuse requires prior agreement.',
    'legal.links.title': 'External links',
    'legal.links.content':
      'The site links to demonstrations, a booking service and other websites. Their content and practices are the responsibility of their respective publishers.',
    'legal.contact.title': 'Contact',
    'legal.contact.content': 'For a question about the site, its content or a legal request:',
    'legal.related.title': 'Related documents',
    'legal.related.content':
      'You can also read how technical data and the language preference are handled.',
    'legal.related.privacy': 'Privacy policy',
    'legal.related.cookies': 'Cookies and local storage',

    'privacy.kicker': 'Data and browsing',
    'privacy.title': 'Privacy policy',
    'privacy.lead':
      'What this site processes automatically, what it keeps in your browser and how to ask a question.',
    'privacy.updated': 'Updated 13 July 2026',
    'privacy.summary.title': 'Key points',
    'privacy.summary.content':
      'The site has no contact form, advertising tool or audience analytics. The server may still log technical requests, and the browser stores the language choice in local storage.',
    'privacy.who.title': 'Site operator',
    'privacy.who.content':
      'Sacha FROMENT publishes froment.software and handles requests about data processed by this site.',
    'privacy.data.title': 'Technical server logs',
    'privacy.data.content':
      'When a page or file is loaded, the server may automatically log request data such as the IP address, date and time, requested path, user agent and response status. This technical logging results from the request sent to the server; it is not presented as consent-based. It may be used for service diagnosis, availability and security.',
    'privacy.retention.title': 'Log retention',
    'privacy.retention.content':
      'No fixed duration is stated here because it depends on the operating configuration. You may request current information about retention or the handling of a specific request.',
    'privacy.storage.title': 'Language preference',
    'privacy.storage.content':
      'The site stores the selected language in the browser’s local storage under the key “froment.software.language”, with the value “fr” or “en”. This setting persists until it is changed or cleared in the browser. It is neither a cookie nor a session.',
    'privacy.external.title': 'Email and external services',
    'privacy.external.content':
      'Contact links open your email application; the site itself does not send a message. If you follow a link to another domain, that service applies its own data-handling rules.',
    'privacy.rights.title': 'Data requests',
    'privacy.rights.content':
      'You may ask what technical data is available, report an error or request deletion when the request can be identified. An IP address, date and time range may be needed to locate a log entry. This is practical information, not legal advice.',
    'privacy.contact.title': 'Contact',
    'privacy.contact.content': 'For a privacy question or data request:',
    'privacy.related.title': 'Related information',
    'privacy.related.cookies': 'Details about cookies and local storage',
    'privacy.related.legal': 'Legal notice',

    'cookies.kicker': 'Browser storage',
    'cookies.title': 'Cookies and local storage',
    'cookies.lead':
      'The site does not set cookies. It stores only the display language in the browser’s local storage.',
    'cookies.updated': 'Updated 13 July 2026',
    'cookies.summary.title': 'Current behaviour',
    'cookies.summary.content':
      'The froment.software application creates no session, preference, audience analytics or advertising cookie.',
    'cookies.what.title': 'Cookies and local storage are different',
    'cookies.what.content':
      'A cookie may be sent to the server automatically with a request. Local storage remains in the browser and is not transmitted automatically. froment.software uses only the latter for language.',
    'cookies.why.title': 'Stored setting',
    'cookies.why.content':
      'The key “froment.software.language” contains “fr” or “en”. If no valid value exists, the site selects French when the browser language starts with “fr”, and English otherwise, then stores that choice locally.',
    'cookies.control.title': 'Change or clear the setting',
    'cookies.control.content':
      'Use the language selector in the header to replace the value. You can also clear site data in your browser settings. The site will continue to work and will detect the language again on the next load.',
    'cookies.privacy.title': 'Technical data',
    'cookies.privacy.content':
      'Local storage is separate from the technical logs the server may produce when responding to a request.',
    'cookies.privacy.link': 'Read the privacy policy',
    'cookies.contact.title': 'Contact',
    'cookies.contact.content': 'For a question about this setting or how the site works:',
  },
} as const;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  protected readonly supportedLanguages: Language[] = ['fr', 'en'];

  readonly language = signal<Language>('fr');

  readonly languages = [
    { code: 'fr' as Language, labelKey: 'lang.fr' as TranslationKey },
    { code: 'en' as Language, labelKey: 'lang.en' as TranslationKey },
  ];

  constructor() {
    afterNextRender(() => {
      const language = this.detectLanguage();
      this.language.set(language);
      this.writeStoredLanguage(language);
    });
    effect(() => {
      const language = this.language();
      this.document.documentElement.lang = language;
      this.document.documentElement.setAttribute('data-language', language);
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
      this.writeStoredLanguage(language);
    }
  }

  formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const formatOptions: Intl.DateTimeFormatOptions = options ?? { dateStyle: 'short' };

    if (typeof date === 'string') {
      const match = isoDateOnlyPattern.exec(date);

      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const calendarDate = new Date(0);
        calendarDate.setUTCHours(0, 0, 0, 0);
        calendarDate.setUTCFullYear(year, month - 1, day);

        if (
          calendarDate.getUTCFullYear() !== year ||
          calendarDate.getUTCMonth() !== month - 1 ||
          calendarDate.getUTCDate() !== day
        ) {
          throw new RangeError(`Invalid ISO date: ${date}`);
        }

        return new Intl.DateTimeFormat(this.language(), {
          ...formatOptions,
          timeZone: 'UTC',
        }).format(calendarDate);
      }
    }

    return new Intl.DateTimeFormat(this.language(), formatOptions).format(new Date(date));
  }

  private detectLanguage(): Language {
    const stored = this.readStoredLanguage();
    if (this.isSupportedLanguage(stored)) {
      return stored;
    }

    const browserLanguage = globalThis.navigator?.language?.toLowerCase() ?? 'fr';
    return browserLanguage.startsWith('fr') ? 'fr' : 'en';
  }

  private readStoredLanguage(): string | null {
    try {
      return globalThis.localStorage?.getItem(storageKey) ?? null;
    } catch {
      return null;
    }
  }

  private writeStoredLanguage(language: Language): void {
    try {
      globalThis.localStorage?.setItem(storageKey, language);
    } catch {
      // Keep the in-memory language when browser storage is unavailable.
    }
  }

  private isSupportedLanguage(language: string | null | undefined): language is Language {
    return language === 'fr' || language === 'en';
  }
}
