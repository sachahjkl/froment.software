import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-new-label',
  imports: [RouterLink],
  templateUrl: './new-label.html',
  styleUrl: './new-label.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewLabel {}
