import { Directive } from '@angular/core';

@Directive({
  selector: '[appListWorkspace]',
  host: {
    '[style.display]': "'grid'",
    '[style.gap]': "'var(--space-4)'",
    '[style.min-inline-size]': "'0'",
    '[style.align-content]': "'start'",
  },
})
export class ListWorkspace {}
