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

    'page.home': 'froment.software',
    'page.clients': 'Références — froment.software',
    'page.services': 'Services — froment.software',
    'page.products': 'Produits — froment.software',
    'page.design': 'Atelier design system — froment.software',
    'page.description.design': 'Atelier de vérification des tokens, composants et états d’interface de froment.software.',

    'page.about': 'À propos — froment.software',
    'page.description.about': 'Parcours de Sacha FROMENT : logiciels d’entreprise, reprise de code existant et conseil technique.',

    'page.legal': 'Mentions légales — froment.software',
    'page.description.legal': 'Édition, hébergement, propriété intellectuelle et contact du site froment.software.',

    'page.privacy': 'Confidentialité — froment.software',
    'page.description.privacy': 'Données techniques, stockage local et contacts liés à la confidentialité sur froment.software.',

    'page.cookies': 'Cookies et stockage local — froment.software',
    'page.description.cookies': 'Cookies, préférence de langue et contrôle du stockage local utilisé par froment.software.',
    'page.not_found': 'Page introuvable — froment.software',
    'page.description.not_found': 'La page demandée n’existe pas ou a changé d’adresse.',
    'page.description.home': 'Applications sur mesure, outils internes, reprise de code existant et conseil technique pragmatique.',
    'page.description.clients': 'Références professionnelles publiées et contexte d’intervention de froment.software.',
    'page.description.services': 'Applications web et de bureau, outils internes, maintenance, reprise d’existant et conseil technique.',
    'page.description.products': 'Expérimentations, prototypes et outils publics de froment.software pour éprouver des usages et des choix techniques.',
    'meta.socialImageAlt': 'Froment Software — ingénierie logicielle sobre, robuste et sur mesure',

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
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Des logiciels métier qui avancent sans tout recommencer.',
    'home.hero.lead': 'Froment Software conçoit, reprend et fait évoluer des applications web, desktop et des outils internes pour les équipes confrontées à un besoin métier concret ou à un existant fragile.',
    'home.hero.contact': 'Nous contacter',
    'home.hero.book': 'Prendre rendez-vous',
    'home.fit.kicker': 'Pour qui',
    'home.fit.title': 'Quand le logiciel doit servir le travail réel.',
    'home.fit.intro': 'Une intervention ciblée pour livrer un nouvel outil, remettre un produit sur de bons rails ou éclaircir une décision technique.',
    'home.fit.internal.title': 'Équipes métier',
    'home.fit.internal.desc': 'Un processus manuel, dispersé ou pénible mérite un outil interne conçu autour de ses utilisateurs.',
    'home.fit.legacy.title': 'Logiciel existant',
    'home.fit.legacy.desc': 'Une base de code utile doit être comprise, stabilisée puis améliorée sans réécriture réflexe.',
    'home.fit.delivery.title': 'Projet à livrer',
    'home.fit.delivery.desc': 'Un besoin cadré gagne à être transformé en application opérable, documentée et transmissible.',
    'home.engage.kicker': 'Premier échange',
    'home.engage.title': 'Commencer par le contexte, pas par une solution toute faite.',
    'home.engage.copy': 'Décrivez le besoin, l’existant et les contraintes. Un premier échange permet de vérifier l’adéquation, de préciser le périmètre et de choisir la prochaine étape utile.',
    'home.engage.mail': 'Exposer le besoin',
    'home.engage.services': 'Examiner les capacités',

    'home.timeline.title': 'Démonstrations publiques',
    'home.timeline.intro': 'Trois points d’entrée consultables pour examiner des choix de produit, d’interface et d’architecture.',
    'home.timeline.albumator.desc': 'Téléversement et navigation d’images dans une application web SvelteKit orientée produit.',
    'home.timeline.albumator.cta': 'Ouvrir la démonstration',
    'home.timeline.htmx.desc': 'Expérimentation HTMX avec Go et Fiber pour piloter l’interface depuis le serveur.',
    'home.timeline.htmx.cta': 'Voir la démonstration',
    'home.timeline.sacha.desc': 'Point d’entrée public vers des projets, des notes et un historique technique.',
    'home.timeline.sacha.cta': 'Voir le site',
    'home.timeline.empty.title': 'Travaux non publics',
    'home.timeline.empty.desc': 'Cette sélection se limite aux travaux consultables sans contexte confidentiel.',

    'home.services.title': 'Prestations',
    'home.services.intro': 'Conception, fabrication et mise en service, avec une attention particulière aux logiciels internes, aux applications métier et à la reprise de code existant.',
    'home.services.cta': 'Voir les services',
    'home.services.book': 'Réserver un créneau',
    'home.services.web.title': 'Applications web de bout en bout',
    'home.services.web.desc': 'Cadrage, développement, livraison, mise en service et hébergement géré.',
    'home.services.desktop.title': 'Applications de bureau de bout en bout',
    'home.services.desktop.desc': '.NET WPF, Electron, interfaces internes et postes de travail métier.',
    'home.services.cli.title': 'Outils internes et CLI',
    'home.services.cli.desc': 'Commandes, scripts et outils exploitables pour accélérer les équipes et fiabiliser les opérations.',
    'home.services.legacy.title': 'Maintenance et évolution de l’existant',
    'home.services.legacy.desc': 'Reprise de code, audit, remise à plat progressive et corrections sans réécriture systématique.',
    'home.services.consulting.title': 'Conseil technique',
    'home.services.consulting.desc': 'Analyse, recommandations, cadrage et arbitrages explicites sur ce qui mérite d’être réalisé.',

    'home.products.title': 'Produits',
    'home.products.note': 'Aucun logiciel standard n’est commercialisé actuellement ; les besoins sont traités sur mesure.',
    'home.products.cta': 'Consulter le catalogue',
    'home.clients.title': 'Expérience en contexte métier',
    'home.clients.note': 'Des références réelles, présentées sans attribuer de résultats non publiables.',
    'home.clients.cta': 'Voir les références',
    'home.clients.experience': 'Organisations de référence',

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
    'products.principles.kicker': 'Ligne de conduite',
    'products.principles.title': 'Construire pour apprendre, publier pour montrer.',
    'products.principles.focus.title': 'Une question à la fois',
    'products.principles.focus.desc': 'Chaque expérimentation isole un usage, une architecture ou une interaction à examiner.',
    'products.principles.real.title': 'Du logiciel manipulable',
    'products.principles.real.desc': 'Les liens mènent vers des interfaces ou des espaces publics réels, pas vers des rendus statiques.',
    'products.principles.honest.title': 'Un statut explicite',
    'products.principles.honest.desc': 'Prototype, expérimentation ou produit : la présentation distingue ce qui est exploratoire de ce qui est vendu.',
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
    'services.entry.web.title': 'Applications web de bout en bout',
    'services.entry.web.desc': 'Cadrage, développement, livraison, mise en service et hébergement géré.',
    'services.entry.desktop.title': 'Applications de bureau de bout en bout',
    'services.entry.desktop.desc': '.NET WPF, Electron et interfaces métier pour postes de travail.',
    'services.entry.cli.title': 'Outils internes et CLI',
    'services.entry.cli.desc': 'Utilitaires, scripts et commandes pour accélérer les équipes et fiabiliser les opérations.',
    'services.entry.legacy.title': 'Maintenance et évolution de l’existant',
    'services.entry.legacy.desc': 'Reprise de code, remise à plat progressive, correction et évolution sans réécriture systématique.',
    'services.entry.consulting.title': 'Conseil technique',
    'services.entry.consulting.desc': 'Analyse, cadrage, recommandations et arbitrages techniques explicites.',
    'services.process.kicker': 'Méthode de livraison',
    'services.process.title': 'Un chemin lisible du besoin à la mise en service.',
    'services.process.intro': 'Le niveau de détail s’adapte à la mission, mais les décisions, les risques et la transmission restent visibles.',
    'services.process.discovery.title': '01 — Comprendre',
    'services.process.discovery.desc': 'Examiner le contexte, les utilisateurs, l’existant et les contraintes avant de proposer une direction.',
    'services.process.scope.title': '02 — Cadrer',
    'services.process.scope.desc': 'Définir le périmètre utile, les arbitrages, les livrables et les conditions de validation.',
    'services.process.build.title': '03 — Construire',
    'services.process.build.desc': 'Avancer par incréments vérifiables, avec un retour régulier sur ce qui fonctionne réellement.',
    'services.process.handover.title': '04 — Livrer',
    'services.process.handover.desc': 'Mettre en service, documenter les choix et préparer la maintenance ou la reprise par une autre équipe.',

    'clients.kicker': 'Références',
    'clients.title': 'Expérience en environnement métier.',
    'clients.lead': 'Des environnements métier réels, cités sobrement lorsque les détails des missions ne sont pas publics.',
    'clients.ref.title': 'Organisations de référence',
    'clients.ref.copy': 'Ces organisations font partie de l’expérience professionnelle de Sacha Froment. Leur présence ici n’implique ni témoignage, ni résultat chiffré, ni approbation de cette activité.',
    'clients.ref.contact_title': 'Parlons de votre contexte',
    'clients.ref.contact_copy': 'Pour évaluer une collaboration, partagez le problème, le logiciel concerné et les principales contraintes.',
    'clients.ref.contact_cta': 'Écrire à froment.software',
    'clients.list.title': 'Références publiées',
    'clients.table.client': 'Organisation',
    'clients.table.type': 'Secteur',
    'clients.table.scope': 'Contexte',
    'clients.table.status': 'Publication',
    'clients.empty.title': 'Périmètre non public',
    'clients.empty.copy': 'Les noms publiés restent limités aux références dont l’affichage est approprié.',
    'clients.context.kicker': 'Repères',
    'clients.context.title': 'Trois secteurs, une même exigence de contexte.',
    'clients.context.intro': 'Le domaine, les utilisateurs et les contraintes d’exploitation orientent les choix techniques avant la technologie.',
    'clients.context.alstom': 'Industrie ferroviaire',
    'clients.context.ag2r': 'Assurance',
    'clients.context.ogf': 'Services funéraires',
    'clients.disclosure.title': 'Ce qui peut être partagé',
    'clients.disclosure.copy': 'Les contraintes, l’approche et le mode de collaboration peuvent être discutés lors d’un échange, dans les limites de confidentialité applicables.',


    'about.kicker': 'À propos',
    'about.title': 'Sacha FROMENT.',
    'about.lead': 'Ingénieur logiciel, Sacha Froment intervient sur des applications d’entreprise neuves ou existantes, du cadrage à la transmission.',
    'about.bio.title': 'Parcours',
    'about.bio.intro': 'Je conçois et fais évoluer des applications d’entreprise. Mon travail couvre aussi bien les systèmes anciens au long vécu que les montées de version et les développements entièrement nouveaux.',
    'about.bio.experience': 'Ces cinq dernières années, j’ai repris des applications vieillissantes, mené des refactorisations progressives et livré de nouvelles solutions pour le web, le bureau et la ligne de commande.',
    'about.bio.years': 'Années d’expérience',
    'about.bio.ref1': 'Industrie ferroviaire',
    'about.bio.ref2': 'Assurance',
    'about.bio.ref3': 'Services funéraires',
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
    'about.approach.kicker': 'Façon de travailler',
    'about.approach.title': 'Comprendre avant de transformer.',
    'about.approach.intro': 'Le travail combine lecture de l’existant, décisions explicites et livraison progressive afin de laisser un logiciel compréhensible.',
    'about.approach.context.title': 'Contexte d’abord',
    'about.approach.context.desc': 'Les utilisateurs, les contraintes et l’exploitation quotidienne donnent leur sens aux choix techniques.',
    'about.approach.progress.title': 'Progrès vérifiable',
    'about.approach.progress.desc': 'Les changements sont découpés pour pouvoir être relus, essayés et ajustés.',
    'about.approach.handover.title': 'Transmission prévue',
    'about.approach.handover.desc': 'La documentation et la lisibilité font partie de la livraison, pas d’un éventuel après.',
    'about.references.title': 'Contextes professionnels',
    'about.references.intro': 'Organisations citées comme références d’expérience, sans témoignage ni résultat attribué.',
    'not_found.title': 'Cette page n’existe pas.',
    'not_found.lead': 'L’adresse est peut-être incomplète ou la page a été déplacée.',
    'not_found.sub': 'Reprenez depuis l’accueil, consultez les services ou écrivez directement.',
    'not_found.cta': 'Retour à l’accueil',
    'not_found.links_label': 'Prochaines étapes',
    'not_found.services': 'Voir les services',
    'not_found.contact': 'Écrire à Froment Software',


    'about.contact.title': 'Travaillons ensemble',
    'about.contact.copy': 'Présentez le contexte, la contrainte principale et le résultat attendu pour démarrer un échange concret.',
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

    'page.home': 'froment.software',
    'page.clients': 'References — froment.software',
    'page.services': 'Services — froment.software',
    'page.products': 'Products — froment.software',
    'page.design': 'Design system workshop — froment.software',
    'page.description.design': 'Workshop for reviewing froment.software interface tokens, components and states.',

    'page.about': 'About — froment.software',
    'page.description.about': 'Sacha FROMENT’s background in enterprise software, existing-code takeovers and technical consulting.',

    'page.legal': 'Legal notice — froment.software',
    'page.description.legal': 'Publishing, hosting, intellectual property and contact information for froment.software.',

    'page.privacy': 'Privacy — froment.software',
    'page.description.privacy': 'Technical request data, local storage and privacy contacts for froment.software.',

    'page.cookies': 'Cookies and local storage — froment.software',
    'page.description.cookies': 'Cookies, language preference and local-storage controls used by froment.software.',
    'page.not_found': 'Page not found — froment.software',
    'page.description.not_found': 'Page not found. Return to the froment.software home page or services.',
    'page.description.home': 'Custom applications, internal tools, existing-code takeovers and pragmatic technical consulting.',
    'page.description.clients': 'Published professional references and engagement context for froment.software.',
    'page.description.services': 'Web and desktop applications, internal tools, maintenance, existing-code takeovers and technical consulting.',
    'page.description.products': 'Public experiments, prototypes and tools from froment.software for testing use cases and technical choices.',
    'meta.socialImageAlt': 'Froment Software — focused, robust, tailored software engineering',

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
    'home.hero.kicker': 'froment.software',
    'home.hero.title': 'Business software that moves forward without starting over.',
    'home.hero.lead': 'Froment Software designs, takes over and evolves web apps, desktop software and internal tools for teams facing a concrete business need or a fragile existing system.',
    'home.hero.contact': 'Contact us',
    'home.hero.book': 'Book a meeting',
    'home.fit.kicker': 'Who it is for',
    'home.fit.title': 'When software has to support real work.',
    'home.fit.intro': 'Focused support to ship a new tool, put a product back on solid ground or clarify a technical decision.',
    'home.fit.internal.title': 'Business teams',
    'home.fit.internal.desc': 'A manual, scattered or painful process deserves an internal tool designed around its users.',
    'home.fit.legacy.title': 'Existing software',
    'home.fit.legacy.desc': 'A useful codebase should be understood, stabilised and then improved without a reflex rewrite.',
    'home.fit.delivery.title': 'A project to ship',
    'home.fit.delivery.desc': 'A scoped need should become an operable, documented application that another team can own.',
    'home.engage.kicker': 'First conversation',
    'home.engage.title': 'Start with the context, not a prepackaged solution.',
    'home.engage.copy': 'Describe the need, the existing system and the constraints. A first conversation helps confirm fit, clarify scope and choose the next useful step.',
    'home.engage.mail': 'Share your brief',
    'home.engage.services': 'Review capabilities',

    'home.timeline.title': 'Public demonstrations',
    'home.timeline.intro': 'Three public entry points for examining product, interface and architecture decisions.',
    'home.timeline.albumator.desc': 'Image upload and browsing in a product-oriented SvelteKit web application.',
    'home.timeline.albumator.cta': 'Open demonstration',
    'home.timeline.htmx.desc': 'HTMX experiment with Go and Fiber to drive the interface from the server.',
    'home.timeline.htmx.cta': 'View demonstration',
    'home.timeline.sacha.desc': 'Public entry point for projects, notes and technical history.',
    'home.timeline.sacha.cta': 'View site',
    'home.timeline.empty.title': 'Non-public work',
    'home.timeline.empty.desc': 'This selection is limited to work that can be viewed without confidential context.',

    'home.services.title': 'Services',
    'home.services.intro': 'Design, implementation and go-live, with a focus on internal software, business applications and existing-code takeovers.',
    'home.services.cta': 'View services',
    'home.services.book': 'Book a slot',
    'home.services.web.title': 'End-to-end web applications',
    'home.services.web.desc': 'Scoping, development, delivery, rollout and managed hosting.',
    'home.services.desktop.title': 'End-to-end desktop applications',
    'home.services.desktop.desc': '.NET WPF, Electron, internal interfaces and business workstations.',
    'home.services.cli.title': 'Internal tools and CLIs',
    'home.services.cli.desc': 'Commands, scripts and operable tools that speed teams up and make operations more reliable.',
    'home.services.legacy.title': 'Existing-software maintenance and evolution',
    'home.services.legacy.desc': 'Code takeover, audit, gradual cleanup and fixes without systematic rewrites.',
    'home.services.consulting.title': 'Technical consulting',
    'home.services.consulting.desc': 'Analysis, recommendations, scoping and explicit trade-offs about what is worth building.',

    'home.products.title': 'Products',
    'home.products.note': 'No standard software is currently sold; current needs are handled as custom engagements.',
    'home.products.cta': 'View the catalogue',
    'home.clients.title': 'Experience in business settings',
    'home.clients.note': 'Real references, presented without claiming outcomes that cannot be published.',
    'home.clients.cta': 'View references',
    'home.clients.experience': 'Reference organisations',

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
    'products.principles.kicker': 'Working principles',
    'products.principles.title': 'Build to learn, publish to show.',
    'products.principles.focus.title': 'One question at a time',
    'products.principles.focus.desc': 'Each experiment isolates a use case, architecture or interaction to examine.',
    'products.principles.real.title': 'Software you can use',
    'products.principles.real.desc': 'Links lead to real interfaces or public spaces, not static mock-ups.',
    'products.principles.honest.title': 'An explicit status',
    'products.principles.honest.desc': 'Prototype, experiment or product: the presentation separates exploratory work from what is sold.',
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
    'services.entry.web.title': 'End-to-end web applications',
    'services.entry.web.desc': 'Scoping, development, delivery, rollout and managed hosting.',
    'services.entry.desktop.title': 'End-to-end desktop applications',
    'services.entry.desktop.desc': '.NET WPF, Electron and business interfaces for workstations.',
    'services.entry.cli.title': 'Internal tools and CLIs',
    'services.entry.cli.desc': 'Utilities, scripts and commands that speed teams up and make operations more reliable.',
    'services.entry.legacy.title': 'Existing-software maintenance and evolution',
    'services.entry.legacy.desc': 'Code takeover, gradual cleanup, fixes and evolution without systematic rewrites.',
    'services.entry.consulting.title': 'Technical consulting',
    'services.entry.consulting.desc': 'Analysis, scoping, recommendations and explicit technical trade-offs.',
    'services.process.kicker': 'Delivery method',
    'services.process.title': 'A clear path from need to go-live.',
    'services.process.intro': 'The level of detail adapts to the engagement, but decisions, risks and handover stay visible.',
    'services.process.discovery.title': '01 — Understand',
    'services.process.discovery.desc': 'Review the context, users, existing system and constraints before proposing a direction.',
    'services.process.scope.title': '02 — Scope',
    'services.process.scope.desc': 'Define the useful scope, trade-offs, deliverables and validation conditions.',
    'services.process.build.title': '03 — Build',
    'services.process.build.desc': 'Move through verifiable increments, with regular feedback on what actually works.',
    'services.process.handover.title': '04 — Deliver',
    'services.process.handover.desc': 'Go live, document decisions and prepare maintenance or takeover by another team.',

    'clients.kicker': 'References',
    'clients.title': 'Experience in business environments.',
    'clients.lead': 'Real business environments, named plainly when engagement details are not public.',
    'clients.ref.title': 'Reference organisations',
    'clients.ref.copy': 'These organisations are part of Sacha Froment’s professional experience. Their presence here does not imply a testimonial, a quantified outcome or endorsement of this business.',
    'clients.ref.contact_title': 'Let’s discuss your context',
    'clients.ref.contact_copy': 'To assess a collaboration, share the problem, the software involved and the main constraints.',
    'clients.ref.contact_cta': 'Email froment.software',
    'clients.list.title': 'Published references',
    'clients.table.client': 'Organisation',
    'clients.table.type': 'Sector',
    'clients.table.scope': 'Context',
    'clients.table.status': 'Publication',
    'clients.empty.title': 'Scope not public',
    'clients.empty.copy': 'Published names remain limited to references that are appropriate to display.',
    'clients.context.kicker': 'Context',
    'clients.context.title': 'Three sectors, the same need for context.',
    'clients.context.intro': 'The domain, users and operating constraints shape technical choices before technology does.',
    'clients.context.alstom': 'Railway industry',
    'clients.context.ag2r': 'Insurance',
    'clients.context.ogf': 'Funeral services',
    'clients.disclosure.title': 'What can be shared',
    'clients.disclosure.copy': 'Constraints, approach and ways of working can be discussed in a conversation, within applicable confidentiality limits.',


    'about.kicker': 'About',
    'about.title': 'Sacha FROMENT.',
    'about.lead': 'Software engineer Sacha Froment works on new and existing enterprise applications, from scoping through handover.',
    'about.bio.title': 'Background',
    'about.bio.intro': 'I design and evolve enterprise applications. My work spans long-lived systems, version upgrades and entirely new software.',
    'about.bio.experience': 'Over the last five years, I have taken over ageing applications, carried out gradual refactoring and delivered new web, desktop and command-line solutions.',
    'about.bio.years': 'Years of experience',
    'about.bio.ref1': 'Railway industry',
    'about.bio.ref2': 'Insurance',
    'about.bio.ref3': 'Funeral services',
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
    'about.approach.kicker': 'Working style',
    'about.approach.title': 'Understand before changing.',
    'about.approach.intro': 'The work combines reading the existing system, explicit decisions and progressive delivery to leave understandable software.',
    'about.approach.context.title': 'Context first',
    'about.approach.context.desc': 'Users, constraints and day-to-day operation give technical choices their meaning.',
    'about.approach.progress.title': 'Verifiable progress',
    'about.approach.progress.desc': 'Changes are broken down so they can be reviewed, tried and adjusted.',
    'about.approach.handover.title': 'Handover by design',
    'about.approach.handover.desc': 'Documentation and readability are part of delivery, not an optional afterthought.',
    'about.references.title': 'Professional contexts',
    'about.references.intro': 'Organisations named as experience references, without testimonials or attributed outcomes.',
    'not_found.title': 'This page does not exist.',
    'not_found.lead': 'The address may be incomplete or the page may have moved.',
    'not_found.sub': 'Start again from the home page, review the services or get in touch directly.',
    'not_found.cta': 'Back to home',
    'not_found.links_label': 'Next steps',
    'not_found.services': 'View services',
    'not_found.contact': 'Email Froment Software',


    'about.contact.title': 'Let’s work together',
    'about.contact.copy': 'Share the context, main constraint and expected outcome to start a concrete discussion.',
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
