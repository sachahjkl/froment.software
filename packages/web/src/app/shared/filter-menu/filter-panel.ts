import { Directive, inject, input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[appFilterPanel]',
})
export class FilterPanel {
  readonly label = input.required<string>();
  readonly summary = input('');
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}
