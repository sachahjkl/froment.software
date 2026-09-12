import { TestBed } from '@angular/core/testing';
import { DocumentLineEditor, type DocumentLineEditValue } from './document-line-editor';

const line: DocumentLineEditValue = {
  description: 'Audit',
  quantity: '1.000',
  unitPrice: '100.00',
  vatRate: '20.00',
};

describe('DocumentLineEditor', () => {
  it('adds and removes lines through the compact table', async () => {
    const fixture = TestBed.createComponent(DocumentLineEditor);
    fixture.componentRef.setInput('lines', [line]);
    fixture.componentRef.setInput('currency', 'EUR');
    const changes: Array<ReadonlyArray<DocumentLineEditValue>> = [];
    fixture.componentInstance.linesChange.subscribe((value) => changes.push(value));
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>(':scope > button')!.click();
    expect(changes.at(-1)).toHaveLength(2);

    fixture.componentRef.setInput('lines', [line, { ...line, description: 'Delivery' }]);
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('tbody button')!.click();
    expect(changes.at(-1)?.map((item) => item.description)).toEqual(['Delivery']);
  });

  it('edits one mobile line in a modal and keeps other lines unchanged', async () => {
    const fixture = TestBed.createComponent(DocumentLineEditor);
    const delivery = { ...line, description: 'Delivery' };
    fixture.componentRef.setInput('lines', [line, delivery]);
    fixture.componentRef.setInput('currency', 'EUR');
    let changed: ReadonlyArray<DocumentLineEditValue> = [];
    fixture.componentInstance.linesChange.subscribe((value) => {
      changed = value;
    });
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.mobile-lines button')!.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const description = dialog.querySelector<HTMLInputElement>('input')!;
    description.value = 'Security audit';
    description.dispatchEvent(new Event('input'));
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(changed).toEqual([{ ...line, description: 'Security audit' }, delivery]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
