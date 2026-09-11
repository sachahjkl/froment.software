# Corrections de la revue du 11 septembre 2026

La revue portait sur le commit `9a4f7e92e655793831c20d0a44932f69fdd2ca37`.
Elle retenait 19 défauts P2 et neuf défauts P3, sans défaut P1 confirmé.

## Documents et conditions

| Défaut                                          | Correction                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Description tronquée dans le PDF                | Les cellules peuvent continuer sur une autre page.                                                                               |
| Coupure d’un caractère Unicode                  | La coupure respecte les points de code Unicode.                                                                                  |
| Date PDF différente du calendrier métier        | Les nouveaux snapshots conservent leur calendrier. La preuve de signature conserve le calendrier de confirmation de la commande. |
| Quantité perdant un millième                    | La préparation conserve une chaîne décimale exacte, sans division flottante.                                                     |
| Indentation convertie en code Markdown interdit | L’éditeur enregistre des blocs typés en JSON.                                                                                    |
| Retour dans un titre modifiant le contenu       | Les blocs typés conservent les titres multilignes.                                                                               |
| Entité littérale après un antislash modifiée    | Les blocs typés conservent les caractères sans interprétation Markdown.                                                          |

Les blocs typés conservent aussi les paragraphes vides.
Les formats historiques restent lisibles sans réécriture des sources.
La limite de 2 000 caractères porte sur la chaîne enregistrée, structure JSON comprise.
Les règles détaillées figurent dans [Conditions des documents](document-conditions.md).

## Persistance et opérations financières

| Défaut                                                           | Correction                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Identité de remboursement perdue après un refus de reprise       | Les refus de tentative et les refus conclusifs de requête sont distincts. Une réponse inconnue conserve l’identité.      |
| Nouvelle écriture antidatée après contrepassation                | La date comptable reste au moins égale à la dernière contrepassation. La date bancaire reste distincte.                  |
| Coordonnées émetteur écrasées par une copie ancienne             | La requête exige une version attendue. Le contrôle SQL refuse atomiquement une copie périmée.                            |
| Création client répétée après une réponse perdue                 | La transaction conserve l’UUID, la requête exacte, son auteur et la réponse initiale. Le navigateur conserve la requête. |
| Autres profils saisis effacés après l’enregistrement d’un membre | L’interface actualise seulement le membre concerné et conserve les versions initiales des autres saisies.                |

Les protections SQLite couvrent aussi les modifications directes des faits financiers.
Les encaissements et rapprochements autorisent seulement leur première annulation complète.
Les transactions bancaires et les références des factures émises restent immuables.
Les connexions activent `recursive_triggers` pour protéger les données contre `INSERT OR REPLACE`.

Un conflit avec une requête d’avoir déjà enregistrée utilise `invoice.credit_request_conflict`.
Ce refus de tentative ne prouve pas l’absence d’une écriture antérieure.
Une reprise incertaine conserve donc sa requête exacte.

## Sécurité et limites HTTP

| Défaut                                                   | Correction                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Traceur externe conservant les paramètres d’URL          | Le serveur conserve un seul traceur filtré. Le test utilise l’enveloppe `HttpEffect.toHandled`. |
| Quota appliqué après Argon2                              | Le serveur réserve les tentatives avant vérification et borne les calculs natifs simultanés.    |
| Requêtes publiques refusées évacuant les quotas protégés | Les registres sont séparés. Une clé nouvelle ne remplace pas un compteur actif.                 |
| Import annoncé incompatible avec la limite HTTP          | Les deux routes d’import disposent d’une limite dédiée qui couvre JSON et UTF-8.                |

Les mutations authentifiées par cookie exigent une origine autorisée.
Les mutations Bearer restent indépendantes de l’origine du navigateur.
Les quotas restent locaux au processus et repartent à zéro au redémarrage.
Les paramètres figurent dans [Configuration runtime](runtime-configuration.md).

## Intégrations

| Défaut                                               | Correction                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Corps Stripe interrompu classé comme échec définitif | Les erreurs de transport déclenchent une reprise avec la même clé. Un JSON reçu mais invalide reste refusé.               |
| Session Stripe bloquée sans reprise                  | Une vérification explicite consulte uniquement la session existante, après contrôle des permissions et de la clé de test. |
| Refus certain de relance bloquant le formulaire      | Le serveur persiste un refus identifié par UUID et contenu. Seul ce refus permet de libérer la demande correspondante.    |
| Relances récentes masquées après préparation         | Les programmations utilisent l’échéance croissante. L’historique utilise l’échéance décroissante.                         |

