# Relances programmées

Depuis une facture émise, ouvrez **Préparer un rappel de paiement**.
Dans **Relances programmées**, saisissez une date et une heure locales.
Cliquez sur **Programmer la relance**.
Confirmez la programmation.

La relance utilise le rappel standard dans la langue active au moment de la programmation.
Elle n’utilise pas les modifications du texte du formulaire de courriel.
Elle ne joint aucun PDF.
Le navigateur transmet un instant UTC au serveur.
Le serveur accepte une date future dans les 366 jours.

L’installation accepte 100 programmations actives, avec une seule programmation active par facture.
La programmation exige une facture émise, un solde positif et une adresse client valide.
Elle vérifie la version de la facture.
Un UUID v4 stable rend les nouvelles tentatives de création idempotentes.

## Refus et résultat inconnu

Si une réponse est perdue, réessayez avec le même UUID et la demande d’origine.
L’éditeur conserve cette demande dans son stockage de reprise et bloque ses modifications.
Un conflit d’identifiant, une erreur de transport ou un refus de permission ne prouve pas l’absence d’une programmation antérieure.

Le contrat `ReminderRejected` confirme un refus avant création pour un UUID et une demande précis.
Il indique la raison : facture, adresse, mode, date, programmation existante ou limite atteinte.
SQLite conserve ce refus et son auteur dans `email_reminder_rejections`, dans la même transaction que l’événement d’audit.
Une nouvelle tentative identique restitue ce refus, même si les conditions ont changé depuis.
Une demande modifiée ou un autre auteur reçoit un conflit, pas une confirmation de refus.
Les brouillons et soumissions de courriels ne peuvent pas réutiliser cet UUID.

Après un refus confirmé pour sa demande exacte, l’éditeur retire la demande de son stockage de reprise.
Les champs deviennent modifiables sans perdre leur contenu.
Corrigez les valeurs ou actualisez les factures et les accès.
Une nouvelle programmation utilise un nouvel UUID.
Une reprise conserve toujours le mode d’origine, même après un changement de configuration.

## Traitement durable

Le service Effect `Reminders` expose `list`, `create`, `cancel` et `runPending`.
SQLite conserve chaque programmation, son initiateur, sa langue et son mode attendu.
Le travailleur examine les échéances toutes les 15 secondes, par lots de 20.
Après un arrêt du serveur, il traite les programmations arrivées à échéance.

Au moment prévu, le serveur vérifie de nouveau :

- le compte initiateur et ses quatre permissions ;
- le mode du fournisseur ;
- l’état de la facture et du client ;
- le solde après déduction des règlements actifs ;
- l’adresse actuelle du client.

Les règlements annulés ne réduisent pas le solde.
Une facture soldée, annulée ou liée à un client désactivé ne produit aucun courriel.
Un changement de mode ou de permissions empêche également la préparation.
La liste affiche la raison de cette décision.

Une transaction prépare le message, crée son opération et l’inscrit dans la file des reprises automatiques.
Elle marque aussi la programmation comme préparée.
Aucun appel fournisseur ne se produit dans cette transaction.
Deux travailleurs ne peuvent pas créer deux opérations pour la même programmation.

La file traite le message au passage suivant, avec cinq tentatives maximum.
Elle conserve le texte, le destinataire et le mode de la demande préparée.
Avant chaque tentative, elle vérifie aussi la version de la facture, ses règlements actifs et le destinataire.
Si ces données changent, elle bloque la reprise au lieu de soumettre un rappel périmé.
Le service de soumission applique ces contrôles aux reprises automatiques et manuelles avant tout nouvel appel fournisseur.
Il refuse aussi les factures couvertes par un avoir et les clients désactivés.
L’initiateur et l’auteur d’une reprise manuelle doivent conserver les quatre permissions requises.
Une opération déjà terminée restitue son reçu sans appeler le fournisseur.

## Annulation et historique

Une programmation encore active peut être annulée depuis la liste.
L’annulation et la préparation utilisent des transactions exclusives.
La première transaction validée détermine le résultat.
Une programmation préparée ne peut plus être annulée par cette action.
Son opération possède alors son propre historique.

L’audit conserve la création, l’annulation et le résultat de la préparation.
La route `GET /api/reminders` retourne au plus 100 lignes, avec priorité aux programmations actives.
Elle trie les programmations par échéance croissante, puis l’historique par échéance décroissante.
Les routes exigent `email.reminder.manage`, `invoice.read`, `client.read` et `integration.manage`.
La migration attribue la nouvelle permission au rôle administrateur, sans modifier les jetons API.

## Simulation

Le fournisseur raccordé reste un mock, y compris en production.
La programmation et son traitement local sont réels.
Le reçu fournisseur reste une simulation et ne prouve aucun envoi.
La programmation ne déclenche ni encaissement ni modification de facture.
