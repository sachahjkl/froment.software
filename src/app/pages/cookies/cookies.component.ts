import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookies.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './cookies.component.scss',
})
export class CookiesComponent {
  protected readonly i18n = inject(I18nService);
}
