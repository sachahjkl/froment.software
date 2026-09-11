import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { TeamList, TeamMember, TeamProfile } from '@froment/contracts';
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
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { memberTableOptions, invitationTableOptions } from '../configuration/workspace-tables';
import { TeamNavigation } from './team-navigation';
import { teamErrorMessage, type TeamOperation } from './team-error-message';

@Component({
  imports: [
    Can,
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
    FilterChip,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry, TeamNavigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-team',
  styleUrl: './team.scss',
  templateUrl: './team.html',
})
export class Team {
  private readonly authentication = inject(Authentication);
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
  protected readonly navigation = inject(TeamNavigation);
  private readonly api = inject(TeamApi);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
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
  protected readonly memberFilterCount = computed(() =>
    Number(this.members.query().filter !== 'all'),
  );
  protected readonly invitationFilterCount = computed(() =>
    Number(this.invitations.query().filter !== 'all'),
  );
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
  private readonly errorOperation = signal<TeamOperation>('load');
  protected readonly errorMessage = computed(() =>
    teamErrorMessage(this.error(), this.errorOperation()),
  );
  protected readonly saved = signal(false);
  protected readonly now = signal(Date.now());
  private readonly profiles = signal<Record<string, string>>({});
  protected readonly hasUnsavedChanges = computed(() =>
    this.data().members.some((member) => this.profiles()[member.id] !== member.profile),
  );
  protected readonly profileForm = form(this.profiles, (path) => {
    disabled(path, () => !this.authentication.can('user.update') || this.busy() || this.loading());
  });
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  private async readTeam(): Promise<typeof TeamList.Type | undefined> {
    try {
      const outcome = await this.api.list();
      if (this.destroyRef.destroyed) return;
      if (outcome.success) {
        this.error.set(undefined);
        this.now.set(Date.now());
        return outcome.result;
      }
      this.errorOperation.set('load');
      this.error.set(outcome.code);
    } catch {
      if (!this.destroyRef.destroyed) {
        this.errorOperation.set('load');
        this.error.set('team.error');
      }
    }
    return undefined;
  }
  private async load(): Promise<void> {
    this.loading.set(true);
    const data = await this.readTeam();
    if (data) {
      this.data.set(data);
      this.profiles.set(
        Object.fromEntries(data.members.map((member) => [member.id, member.profile])),
      );
      this.profileForm().reset();
    }
    this.loading.set(false);
  }
  protected async reload(): Promise<void> {
    if (this.busy() || this.loading()) return;
    this.busy.set(true);
    try {
      if (
        this.hasUnsavedChanges() &&
        !(await this.confirmation.request(this.i18n.t('team.reloadConfirm')))
      )
        return;
      if (this.destroyRef.destroyed) return;
      this.saved.set(false);
      await this.load();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.errorOperation.set('load');
        this.error.set('team.error');
      }
    } finally {
      this.busy.set(false);
    }
  }
  protected async cancel(id: string): Promise<void> {
    if (this.busy() || this.loading()) return;
    this.busy.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('team.confirmCancel')))) return;
      if (this.destroyRef.destroyed) return;
      this.saved.set(false);
      const outcome = await this.api.cancel(id);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.errorOperation.set('cancel');
        this.error.set(outcome.code);
        return;
      }
      const data = await this.readTeam();
      if (!data) return;
      this.data.update((current) => ({ ...current, invitations: data.invitations }));
      this.saved.set(true);
      this.result()?.nativeElement.focus();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.errorOperation.set('cancel');
        this.error.set('team.error');
      }
    } finally {
      this.busy.set(false);
    }
  }
  protected async update(
    member: typeof TeamMember.Type,
    profile: typeof TeamProfile.Type,
    disabled: boolean,
  ): Promise<void> {
    if (this.busy() || this.loading()) return;
    const submittedProfile = this.profiles()[member.id] === profile;
    this.busy.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('team.confirmUpdate')))) return;
      if (this.destroyRef.destroyed) return;
      this.saved.set(false);
      const outcome = await this.api.update(member.id, {
        expectedVersion: member.version,
        profile,
        disabled,
      });
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.errorOperation.set('update');
        this.error.set(outcome.code);
        return;
      }
      const data = await this.readTeam();
      if (!data) return;
      const updated = data.members.find((item) => item.id === member.id);
      if (!updated) {
        this.errorOperation.set('load');
        this.error.set('team.error');
        return;
      }
      this.data.update((current) => ({
        ...current,
        members: current.members.map((item) => (item.id === member.id ? updated : item)),
      }));
      if (submittedProfile) this.profileForm[member.id]().reset(updated.profile);
      this.saved.set(true);
      this.result()?.nativeElement.focus();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.errorOperation.set('update');
        this.error.set('team.error');
      }
    } finally {
      this.busy.set(false);
    }
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
    if (this.busy() || this.loading()) return false;
    return !this.hasUnsavedChanges() || this.confirmation.request(this.i18n.t('team.leave'));
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
import { Can } from '@backoffice/can';
import { Authentication } from '@backoffice/authentication';
