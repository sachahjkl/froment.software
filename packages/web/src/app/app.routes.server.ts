import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'back-office',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'back-office/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [{ slug: '2026-08-froment-software-arrive' }],
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
