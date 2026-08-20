import { Directive } from '@angular/core';

@Directive({
  selector: '[appBackOfficeTable]',
  host: { class: 'back-office-table' },
})
export class BackOfficeTable {}
