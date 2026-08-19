import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BackOfficeClientsApi } from '../../back-office/back-office-clients-api';
import { BackOfficeQuotesApi } from '../../back-office/back-office-quotes-api';
import { BackOfficeQuoteEditor } from './back-office-quote-editor';

describe('BackOfficeQuoteEditor', () => {
  it('adds a quote line without calculating totals in the browser', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BackOfficeClientsApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: BackOfficeQuotesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(BackOfficeQuoteEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const before = root.querySelectorAll('fieldset').length;
    const addButton = root.querySelector<HTMLButtonElement>('.section-heading button');
    if (addButton === null) throw new Error('The add line button is unavailable.');

    addButton.click();
    fixture.detectChanges();

    expect(before).toBe(1);
    expect(root.querySelectorAll('fieldset')).toHaveLength(2);
    expect(root.textContent).not.toContain('Total HT');
  });
});
