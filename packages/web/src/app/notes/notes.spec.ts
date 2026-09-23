import { TestBed } from '@angular/core/testing';
import { Notes, noteSlugs } from './notes';
import { I18nService } from '@app/i18n.service';

describe('Notes', () => {
  it('renders the localized Markdown article by slug', () => {
    const notes = TestBed.inject(Notes);
    const i18n = TestBed.inject(I18nService);

    i18n.setLanguage('fr');
    const post = notes.find('2026-08-froment-software-arrive');

    expect(post?.title).toBe('Froment Software arrive sur le marché');
    expect(post?.html).toContain('<h2>Pourquoi maintenant ?</h2>');
    expect(post?.topics).toContain('développement logiciel');
  });

  it('returns no article for an unknown slug', () => {
    expect(TestBed.inject(Notes).find('unknown')).toBeUndefined();
  });

  it('exposes every article slug for prerendering', () => {
    expect(noteSlugs).toHaveLength(TestBed.inject(Notes).posts().length);
  });

  it('preserves the article URL and query in Markdown fragment links', () => {
    const post = TestBed.inject(Notes).find(
      '2026-08-architecture-effect',
      '/notes/2026-08-architecture-effect?source=contact&mode=reading',
    );

    expect(post?.html).toContain(
      'href="/notes/2026-08-architecture-effect?source=contact&amp;mode=reading#',
    );
    expect(post?.html).not.toContain('href="#');
  });

  it('keeps Mermaid diagrams for browser rendering', () => {
    const post = TestBed.inject(Notes).find('2026-08-architecture-effect');

    expect(post?.html).toContain('<pre class="mermaid">');
    expect(post?.html).toContain('flowchart');
    expect(post?.html).toContain(
      'href="/notes/2026-08-architecture-effect#une-chaine-d-integrite-fondee-sur-sha-256"',
    );
  });
});
