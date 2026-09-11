import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import type { PermissionCodeValue } from '@froment/contracts';
import { Array } from 'effect';
import { Authentication } from './authentication';

@Directive({
  selector: '[appCan]',
})
export class Can {
  readonly appCan = input.required<PermissionCodeValue | readonly PermissionCodeValue[]>();
  private readonly authentication = inject(Authentication);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      const permissions = Array.ensure(this.appCan());
      const allowed =
        permissions.length > 0 &&
        permissions.every((permission) => this.authentication.can(permission));
      if (allowed && this.container.length === 0) this.container.createEmbeddedView(this.template);
      else if (!allowed) this.container.clear();
    });
  }
}
