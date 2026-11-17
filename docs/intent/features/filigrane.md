# Filigrane

`/filigrane?sceau=gf1MDAWPoTGY` est la première étape d’une chasse (un jeu en réalité alternée) à travers les programmes. La carte de licence des programmes porte un QR code gravé, visible seulement quand on incline la carte sous un angle précis. Ce code mène exactement à cette adresse.

## Intention

La page dit au visiteur qu’il a trouvé ce que la feuille cachait, puis lui donne la première énigme : la chasse continue dans les programmes eux-mêmes. Elle est courte, sombre, dans l’esprit d’une gravure. Elle ne mène nulle part ailleurs, sauf un lien discret vers l’accueil.

## Décisions

- **Le sceau est le secret.** Seul le paramètre `sceau` exact ouvre la page. Le jeton vit à un seul endroit, dans `packages/marketing/src/filigrane/filigrane.ts`. Il doit rester égal au code gravé sur la carte (gui_toolkit, `ui.licence_card`, `src/md/features/licence-card.md`, section « The engraved code »). Si l’un change, l’autre change aussi.
- **Tout le reste donne le 404 du site.** Sans paramètre, ou avec un autre jeton, la requête passe au routeur normal. Le visiteur reçoit la même réponse que pour une adresse inconnue : même statut, même corps. Deviner le chemin ne révèle rien.
- **Le serveur vérifie le jeton.** Le serveur Effect sert la page, en HTML écrit dans le module. La page n’entre ni dans le bundle Angular, ni dans les routes pré-rendues, ni dans `packages/l10n` : le texte et le jeton ne sont lisibles dans aucun fichier public.
- **La page n’est pas listée.** Elle est absente du sitemap et de tout lien. Elle porte `noindex, nofollow` dans une balise meta et dans l’en-tête `X-Robots-Tag`. `Referrer-Policy: no-referrer` garde le jeton hors des en-têtes `Referer`. `robots.txt` ne la nomme pas, car ce fichier est public.
- **Le jeton n’est pas une configuration d’exécution.** Il est le même dans tous les environnements, car la carte gravée ne change pas avec eux. Il reste donc une constante, hors de `runtime-config.ts`.
- **Pas d’entrée au journal des versions.** Aucun visiteur n’est censé voir la page sans la carte.

## Options refusées

- **Le chemin seul comme secret.** Un chemin se devine, se liste et finit dans les journaux de robots. Le jeton porte le secret ; le chemin peut être connu.
- **Une vérification dans le navigateur.** Une route Angular qui compare le jeton le met dans un fichier JavaScript public. N’importe qui le lit sans la carte.
- **Une ligne `Disallow: /filigrane` dans `robots.txt`.** Elle révèle le chemin à quiconque lit le fichier.
