import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { LinkButton } from '../../shared/link-button/link-button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [LinkButton, RouterLink],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  protected readonly i18n = inject(I18nService);
}
