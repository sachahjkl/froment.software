import { TestBed } from '@angular/core/testing';
import { Blog } from './blog';
import { I18nService } from '../i18n.service';

describe('Blog', () => {
  it('renders the localized Markdown article by slug', () => {
    const blog = TestBed.inject(Blog);
    const i18n = TestBed.inject(I18nService);

    i18n.setLanguage('fr');
    const post = blog.find('2026-08-froment-software-arrive');

    expect(post?.title).toBe('Froment Software arrive sur le marché');
    expect(post?.html).toContain('<h2>Pourquoi maintenant ?</h2>');
    expect(post?.topics).toContain('développement logiciel');
  });

  it('returns no article for an unknown slug', () => {
    expect(TestBed.inject(Blog).find('unknown')).toBeUndefined();
  });
});
