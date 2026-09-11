import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { RuntimeConfiguration } from '@app/runtime-configuration';

@Component({
  selector: 'app-new-label',
  imports: [RouterLink],
  templateUrl: './new-label.html',
  styleUrl: './new-label.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewLabel {
  protected readonly i18n = inject(I18nService);
  protected readonly construction = inject(RuntimeConfiguration).productionConstruction;
}
