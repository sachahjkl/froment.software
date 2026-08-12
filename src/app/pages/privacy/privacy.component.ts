import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  protected readonly i18n = inject(I18nService);
}