Une réponse fournisseur incertaine ne devient pas une expiration inventée.
Les contrôles ne réalisent ni paiement, ni remboursement, ni envoi réel.

## Navigation et composants

| Défaut                                                         | Correction                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ancien devis conservé après changement de fragment             | Le jeton définit le contexte réactif. Les réponses périmées sont ignorées et les changements de contexte sont gardés. |
| Ancres publiques quittant la page                              | La copie utilise un bouton. Les liens Markdown conservent le chemin courant.                                          |
| Diagrammes et titres non actualisés après changement de langue | Le contenu déclenche le rendu et les résultats périmés sont ignorés.                                                  |
| Surlignages des listes et dialogues se remplaçant              | Un stockage partagé conserve les plages de chaque consommateur.                                                       |
| Espaces encodés avec `+` dans `mailto`                         | Les valeurs utilisent `%20` et les retours du corps utilisent CRLF.                                                   |
| Métadonnées anciennes sur un article absent                    | L’article absent possède ses propres métadonnées et `noindex`.                                                        |
| Invitation publique dans le shell administrateur               | Les routes déclarent explicitement leur shell.                                                                        |
| Connexion client perdant le document demandé                   | La destination est validée parmi les routes client internes reconnues.                                                |

`Button` expose aussi la variante `ghost`.
`Button`, `Tabs` et `IconToolbar` partagent les surfaces et les états, mais conservent leurs dimensions et leurs comportements.

## Compléments

Le compte expose les permissions effectives calculées par le serveur.
Les routes, la navigation et les actions utilisent ces permissions sans remplacer les contrôles API.
Les gardes actualisent le compte une fois par navigation et vérifient les exigences des routes parentes.
Le chargement du compte borne les reprises et ignore les réponses d’une ancienne identité.

Les devis et commandes exposent la disponibilité de leur PDF conservé.
Un compte disposant de `document.download` peut télécharger ce PDF sans permission de génération.
Les confirmations de remplacement de lien et de vérification Stripe recontrôlent les permissions avant leur appel API.

Un devis envoyé non signé permet de remplacer un lien perdu après confirmation.
Le remplacement révoque l’ancien lien et conserve le devis ainsi que son PDF.
La version et l’identifiant du lien attendu protègent les remplacements concurrents.

Les dépendances concernées par les avis de sécurité ont été mises à jour.
Le sérialiseur `prosemirror-markdown`, devenu inutilisé, est retiré.

## Messages d’autorisation et de reprise

Les messages français et anglais distinguent l’authentification requise des permissions insuffisantes.
Ils ne présentent plus une reconnexion comme une correction des permissions manquantes.
Les limites portent sur les demandes, sans supposer un échec préalable ou une modification.

Les messages de traitement automatique nomment le compte initiateur.
Les messages de vérification manuelle concernent le compte demandeur.
Un changement de clé fournisseur ne signifie plus un changement de compte fournisseur.

Les messages de lecture nomment les données à recharger.
Les messages de modification distinguent un refus confirmé d’un résultat restant à confirmer.
La création d’un jeton sans secret reçu exige une vérification de la liste avant toute nouvelle création.

Les correspondances contextuelles servent uniquement à l’affichage.
Elles ne modifient ni les codes publics ni les décisions de reprise.

## Vérification et exclusions

Les vérifications utilisent `nix develop` et les tests métier, API, contrats et unités Angular.

La validation locale finale réussit avec 1 716 tests :

| Suite     | Tests |
| --------- | ----: |
| Web       | 1 179 |
| API       |   369 |
| Contrats  |    72 |
| Langues   |    88 |
| Documents |     8 |

La compilation, le typage, le lint, le formatage, les hooks et `drizzle-kit check` réussissent.
L’audit des dépendances ne signale aucun avis de sécurité.
Le bundle initial mesure 863,47 kB, sous le seuil d’erreur de 1,05 MB.
Les avertissements de taille et de dépendances CommonJS restent présents.

Aucun scénario navigateur ne conditionne cette livraison.
Aucune sauvegarde, donnée de production, clé réelle ou configuration fournisseur réelle n’est modifiée.
