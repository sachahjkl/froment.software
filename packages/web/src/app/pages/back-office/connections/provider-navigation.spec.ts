import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { providerTabs, providerTestParams } from './provider-navigation';

describe('Provider navigation', () => {
  it.each(['stripe', 'resend'] as const)(
    'uses explicit %s routes and carries the return request',
    (provider) => {
      const tabs = providerTabs(provider, TestBed.inject(I18nService), 'saved-request');
      expect(tabs.map((tab) => tab.path)).toEqual([
        `/backoffice/services/${provider}`,
        `/backoffice/services/${provider}/tests`,
      ]);
      expect(tabs[0]?.queryParams).toEqual({ request: 'saved-request' });
      expect(tabs[1]?.exact).toBe(false);
    },
  );

  it.each(['signwell', 'superpdp'] as const)('does not invent tests for %s', (provider) => {
    expect(providerTabs(provider, TestBed.inject(I18nService))).toEqual([]);
  });

  it('keeps valid Stripe list context and excludes unrelated query parameters', () => {
    expect(
      providerTestParams(
        'stripe',
        convertToParamMap({
          q: 'INV-12',
          sort: 'amountAsc',
          filter: 'paid',
          request: 'saved-request',
          private: 'value',
        }),
      ),
    ).toEqual({ q: 'INV-12', sort: 'amountAsc', filter: 'paid' });
  });

  it('keeps valid Resend list context and rejects unsupported filters', () => {
    expect(
      providerTestParams(
        'resend',
        convertToParamMap({
          q: 'Message',
          sort: 'subjectDesc',
          filter: 'delivered',
        }),
      ),
    ).toEqual({ q: 'Message', sort: 'subjectDesc', filter: 'delivered' });
    expect(
      providerTestParams(
        'resend',
        convertToParamMap({
          q: 'Message',
          sort: 'amountAsc',
          filter: 'paid',
        }),
      ),
    ).toEqual({ q: 'Message' });
  });
});
