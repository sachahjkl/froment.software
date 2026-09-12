# Affaires

Une affaire regroupe plusieurs chaînes de devis, commandes et factures pour un client.
Elle possède un ULID interne et une référence `AF-AAAA-NNNNNN`.

Créez une affaire sans créer de document.
Liez ensuite un ou plusieurs devis du même client.
Les commandes et factures liées apparaissent par leur filiation au devis.

La création d’un devis crée aussi une affaire initiale.
Le déplacement d’un devis vers une autre affaire conserve tous ses documents.

La migration crée une affaire pour chaque devis existant.
Elle conserve les liens vers les commandes et factures existantes.

Une affaire est ouverte ou clôturée.
Les modifications utilisent un numéro de version pour détecter les écritures concurrentes.

- `affair.read` permet de consulter les affaires.
- `affair.create` permet de créer une affaire.
- `affair.update` permet de modifier une affaire et ses liens.
