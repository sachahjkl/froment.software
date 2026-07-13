import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookies.component.html',
  styleUrl: './cookies.component.scss',
})
export class CookiesComponent {
  protected readonly i18n = inject(I18nService);
}
