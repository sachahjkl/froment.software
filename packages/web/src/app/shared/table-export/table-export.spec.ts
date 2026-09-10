import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Icon } from '@shared/icon/icon';
import { vi } from 'vitest';
import { TableExport } from './table-export';

const createObjectUrl = vi.fn<typeof URL.createObjectURL>();
const revokeObjectUrl = vi.fn<(url: string) => void>();
class DownloadUrl extends URL {
  static override createObjectURL = createObjectUrl;
  static override revokeObjectURL = revokeObjectUrl;
}

describe('TableExport', () => {
  let fixture: ComponentFixture<TableExport>;
  let button: HTMLButtonElement;
  const click = vi.fn<(this: HTMLAnchorElement) => void>();

  beforeEach(async () => {
    createObjectUrl.mockReset().mockReturnValue('blob:displayed-results');
    revokeObjectUrl.mockReset();
    vi.stubGlobal('URL', DownloadUrl);
    click.mockReset();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
    fixture = TestBed.createComponent(TableExport);
    fixture.componentRef.setInput('columns', ['Nom', 'Montant']);
    fixture.componentRef.setInput('rows', [['Résultat affiché', 15]]);
    fixture.componentRef.setInput('filename', 'clients.csv');
    fixture.componentRef.setInput('label', 'Exporter les résultats affichés (CSV)');
    fixture.componentRef.setInput('emptyHint', 'Aucun résultat affiché à exporter.');
    fixture.componentRef.setInput('pendingHint', 'Attendez la fin du chargement.');
    await fixture.whenStable();
    button = fixture.nativeElement.querySelector('button');
    Object.defineProperties(fixture.nativeElement.querySelector('[popover]'), {
      showPopover: { value: vi.fn() },
      hidePopover: { value: vi.fn() },
    });
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses a named icon button and a native hint instead of a title', () => {
    expect(button.getAttribute('data-button-icon-only')).toBe('');
    const icon = fixture.debugElement.query(By.directive(Icon)).componentInstance as Icon;
    expect(icon.name()).toBe('download');
    expect(button.getAttribute('aria-label')).toBe('Exporter les résultats affichés (CSV)');
    const hint = document.getElementById(button.getAttribute('aria-describedby')!)!;
    expect(hint.getAttribute('popover')).toBe('hint');
    expect(hint.textContent).toContain('Exporter les résultats affichés (CSV)');
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('downloads only the supplied rows and removes its temporary link', async () => {
    button.click();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    const blob = createObjectUrl.mock.calls[0]![0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(text).toContain('"Nom","Montant"\r\n"Résultat affiché","15"\r\n');
    const download = click.mock.contexts[0];
    expect(download?.download).toBe('clients.csv');
    expect(download?.getAttribute('href')).toBe('blob:displayed-results');
    expect(download?.isConnected).toBe(false);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it('releases each object URL after the browser starts the download', () => {
    vi.useFakeTimers();
    button.click();
    vi.advanceTimersByTime(999);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:displayed-results');
    fixture.destroy();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
  });

  it('releases outstanding object URLs on destruction', () => {
    vi.useFakeTimers();
    createObjectUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    button.click();
    button.click();
    fixture.destroy();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:first');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:second');
    vi.advanceTimersByTime(1000);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps empty exports focusable and explains why downloading is unavailable', async () => {
    fixture.componentRef.setInput('rows', []);
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(
      document.getElementById(button.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('Aucun résultat affiché');
    button.click();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('blocks pending exports even when previous rows remain visible', async () => {
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(
      document.getElementById(button.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('Attendez la fin du chargement.');
    button.click();
    expect(createObjectUrl).not.toHaveBeenCalled();
    fixture.componentRef.setInput('pending', false);
    await fixture.whenStable();
    expect(button.getAttribute('aria-disabled')).toBe('false');
    button.click();
    expect(createObjectUrl).toHaveBeenCalledOnce();
  });
});
