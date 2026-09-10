import { TestBed } from '@angular/core/testing';
import { ResultNavigation } from './result-navigation';

describe('ResultNavigation', () => {
  it('renders the supplied scope without inventing totals or additional pages', async () => {
    const fixture = TestBed.createComponent(ResultNavigation);
    fixture.componentRef.setInput('label', 'Results');
    fixture.componentRef.setInput('rangeLabel', '1–3 of 5 loaded records');
    fixture.componentRef.setInput('previousLabel', 'Previous');
    fixture.componentRef.setInput('nextLabel', 'Next');
    fixture.componentRef.setInput('nextDisabled', false);
    const previous = vi.fn();
    const next = vi.fn();
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    expect(fixture.nativeElement.textContent).toContain('1–3 of 5 loaded records');
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    buttons[1].click();
    expect(previous).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('nextDisabled', true);
    await fixture.whenStable();
    expect(buttons[1].disabled).toBe(true);
  });
});
