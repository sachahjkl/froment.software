import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [Button, RouterLink],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  protected readonly i18n = inject(I18nService);
}
