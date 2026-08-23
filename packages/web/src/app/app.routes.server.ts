import { RenderMode, ServerRoute } from '@angular/ssr';
import { blogPostSlugs } from './blog/blog';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'backoffice/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => blogPostSlugs.map((slug) => ({ slug })),
  },
  {
    path: 'quote',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
