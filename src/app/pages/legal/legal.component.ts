import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './legal.component.scss',
})
export class LegalComponent {
  protected readonly i18n = inject(I18nService);
}
