import { type CheckoutConnection, type CheckoutOperation } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';

export function checkoutStatusLabel(status: CheckoutOperation['status']): TranslationKey {
  return `checkout.${status}`;
}

export function checkoutKeyLabel(connection: typeof CheckoutConnection.Type): TranslationKey {
  if (connection.testKey) return 'checkout.testKey';
  if (connection.credentialsPresent) return 'checkout.testKeyRequired';
  return 'checkout.credentialsMissing';
}

export function checkoutWebhookLabel(connection: typeof CheckoutConnection.Type): TranslationKey {
  return connection.webhookConfigured ? 'checkout.webhookPresent' : 'checkout.webhookAbsent';
}

export function canOpenCheckout(operation: CheckoutOperation): boolean {
  return (
    operation.status === 'open' &&
    operation.checkoutUrl !== null &&
    Date.parse(operation.expiresAt) > Date.now()
  );
}
