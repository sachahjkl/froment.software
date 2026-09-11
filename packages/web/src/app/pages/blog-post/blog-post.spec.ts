import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Blog } from '../../blog/blog';
import { I18nService } from '@app/i18n.service';
import { BlogPost } from './blog-post';

describe('BlogPost context', () => {
  it('renders the current slug, URL query and language on a reused route', async () => {
    const find = vi.fn().mockReturnValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'blog/:slug', component: BlogPost }]),
        { provide: Blog, useValue: { find } },
      ],
    });
    TestBed.overrideComponent(BlogPost, { set: { template: '' } });
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/blog/first?source=mail', BlogPost);
    page['post']();
    expect(find).toHaveBeenLastCalledWith('first', '/blog/first?source=mail');

    expect(await harness.navigateByUrl('/blog/second?source=site#section', BlogPost)).toBe(page);
    page['post']();
    expect(find).toHaveBeenLastCalledWith('second', '/blog/second?source=site');

    await harness.navigateByUrl('/blog/second?source=contact');
    page['post']();
    expect(find).toHaveBeenLastCalledWith('second', '/blog/second?source=contact');

    find.mockClear();
    i18n.setLanguage('en');
    page['post']();
    expect(find).toHaveBeenCalledExactlyOnceWith('second', '/blog/second?source=contact');
  });
});
