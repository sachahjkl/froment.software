import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Notes } from '../../notes/notes';
import { I18nService } from '@app/i18n.service';
import { Note } from './note';

describe('Note context', () => {
  it('renders the current slug, URL query and language on a reused route', async () => {
    const find = vi.fn().mockReturnValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'notes/:slug', component: Note }]),
        { provide: Notes, useValue: { find } },
      ],
    });
    TestBed.overrideComponent(Note, { set: { template: '' } });
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/notes/first?source=mail', Note);
    page['note']();
    expect(find).toHaveBeenLastCalledWith('first', '/notes/first?source=mail');

    expect(await harness.navigateByUrl('/notes/second?source=site#section', Note)).toBe(page);
    page['note']();
    expect(find).toHaveBeenLastCalledWith('second', '/notes/second?source=site');

    await harness.navigateByUrl('/notes/second?source=contact');
    page['note']();
    expect(find).toHaveBeenLastCalledWith('second', '/notes/second?source=contact');

    find.mockClear();
    i18n.setLanguage('en');
    page['note']();
    expect(find).toHaveBeenCalledExactlyOnceWith('second', '/notes/second?source=contact');
  });
});
