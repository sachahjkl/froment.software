import type { TranslationKey } from './translation.js';

export interface NoteMetadata {
  readonly slug: string;
  readonly published: string;
  readonly updated: string;
  readonly titleKey: TranslationKey;
  readonly descriptionKey: TranslationKey;
  readonly topicKeys: readonly TranslationKey[];
}

export const notes = [
  {
    slug: '2026-09-du-commit-a-nomad',
    published: '2026-09-11',
    updated: '2026-09-11',
    titleKey: 'notes.deployment.title',
    descriptionKey: 'notes.deployment.description',
    topicKeys: ['notes.topic.nix', 'notes.topic.nomad', 'notes.topic.supplyChain'],
  },
  {
    slug: '2026-08-production-observabilite',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'notes.operations.title',
    descriptionKey: 'notes.operations.description',
    topicKeys: ['notes.topic.nix', 'notes.topic.secrets', 'notes.topic.observability'],
  },
  {
    slug: '2026-08-securite-authentification',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'notes.security.title',
    descriptionKey: 'notes.security.description',
    topicKeys: ['notes.topic.security', 'notes.topic.authentication', 'notes.topic.audit'],
  },
  {
    slug: '2026-08-architecture-effect',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'notes.architecture.title',
    descriptionKey: 'notes.architecture.description',
    topicKeys: ['notes.topic.effect', 'notes.topic.sqlite', 'notes.topic.documents'],
  },
  {
    slug: '2026-08-froment-software-arrive',
    published: '2026-08-12',
    updated: '2026-08-12',
    titleKey: 'notes.launch.title',
    descriptionKey: 'notes.launch.description',
    topicKeys: [
      'notes.launch.topic.development',
      'notes.launch.topic.takeover',
      'notes.launch.topic.ci',
      'notes.launch.topic.nixos',
      'notes.launch.topic.infrastructure',
    ],
  },
] as const satisfies readonly NoteMetadata[];
