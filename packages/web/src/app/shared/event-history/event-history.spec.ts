import { TestBed } from '@angular/core/testing';
import { EventHistory } from './event-history';

describe('EventHistory', () => {
  it('preserves supplied order, dates and event details without a live region', async () => {
    const fixture = TestBed.createComponent(EventHistory);
    fixture.componentRef.setInput('label', 'History');
    fixture.componentRef.setInput('events', [
      {
        id: 'one',
        datetime: '2026-09-10',
        dateLabel: '10 September',
        title: 'Created',
        detail: 'Local example',
      },
      {
        id: 'two',
        datetime: '2026-09-11',
        dateLabel: '11 September',
        title: 'Edited',
        detail: 'Changed locally',
      },
    ]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('li')).toHaveLength(2);
    expect(root.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-10');
    expect(root.querySelector('strong')?.textContent).toBe('Created');
    expect(root.querySelector('[aria-live], [role="status"]')).toBeNull();
  });
});
