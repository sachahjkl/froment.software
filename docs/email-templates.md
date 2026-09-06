# Modèles de courriels

La page **Courriels** permet de créer, utiliser, modifier et archiver des modèles partagés.
Chaque modèle contient un objet et un texte brut.
Il ne conserve aucun destinataire ni référence commerciale.

Pour créer un modèle, renseignez l’objet et le texte du formulaire.
Cliquez sur **Créer un modèle avec ce texte**.
L’objet identifie le modèle dans la liste.

Cliquez sur **Utiliser ce modèle** pour copier son texte dans le formulaire.
Le destinataire et la référence restent inchangés.
Si le formulaire contient des modifications non enregistrées, confirmez leur remplacement.
La copie reste modifiable et indépendante du modèle.
Le contrôle de sortie protège aussi une copie non modifiée manuellement.

Cliquez sur **Mettre à jour le modèle ouvert** pour remplacer son objet et son texte.
Confirmez cette modification partagée.
L’archivage masque le modèle sans modifier les brouillons ou courriels existants.

## Contrat et stockage

`EmailTemplates` expose `list`, `save` et `archive` comme service Effect.
`EmailTemplatesLive` conserve les modèles dans SQLite.
Les routes `/api/email-templates` exigent `email.template.manage`.
La migration attribue cette permission au rôle administrateur, sans modifier les jetons API existants.

Chaque création utilise un UUID v4 stable et la version attendue zéro.
Les mises à jour vérifient la version attendue.
Une nouvelle tentative identique retourne la version déjà enregistrée.
Un conflit conserve le texte local et refuse l’écrasement du modèle serveur.
L’installation accepte au plus 100 modèles actifs.
L’audit conserve l’acteur, la date et l’identifiant du modèle, sans recopier son texte.

Le texte reste littéral, y compris les balises HTML et les séquences entre accolades.
Aucun moteur de code ou de variables ne l’exécute.
L’enregistrement, l’utilisation et l’archivage ne contactent aucun fournisseur.
La soumission reste une action distincte avec le mode du fournisseur affiché.
