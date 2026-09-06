# Écritures des débits et commissions

Ouvrez **Banque → Écritures des débits et commissions**.
Choisissez une période comptable.
Sélectionnez un débit importé ou une commission déduite d’un encaissement rapproché.

## Comptabilisation

Chaque écriture enregistre deux comptes distincts et un montant positif en EUR.
Le serveur reprend le montant et la date de la source.
Le même montant figure au débit du premier compte et au crédit du second.
Les comptes acceptent de 1 à 32 caractères : lettres, chiffres, point, tiret et soulignement.

Choisissez les comptes avec votre comptable.
Pour une commission déduite, utilisez la contrepartie adaptée au traitement comptable de l’encaissement brut.
Ne comptabilisez pas une seconde fois une commission déjà enregistrée dans votre logiciel comptable.

L’application ne déduit aucune TVA du montant bancaire.
Elle ne crée pas les écritures de vente, de règlement ou de déclaration fiscale dans ce journal.
Le journal couvre les débits et les commissions, pas la comptabilité générale complète.
Un débit correspond au montant total importé ; cette saisie ne ventile pas une dépense entre plusieurs comptes.

## Sources et corrections

Une source possède au plus une écriture non contrepassée.
La commission exige une affectation bancaire active et un encaissement actif.
Les montants nuls, les crédits bancaires sans commission et les sources futures sont refusés.
Les transactions SQLite empêchent la double comptabilisation concurrente.

Les écritures sont immuables.
Pour corriger une écriture, créez une contrepassation avec une date et un motif.
La contrepassation inverse les comptes et conserve le montant initial.
Sa date ne peut pas précéder l’écriture initiale ni dépasser la date courante de l’installation.
Une écriture peut être contrepassée une seule fois.
Une contrepassation ne peut pas être contrepassée.

Après contrepassation, une nouvelle écriture peut reprendre la source avec des comptes corrigés.
La nouvelle écriture reprend la date de la source.
Le journal conserve l’écriture initiale et sa contrepassation, même si leurs dates appartiennent à des périodes différentes.

Avant de dissocier une affectation dont la commission est comptabilisée, contrepassez l’écriture correspondante.
Cette règle s’applique aussi avant d’annuler l’enregistrement de l’encaissement lié.
Les historiques bancaires et les montants des encaissements restent inchangés par les écritures comptables.

## Reprises et traçabilité

Chaque demande utilise une clé UUID stable.
Une reprise identique restitue l’écriture existante.
Une demande modifiée avec la même clé est refusée.
Une reprise ne réactive pas une écriture contrepassée.
Chaque écriture conserve son auteur, sa date d’enregistrement et la source.
L’audit conserve les comptabilisations et les contrepassations.

## Consultation et export

Les bornes de période sont inclusives.
Une période dépassant 10 000 écritures ou 10 000 sources est refusée sans troncature.
Si la limite est dépassée, réduisez la période.

Le CSV contient deux lignes par écriture, contrepassations comprises.
Les montants utilisent une conversion décimale exacte.
Les cellules textuelles sont protégées contre l’interprétation comme formules de tableur.
Le fichier ne constitue pas un FEC ni une déclaration réglementaire.

La permission `ledger.read` permet la consultation et l’export.
La permission `ledger.post`, avec `ledger.read`, permet la comptabilisation et la contrepassation.
Les administrateurs reçoivent les deux permissions.
Le profil comptable reçoit seulement `ledger.read`.
Les jetons API n’accèdent pas à ce module.
Les contrôles restent appliqués côté serveur.

Aucune opération ne contacte un fournisseur ou ne transfère de fonds.
