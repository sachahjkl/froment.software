import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-back-office-header-placeholder',
  styleUrl: './back-office-header-placeholder.scss',
  templateUrl: './back-office-header-placeholder.html',
})
export class BackOfficeHeaderPlaceholder {
  readonly administrator = input(false);
}
