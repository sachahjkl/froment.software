import {
  afterNextRender,
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
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { TeamInvite, TeamList, TeamMember, TeamProfile } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { TeamApi } from '@backoffice/team-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { memberTableOptions, invitationTableOptions } from '../configuration/workspace-tables';

@Component({
  imports: [
    FormField,
    Button,
    Notice,
    PageHeader,
    LocalizedDatePipe,
    RouterLink,
    DataTable,
    EntityIcon,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-team',
  styleUrl: './team.scss',
  templateUrl: './team.html',
})
export class Team {
  protected memberIconVariant(member: typeof TeamMember.Type): EntityIconVariant {
    return member.disabledAt === null ? 'success' : 'default';
  }

  protected invitationIconVariant(
    invitation: (typeof TeamList.Type)['invitations'][number],
  ): EntityIconVariant {
    if (invitation.acceptedAt !== null) return 'success';
    if (invitation.cancelledAt !== null) return 'default';
    if (invitation.expiresAt <= this.now()) return 'warning';
    return 'info';
  }

  protected readonly i18n = inject(I18nService);
  private readonly api = inject(TeamApi);
  private readonly confirmation = inject(Confirmation);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly data = signal<typeof TeamList.Type>({ members: [], invitations: [] });
  protected readonly members = createWorkspaceTable(
    computed(() => this.data().members),
    memberTableOptions,
  );
  protected readonly invitations = createWorkspaceTable(
    computed(() => this.data().invitations),
    invitationTableOptions,
  );
  protected readonly listParams = computed(() => ({
    ...this.members.params(),
    ...this.invitations.params(),
  }));
  protected readonly memberExport = computed(() =>
    this.members
      .rows()
      .map((item) => [
        item.profile,
        item.disabledAt === null ? 'active' : 'disabled',
        item.version,
      ]),
  );
  protected readonly invitationExport = computed(() =>
    this.invitations
      .rows()
      .map((item) => [
        item.profile,
        new Date(item.createdAt).toISOString(),
        new Date(item.expiresAt).toISOString(),
        item.acceptedAt !== null
          ? 'accepted'
          : item.cancelledAt !== null
            ? 'cancelled'
            : item.expiresAt <= this.now()
              ? 'expired'
              : 'pending',
      ]),
  );
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly link = signal('');
  protected readonly saved = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly pending = signal<typeof TeamInvite.Type | undefined>(undefined);
  private readonly profiles = signal<Record<string, string>>({});
  protected readonly profileForm = form(this.profiles, (path) => {
    disabled(path, () => this.busy() || this.loading());
  });
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
      disabled(
        path,
        () => this.busy() || this.loading() || this.link() !== '' || this.pending() !== undefined,
      );
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
      this.profiles.set(
        Object.fromEntries(outcome.result.members.map((member) => [member.id, member.profile])),
      );
      this.profileForm().reset();
      this.error.set(undefined);
      this.now.set(Date.now());
    } else this.error.set(outcome.code);
    this.loading.set(false);
  }
  protected async invite(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.loading() || this.link() !== '') return;
    if (this.invitationForm().invalid()) {
      this.invitationForm().markAsTouched();
      this.invitationForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    const request = Schema.decodeUnknownOption(TeamInvite)({
      ...this.invitationForm().value(),
      requestId: this.pending()?.requestId ?? crypto.randomUUID(),
    });
    if (Option.isNone(request)) {
      this.error.set('team.conflict');
      return;
    }
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(undefined);
    try {
      if (
        !(await this.confirmation.request(
          this.i18n.tf('configurationWorkspace.inviteConfirm', {
            name: request.value.displayName,
            email: request.value.email,
            profile: this.i18n.t(
              request.value.profile === 'accountant' ? 'team.accountant' : 'team.collaborator',
            ),
          }),
        ))
      )
        return;
      this.pending.set(this.pending() ?? request.value);
      const outcome = await this.api.invite(this.pending() ?? request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.link.set(outcome.result.url);
      this.pending.set(undefined);
      this.invitationForm().reset({ displayName: '', email: '', profile: '' });
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
  protected async applyProfile(member: typeof TeamMember.Type): Promise<void> {
    const profile = Schema.decodeUnknownOption(TeamProfile)(this.profiles()[member.id]);
    if (Option.isSome(profile))
      await this.update(member, profile.value, member.disabledAt !== null);
  }
  protected date(value: number): Date {
    return new Date(value);
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return (
      (!this.invitationForm().dirty() &&
        this.link() === '' &&
        !this.pending() &&
        !this.profileForm().dirty()) ||
      this.confirmation.request(this.i18n.t('team.leave'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.busy() ||
      this.invitationForm().dirty() ||
      this.link() !== '' ||
      this.pending() ||
      this.profileForm().dirty()
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
