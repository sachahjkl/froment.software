import { type ProviderConnection } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type ConnectionProvider } from './provider-navigation';

export function providerName(provider: ConnectionProvider): TranslationKey {
  return `connections.${provider}`;
}

export function providerUsage(provider: ConnectionProvider): TranslationKey {
  const usages = {
    resend: 'connections.email',
    stripe: 'connections.payment',
    signwell: 'connections.signature',
    superpdp: 'connections.electronicInvoice',
  } satisfies Record<ConnectionProvider, TranslationKey>;
  return usages[provider];
}

export function providerCredentialsLabel(
  connection: typeof ProviderConnection.Type,
): TranslationKey {
  return connection.credentialsPresent ? 'connections.present' : 'connections.missing';
}

export function providerModeLabel(connection: typeof ProviderConnection.Type): TranslationKey {
  return connection.mode === 'restricted-test'
    ? 'connections.restricted'
    : 'connections.notConnected';
}
