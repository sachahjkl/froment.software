import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-visual-sample',
  templateUrl: './visual-sample.html',
  styleUrl: './visual-sample.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualSample {
  readonly name = input.required<string>();
}
