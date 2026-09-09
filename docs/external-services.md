# Services externes

La page **Configuration → Services externes** affiche le mode de chaque adaptateur et les 100 dernières opérations.
La page **Courriels** permet de rédiger des messages en texte brut et de consulter les 100 derniers courriels.
Elle utilise le même adaptateur et le même journal persistant.
Le filtre serveur `kind=email` sélectionne les courriels avant d’appliquer la limite de 100 opérations.
Les cinq adaptateurs des opérations commerciales fonctionnent en simulation, y compris en production :

- courriels ;
- signature ;
- paiement en ligne ;
- banque ;
- facturation électronique.

La page **Simulations** utilise des données fictives.
Le parcours [Vérifier Resend](resend.md) est distinct et envoie un vrai courriel au destinataire autorisé.
Le parcours [Stripe Checkout](stripe.md) crée une page en mode test, sans modifier l’historique financier.
La page signale explicitement les simulations.
Aucun courriel, signature, encaissement, mouvement bancaire ou dépôt réglementaire ne résulte de ces tests.
Les adaptateurs ne modifient pas les documents commerciaux.

## Contrats et journal

Chaque domaine possède son service Effect dans `packages/api/src/integrations/providers.ts`.
Chaque demande possède un schéma distinct dans `packages/contracts/src/integrations/contracts.ts`.
Les autres actions possèdent leurs contrats dans `packages/contracts/src/integrations/provider-actions.ts`.
La couche de production fournit actuellement `SimulatedProviders`.

SQLite conserve la demande avant l’appel de l’adaptateur, puis son reçu.
Le journal d’audit enregistre chaque étape dans la même transaction que sa modification.
Il ne recopie pas les destinataires ou le contenu des courriels.

Une demande possède une clé UUID et un mode attendu.
Une nouvelle tentative reprend la même clé et le même contenu.
Le serveur refuse la réutilisation d’une clé avec un contenu différent.
Une simulation enregistrée ne devient jamais un envoi réel lors d’un changement d’adaptateur.
Un reçu existant est retourné sans nouvel appel au prestataire.

Si l’adaptateur échoue, la demande reste enregistrée sans reçu.
Le serveur reprend automatiquement les demandes éligibles ; consultez `docs/integration-retries.md`.
Le journal permet de reprendre manuellement les simulations sans reçu, même après un redémarrage.
Le serveur ne relance pas automatiquement les demandes.

## Courriels

Le formulaire demande un destinataire, une référence interne, un objet et un message.
Il conserve les valeurs après une erreur et verrouille une demande dont le résultat reste inconnu.
Une nouvelle tentative reprend exactement cette demande.
Les protections de navigation signalent les modifications non enregistrées.
Le bouton d’enregistrement conserve les brouillons sur le serveur ; consultez `docs/email-drafts.md`.

Le journal conserve le contenu en texte brut.
Le navigateur ne traite pas ce contenu comme du HTML.
En mode simulation, le bouton et le journal indiquent que le courriel n’est pas envoyé.
Un reçu réel confirme uniquement la transmission au prestataire, pas la réception du courriel.

Cette page ne remplace pas la boîte Tuta.
Les pièces jointes, les modèles réutilisables et les relances automatiques restent des modules distincts à raccorder.

## Accès

Les routes `/api/integrations` exigent la permission `integration.manage`.
La migration accorde cette permission au rôle administrateur existant.
Les clients et les jetons d’API ne peuvent pas utiliser ces routes.
Les mutations exigent une origine autorisée et sont limitées à dix demandes par minute.
Les réponses utilisent `Cache-Control: no-store`.

## Raccordement des prestataires

Un adaptateur réel doit respecter la clé d’idempotence, y compris après une réponse perdue ou des appels concurrents.
Son reçu `submitted` confirme uniquement la transmission de la demande.
Il ne constitue ni une preuve de signature, ni une confirmation de règlement ou de réception réglementaire.
Les notifications vérifiées et les transitions commerciales appartiennent aux modules concernés.

Les interfaces couvrent aussi les 32 actions décrites dans `docs/provider-contracts.md`.
Leurs implémentations actuelles sont des mocks indépendants, sans appel réseau ni modification métier.
Le choix d’un prestataire réel n’est pas un préalable à la définition de ces contrats ou de leurs mocks.
