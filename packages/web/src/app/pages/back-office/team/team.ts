import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, email, form, FormField, maxLength, required } from '@angular/forms/signals';
import { TeamInvite, TeamList, TeamMember, TeamProfile } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { TeamApi } from '@backoffice/team-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  imports: [FormField, Button, Notice, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-team',
  styleUrl: './team.scss',
  templateUrl: './team.html',
})
export class Team {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(TeamApi);
  private readonly confirmation = inject(Confirmation);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly data = signal<typeof TeamList.Type>({ members: [], invitations: [] });
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly link = signal('');
  protected readonly saved = signal(false);
  protected readonly now = signal(Date.now());
  private requestId: string | undefined;
  protected readonly invitationForm = form(
    signal({ displayName: '', email: '', profile: 'accountant' }),
    (path) => {
      required(path.displayName);
      maxLength(path.displayName, 160);
      required(path.email);
      email(path.email);
      maxLength(path.email, 254);
      disabled(path, () => this.busy() || this.loading());
    },
  );
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    const outcome = await this.api.list();
    if (outcome.success) {
      this.data.set(outcome.result);
      this.error.set(undefined);
      this.now.set(Date.now());
    } else this.error.set(outcome.code);
    this.loading.set(false);
  }
  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.loading() || this.invitationForm().invalid()) return;
    this.requestId ??= crypto.randomUUID();
    const request = Schema.decodeUnknownOption(TeamInvite)({
      ...this.invitationForm().value(),
      requestId: this.requestId,
    });
    if (Option.isNone(request)) {
      this.error.set('team.conflict');
      return;
    }
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(undefined);
    try {
      const outcome = await this.api.invite(request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.link.set(outcome.result.url);
      this.requestId = undefined;
      this.invitationForm().reset({ displayName: '', email: '', profile: 'accountant' });
      await this.load();
      this.saved.set(true);
      this.result()?.nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }
  protected async cancel(id: string): Promise<void> {
    if (this.busy() || !(await this.confirmation.request(this.i18n.t('team.confirmCancel'))))
      return;
    this.busy.set(true);
    try {
      const outcome = await this.api.cancel(id);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.link.set('');
      await this.load();
      this.saved.set(true);
      this.result()?.nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }
  protected async update(
    member: typeof TeamMember.Type,
    profile: typeof TeamProfile.Type,
    disabled: boolean,
  ): Promise<void> {
    if (this.busy() || !(await this.confirmation.request(this.i18n.t('team.confirmUpdate'))))
      return;
    this.busy.set(true);
    try {
      const outcome = await this.api.update(member.id, {
        expectedVersion: member.version,
        profile,
        disabled,
      });
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      await this.load();
      this.saved.set(true);
      this.result()?.nativeElement.focus();
    } finally {
      this.busy.set(false);
    }
  }
  protected dismissLink(): void {
    this.link.set('');
  }
  protected date(value: number): Date {
    return new Date(value);
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return (
      (!this.invitationForm().dirty() && this.link() === '') ||
      this.confirmation.request(this.i18n.t('team.leave'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.invitationForm().dirty() || this.link() !== '') {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
