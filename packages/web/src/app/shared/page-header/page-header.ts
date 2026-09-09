import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-page-header',
  styleUrl: './page-header.scss',
  templateUrl: './page-header.html',
})
export class PageHeader {}
