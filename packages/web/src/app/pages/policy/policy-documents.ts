import { TranslationKey } from '@app/i18n.service';

export interface PolicyLink {
  href?: string;
  route?: string;
  label?: string;
  labelKey?: TranslationKey;
}

interface PolicySection {
  id: string;
  titleKey: TranslationKey;
  contentKey?: TranslationKey;
  links?: readonly PolicyLink[];
  linkNavigation?: boolean;
}

export interface PolicyDocument {
  id: string;
  titleKey: TranslationKey;
  leadKey: TranslationKey;
  updatedKey: TranslationKey;
  summaryTitleKey: TranslationKey;
  summaryContentKey: TranslationKey;
  sections: readonly PolicySection[];
}

export const policies = {
  legal: {
    id: 'legal',
    titleKey: 'legal.title',
    leadKey: 'legal.lead',
    updatedKey: 'legal.updated',
    summaryTitleKey: 'legal.summary.title',
    summaryContentKey: 'legal.summary.content',
    sections: [
      {
        id: 'publisher',
        titleKey: 'legal.publisher.title',
        contentKey: 'legal.publisher.content',
        links: [{ href: 'mailto:contact@froment.software', label: 'contact@froment.software' }],
      },
      { id: 'hosting', titleKey: 'legal.hosting.title', contentKey: 'legal.hosting.content' },
      { id: 'ip', titleKey: 'legal.ip.title', contentKey: 'legal.ip.content' },
      { id: 'links', titleKey: 'legal.links.title', contentKey: 'legal.links.content' },
      {
        id: 'contact',
        titleKey: 'legal.contact.title',
        contentKey: 'legal.contact.content',
        links: [{ href: 'mailto:contact@froment.software', label: 'contact@froment.software' }],
      },
      {
        id: 'related',
        titleKey: 'legal.related.title',
        contentKey: 'legal.related.content',
        linkNavigation: true,
        links: [
          { route: '/privacy', labelKey: 'legal.related.privacy' },
          { route: '/cookies', labelKey: 'legal.related.cookies' },
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    titleKey: 'privacy.title',
    leadKey: 'privacy.lead',
    updatedKey: 'privacy.updated',
    summaryTitleKey: 'privacy.summary.title',
    summaryContentKey: 'privacy.summary.content',
    sections: [
      { id: 'who', titleKey: 'privacy.who.title', contentKey: 'privacy.who.content' },
      { id: 'data', titleKey: 'privacy.data.title', contentKey: 'privacy.data.content' },
      {
        id: 'retention',
        titleKey: 'privacy.retention.title',
        contentKey: 'privacy.retention.content',
      },
      { id: 'storage', titleKey: 'privacy.storage.title', contentKey: 'privacy.storage.content' },
      { id: 'session', titleKey: 'privacy.session.title', contentKey: 'privacy.session.content' },
      {
        id: 'external',
        titleKey: 'privacy.external.title',
        contentKey: 'privacy.external.content',
      },
      { id: 'rights', titleKey: 'privacy.rights.title', contentKey: 'privacy.rights.content' },
      {
        id: 'contact',
        titleKey: 'privacy.contact.title',
        contentKey: 'privacy.contact.content',
        links: [{ href: 'mailto:contact@froment.software', label: 'contact@froment.software' }],
      },
      {
        id: 'related',
        titleKey: 'privacy.related.title',
        linkNavigation: true,
        links: [
          { route: '/cookies', labelKey: 'privacy.related.cookies' },
          { route: '/legal', labelKey: 'privacy.related.legal' },
        ],
      },
    ],
  },
  cookies: {
    id: 'cookies',
    titleKey: 'cookies.title',
    leadKey: 'cookies.lead',
    updatedKey: 'cookies.updated',
    summaryTitleKey: 'cookies.summary.title',
    summaryContentKey: 'cookies.summary.content',
    sections: [
      { id: 'what', titleKey: 'cookies.what.title', contentKey: 'cookies.what.content' },
      { id: 'setting', titleKey: 'cookies.why.title', contentKey: 'cookies.why.content' },
      { id: 'control', titleKey: 'cookies.control.title', contentKey: 'cookies.control.content' },
      {
        id: 'privacy',
        titleKey: 'cookies.privacy.title',
        contentKey: 'cookies.privacy.content',
        links: [{ route: '/privacy', labelKey: 'cookies.privacy.link' }],
      },
      {
        id: 'contact',
        titleKey: 'cookies.contact.title',
        contentKey: 'cookies.contact.content',
        links: [{ href: 'mailto:contact@froment.software', label: 'contact@froment.software' }],
      },
    ],
  },
} satisfies Record<'legal' | 'privacy' | 'cookies', PolicyDocument>;
