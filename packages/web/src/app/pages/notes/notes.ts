import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notes as NotesService } from '../../notes/notes';
import { I18nService } from '@app/i18n.service';
import { Icon } from '@shared/icon/icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  host: { class: 'page-container' },
  selector: 'app-notes',
  imports: [Icon, LocalizedDatePipe, RouterLink],
  templateUrl: './notes.html',
  styleUrl: './notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notes {
  protected readonly notes = inject(NotesService);
  protected readonly i18n = inject(I18nService);
}
