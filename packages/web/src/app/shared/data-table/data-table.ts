import { Directive } from '@angular/core';

@Directive({
  selector: '[appDataTable]',
  host: { class: 'data-table' },
})
export class DataTable {}
