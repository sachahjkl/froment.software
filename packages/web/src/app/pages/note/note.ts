import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Notes, RenderedNote } from '../../notes/notes';
import { I18nService } from '@app/i18n.service';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { MermaidDiagrams } from '@shared/mermaid-diagrams';
import { NoteJustification } from '@shared/note-justification';

@Component({
  host: { class: 'page-container' },
  selector: 'app-note',
  imports: [NoteJustification, LocalizedDatePipe, MermaidDiagrams, RouterLink],
  templateUrl: './note.html',
  styleUrl: './note.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Note {
  private readonly notes = inject(Notes);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams,
  });
  protected readonly i18n = inject(I18nService);
  protected readonly note = computed<RenderedNote | undefined>(() => {
    this.i18n.language();
    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: this.queryParams(),
    });
    return this.notes.find(this.params().get('slug') ?? '', this.router.serializeUrl(url));
  });
}
