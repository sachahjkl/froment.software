import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-list-toolbar',
  styleUrl: './list-toolbar.scss',
  templateUrl: './list-toolbar.html',
})
export class ListToolbar {}
