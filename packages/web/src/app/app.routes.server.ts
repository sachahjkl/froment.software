import { RenderMode, ServerRoute } from '@angular/ssr';
import { noteSlugs } from './notes/notes';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'backoffice/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'notes/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => noteSlugs.map((slug) => ({ slug })),
  },
  {
    path: 'quote/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
