import type { TranslationKey } from './translation.js';

export interface BlogPostMetadata {
  readonly slug: string;
  readonly published: string;
  readonly updated: string;
  readonly titleKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  readonly topicKeys: readonly TranslationKey[];
}

export const blogPosts = [
  {
    slug: '2026-09-du-commit-a-nomad',
    published: '2026-09-11',
    updated: '2026-09-11',
    titleKey: 'blog.deployment.title',
    descriptionKey: 'blog.deployment.description',
    topicKeys: ['blog.topic.nix', 'blog.topic.nomad', 'blog.topic.supplyChain'],
  },
  {
    slug: '2026-08-production-observabilite',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.operations.title',
    descriptionKey: 'blog.operations.description',
    topicKeys: ['blog.topic.nix', 'blog.topic.secrets', 'blog.topic.observability'],
  },
  {
    slug: '2026-08-securite-authentification',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.security.title',
    descriptionKey: 'blog.security.description',
    topicKeys: ['blog.topic.security', 'blog.topic.authentication', 'blog.topic.audit'],
  },
  {
    slug: '2026-08-architecture-effect',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.architecture.title',
    descriptionKey: 'blog.architecture.description',
    topicKeys: ['blog.topic.effect', 'blog.topic.sqlite', 'blog.topic.documents'],
  },
  {
    slug: '2026-08-froment-software-arrive',
    published: '2026-08-12',
    updated: '2026-08-12',
    titleKey: 'blog.launch.title',
    descriptionKey: 'blog.launch.description',
    topicKeys: [
      'blog.launch.topic.development',
      'blog.launch.topic.takeover',
      'blog.launch.topic.ci',
      'blog.launch.topic.nixos',
      'blog.launch.topic.infrastructure',
    ],
  },
] as const satisfies readonly BlogPostMetadata[];
