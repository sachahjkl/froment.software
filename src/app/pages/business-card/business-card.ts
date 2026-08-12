import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-business-card',
  imports: [RouterLink],
  templateUrl: './business-card.html',
  styleUrl: './business-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessCard {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  print(): void {
    if (this.isBrowser) {
      window.print();
    }
  }
}
