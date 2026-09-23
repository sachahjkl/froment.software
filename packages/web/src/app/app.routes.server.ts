import { RenderMode, ServerRoute } from '@angular/ssr';
import { noteSlugs } from './notes/notes';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'notes/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => noteSlugs.map((slug) => ({ slug })),
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
