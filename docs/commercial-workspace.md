# Affaires, devis et commandes

## Affaires

Une affaire relie un devis, sa commande et sa facture.
La liste propose quatre vues : À traiter, En cours, Terminées et Toutes.

Recherchez une référence, un titre ou un client.
Filtrez les résultats par étape ou par client.
Ouvrez le menu Filtres.
Choisissez la catégorie Progression ou Client.
Recherchez une option, puis sélectionnez-la pour appliquer le filtre et fermer le menu.
La recherche d’une option ne modifie pas le filtre appliqué.
Les catégories affichent la sélection actuelle.
Le bouton de retour affiche les catégories sans modifier les filtres.
Utilisez les filtres actifs pour retirer un critère.
Sélectionnez un en-tête de colonne pour trier les résultats.
Sélectionnez-le à nouveau pour inverser le tri.

Les colonnes triables sont la référence, le titre, le client, l’étape, le montant TTC et la date de modification du devis.
La prochaine action n’est pas une colonne triable.
Par défaut, les devis les plus récemment modifiés apparaissent en premier.
Le tri compare les montants en centimes et les dates dans l’ordre chronologique.
Le tri des textes suit la langue affichée, y compris les libellés d’étape.
Si deux valeurs sont égales, l’identifiant du devis départage les lignes dans l’ordre croissant.

Le montant affiché est le montant TTC du devis.
Ce montant ne représente pas le solde de la facture.

La liste conserve la recherche, les filtres et le tri dans l’URL.
Le contexte suit les liens vers l’affaire, le devis, l’éditeur et la publication.
Le retour à la liste restaure la vue, les filtres et le tri.
L’effacement des filtres conserve le tri.

Le bouton d’export télécharge `affairs.csv`.
L’export contient uniquement les résultats chargés de la vue active, après recherche et filtres, dans l’ordre du tri affiché.
Il contient les six colonnes de données affichées, sans les actions ni les identifiants internes.
Les montants, les dates et les libellés suivent la langue affichée.
Pendant le chargement ou sans résultat, une infobulle explique pourquoi l’export est indisponible.

Le détail de l’affaire propose trois onglets :

- Vue d’ensemble présente la prochaine action et les documents liés.
- Documents distingue les liens vers les fiches et les aperçus PDF.
- Historique présente les événements commerciaux et financiers enregistrés.

Les documents gardent l’ordre devis, commande, facture.
L’historique garde l’ordre du plus ancien au plus récent.
Ces tableaux ne proposent pas de tri interactif.

## Devis

Le détail du devis est distinct de son éditeur.
Il propose les onglets Résumé, Document et Versions.
L’onglet Document peut présenter une révision précise.
Les versions gardent l’ordre de la première à la dernière révision.
Les lignes d’un document gardent l’ordre enregistré.

Un devis brouillon peut être modifié ou publié pour signature.
Un devis expiré permet de créer une révision.
Un devis accepté donne accès à sa commande.
Le serveur contrôle les transitions autorisées et la version attendue.

### Édition

Choisissez le client et saisissez le titre.
Ajoutez les lignes manuellement ou depuis le catalogue avec recherche.
Choisissez un modèle de conditions ou saisissez les conditions.
Enregistrez le devis.

Le catalogue copie les valeurs dans une ligne indépendante.
La modification ultérieure du catalogue ne modifie pas cette ligne.
Le sélecteur de conditions affiche un extrait de 160 caractères maximum.
La sélection copie le texte complet des conditions.

Le lien Nouveau devis depuis une fiche client peut préselectionner ce client.
La préselection exige un identifiant valide et un client actif dans la liste accessible.
Elle ne marque pas le formulaire comme modifié.

Le bouton Enregistrer reste disponible quand un champ est invalide.
La soumission affiche les erreurs et place le focus sur le premier champ invalide.
Le serveur calcule les totaux.
Les totaux précédents restent identifiés comme des totaux enregistrés pendant les modifications.

Un conflit de version conserve la saisie.
Le rechargement demande confirmation avant de remplacer une saisie non enregistrée.
Une création sans réponse définitive bloque une deuxième création dans cet éditeur.

### Annulation

L’annulation est une action secondaire du détail du devis.
Ouvrez Autres actions dans le résumé pour afficher le formulaire d’annulation.
Elle exige une raison et une confirmation.
La note est facultative et limitée à 500 caractères.

Les onglets conservent la raison et la note non soumises.
Une sortie demande confirmation avant de perdre ces champs.
Pendant la confirmation ou la demande d’annulation, la page bloque la sortie.
Le dialogue empêche les demandes simultanées et restaure le focus après sa fermeture.

## Publication pour signature

Vérifiez la référence, la révision et le montant du devis.
Préparez le PDF de cette révision.
Vérifiez les coordonnées des parties dans le PDF.
Cochez la confirmation de vérification.
Créez le lien de signature.
Copiez le lien avant de quitter la page.

La création du lien n’envoie aucun courriel.
La signature du client créera une commande.

Les coordonnées du PDF proviennent de la révision enregistrée.
La page ne les remplace pas par les coordonnées actuelles des parties.
Le serveur retourne les blocages documentaires lors de la publication.
La page présente ces blocages avec les liens de correction disponibles.

Une publication sans réponse définitive reste incertaine.
La page bloque une nouvelle soumission tant que l’état du devis n’a pas été relu avec succès.
Un échec du rechargement conserve l’avertissement de sortie.
Après un rechargement réussi, la préparation du PDF et la vérification doivent être refaites.

L’API fournit le lien de signature uniquement dans la réponse de création.
Elle ne permet pas de récupérer un lien perdu.
Le lien du portail exige une connexion client et ne remplace pas le lien de signature.

## Commande

La commande reprend exactement la révision acceptée du devis.
Son contenu est immuable.
La fiche présente la référence, la date, le client, les lignes, les totaux et le document.
Si la révision acceptée est indisponible, la page affiche une erreur.
Elle ne présente pas une autre révision à sa place.

Si une facture existe, ouvrez cette facture depuis la commande.
Sinon, créez une facture depuis la commande.

## Liens du module

| Destination           | URL                                              |
| --------------------- | ------------------------------------------------ |
| Liste des affaires    | `/backoffice/affaires/:view`                     |
| Détail de l’affaire   | `/backoffice/affaires/:quoteId/:tab`             |
| Nouveau devis         | `/backoffice/quotes/new?clientId=:clientId`      |
| Détail du devis       | `/backoffice/quotes/:quoteId/:tab`               |
| Éditeur du devis      | `/backoffice/quotes/:quoteId/edit`               |
| Publication du devis  | `/backoffice/quotes/:quoteId/publication`        |
| Révision du document  | `/backoffice/quotes/:quoteId/document?version=N` |
| Commande              | `/backoffice/orders/:orderId`                    |
| Nouvelle facture liée | `/backoffice/invoices/new?orderId=:orderId`      |

Le contexte commercial accepte uniquement `q`, `stage`, `client`, `view` et `sort`.
La recherche est limitée à 120 caractères.
L’étape, la vue et l’identifiant client sont validés.
Aucun paramètre `returnUrl` n’est utilisé.

Le tri accepte les clés `reference`, `title`, `client`, `stage`, `amount` et `updated`, avec le suffixe `-asc` ou `-desc`.
Une valeur absente ou invalide utilise `updated-desc`.
