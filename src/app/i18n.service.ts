import { DOCUMENT } from '@angular/common';
import { afterNextRender, effect, inject, Injectable, signal } from '@angular/core';

export type Language = 'fr' | 'en';

export type TranslationKey = keyof typeof translations.fr;

const storageKey = 'froment.software.language';
const isoDateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const translations = {
  fr: {
    'nav.home': 'Accueil',
    'nav.about': 'À propos',
    'nav.products': 'Produits',
    'nav.services': 'Services',
    'nav.clients': 'Clients',
    'nav.legal': 'Mentions légales',
    'nav.privacy': 'Confidentialité',
    'nav.cookies': 'Cookies',
    'brand.home': 'froment.software accueil',
    'nav.primary': 'Navigation principale',
    'shell.skip': 'Aller au contenu',
    'shell.menu': 'Menu',
    'shell.menu.open': 'Ouvrir le menu',
    'shell.menu.close': 'Fermer le menu',
    'shell.legal_nav': 'Navigation juridique',

    'page.home': 'Développement et rénovation de logiciels métier | froment.software',
    'page.clients': 'Références | froment.software',
    'page.services': 'Services | froment.software',
    'page.products': 'Produits | froment.software',
    'page.design': 'Proposition visuelle | froment.software',
    'page.description.design': 'Proposition de mise en page sobre et directe pour le site de Sacha Froment, ingénieur logiciel indépendant.',

    'page.about': 'À propos | froment.software',
    'page.description.about': 'Questions fréquentes sur les missions, les technologies, les délais, la maintenance et la facturation.',

    'page.legal': 'Mentions légales | froment.software',
    'page.description.legal': 'Édition, hébergement, propriété intellectuelle et contact du site froment.software.',

    'page.privacy': 'Confidentialité | froment.software',
    'page.description.privacy': 'Données techniques, stockage local et contacts liés à la confidentialité sur froment.software.',

    'page.cookies': 'Cookies et stockage local | froment.software',
    'page.description.cookies': 'Cookies, préférence de langue et contrôle du stockage local utilisé par froment.software.',
    'page.not_found': 'Page introuvable | froment.software',
    'page.description.not_found': 'La page demandée n’existe pas ou a changé d’adresse.',
    'page.description.home': 'Applications sur mesure, outils internes, reprise de code existant et conseil technique pragmatique.',
    'page.description.clients': 'Références professionnelles et secteurs d’intervention de froment.software.',
    'page.description.services': 'Applications web et de bureau, outils internes, maintenance, reprise d’existant et conseil technique.',
    'page.description.products': 'Expérimentations, prototypes et outils publics de froment.software pour éprouver des usages et des choix techniques.',
    'meta.socialImageAlt': 'Froment Software — ingénierie logicielle sobre, robuste et sur mesure',

    'footer.rights': '© {year} froment.software. Tous droits réservés.',
    'footer.language': 'Langue',
    'lang.fr': 'Français',
    'lang.en': 'English',

    'design.hero.title': 'Je construis et rénove des logiciels métier.',
    'design.hero.lead': 'Applications web, logiciels de bureau et outils internes. J’interviens aussi sur les bases de code qui fonctionnent encore, mais que plus personne ne veut toucher.',
    'design.hero.mail': 'M’écrire',
    'design.hero.work': 'Voir ce que je fais',
    'design.facts.title': 'En pratique',
    'design.facts.schedule': 'Missions à temps partiel',
    'design.facts.price': 'Forfait après cadrage',
    'design.facts.languages': 'Français et anglais',
    'design.facts.handover': 'Code et documentation transmis',
    'design.work.label': 'Ce que je fais',
    'design.work.title': 'Trois types de missions.',
    'design.work.build.title': 'Créer un outil',
    'design.work.build.copy': 'Transformer un processus concret en application utilisable, déployée et documentée.',
    'design.work.build.web': 'application web ou desktop',
    'design.work.build.internal': 'outil interne ou ligne de commande',
    'design.work.build.delivery': 'interface, données et mise en service',
    'design.work.renovate.title': 'Rénover un existant',
    'design.work.renovate.copy': 'Comprendre une application fragile, la remettre au propre puis la faire évoluer sans tout réécrire.',
    'design.work.renovate.read': 'lecture et exécution du code',
    'design.work.renovate.upgrade': 'corrections et mises à niveau',
    'design.work.renovate.refactor': 'refactorisation progressive',
    'design.work.decide.title': 'Débloquer une décision',
    'design.work.decide.copy': 'Examiner un problème technique avant qu’il ne devienne un projet trop gros ou une mauvaise réécriture.',
    'design.work.decide.audit': 'audit ciblé',
    'design.work.decide.scope': 'cadrage et options chiffrées',
    'design.work.decide.report': 'recommandation écrite',
    'design.profile.label': 'Qui fait le travail ?',
    'design.profile.role': 'Ingénieur logiciel. Vous parlez avec la personne qui lit le code, propose la solution et la livre.',
    'design.profile.copy': 'J’ai travaillé sur des applications utilisées dans le ferroviaire, l’assurance et les services. Mon terrain couvre Angular, SvelteKit, ASP.NET, WPF, Go, Linux et PostgreSQL.',
    'design.method.label': 'Fonctionnement',
    'design.method.title': 'Pas de grand cérémonial.',
    'design.method.copy': 'Il faut surtout un problème réel, un interlocuteur disponible et un moyen de vérifier le résultat.',
    'design.method.explain.title': 'Vous expliquez.',
    'design.method.explain.copy': 'Contexte, logiciel, contrainte et échéance.',
    'design.method.review.title': 'Je vérifie.',
    'design.method.review.copy': 'Adéquation, risques et première étape utile.',
    'design.method.scope.title': 'On cadre.',
    'design.method.scope.copy': 'Périmètre, livrables, prix et validations.',
    'design.method.deliver.title': 'Je livre.',
    'design.method.deliver.copy': 'Par étapes visibles, jusqu’à la mise en service.',
    'design.contact.label': 'Premier échange',
    'design.contact.title': 'Qu’est-ce qui vous bloque ?',
    'design.contact.copy': 'Un e-mail de quelques lignes suffit. Ajoutez le contexte, le problème principal et l’échéance connue.',
    'design.contact.book': 'Choisir un créneau',
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
    'design.components.notices': 'Messages',
    'design.components.data': 'Tableau',
    'design.components.service': 'Service',
    'design.components.status': 'Statut',
    'design.components.details': 'Détails natifs',
    'design.components.details_summary': 'Afficher les conditions de livraison',
    'design.components.details_copy': 'Le code, la documentation et les instructions de mise en service font partie de la livraison.',

    'home.hero.title.part1a': 'Applications',
    'home.hero.title.part1b': 'sur mesure',
    'home.hero.title.sep1': 'pour le web, le desktop,',
    'home.hero.title.part2a': 'les outils',
    'home.hero.title.part2b': 'internes',
    'home.hero.title.sep2': 'et la',
    'home.hero.title.part3a': 'reprise',
    'home.hero.title.part3b': 'de legacy',
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Développement et rénovation de logiciels métier.',
    'home.hero.lead': 'Je développe des applications web, des logiciels de bureau et des outils internes. Je reprends aussi des applications existantes pour les remettre au propre, les mettre à niveau et poursuivre leur développement.',
    'home.hero.contact': 'M’écrire',
    'home.hero.book': 'Prendre rendez-vous',
    'home.engage.kicker': 'Premier échange',
    'home.engage.title': 'Commencer par le contexte, pas par une solution toute faite.',
    'home.engage.mail': 'Exposer le besoin',
    'home.engage.services': 'Examiner les capacités',

    'home.timeline.title': 'Démonstrations publiques',
    'home.timeline.intro': 'Trois points d’entrée consultables pour examiner des choix de produit, d’interface et d’architecture.',
    'home.timeline.albumator.desc': 'Gestion et partage de bibliothèques d’images.',
    'home.timeline.albumator.cta': 'Ouvrir Albumator',
    'home.timeline.htmx.desc': 'Démonstration HTMX avec un serveur Go et Fiber.',
    'home.timeline.htmx.cta': 'Ouvrir la démonstration',
    'home.timeline.sacha.desc': 'Site personnel de Sacha Froment.',
    'home.timeline.sacha.cta': 'Voir le site',
    'home.timeline.clockin.desc': 'Application de pointage et de suivi du temps.',
    'home.timeline.clockin.cta': 'Ouvrir Clockin',
    'home.timeline.empty.title': 'Travaux non publics',
    'home.timeline.empty.desc': 'Cette sélection se limite aux travaux consultables sans contexte confidentiel.',

    'home.services.title': 'Prestations',
    'home.services.cta': 'Voir les services',
    'home.services.book': 'Réserver un créneau',
    'home.services.applications.title': 'Applications métier',
    'home.services.applications.desc': 'Applications web ou de bureau conçues pour un besoin, des utilisateurs et un environnement précis.',
    'home.services.internal.title': 'Outils internes',
    'home.services.internal.desc': 'Interfaces, commandes et automatisations pour remplacer les manipulations manuelles ou dispersées.',
    'home.services.renovation.title': 'Rénovation de l’existant',
    'home.services.renovation.desc': 'Reprise, mise à niveau et remise au propre progressive d’applications déjà en service.',
    'home.method.title': 'Déroulement d’une mission',
    'home.method.review.title': 'Examiner.',
    'home.method.review.copy': 'Je lis l’existant, reproduis le problème et relève les contraintes.',
    'home.method.scope.title': 'Définir.',
    'home.method.scope.copy': 'Le devis fixe le périmètre, les livrables, le prix et les validations.',
    'home.method.delivery.title': 'Livrer.',
    'home.method.delivery.copy': 'Les changements sont livrés par étapes avec le code, les tests et la documentation.',

    'home.products.title': 'Produits',
    'home.products.note': 'Aucun logiciel standard n’est commercialisé actuellement ; les besoins sont traités sur mesure.',
    'home.products.cta': 'Consulter le catalogue',
    'home.clients.title': 'Parcours',
    'home.clients.copy': 'Cinq ans de développement sur des applications neuves et existantes.',
    'home.clients.cv': 'Voir le CV complet',
    'home.clients.experience': 'Organisations de référence',
    'home.contact.copy': 'Indiquez le logiciel concerné, le problème principal et l’échéance connue.',
    'home.about.title': 'Qui sommes-nous ?',
    'home.about.copy': 'Froment Software est un atelier de développement logiciel indépendant.',
    'home.about.sacha.role': 'Développement logiciel et direction technique.',
    'home.about.sacha.website': 'Visiter le site personnel de Sacha Froment',
    'home.about.cta': 'Consulter la FAQ',

    'products.kicker': 'Produits & laboratoire',
    'products.title': 'Des outils publics pour éprouver des idées.',
    'products.lead': 'Les produits commercialisés et les expérimentations utiles vivent ici. Pour l’instant, le laboratoire public montre des prototypes réels ; aucun produit n’est proposé à la vente.',
    'products.catalog.title': 'Laboratoire public',
    'products.table.product': 'Produit',
    'products.table.type': 'Type',
    'products.table.license': 'Licence',
    'products.table.price': 'Prix',
    'products.empty.title': 'Aucun produit commercialisé',
    'products.empty.copy': 'Les besoins actuels sont pris en charge sous forme de prestations sur mesure.',
    'products.catalog.intro': 'Trois points d’entrée consultables, présentés comme des expérimentations et non comme des études de cas client.',
    'products.status.prototype': 'Prototype',
    'products.status.experiment': 'Expérimentation',
    'products.status.public': 'Espace public',
    'products.contact.title': 'Un outil interne à concevoir ?',
    'products.contact.copy': 'Le laboratoire montre une manière d’explorer. La page Services décrit comment transformer un besoin métier en logiciel livré.',
    'products.contact.cta': 'Voir les services',

    'services.kicker': 'Services',
    'services.title': 'Applications sur mesure et reprise d’existant.',
    'services.lead': 'Conception et livraison de nouveaux outils, reprise progressive d’applications existantes et conseil technique pour décider sans surconstruire.',
    'services.quote': 'Demander un devis',
    'services.book': 'Prendre rendez-vous',
    'services.list.title': 'Domaines d’intervention',
    'services.quote.subject': 'Demande de devis',
    'services.quote.body': 'Bonjour,\n\nNous souhaitons échanger au sujet du projet suivant :\n\n- Contexte :\n- Besoin :\n- Périmètre :\n- Contraintes techniques :\n- Échéance souhaitée :\n- Budget indicatif :\n\nMerci.',
    'services.entry.applications.title': 'Applications métier',
    'services.entry.applications.desc': 'Conception, développement et mise en service d’applications web ou de bureau adaptées au travail de leurs utilisateurs.',
    'services.entry.internal.title': 'Outils internes',
    'services.entry.internal.desc': 'Interfaces, commandes, scripts et automatisations pour simplifier les opérations quotidiennes.',
    'services.entry.renovation.title': 'Rénovation de l’existant',
    'services.entry.renovation.desc': 'Lecture du code, mise à niveau, correction et refactorisation progressive sans réécriture systématique.',
    'services.process.kicker': 'Méthode de livraison',
    'services.process.title': 'Un chemin lisible du besoin à la mise en service.',
    'services.process.intro': 'Le niveau de détail s’adapte à la mission, mais les décisions, les risques et la transmission restent visibles.',
    'services.process.discovery.title': 'Comprendre',
    'services.process.discovery.desc': 'Examiner le contexte, les utilisateurs, l’existant et les contraintes avant de proposer une direction.',
    'services.process.scope.title': 'Cadrer',
    'services.process.scope.desc': 'Définir le périmètre utile, les arbitrages, les livrables et les conditions de validation.',
    'services.process.build.title': 'Construire',
    'services.process.build.desc': 'Avancer par incréments vérifiables, avec un retour régulier sur ce qui fonctionne réellement.',
    'services.process.handover.title': 'Livrer',
    'services.process.handover.desc': 'Mettre en service, documenter les choix et préparer la maintenance ou la reprise par une autre équipe.',

    'clients.title': 'Références professionnelles',
    'clients.sectors.title': 'Secteurs',
    'clients.cv': 'Voir le CV complet',
    'clients.contact.title': 'Contact',
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
    'about.faq.process.a': 'Un premier échange précise le besoin, les contraintes et les critères de réussite. Le devis fixe ensuite le périmètre, les livrables et les modalités de suivi avant le développement et la mise en service.',
    'about.faq.stack.a': 'Le choix part des contraintes du produit et de l’équipe. L’expérience couvre notamment SvelteKit, ASP.NET, Angular, WinForms/WPF, Linux, SQLite/PostgreSQL, Odin et Go.',
    'about.faq.remote.a': 'Oui, le travail se fait principalement à distance, avec des points de suivi convenus selon la mission.',
    'about.faq.nda.a': 'Oui, après lecture et accord sur un texte proportionné aux informations réellement échangées.',
    'about.faq.timeline.a': 'Le calendrier dépend du périmètre, des dépendances et des validations attendues. Il est défini dans le devis plutôt que promis avant le cadrage.',
    'about.faq.maintenance.a': 'Oui. Correctifs, mises à jour et évolutions peuvent être prévus dès le devis ou convenus après la livraison.',
    'about.faq.pricing.a': 'Au forfait lorsque le périmètre est suffisamment stable. Les incertitudes sont d’abord isolées dans une phase de cadrage.',
    'about.faq.availability.a': 'Les missions sont planifiées à temps partiel ; une prise de contact en amont permet de réserver le bon créneau.',
    'not_found.title': 'Cette page n’existe pas.',
    'not_found.lead': 'L’adresse est peut-être incomplète ou la page a été déplacée.',
    'not_found.sub': 'Reprenez depuis l’accueil, consultez les services ou écrivez directement.',
    'not_found.cta': 'Retour à l’accueil',
    'not_found.links_label': 'Prochaines étapes',
    'not_found.services': 'Voir les services',
    'not_found.contact': 'Écrire à Froment Software',


    'about.contact.title': 'Travaillons ensemble',
    'about.contact.mail': 'Écrire un e-mail',
    'about.contact.book': 'Réserver un créneau',

    'legal.kicker': 'Informations du site',
    'legal.title': 'Mentions légales',
    'legal.lead': 'Les informations essentielles sur l’édition, l’hébergement et l’utilisation des contenus de froment.software.',
    'legal.updated': 'Mis à jour le 13 juillet 2026',
    'legal.summary.title': 'En bref',
    'legal.summary.content': 'froment.software présente l’activité et les services de conseil en ingénierie logicielle de Sacha FROMENT. Aucun achat ni compte utilisateur n’est proposé sur ce site.',
    'legal.publisher.title': 'Édition du site',
    'legal.publisher.content': 'Le site froment.software est édité et maintenu par Sacha FROMENT. Les demandes administratives ou juridiques peuvent être adressées par e-mail.',
    'legal.hosting.title': 'Hébergement',
    'legal.hosting.content': 'Le site est servi comme un site statique et hébergé sur une infrastructure privée administrée par l’éditeur. Les demandes techniques relatives à l’hébergement peuvent être envoyées au même contact.',
    'legal.ip.title': 'Contenus et propriété intellectuelle',
    'legal.ip.content': 'Sauf mention contraire, les textes, éléments graphiques et composants propres à froment.software restent la propriété de leur auteur. Une citation courte avec attribution est possible ; toute autre réutilisation doit faire l’objet d’un accord préalable.',
    'legal.links.title': 'Liens externes',
    'legal.links.content': 'Le site renvoie vers des démonstrations, un service de prise de rendez-vous et d’autres sites. Leur contenu et leurs pratiques relèvent de leurs éditeurs respectifs.',
    'legal.contact.title': 'Contact',
    'legal.contact.content': 'Pour une question relative au site, à un contenu ou à une demande juridique :',
    'legal.related.title': 'Documents associés',
    'legal.related.content': 'Consultez également les informations sur les données techniques et le stockage du choix de langue.',
    'legal.related.privacy': 'Politique de confidentialité',
    'legal.related.cookies': 'Cookies et stockage local',

    'privacy.kicker': 'Données et navigation',
    'privacy.title': 'Politique de confidentialité',
    'privacy.lead': 'Ce que ce site traite automatiquement, ce qu’il conserve dans votre navigateur et comment poser une question.',
    'privacy.updated': 'Mis à jour le 13 juillet 2026',
    'privacy.summary.title': 'À retenir',
    'privacy.summary.content': 'Le site n’intègre ni formulaire de contact, ni outil publicitaire, ni mesure d’audience. Le serveur peut toutefois journaliser les requêtes techniques, et le navigateur conserve le choix de langue dans son stockage local.',
    'privacy.who.title': 'Responsable du site',
    'privacy.who.content': 'Sacha FROMENT édite froment.software et répond aux demandes relatives aux données traitées par ce site.',
    'privacy.data.title': 'Journaux techniques du serveur',
    'privacy.data.content': 'Lors du chargement d’une page ou d’un fichier, le serveur peut journaliser automatiquement des données de requête telles que l’adresse IP, la date et l’heure, le chemin demandé, l’agent utilisateur et le code de réponse. Cette journalisation technique résulte de la requête adressée au serveur ; elle n’est pas présentée comme reposant sur un consentement. Elle peut servir au diagnostic, à la disponibilité et à la sécurité du service.',
    'privacy.retention.title': 'Conservation des journaux',
    'privacy.retention.content': 'Aucune durée fixe n’est annoncée ici, car elle dépend de la configuration d’exploitation. Vous pouvez demander les informations à jour sur la conservation ou le traitement d’une requête précise.',
    'privacy.storage.title': 'Préférence de langue',
    'privacy.storage.content': 'Le site enregistre la langue choisie dans le stockage local du navigateur sous la clé « froment.software.language », avec la valeur « fr » ou « en ». Ce réglage persiste jusqu’à sa modification ou sa suppression depuis le navigateur. Il ne s’agit ni d’un cookie ni d’une session.',
    'privacy.external.title': 'E-mail et services externes',
    'privacy.external.content': 'Les liens de contact ouvrent votre logiciel de messagerie ; aucun message n’est envoyé par le site lui-même. Si vous suivez un lien vers un autre domaine, ce service applique ses propres règles de traitement.',
    'privacy.rights.title': 'Demandes relatives aux données',
    'privacy.rights.content': 'Vous pouvez demander quelles données techniques sont disponibles, signaler une erreur ou solliciter une suppression lorsque la requête peut être identifiée. Une adresse IP, une date et une plage horaire peuvent être nécessaires pour retrouver une ligne de journal. Cette présentation est informative et ne constitue pas un conseil juridique.',
    'privacy.contact.title': 'Contact',
    'privacy.contact.content': 'Pour une question ou une demande liée à la confidentialité :',
    'privacy.related.title': 'À lire aussi',
    'privacy.related.cookies': 'Détail des cookies et du stockage local',
    'privacy.related.legal': 'Mentions légales',

    'cookies.kicker': 'Stockage du navigateur',
    'cookies.title': 'Cookies et stockage local',
    'cookies.lead': 'Le site ne dépose pas de cookie. Il mémorise uniquement la langue d’affichage dans le stockage local du navigateur.',
    'cookies.updated': 'Mis à jour le 13 juillet 2026',
    'cookies.summary.title': 'Situation actuelle',
    'cookies.summary.content': 'Aucun cookie de session, de préférence, de mesure d’audience ou de publicité n’est créé par l’application froment.software.',
    'cookies.what.title': 'Différence entre cookie et stockage local',
    'cookies.what.content': 'Un cookie peut être envoyé automatiquement au serveur avec une requête. Le stockage local reste dans le navigateur et n’est pas transmis automatiquement. froment.software utilise uniquement ce second mécanisme pour la langue.',
    'cookies.why.title': 'Réglage enregistré',
    'cookies.why.content': 'La clé « froment.software.language » contient « fr » ou « en ». En l’absence de valeur valide, le site choisit le français si la langue du navigateur commence par « fr », et l’anglais dans les autres cas, puis mémorise ce choix localement.',
    'cookies.control.title': 'Modifier ou supprimer le réglage',
    'cookies.control.content': 'Utilisez le sélecteur de langue en bas de page pour remplacer la valeur. Vous pouvez aussi supprimer les données du site dans les réglages de votre navigateur. Le site continuera de fonctionner et détectera de nouveau la langue au prochain chargement.',
    'cookies.privacy.title': 'Données techniques',
    'cookies.privacy.content': 'Le stockage local est distinct des journaux techniques que le serveur peut produire lorsqu’il répond à une requête.',
    'cookies.privacy.link': 'Lire la politique de confidentialité',
    'cookies.contact.title': 'Contact',
    'cookies.contact.content': 'Pour une question sur ce réglage ou le fonctionnement du site :',
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
    'shell.skip': 'Skip to content',
    'shell.menu': 'Menu',
    'shell.menu.open': 'Open menu',
    'shell.menu.close': 'Close menu',
    'shell.legal_nav': 'Legal navigation',

    'page.home': 'Business software development and renovation | froment.software',
    'page.clients': 'References | froment.software',
    'page.services': 'Services | froment.software',
    'page.products': 'Products | froment.software',
    'page.design': 'Visual proposal | froment.software',
    'page.description.design': 'Plain, direct layout proposal for the website of independent software engineer Sacha Froment.',

    'page.about': 'About | froment.software',
    'page.description.about': 'Frequently asked questions about engagements, technologies, schedules, maintenance and billing.',

    'page.legal': 'Legal notice | froment.software',
    'page.description.legal': 'Publishing, hosting, intellectual property and contact information for froment.software.',

    'page.privacy': 'Privacy | froment.software',
    'page.description.privacy': 'Technical request data, local storage and privacy contacts for froment.software.',

    'page.cookies': 'Cookies and local storage | froment.software',
    'page.description.cookies': 'Cookies, language preference and local-storage controls used by froment.software.',
    'page.not_found': 'Page not found | froment.software',
    'page.description.not_found': 'Page not found. Return to the froment.software home page or services.',
    'page.description.home': 'Custom applications, internal tools, existing-code takeovers and pragmatic technical consulting.',
    'page.description.clients': 'Professional references and sectors served by froment.software.',
    'page.description.services': 'Web and desktop applications, internal tools, maintenance, existing-code takeovers and technical consulting.',
    'page.description.products': 'Public experiments, prototypes and tools from froment.software for testing use cases and technical choices.',
    'meta.socialImageAlt': 'Froment Software — focused, robust, tailored software engineering',

    'footer.rights': '© {year} froment.software. All rights reserved.',
    'footer.language': 'Language',
    'lang.fr': 'French',
    'lang.en': 'English',

    'design.hero.title': 'I build and renovate business software.',
    'design.hero.lead': 'Web applications, desktop software and internal tools. I also work on codebases that still run, but nobody wants to touch.',
    'design.hero.mail': 'Email me',
    'design.hero.work': 'See what I do',
    'design.facts.title': 'In practice',
    'design.facts.schedule': 'Part-time engagements',
    'design.facts.price': 'Fixed price after scoping',
    'design.facts.languages': 'French and English',
    'design.facts.handover': 'Code and documentation handed over',
    'design.work.label': 'What I do',
    'design.work.title': 'Three types of engagement.',
    'design.work.build.title': 'Build a tool',
    'design.work.build.copy': 'Turn a real process into a usable, deployed and documented application.',
    'design.work.build.web': 'web or desktop application',
    'design.work.build.internal': 'internal tool or command line utility',
    'design.work.build.delivery': 'interface, data and rollout',
    'design.work.renovate.title': 'Renovate an existing system',
    'design.work.renovate.copy': 'Understand a fragile application, clean it up and evolve it without rewriting everything.',
    'design.work.renovate.read': 'code review and local execution',
    'design.work.renovate.upgrade': 'fixes and upgrades',
    'design.work.renovate.refactor': 'gradual refactoring',
    'design.work.decide.title': 'Unblock a decision',
    'design.work.decide.copy': 'Review a technical problem before it becomes an oversized project or a bad rewrite.',
    'design.work.decide.audit': 'focused audit',
    'design.work.decide.scope': 'scoping and costed options',
    'design.work.decide.report': 'written recommendation',
    'design.profile.label': 'Who does the work?',
    'design.profile.role': 'Software engineer. You speak with the person who reads the code, proposes the solution and delivers it.',
    'design.profile.copy': 'I have worked on applications used in railway, insurance and service businesses. My working stack includes Angular, SvelteKit, ASP.NET, WPF, Go, Linux and PostgreSQL.',
    'design.method.label': 'How it works',
    'design.method.title': 'No grand ceremony.',
    'design.method.copy': 'The essentials are a real problem, an available contact and a way to verify the result.',
    'design.method.explain.title': 'You explain.',
    'design.method.explain.copy': 'Context, software, constraint and deadline.',
    'design.method.review.title': 'I review.',
    'design.method.review.copy': 'Fit, risks and the first useful step.',
    'design.method.scope.title': 'We scope.',
    'design.method.scope.copy': 'Scope, deliverables, price and approvals.',
    'design.method.deliver.title': 'I deliver.',
    'design.method.deliver.copy': 'In visible steps, through rollout.',
    'design.contact.label': 'First conversation',
    'design.contact.title': 'What is blocking you?',
    'design.contact.copy': 'A short email is enough. Include the context, main problem and known deadline.',
    'design.contact.book': 'Choose a time',
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
    'design.components.notices': 'Messages',
    'design.components.data': 'Table',
    'design.components.service': 'Service',
    'design.components.status': 'Status',
    'design.components.details': 'Native details',
    'design.components.details_summary': 'Show delivery terms',
    'design.components.details_copy': 'Code, documentation and rollout instructions are part of delivery.',

    'home.hero.title.part1a': 'Custom',
    'home.hero.title.part1b': 'applications',
    'home.hero.title.sep1': 'for web, desktop,',
    'home.hero.title.part2a': 'internal',
    'home.hero.title.part2b': 'tools',
    'home.hero.title.sep2': 'and',
    'home.hero.title.part3a': 'legacy',
    'home.hero.title.part3b': 'takeover',
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Business software development and renovation.',
    'home.hero.lead': 'I develop web applications, desktop software and internal tools. I also take over existing applications to clean them up, upgrade them and continue their development.',
    'home.hero.contact': 'Email me',
    'home.hero.book': 'Book a meeting',
    'home.engage.kicker': 'First conversation',
    'home.engage.title': 'Start with the context, not a prepackaged solution.',
    'home.engage.mail': 'Share your brief',
    'home.engage.services': 'Review capabilities',

    'home.timeline.title': 'Public demonstrations',
    'home.timeline.intro': 'Three public entry points for examining product, interface and architecture decisions.',
    'home.timeline.albumator.desc': 'Image library management and sharing.',
    'home.timeline.albumator.cta': 'Open Albumator',
    'home.timeline.htmx.desc': 'HTMX demonstration with a Go and Fiber server.',
    'home.timeline.htmx.cta': 'Open demonstration',
    'home.timeline.sacha.desc': 'Sacha Froment’s personal website.',
    'home.timeline.sacha.cta': 'View site',
    'home.timeline.clockin.desc': 'Clock-in and time-tracking application.',
    'home.timeline.clockin.cta': 'Open Clockin',
    'home.timeline.empty.title': 'Non-public work',
    'home.timeline.empty.desc': 'This selection is limited to work that can be viewed without confidential context.',

    'home.services.title': 'Services',
    'home.services.cta': 'View services',
    'home.services.book': 'Book a slot',
    'home.services.applications.title': 'Business applications',
    'home.services.applications.desc': 'Web or desktop applications designed for a specific need, set of users and working environment.',
    'home.services.internal.title': 'Internal tools',
    'home.services.internal.desc': 'Interfaces, commands and automation that replace manual or scattered operations.',
    'home.services.renovation.title': 'Existing-software renovation',
    'home.services.renovation.desc': 'Takeover, upgrades and gradual cleanup of applications already in service.',
    'home.method.title': 'How an engagement works',
    'home.method.review.title': 'Review.',
    'home.method.review.copy': 'I read the existing system, reproduce the problem and identify constraints.',
    'home.method.scope.title': 'Define.',
    'home.method.scope.copy': 'The quote defines scope, deliverables, price and approvals.',
    'home.method.delivery.title': 'Deliver.',
    'home.method.delivery.copy': 'Changes ship in stages with code, tests and documentation.',

    'home.products.title': 'Products',
    'home.products.note': 'No standard software is currently sold; current needs are handled as custom engagements.',
    'home.products.cta': 'View the catalogue',
    'home.clients.title': 'Background',
    'home.clients.copy': 'Five years developing new and existing applications.',
    'home.clients.cv': 'View full CV',
    'home.clients.experience': 'Reference organisations',
    'home.contact.copy': 'Include the software involved, the main problem and the known deadline.',
    'home.about.title': 'Who are we?',
    'home.about.copy': 'Froment Software is an independent software development studio.',
    'home.about.sacha.role': 'Software development and technical direction.',
    'home.about.sacha.website': 'Visit Sacha Froment’s personal website',
    'home.about.cta': 'Read the FAQ',

    'products.kicker': 'Products & lab',
    'products.title': 'Public tools for testing ideas.',
    'products.lead': 'Commercial products and useful experiments live here. For now, the public lab shows real prototypes; no product is currently offered for sale.',
    'products.catalog.title': 'Public lab',
    'products.table.product': 'Product',
    'products.table.type': 'Type',
    'products.table.license': 'Licence',
    'products.table.price': 'Price',
    'products.empty.title': 'No product currently sold',
    'products.empty.copy': 'Current needs are handled as custom consulting and delivery engagements.',
    'products.catalog.intro': 'Three public entry points, presented as experiments rather than client case studies.',
    'products.status.prototype': 'Prototype',
    'products.status.experiment': 'Experiment',
    'products.status.public': 'Public space',
    'products.contact.title': 'Need an internal tool?',
    'products.contact.copy': 'The lab shows a way of exploring. The Services page explains how a business need becomes delivered software.',
    'products.contact.cta': 'View services',

    'services.kicker': 'Services',
    'services.title': 'Custom applications and existing‑code takeovers.',
    'services.lead': 'Design and delivery of new tools, gradual takeover of existing applications and technical consulting to make decisions without overbuilding.',
    'services.quote': 'Request a quote',
    'services.book': 'Book a meeting',
    'services.list.title': 'Areas of work',
    'services.quote.subject': 'Quote request',
    'services.quote.body': 'Hello,\n\nWe would like to discuss the following project:\n\n- Context:\n- Need:\n- Scope:\n- Technical constraints:\n- Desired deadline:\n- Approximate budget:\n\nThank you.',
    'services.entry.applications.title': 'Business applications',
    'services.entry.applications.desc': 'Design, development and rollout of web or desktop applications adapted to their users’ work.',
    'services.entry.internal.title': 'Internal tools',
    'services.entry.internal.desc': 'Interfaces, commands, scripts and automation that simplify daily operations.',
    'services.entry.renovation.title': 'Existing-software renovation',
    'services.entry.renovation.desc': 'Code review, upgrades, fixes and gradual refactoring without a systematic rewrite.',
    'services.process.kicker': 'Delivery method',
    'services.process.title': 'A clear path from need to go-live.',
    'services.process.intro': 'The level of detail adapts to the engagement, but decisions, risks and handover stay visible.',
    'services.process.discovery.title': 'Understand',
    'services.process.discovery.desc': 'Review the context, users, existing system and constraints before proposing a direction.',
    'services.process.scope.title': 'Scope',
    'services.process.scope.desc': 'Define the useful scope, trade-offs, deliverables and validation conditions.',
    'services.process.build.title': 'Build',
    'services.process.build.desc': 'Move through verifiable increments, with regular feedback on what actually works.',
    'services.process.handover.title': 'Deliver',
    'services.process.handover.desc': 'Go live, document decisions and prepare maintenance or takeover by another team.',

    'clients.title': 'Professional references',
    'clients.sectors.title': 'Sectors',
    'clients.cv': 'View full CV',
    'clients.contact.title': 'Contact',
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
    'about.faq.process.a': 'An initial discussion identifies the need, constraints and success criteria. The quote then defines scope, deliverables and follow-up terms before development and go-live.',
    'about.faq.stack.a': 'The choice starts with product and team constraints. Experience includes SvelteKit, ASP.NET, Angular, WinForms/WPF, Linux, SQLite/PostgreSQL, Odin and Go.',
    'about.faq.remote.a': 'Yes. Work is mainly remote, with review points agreed for each engagement.',
    'about.faq.nda.a': 'Yes, after reviewing and agreeing on terms proportionate to the information actually exchanged.',
    'about.faq.timeline.a': 'The schedule depends on scope, dependencies and expected approvals. It is defined in the quote rather than promised before scoping.',
    'about.faq.maintenance.a': 'Yes. Fixes, upgrades and further changes can be included in the quote or agreed after delivery.',
    'about.faq.pricing.a': 'Fixed-price when the scope is stable enough. Uncertainty is first isolated in a scoping phase.',
    'about.faq.availability.a': 'Engagements are scheduled part-time; contacting early helps reserve the right slot.',
    'not_found.title': 'This page does not exist.',
    'not_found.lead': 'The address may be incomplete or the page may have moved.',
    'not_found.sub': 'Start again from the home page, review the services or get in touch directly.',
    'not_found.cta': 'Back to home',
    'not_found.links_label': 'Next steps',
    'not_found.services': 'View services',
    'not_found.contact': 'Email Froment Software',


    'about.contact.title': 'Let’s work together',
    'about.contact.mail': 'Send an email',
    'about.contact.book': 'Book a slot',

    'legal.kicker': 'Site information',
    'legal.title': 'Legal notice',
    'legal.lead': 'Essential information about the publishing, hosting and use of froment.software content.',
    'legal.updated': 'Updated 13 July 2026',
    'legal.summary.title': 'At a glance',
    'legal.summary.content': 'froment.software presents Sacha FROMENT’s software-engineering consultancy work and services. This site does not offer purchases or user accounts.',
    'legal.publisher.title': 'Site publisher',
    'legal.publisher.content': 'froment.software is published and maintained by Sacha FROMENT. Administrative or legal requests can be sent by email.',
    'legal.hosting.title': 'Hosting',
    'legal.hosting.content': 'The site is served as a static website and hosted on private infrastructure administered by the publisher. Technical requests relating to hosting can be sent to the same contact.',
    'legal.ip.title': 'Content and intellectual property',
    'legal.ip.content': 'Unless stated otherwise, text, graphics and components created for froment.software remain their author’s property. Short quotations with attribution are permitted; any other reuse requires prior agreement.',
    'legal.links.title': 'External links',
    'legal.links.content': 'The site links to demonstrations, a booking service and other websites. Their content and practices are the responsibility of their respective publishers.',
    'legal.contact.title': 'Contact',
    'legal.contact.content': 'For a question about the site, its content or a legal request:',
    'legal.related.title': 'Related documents',
    'legal.related.content': 'You can also read how technical data and the language preference are handled.',
    'legal.related.privacy': 'Privacy policy',
    'legal.related.cookies': 'Cookies and local storage',

    'privacy.kicker': 'Data and browsing',
    'privacy.title': 'Privacy policy',
    'privacy.lead': 'What this site processes automatically, what it keeps in your browser and how to ask a question.',
    'privacy.updated': 'Updated 13 July 2026',
    'privacy.summary.title': 'Key points',
    'privacy.summary.content': 'The site has no contact form, advertising tool or audience analytics. The server may still log technical requests, and the browser stores the language choice in local storage.',
    'privacy.who.title': 'Site operator',
    'privacy.who.content': 'Sacha FROMENT publishes froment.software and handles requests about data processed by this site.',
    'privacy.data.title': 'Technical server logs',
    'privacy.data.content': 'When a page or file is loaded, the server may automatically log request data such as the IP address, date and time, requested path, user agent and response status. This technical logging results from the request sent to the server; it is not presented as consent-based. It may be used for service diagnosis, availability and security.',
    'privacy.retention.title': 'Log retention',
    'privacy.retention.content': 'No fixed duration is stated here because it depends on the operating configuration. You may request current information about retention or the handling of a specific request.',
    'privacy.storage.title': 'Language preference',
    'privacy.storage.content': 'The site stores the selected language in the browser’s local storage under the key “froment.software.language”, with the value “fr” or “en”. This setting persists until it is changed or cleared in the browser. It is neither a cookie nor a session.',
    'privacy.external.title': 'Email and external services',
    'privacy.external.content': 'Contact links open your email application; the site itself does not send a message. If you follow a link to another domain, that service applies its own data-handling rules.',
    'privacy.rights.title': 'Data requests',
    'privacy.rights.content': 'You may ask what technical data is available, report an error or request deletion when the request can be identified. An IP address, date and time range may be needed to locate a log entry. This is practical information, not legal advice.',
    'privacy.contact.title': 'Contact',
    'privacy.contact.content': 'For a privacy question or data request:',
    'privacy.related.title': 'Related information',
    'privacy.related.cookies': 'Details about cookies and local storage',
    'privacy.related.legal': 'Legal notice',

    'cookies.kicker': 'Browser storage',
    'cookies.title': 'Cookies and local storage',
    'cookies.lead': 'The site does not set cookies. It stores only the display language in the browser’s local storage.',
    'cookies.updated': 'Updated 13 July 2026',
    'cookies.summary.title': 'Current behaviour',
    'cookies.summary.content': 'The froment.software application creates no session, preference, audience analytics or advertising cookie.',
    'cookies.what.title': 'Cookies and local storage are different',
    'cookies.what.content': 'A cookie may be sent to the server automatically with a request. Local storage remains in the browser and is not transmitted automatically. froment.software uses only the latter for language.',
    'cookies.why.title': 'Stored setting',
    'cookies.why.content': 'The key “froment.software.language” contains “fr” or “en”. If no valid value exists, the site selects French when the browser language starts with “fr”, and English otherwise, then stores that choice locally.',
    'cookies.control.title': 'Change or clear the setting',
    'cookies.control.content': 'Use the language selector at the bottom of the page to replace the value. You can also clear site data in your browser settings. The site will continue to work and will detect the language again on the next load.',
    'cookies.privacy.title': 'Technical data',
    'cookies.privacy.content': 'Local storage is separate from the technical logs the server may produce when responding to a request.',
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

        return new Intl.DateTimeFormat(this.language(), { ...formatOptions, timeZone: 'UTC' }).format(calendarDate);
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
