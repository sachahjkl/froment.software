import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type InvoiceListValue } from '@froment/contracts';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BillingPdf {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly downloads = new Map<string, ReturnType<typeof setTimeout>>();
  readonly pending = signal(false);
  readonly failed = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const [url, timer] of this.downloads) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      this.downloads.clear();
    });
  }

  async download(selected: InvoiceListValue): Promise<void> {
    if (this.pending() || this.destroyRef.destroyed) return;
    const invoices = selected.filter((invoice) => invoice.pdf?.status === 'ready');
    if (invoices.length === 0) return;
    this.pending.set(true);
    this.failed.set(false);
    try {
      for (const invoice of invoices) {
        const pdf = await firstValueFrom(
          this.http
            .get(`/api/invoices/${invoice.id}/revisions/${invoice.version}/pdf`, {
              responseType: 'blob',
            })
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );
        if (this.destroyRef.destroyed) return;
        if (pdf.type !== 'application/pdf') {
          this.failed.set(true);
          return;
        }
        const url = URL.createObjectURL(pdf);
        // Laissez le navigateur démarrer le téléchargement avant de libérer son URL.
        this.downloads.set(
          url,
          setTimeout(() => {
            URL.revokeObjectURL(url);
            this.downloads.delete(url);
          }, 1000),
        );
        const link = this.document.createElement('a');
        link.href = url;
        link.download = `${invoice.invoiceNumber ?? invoice.id}-v${invoice.version}.pdf`;
        link.hidden = true;
        this.document.body.append(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      }
    } catch {
      if (!this.destroyRef.destroyed) this.failed.set(true);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
}
