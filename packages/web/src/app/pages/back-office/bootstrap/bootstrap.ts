import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { BootstrapApi } from '@backoffice/bootstrap-api';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';

type PageState = 'loading' | 'available' | 'unavailable' | 'error';

@Component({
  selector: 'app-bootstrap',
  imports: [Button, FormField, RouterLink],
  templateUrl: './bootstrap.html',
  styleUrl: './bootstrap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bootstrap {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BootstrapApi);
  private readonly model = signal({ bootstrapPassword: '', email: '', password: '' });
  protected readonly bootstrapForm = form(this.model, (path) => {
    required(path.bootstrapPassword);
    required(path.email);
    required(path.password);
  });
  protected readonly state = signal<PageState>('loading');
  protected readonly pending = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly created = signal(false);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.bootstrapForm, async () => {
      this.pending.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.create(this.model());
        if (outcome.success) {
          this.created.set(true);
          this.state.set('unavailable');
          return;
        }
        this.error.set(outcome.code);
        if (outcome.code === 'bootstrap.unavailable') {
          this.state.set('unavailable');
        }
      } catch {
        this.error.set('bootstrap.error');
      } finally {
        this.pending.set(false);
      }
    });
  }

  protected submitLabel(): TranslationKey {
    if (this.pending()) return 'bootstrap.pending';
    return 'bootstrap.submit';
  }

  private async load(): Promise<void> {
    try {
      if (await this.api.status()) {
        this.state.set('available');
        return;
      }
      this.state.set('unavailable');
    } catch {
      this.state.set('error');
    }
  }
}
