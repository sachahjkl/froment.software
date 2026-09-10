import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { disabled, form, FormField, pattern, required, submit } from '@angular/forms/signals';
import { I18nService } from '@app/i18n.service';
import { Theme } from '@app/theme';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [Button, FormField, Notice, PageHeader],
  selector: 'app-account-preferences',
  styleUrl: './account-preferences.scss',
  templateUrl: './account-preferences.html',
})
export class AccountPreferences {
  protected readonly i18n = inject(I18nService);
  private readonly theme = inject(Theme);
  private readonly confirmation = inject(Confirmation);
  private readonly model = linkedSignal(() => ({
    theme: this.theme.current(),
    language: this.i18n.language(),
  }));
  protected readonly preferencesForm = form(this.model, (path) => {
    disabled(path, ({ state }) => state.submitting());
    required(path.theme);
    pattern(path.theme, /^(light|dark)$/);
    required(path.language);
    pattern(path.language, /^(fr|en)$/);
  });
  protected readonly applied = signal(false);
  protected readonly hasChanges = computed(
    () =>
      this.model().theme !== this.theme.current() || this.model().language !== this.i18n.language(),
  );

  protected apply(event: SubmitEvent): void {
    event.preventDefault();
    if (this.preferencesForm().submitting()) return;
    if (this.preferencesForm().invalid()) {
      this.preferencesForm().markAsTouched();
      this.preferencesForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.preferencesForm, async () => {
      const { theme, language } = this.model();
      if (theme !== this.theme.current()) this.theme.toggle();
      this.i18n.setLanguage(language);
      this.preferencesForm().reset();
      this.applied.set(true);
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.preferencesForm().submitting()) return false;
    return (
      !this.hasChanges() ||
      (await this.confirmation.request(this.i18n.t('configurationWorkspace.unsaved')))
    );
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.preferencesForm().submitting() || this.hasChanges()) event.preventDefault();
  }
}
