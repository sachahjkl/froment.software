import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  QuoteConditionPreset,
  QuoteConditionPresetFailure,
  QuoteConditionPresetList,
  type QuoteConditionPresetFailureValue,
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
  type QuoteConditionPresetWriteRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type QuoteConditionPresetOutcome = ApiOutcome<
  QuoteConditionPresetValue,
  QuoteConditionPresetFailureValue,
  'quote.error'
>;

@Injectable({ providedIn: 'root' })
export class QuoteConditionPresetsApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<QuoteConditionPresetListValue> {
    return Schema.decodeUnknownSync(QuoteConditionPresetList)(
      await firstValueFrom(this.http.get<unknown>('/api/quote-condition-presets')),
    );
  }

  async create(
    request: QuoteConditionPresetWriteRequestValue,
  ): Promise<QuoteConditionPresetOutcome> {
    return requestOutcome(
      this.http.post<unknown>('/api/quote-condition-presets', request),
      QuoteConditionPreset,
      QuoteConditionPresetFailure,
      'quote.error',
    );
  }

  async update(
    presetId: UlidValue,
    request: QuoteConditionPresetWriteRequestValue,
  ): Promise<QuoteConditionPresetOutcome> {
    return requestOutcome(
      this.http.put<unknown>(`/api/quote-condition-presets/${presetId}`, request),
      QuoteConditionPreset,
      QuoteConditionPresetFailure,
      'quote.error',
    );
  }

  async remove(presetId: UlidValue): Promise<QuoteConditionPresetOutcome> {
    return requestOutcome(
      this.http.delete<unknown>(`/api/quote-condition-presets/${presetId}`),
      QuoteConditionPreset,
      QuoteConditionPresetFailure,
      'quote.error',
    );
  }
}
