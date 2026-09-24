import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { NewLabel } from '@shared/new-label/new-label';

@Component({
  selector: 'app-home',
  imports: [Button, NewLabel],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly projectNames = {
    albumator: 'Albumator',
    clockin: 'Clock-in',
    dw: 'dw',
    backoffice: 'Backoffice',
  };
}
