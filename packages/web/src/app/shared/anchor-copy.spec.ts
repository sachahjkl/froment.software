import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { AnchorCopy } from './anchor-copy';
import { TextCopy } from './text-copy';

describe('AnchorCopy', () => {
  afterEach(() => vi.useRealTimers());

  it('copies the current path and query without navigating to the fragment', async () => {
    vi.useFakeTimers();
    const location = new URL('https://example.test/services?source=contact#previous');
    const copy = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { defaultView: { location } } },
        { provide: TextCopy, useValue: { copy } },
      ],
    });

    await TestBed.inject(AnchorCopy).copy('prestations', 'Lien copié');

    expect(copy).toHaveBeenCalledExactlyOnceWith(
      'https://example.test/services?source=contact#prestations',
    );
    expect(location.hash).toBe('#previous');
  });
});
