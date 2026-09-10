import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { PageHeader } from '@shared/page-header/page-header';
import { ConnectionsData } from './connections-data';
import {
  providerCredentialsLabel,
  providerModeLabel,
  providerName,
  providerUsage,
} from './connections-view';

@Component({
  host: { class: 'page-container' },
  selector: 'app-connections',
  imports: [RouterLink, Button, Notice, DataTable, PageHeader],
  providers: [ConnectionsData],
  templateUrl: './connections.html',
  styleUrl: './connections.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Connections {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject(ConnectionsData);
  protected readonly providerName = providerName;
  protected readonly providerUsage = providerUsage;
  protected readonly credentialsLabel = providerCredentialsLabel;
  protected readonly modeLabel = providerModeLabel;
  constructor() {
    afterNextRender(() => {
      void this.data.load();
    });
  }
}
