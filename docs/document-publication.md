# Contrôles avant publication

## Dates du document

Chaque nouveau snapshot de devis ou de facture conserve son calendrier métier dans `calendar.timeZone`.
Le moteur PDF utilise ce calendrier pour les dates issues d’un instant.
Les dates de prestation et d’échéance restent des dates calendaires.

La preuve de signature version 2 conserve le calendrier de confirmation de la commande dans `orderCalendar`.
Ce calendrier vient de la configuration au moment de la signature, même si le devis est ancien.
Les preuves version 1 et les snapshots sans calendrier conservent leur lecture historique en UTC.
Un changement de configuration ne réécrit ni les preuves ni les PDF conservés.

## Coordonnées

Le serveur contrôle les coordonnées enregistrées dans la version du document, pas seulement les fiches actuelles.
Il effectue ce contrôle avant de créer un lien de signature ou d’émettre une facture.

Pour l’entreprise et le client, les champs suivants sont requis :

- nom ;
- adresse principale ;
- ville ;
- pays ;
- adresse e-mail au format accepté par l’application.

Les chaînes composées uniquement d’espaces sont considérées comme vides.
Le code postal reste facultatif pour les pays qui ne l’utilisent pas.
Le téléphone, le complément d’adresse et les identifiants fiscaux ne sont pas contrôlés par ce premier socle.
Ces contrôles ne certifient ni la conformité fiscale ni la validité juridique du document.

L’API retourne `document.incomplete`, avec une liste structurée des parties, champs et motifs concernés.
L’interface affiche ces champs et les liens vers les fiches à corriger.
Un refus laisse le document en brouillon.
Il ne crée aucun lien de signature, numéro de facture ou tâche PDF définitive.

## Reprise après correction

Pour un devis :

1. Corrigez les fiches indiquées.
2. Enregistrez une nouvelle version du devis, même sans modifier ses lignes.
3. Générez le PDF de cette version.
4. Créez le lien de signature.

Chaque version de devis reprend les coordonnées actuelles des deux fiches.

Pour une facture :

1. Corrigez les fiches indiquées.
2. Ouvrez le brouillon de facture.
3. Cochez l’actualisation des coordonnées.
4. Enregistrez une nouvelle version.
5. Vérifiez son aperçu avant l’émission.

La requête de révision de facture exige le booléen `refreshParties`.
Si sa valeur est `false`, la nouvelle version conserve les coordonnées de la version précédente.
Si sa valeur est `true`, elle reprend les deux fiches actuelles.
L’événement d’audit enregistre ce choix.
Les versions précédentes, les devis acceptés et les factures émises restent inchangés.

## Vérification

Les tests couvrent les champs manquants, les adresses e-mail invalides et l’absence de code postal.
Un parcours HTTP vérifie le refus, la correction, l’actualisation explicite et la conservation des versions précédentes.
Le test Angular vérifie les messages et les liens de correction.

```sh
pnpm lint
pnpm build
pnpm --recursive --if-present test
```
