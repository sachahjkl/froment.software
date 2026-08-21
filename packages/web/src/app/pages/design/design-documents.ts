import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { VisualSample } from '@shared/visual-sample/visual-sample';

@Component({
  selector: 'app-design-documents',
  imports: [Badge, Button, VisualSample],
  templateUrl: './design-documents.html',
  styleUrl: './design-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignDocuments {}
