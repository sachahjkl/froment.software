import { type ClientSummaryValue } from '@froment/contracts';

export const clientContactIncomplete = (client: ClientSummaryValue): boolean =>
  [client.displayName, client.addressLine1, client.postalCode, client.city, client.country].some(
    (value) => value.trim() === '',
  ) ||
  (client.email.trim() === '' && client.phone.trim() === '');
