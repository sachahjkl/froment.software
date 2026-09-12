import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PermissionCodes, type PermissionCodeValue } from '@froment/contracts';

import { RolesApi } from '@backoffice/roles-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

interface RoleModel {
  readonly name: string;
  readonly permissions: ReadonlyArray<PermissionCodeValue>;
}

const permissionDomains = [
  ...new Set(PermissionCodes.map((code) => code.slice(0, code.indexOf('.')))),
];

@Component({
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-role-editor',
  imports: [Breadcrumbs, Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './role-editor.html',
  styleUrl: './role-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(RolesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(Confirmation);
  private readonly roleId = this.route.snapshot.paramMap.get('roleId');
  private readonly createRequestId = crypto.randomUUID();
  private readonly version = signal<number | undefined>(undefined);
  protected readonly editing = this.roleId !== null;
  protected readonly model = signal<RoleModel>({ name: '', permissions: [] });
  protected readonly roleForm = form(this.model, (path) => {
    required(path.name);
    pattern(path.name, /\S/);
    maxLength(path.name, 80);
  });
  protected readonly permissionGroups = computed(() =>
    permissionDomains.map((domain) => ({
      domain,
      permissions: PermissionCodes.filter((code) => code.startsWith(`${domain}.`)),
    })),
  );
  protected readonly loading = signal(this.editing);
  protected readonly saving = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly breadcrumbs = computed(() => [
    { label: this.i18n.t('team.title'), path: '/backoffice/equipe' },
    { label: this.i18n.t('role.title'), path: '/backoffice/equipe/roles' },
  ]);

  constructor() {
    afterNextRender(() => {
      if (this.roleId) void this.load(this.roleId);
    });
  }

  protected title(): string {
    return this.i18n.t(this.editing ? 'role.editTitle' : 'role.createTitle');
  }

  protected selected(permission: PermissionCodeValue): boolean {
    return this.model().permissions.includes(permission);
  }

  protected toggle(permission: PermissionCodeValue, event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const checked = event.currentTarget.checked;
    this.roleForm.permissions().markAsDirty();
    this.model.update((model) => ({
      ...model,
      permissions: checked
        ? [...model.permissions, permission]
        : model.permissions.filter((code) => code !== permission),
    }));
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.roleForm().invalid()) {
      this.roleForm().markAsTouched();
      return;
    }
    void submit(this.roleForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      try {
        const outcome = this.roleId
          ? await this.api.update(this.roleId, {
              ...this.model(),
              expectedVersion: this.version() ?? 0,
            })
          : await this.api.create({ ...this.model(), requestId: this.createRequestId });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.roleForm().reset(this.model());
        await this.router.navigate(['/backoffice/equipe/roles']);
      } catch {
        this.error.set('role.error');
      } finally {
        this.saving.set(false);
      }
    });
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    return (
      !this.roleForm().dirty() || this.confirmation.request(this.i18n.t('role.unsavedChanges'))
    );
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.roleForm().dirty()) event.preventDefault();
  }

  private async load(id: string): Promise<void> {
    try {
      const outcome = await this.api.get(id);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.version.set(outcome.result.version);
      this.roleForm().reset({
        name: outcome.result.name,
        permissions: outcome.result.permissions,
      });
    } catch {
      this.error.set('role.error');
    } finally {
      this.loading.set(false);
    }
  }
}
