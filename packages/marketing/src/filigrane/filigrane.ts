import { HttpServerResponse } from 'effect/http';

// Must match the code engraved on the licence card: gui_toolkit `ui.licence_card`,
// `src/md/features/licence-card.md`, section "The engraved code". The card links to
// `https://froment.software/filigrane?sceau=<this token>`. This is a fixed secret of the hunt,
// not a per-environment setting, so it does not belong in the runtime configuration.
const sealToken = 'gf1MDAWPoTGY';

const filigranePath = '/filigrane';

// Only the exact token opens the page. Every other request falls through to the normal
// router, so a guess of the path gets the site's own 404, byte for byte.
export const isFiligraneRequest = (url: URL): boolean =>
  url.pathname === filigranePath && url.searchParams.get('sceau') === sealToken;

// Inline page, served only by the server: the text never enters the Angular bundle, the
// sitemap or the pre-rendered routes. It reuses the site's fonts and ink colour, darker.
// oxlint-disable-next-line anti-slop/no-natural-language-literals -- A hidden page: the l10n package ships to the browser and would reveal it.
const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Le filigrane</title>
<link rel="icon" href="/favicon.ico">
<style>
@font-face {
  font-family: "Fira Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/FiraSans-Book.woff2") format("woff2");
}
@font-face {
  font-family: "Fira Sans";
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/FiraSans-BookItalic.woff2") format("woff2");
}
@font-face {
  font-family: "Fira Sans";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/FiraSans-Medium.woff2") format("woff2");
}
:root {
  color-scheme: dark;
  --ink: #d5d4dc;
  --muted: #8f8aa6;
  --line: #363653;
  --night: #12121f;
  --deep: #20203a;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 2rem;
  background: radial-gradient(ellipse at center, var(--deep) 0%, var(--night) 70%);
  color: var(--ink);
  font-family: "Fira Sans", sans-serif;
  line-height: 1.6;
}
main {
  max-width: 34rem;
  padding: 3rem 2.5rem;
  border: 1px solid var(--line);
  outline: 1px solid var(--line);
  outline-offset: 6px;
  text-align: center;
}
h1 {
  margin: 0 0 1.5rem;
  font-weight: 600;
  font-size: 1.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
p { margin: 0 0 1.25rem; }
.riddle { color: var(--muted); font-style: italic; }
a {
  display: inline-block;
  margin-top: 1.5rem;
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: none;
  border-bottom: 1px solid var(--line);
}
a:hover, a:focus-visible { color: var(--ink); }
</style>
</head>
<body>
<main>
<h1>Le filigrane</h1>
<p>Vous avez trouvé ce que la feuille cachait.</p>
<p class="riddle">Le sceau n’est que le premier. Cherchez ce que les programmes taisent quand on les regarde de biais.</p>
<a href="/fr">Revenir</a>
</main>
</body>
</html>
`;

export const filigraneResponse = () =>
  HttpServerResponse.text(page, {
    contentType: 'text/html; charset=utf-8',
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'content-language': 'fr',
      'x-content-type-options': 'nosniff',
    },
  });
