# Stripe Checkout en mode test

Le parcours se trouve dans **Configuration → Services externes → Tester Stripe Checkout**.
Il crée une page hébergée par Stripe à partir d’une facture émise.
Il ne crée aucun encaissement local. Les paiements et remboursements commerciaux restent locaux ou simulés.

## Limites du test

Le serveur accepte uniquement les clés `sk_test_` et `rk_test_`.
Il refuse les réponses avec `livemode: true`, les sessions réelles et les URL hors de `checkout.stripe.com`.
Il n’active ni Stripe Billing, ni Stripe Invoicing, ni Connect, ni la fiscalité automatique.

La facture doit être émise et sans avoir.
Son solde doit être compris entre 50 et 99 999 999 centimes EUR.
Le serveur calcule ce solde avec les encaissements actifs, sans utiliser de montant fourni par le navigateur.

Stripe reçoit le numéro de facture, le solde, les identifiants de suivi et l’adresse `sacha@sacha.house`.
Les coordonnées du client et de l’émetteur restent locales.
Les lignes de facture restent locales. Stripe reçoit une ligne de paiement avec le montant figé.

## Préparer les accès

Renseignez `STRIPE_SECRET_KEY` dans le profil SOPS actif.
Redémarrez le serveur pour charger la clé.

Le serveur consulte les sessions toutes les 30 secondes.
Ce suivi fonctionne sans webhook. Il continue lorsque le navigateur est fermé.

Pour recevoir les notifications, créez un endpoint Stripe **en mode test** :

```text
https://froment.software/api/integrations/stripe/webhook
```

Sélectionnez les événements suivants :

- `checkout.session.completed`.
- `checkout.session.expired`.
- `checkout.session.async_payment_succeeded`.
- `checkout.session.async_payment_failed`.

Renseignez son secret `whsec_` dans `STRIPE_WEBHOOK_SECRET` du profil SOPS correspondant.
Redémarrez le serveur pour charger ce secret.
La présence du secret ne confirme pas la réception des événements.

Pour un test local, utilisez Stripe CLI avec une destination locale :

```bash
stripe listen --forward-to http://localhost:3000/api/integrations/stripe/webhook
```

Utilisez le secret émis par cette commande uniquement dans le profil `development`.
Ne remplacez pas le secret de production par celui de Stripe CLI.
Ne copiez pas les secrets dans une conversation ou un fichier Git en clair.

## Exécution durable

La demande conserve son UUID, sa facture, sa révision, son solde, son auteur, son URL de retour et son échéance.
Le service `Checkouts` enregistre ces valeurs dans SQLite avant tout appel Stripe.
La base interdit leur modification et la suppression de l’historique.

Le worker Effect examine les demandes toutes les trois secondes.
Chaque traitement prend un verrou de deux minutes avec un numéro de génération.
Une réponse tardive ne remplace pas le résultat d’un traitement plus récent.
Un défaut de traitement est signalé sans contenu privé. Le worker reprend à la prochaine échéance.
La fermeture de son périmètre Effect arrête le worker et ses appels en cours.

Les reprises conservent la même clé d’idempotence et les mêmes paramètres Stripe.
Le serveur autorise cinq tentatives, espacées de deux, quatre, huit et seize minutes.
Il bloque les reprises après 22 heures. La session expire 23 heures après l’enregistrement.
Ces limites précèdent l’expiration des clés d’idempotence Stripe à 24 heures.

Avant chaque création, le serveur vérifie les droits de l’auteur, l’empreinte de la clé, la version, l’état et le solde de facture.
Un changement bloque la création. Il ne modifie pas une page Stripe déjà créée.

Une seule demande reste active par facture.
L’installation conserve au maximum 100 demandes de test.

## Notifications signées

La route lit le corps HTTP brut, dans la limite globale des requêtes.
Le SDK officiel Stripe vérifie la signature avec une tolérance de cinq minutes.
Le serveur refuse les événements réels.

Pour une session connue, SQLite conserve l’identifiant d’événement une seule fois.
Une notification programme une lecture authentifiée de la session chez Stripe.
Le corps de notification ne confirme jamais directement un paiement.

Le serveur compare le montant, la devise, la session, les identifiants de suivi et l’échéance avec la demande enregistrée.
Il exige une session terminée et un paiement confirmé pour afficher **Paiement de test confirmé par Stripe**.

Un secret absent produit HTTP 503. Une signature invalide produit HTTP 400.
Une erreur de stockage produit HTTP 503, sans accuser réception.
Un événement répété ou sans session locale connue produit HTTP 200, sans effet commercial.

## Vérifier un paiement

Choisissez une facture éligible.
Vérifiez le solde affiché.
Confirmez la création du test.
Ouvrez la page Stripe dans le nouvel onglet.

N’utilisez aucune vraie carte.
Utilisez la carte de test `4242 4242 4242 4242`.
Renseignez une date future et trois chiffres quelconques.

Le retour depuis Stripe ne confirme ni le paiement ni l’annulation.
Le serveur vérifie le résultat auprès de Stripe.
La facture reste émise après un paiement de test. Son historique financier reste inchangé.

Si le résultat reste inconnu, consultez le journal Stripe avant de créer une nouvelle demande.
Après une erreur de lecture, le serveur attend cinq minutes avant de consulter Stripe à nouveau.
Il arrête le suivi trois jours après l’échéance prévue, sans inventer une confirmation d’expiration.
