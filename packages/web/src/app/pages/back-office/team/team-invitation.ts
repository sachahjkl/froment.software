import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  email,
  form,
  FormField,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TeamInvite } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { TeamApi } from '@backoffice/team-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TeamNavigation } from './team-navigation';

const rejectedBeforeCreation = (code: TranslationKey): boolean =>
  code === 'team.email_exists' ||
  code === 'team.invitation_exists' ||
  code === 'team.invitation_limit';

@Component({
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [FormField, RouterLink, Button, Notice, PageHeader],
  providers: [TeamNavigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-team-invitation',
  styleUrl: './team-invitation.scss',
  templateUrl: './team-invitation.html',
})
export class TeamInvitation {
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(TeamNavigation);
  private readonly api = inject(TeamApi);
  private readonly confirmation = inject(Confirmation);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly link = signal('');
  protected readonly saved = signal(false);
  protected readonly pending = signal<typeof TeamInvite.Type | undefined>(undefined);
  protected readonly submitLabel = computed(() =>
    this.i18n.t(this.pending() ? 'teamInvitation.retry' : 'team.invite'),
  );
  protected readonly invitationForm = form(
    signal({ displayName: '', email: '', profile: '' }),
    (path) => {
      required(path.displayName);
      pattern(path.displayName, /\S/);
      maxLength(path.displayName, 160);
      required(path.email);
      email(path.email);
      maxLength(path.email, 254);
      required(path.profile);
      disabled(path, () => this.busy() || this.link() !== '' || this.pending() !== undefined);
    },
  );

  constructor() {
    afterRenderEffect(() => {
      if (this.saved()) this.result()?.nativeElement.focus();
    });
  }

  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.link() !== '') return;
    let request = this.pending();
    if (request === undefined) {
      if (this.invitationForm().invalid()) {
        this.invitationForm().markAsTouched();
        this.invitationForm().errorSummary()[0]?.fieldTree().focusBoundControl();
        return;
      }
      const decoded = Schema.decodeUnknownOption(TeamInvite)({
        ...this.invitationForm().value(),
        requestId: crypto.randomUUID(),
      });
      if (Option.isNone(decoded)) {
        this.error.set('team.conflict');
        return;
      }
      request = decoded.value;
    }
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(undefined);
    try {
      if (
        !(await this.confirmation.request(
          this.i18n.tf('configurationWorkspace.inviteConfirm', {
            name: request.displayName,
            email: request.email,
            profile: this.i18n.t(
              request.profile === 'accountant' ? 'team.accountant' : 'team.collaborator',
            ),
          }),
        ))
      )
        return;
      this.pending.set(request);
      const outcome = await this.api.invite(request);
      if (!outcome.success) {
        // Ces refus arrivent après la recherche de l’identifiant, mais avant toute insertion.
        if (rejectedBeforeCreation(outcome.code)) this.pending.set(undefined);
        this.error.set(outcome.code);
        return;
      }
      this.link.set(outcome.result.url);
      this.pending.set(undefined);
      this.invitationForm().reset({ displayName: '', email: '', profile: '' });
      this.saved.set(true);
    } catch {
      this.error.set('team.error');
    } finally {
      this.busy.set(false);
    }
  }

  protected dismissLink(): void {
    this.link.set('');
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return (
      (!this.invitationForm().dirty() && this.link() === '' && !this.pending()) ||
      this.confirmation.request(this.i18n.t('team.leave'))
    );
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.invitationForm().dirty() || this.link() !== '' || this.pending()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
