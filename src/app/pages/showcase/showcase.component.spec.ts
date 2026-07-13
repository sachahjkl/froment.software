import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../i18n.service';
import { ShowcaseComponent } from './showcase.component';

function dispatchValue(control: HTMLInputElement | HTMLSelectElement, value: string, eventName: 'input' | 'change'): void {
  control.value = value;
  control.dispatchEvent(new Event(eventName, { bubbles: true }));
}

describe('ShowcaseComponent', () => {
  let fixture: ComponentFixture<ShowcaseComponent>;
  let i18n: I18nService;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ShowcaseComponent] }).compileComponents();
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    fixture = TestBed.createComponent(ShowcaseComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('keeps labels and a caption associated while exposing a distinct action name per service', () => {
    const search = element.querySelector<HTMLInputElement>('#showcase-search')!;
    const status = element.querySelector<HTMLSelectElement>('#showcase-status')!;
    const searchLabel = element.querySelector<HTMLLabelElement>('label[for="showcase-search"]')!;
    const statusLabel = element.querySelector<HTMLLabelElement>('label[for="showcase-status"]')!;
    const caption = element.querySelector<HTMLTableCaptionElement>('caption')!;
    const frenchSearchLabel = searchLabel.textContent;
    const frenchStatusLabel = statusLabel.textContent;
    const frenchCaption = caption.textContent;

    expect(searchLabel.control).toBe(search);
    expect(statusLabel.control).toBe(status);
    expect(caption.textContent?.trim()).toBeTruthy();

    const actionButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('tbody .data-row button'),
    );
    const services = Array.from(
      element.querySelectorAll<HTMLElement>('tbody .data-row th[scope="row"]'),
      (cell) => cell.textContent?.trim() ?? '',
    );
    const actionNames = actionButtons.map((button) => button.getAttribute('aria-label') ?? '');

    expect(actionButtons).toHaveLength(3);
    expect(new Set(actionNames).size).toBe(3);
    expect(actionNames.every((name, index) => name.includes(services[index]))).toBe(true);

    i18n.setLanguage('en');
    fixture.detectChanges();

    expect(searchLabel.control).toBe(search);
    expect(statusLabel.control).toBe(status);
    expect(caption.textContent?.trim()).toBeTruthy();
    expect(searchLabel.textContent).not.toBe(frenchSearchLabel);
    expect(statusLabel.textContent).not.toBe(frenchStatusLabel);
    expect(caption.textContent).not.toBe(frenchCaption);
  });

  it('filters by status and query and renders the empty state when nothing matches', () => {
    const search = element.querySelector<HTMLInputElement>('#showcase-search')!;
    const status = element.querySelector<HTMLSelectElement>('#showcase-status')!;

    dispatchValue(status, 'warn', 'change');
    fixture.detectChanges();

    const filteredRows = element.querySelectorAll('.data-row');
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].querySelector('th[scope="row"]')?.textContent?.trim()).toBe('web-app');

    dispatchValue(search, 'does-not-exist', 'input');
    fixture.detectChanges();

    expect(element.querySelectorAll('.data-row')).toHaveLength(0);
    expect(element.querySelector('.empty-row')?.textContent?.trim()).toBeTruthy();
  });

  it('switches visible and accessible detail actions and keeps them localized', () => {
    const action = element.querySelector<HTMLButtonElement>('tbody .data-row button')!;
    const initialText = action.textContent?.trim();
    const initialName = action.getAttribute('aria-label');
    const detailsId = action.getAttribute('aria-controls')!;
    const details = element.querySelector<HTMLElement>(`#${detailsId}`)!.closest<HTMLTableRowElement>('tr')!;

    expect(action.getAttribute('aria-expanded')).toBe('false');
    expect(details.hidden).toBe(true);

    action.click();
    fixture.detectChanges();

    const frenchCloseText = action.textContent?.trim();
    const frenchCloseName = action.getAttribute('aria-label');
    expect(action.getAttribute('aria-expanded')).toBe('true');
    expect(details.hidden).toBe(false);
    expect(frenchCloseText).not.toBe(initialText);
    expect(frenchCloseName).not.toBe(initialName);

    i18n.setLanguage('en');
    fixture.detectChanges();

    expect(action.textContent?.trim()).not.toBe(frenchCloseText);
    expect(action.getAttribute('aria-label')).not.toBe(frenchCloseName);

    action.click();
    fixture.detectChanges();

    expect(action.getAttribute('aria-expanded')).toBe('false');
    expect(details.hidden).toBe(true);
  });

  it('re-announces repeated Run and Cancel actions through alternating persistent status regions', () => {
    const buttons = element.querySelectorAll<HTMLButtonElement>('.buttons-card .button-stack button');
    const statuses = element.querySelectorAll<HTMLElement>('.buttons-card [role="status"]');
    const announcement = (status: HTMLElement) => status.textContent?.trim() ?? '';

    expect(buttons).toHaveLength(3);
    expect(statuses).toHaveLength(2);

    buttons[0].click();
    fixture.detectChanges();
    const runAnnouncement = announcement(statuses[0]);
    expect(runAnnouncement).toBeTruthy();
    expect(announcement(statuses[1])).toBe('');

    buttons[0].click();
    fixture.detectChanges();
    expect(announcement(statuses[0])).toBe('');
    expect(announcement(statuses[1])).toBe(runAnnouncement);

    buttons[1].click();
    fixture.detectChanges();
    const cancelAnnouncement = announcement(statuses[0]);
    expect(cancelAnnouncement).toBeTruthy();
    expect(cancelAnnouncement).not.toBe(runAnnouncement);
    expect(announcement(statuses[1])).toBe('');

    buttons[1].click();
    fixture.detectChanges();
    expect(announcement(statuses[0])).toBe('');
    expect(announcement(statuses[1])).toBe(cancelAnnouncement);
  });

  it('keeps machine-readable and displayed calendar dates stable across languages', () => {
    const readDates = () => {
      const timeElements = element.querySelectorAll<HTMLTimeElement>('tbody .data-row time');
      return Array.from(timeElements, (time) => ({
        dateTime: time.dateTime,
        text: time.textContent?.trim() ?? '',
      }));
    };

    const frenchDates = readDates();
    expect(frenchDates.map(({ dateTime }) => dateTime)).toEqual([
      '2026-05-28',
      '2026-05-28',
      '2026-05-27',
    ]);
    expect(frenchDates.map(({ text }) => text.match(/\b(27|28)\b/)?.[1])).toEqual(['28', '28', '27']);

    i18n.setLanguage('en');
    fixture.detectChanges();

    const englishDates = readDates();
    expect(englishDates.map(({ dateTime }) => dateTime)).toEqual(frenchDates.map(({ dateTime }) => dateTime));
    expect(englishDates.map(({ text }) => text.match(/\b(27|28)\b/)?.[1])).toEqual(['28', '28', '27']);
    expect(englishDates.every(({ text }, index) => text !== frenchDates[index].text)).toBe(true);
  });
});
