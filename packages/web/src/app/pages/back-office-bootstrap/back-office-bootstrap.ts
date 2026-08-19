import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { BackOfficeBootstrapApi } from '../../back-office/back-office-bootstrap-api';
import { I18nService, TranslationKey } from '../../i18n.service';
import { Button } from '../../shared/button/button';
import { TextCopy } from '../../shared/text-copy';

type PageState = 'loading' | 'available' | 'unavailable' | 'error';

@Component({
  selector: 'app-back-office-bootstrap',
  imports: [Button, FormField, RouterLink],
  templateUrl: './back-office-bootstrap.html',
  styleUrl: './back-office-bootstrap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeBootstrap {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BackOfficeBootstrapApi);
  private readonly textCopy = inject(TextCopy);
  private readonly model = signal({ password: '' });
  protected readonly bootstrapForm = form(this.model, (path) => required(path.password));
  protected readonly state = signal<PageState>('loading');
  protected readonly pending = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly accessIdentifier = signal<string | undefined>(undefined);
  protected readonly copied = signal(false);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.bootstrapForm, async () => {
      this.pending.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.create(this.model().password);
        if (outcome.success) {
          this.accessIdentifier.set(outcome.result.accessIdentifier);
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

  protected async copyIdentifier(value: string): Promise<void> {
    if (await this.textCopy.copy(value)) {
      this.copied.set(true);
      return;
    }
    this.error.set('clipboard.error');
  }

  protected copyLabel(): TranslationKey {
    if (this.copied()) return 'bootstrap.copied';
    return 'bootstrap.copy';
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
