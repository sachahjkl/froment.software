import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { CopyField } from '@shared/copy-field/copy-field';
import { DetailRow } from '@shared/detail-row/detail-row';
import { OutcomePanel } from '@shared/outcome-panel/outcome-panel';
import { StatusBlock } from '@shared/status-block/status-block';
import { VisualSample } from '@shared/visual-sample/visual-sample';

@Component({
  selector: 'app-design-documents',
  imports: [Badge, Button, CopyField, DetailRow, OutcomePanel, StatusBlock, VisualSample],
  templateUrl: './design-documents.html',
  styleUrl: './design-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignDocuments {
  protected readonly i18n = inject(I18nService);
}
