import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TimelineStep = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-process-timeline',
  imports: [],
  templateUrl: './process-timeline.html',
  styleUrl: './process-timeline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessTimeline {
  readonly steps = input.required<readonly TimelineStep[]>();
}
