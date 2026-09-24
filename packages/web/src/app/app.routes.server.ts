import { RenderMode, ServerRoute } from '@angular/ssr';
import { noteSlugs } from './notes/notes';

const languages = ['fr', 'en'] as const;
const staticPaths = [
  '',
  'about',
  'clients',
  'services',
  'services/audit-renovation',
  'services/development',
  'tools',
  'notes',
  'legal',
  'privacy',
  'cookies',
  'version',
  '404',
] as const;

const getLanguageParams = async () => languages.map((language) => ({ language }));

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Client },
  ...staticPaths.map((path): ServerRoute => ({
    path: path ? `:language/${path}` : ':language',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: getLanguageParams,
  })),
  {
    path: ':language/notes/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () =>
      languages.flatMap((language) => noteSlugs.map((slug) => ({ language, slug }))),
  },
  { path: ':language/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
