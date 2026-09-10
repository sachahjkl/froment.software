import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { vi } from 'vitest';
import { DateRangeFilter, type DateRange } from './date-range-filter';

async function configure(initial: DateRange = {}) {
  const fixture = TestBed.createComponent(DateRangeFilter);
  fixture.componentRef.setInput('from', initial.from);
  fixture.componentRef.setInput('to', initial.to);
  const applied = vi.fn<(range: DateRange) => void>();
  fixture.componentInstance.rangeApplied.subscribe(applied);
  await fixture.whenStable();
  const i18n = TestBed.inject(I18nService);
  i18n.language.set('fr');
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const field = (name: 'from' | 'to') =>
    Array.from(root.querySelectorAll('input')).find(
      (input) => input.labels?.[0]?.textContent?.trim() === i18n.t(`dateRangeFilter.${name}`),
    )!;
  const fill = async (name: 'from' | 'to', value: string) => {
    const input = field(name);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const apply = async () => {
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
    root.querySelector('form')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
  };
  const clear = async () => {
    root.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    await fixture.whenStable();
  };
  return {
    fixture,
    component: fixture.componentInstance,
    root,
    applied,
    i18n,
    field,
    fill,
    apply,
    clear,
  };
}

describe('DateRangeFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses two labelled native date inputs without another popup', async () => {
    const { root, field, applied } = await configure({ from: '2026-09-01', to: '2026-09-30' });
    expect(root.querySelector('form')?.noValidate).toBe(true);
    expect(root.querySelectorAll('input')).toHaveLength(2);
    expect(field('from').type).toBe('date');
    expect(field('to').type).toBe('date');
    expect(field('from').value).toBe('2026-09-01');
    expect(field('to').value).toBe('2026-09-30');
    expect(field('from').required).toBe(false);
    expect(field('to').required).toBe(false);
    expect(root.querySelector('[role="dialog"], [popover], details')).toBeNull();
    expect(applied).not.toHaveBeenCalled();
  });

  it('keeps the applied period unchanged until submission', async () => {
    const { applied, fill, apply } = await configure({ from: '2026-01-01', to: '2026-01-31' });
    await fill('from', '2026-02-01');
    expect(applied).not.toHaveBeenCalled();
    await fill('to', '2026-02-28');
    expect(applied).not.toHaveBeenCalled();
    await apply();
    expect(applied).toHaveBeenCalledExactlyOnceWith({ from: '2026-02-01', to: '2026-02-28' });
  });

  it.each([
    { from: undefined, to: undefined },
    { from: '2026-09-01', to: undefined },
    { from: undefined, to: '2026-09-30' },
    { from: '2026-09-10', to: '2026-09-10' },
    { from: '2024-02-29', to: '2024-03-01' },
  ])('accepts open bounds and valid calendar dates: $from to $to', async (range) => {
    const { applied, apply } = await configure(range);
    await apply();
    expect(applied).toHaveBeenCalledExactlyOnceWith(range);
  });

  it.each([
    { name: 'from', value: '2026-02-30' },
    { name: 'from', value: '2026-02-29' },
    { name: 'to', value: '2026-04-31' },
    { name: 'to', value: '2026-13-01' },
    { name: 'from', value: '10/09/2026' },
  ] as const)('rejects an invalid $name date: $value', async ({ name, value }) => {
    const { root, field, component, applied, apply } = await configure({ [name]: value });
    await apply();
    expect(applied).not.toHaveBeenCalled();
    expect(component['rangeForm'][name]().value()).toBe(value);
    expect(document.activeElement).toBe(field(name));
    expect(field(name).getAttribute('aria-invalid')).toBe('true');
    const error = root.querySelector('[role="alert"]')!;
    expect(error.textContent).toBe('Saisissez une date valide.');
    expect(field(name).getAttribute('aria-describedby')).toBe(error.id);
  });

  it('focuses the first invalid field and keeps both invalid values', async () => {
    const { component, field, root, apply } = await configure({
      from: '2026-02-30',
      to: '2026-04-31',
    });
    await apply();
    expect(root.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(document.activeElement).toBe(field('from'));
    expect(component['rangeForm']().value()).toEqual({ from: '2026-02-30', to: '2026-04-31' });
  });

  it('rejects a reversed period, focuses its end and waits for another submission', async () => {
    const { applied, apply, fill, field, root } = await configure({
      from: '2026-09-20',
      to: '2026-09-10',
    });
    await apply();
    expect(applied).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field('to'));
    expect(field('from').value).toBe('2026-09-20');
    expect(field('to').value).toBe('2026-09-10');
    expect(root.querySelector('[role="alert"]')?.textContent).toBe(
      'La fin doit être égale ou postérieure au début.',
    );
    await fill('to', '2026-09-30');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(applied).not.toHaveBeenCalled();
    await apply();
    expect(applied).toHaveBeenCalledExactlyOnceWith({ from: '2026-09-20', to: '2026-09-30' });
  });

  it('uses native parse errors instead of accepting an incomplete date as an open bound', async () => {
    const { field, fixture, applied, apply, root } = await configure();
    const input = field('from');
    vi.spyOn(input.validity, 'badInput', 'get').mockReturnValue(true);
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await apply();
    expect(applied).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('Saisissez une date valide.');
  });

  it('preserves the draft if parent inputs change after an apply attempt', async () => {
    const { fixture, fill, apply, applied, field } = await configure({
      from: '2026-01-01',
      to: '2026-01-31',
    });
    await fill('from', '2026-02-01');
    await fill('to', '2026-02-28');
    await apply();
    fixture.componentRef.setInput('from', '2026-03-01');
    fixture.componentRef.setInput('to', '2026-03-31');
    await fixture.whenStable();
    expect(field('from').value).toBe('2026-02-01');
    expect(field('to').value).toBe('2026-02-28');
    await apply();
    expect(applied).toHaveBeenCalledTimes(2);
    expect(applied).toHaveBeenLastCalledWith({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('clears both bounds, validation and interaction state, then emits an undefined pair', async () => {
    const { component, field, root, applied, apply, clear } = await configure({
      from: '2026-09-20',
      to: '2026-09-10',
    });
    await apply();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    await clear();
    expect(field('from').value).toBe('');
    expect(field('to').value).toBe('');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(component['rangeForm']().dirty()).toBe(false);
    expect(component['rangeForm']().touched()).toBe(false);
    expect(document.activeElement).toBe(field('from'));
    expect(applied).toHaveBeenCalledExactlyOnceWith({ from: undefined, to: undefined });
  });

  it('creates distinct field and error IDs for separate subpanels', async () => {
    const first = await configure({ from: '2026-02-30' });
    const second = await configure({ from: '2026-02-30' });
    await first.apply();
    await second.apply();
    expect(first.field('from').id).not.toBe(second.field('from').id);
    expect(first.field('from').getAttribute('aria-describedby')).not.toBe(
      second.field('from').getAttribute('aria-describedby'),
    );
  });

  it('translates the fields, actions and inline error into English', async () => {
    const { fixture, i18n, field, root, apply } = await configure({ from: '2026-02-30' });
    i18n.language.set('en');
    await fixture.whenStable();
    expect(field('from').labels?.[0]?.textContent).toBe('From');
    expect(field('to').labels?.[0]?.textContent).toBe('To');
    expect(root.querySelector('button[type="submit"]')?.textContent).toBe('Apply');
    expect(root.querySelector('button[type="button"]')?.textContent).toBe('Clear');
    await apply();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('Enter a valid date.');
  });
});
