import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TeamAccept } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { TeamApi } from '@backoffice/team-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { teamErrorMessage } from './team-error-message';

@Component({
  selector: 'app-team-join',
  imports: [FormField, Button, Notice, RouterLink],
  templateUrl: './team-join.html',
  styleUrl: './team-join.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class TeamJoin {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(TeamApi);
  private readonly confirmation = inject(Confirmation);
  private token = '';
  protected readonly busy = signal(false);
  protected readonly ready = signal(false);
  protected readonly accepted = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly errorMessage = computed(() => teamErrorMessage(this.error(), 'join'));
  protected readonly joinForm = form(signal({ password: '', confirmation: '' }), (path) => {
    required(path.password);
    required(path.confirmation);
    disabled(path, () => this.busy() || !this.ready());
  });
  constructor() {
    afterNextRender(() => {
      this.token = window.location.hash.slice(1);
      window.history.replaceState(window.history.state, '', window.location.pathname);
      this.ready.set(Schema.is(TeamAccept.fields.token)(this.token));
      if (!this.ready()) this.error.set('team.invitation_rejected');
    });
  }
  protected async accept(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || !this.ready()) return;
    const value = this.joinForm().value();
    const request = Schema.decodeUnknownOption(TeamAccept)({
      token: this.token,
      password: value.password,
    });
    if (Option.isNone(request) || value.password !== value.confirmation) {
      this.error.set('team.passwordInvalid');
      return;
    }
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.accept(request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.token = '';
      this.accepted.set(true);
      this.ready.set(false);
      this.joinForm().reset({ password: '', confirmation: '' });
    } finally {
      this.busy.set(false);
    }
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return !this.joinForm().dirty() || this.confirmation.request(this.i18n.t('team.leave'));
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.joinForm().dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
