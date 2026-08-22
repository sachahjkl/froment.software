import { Schema } from 'effect';

export const PermissionAudience = Schema.Literals(['integration', 'client']);
export type PermissionAudience = typeof PermissionAudience.Type;

export const Permissions = {
  clientRead: { code: 'client.read', audiences: ['integration'] },
  clientCreate: { code: 'client.create', audiences: ['integration'] },
  clientUpdate: { code: 'client.update', audiences: ['integration'] },
  clientArchive: { code: 'client.archive', audiences: ['integration'] },
  clientAccessCreate: { code: 'client.access.create', audiences: [] },
  quoteRead: { code: 'quote.read', audiences: ['integration', 'client'] },
  quoteCreate: { code: 'quote.create', audiences: ['integration'] },
  quoteUpdate: { code: 'quote.update', audiences: ['integration'] },
  quoteDelete: { code: 'quote.delete', audiences: ['integration'] },
  quoteSend: { code: 'quote.send', audiences: ['integration'] },
  quoteSign: { code: 'quote.sign', audiences: [] },
  orderRead: { code: 'order.read', audiences: ['integration', 'client'] },
  orderCreate: { code: 'order.create', audiences: [] },
  orderUpdate: { code: 'order.update', audiences: [] },
  invoiceRead: { code: 'invoice.read', audiences: ['integration', 'client'] },
  invoiceCreate: { code: 'invoice.create', audiences: ['integration'] },
  invoiceUpdate: { code: 'invoice.update', audiences: ['integration'] },
  invoiceIssue: { code: 'invoice.issue', audiences: ['integration'] },
  invoiceSend: { code: 'invoice.send', audiences: [] },
  invoiceMarkPaid: { code: 'invoice.mark-paid', audiences: ['integration'] },
  invoiceVoid: { code: 'invoice.void', audiences: ['integration'] },
  templateRead: { code: 'template.read', audiences: [] },
  templateSelect: { code: 'template.select', audiences: [] },
  documentRender: { code: 'document.render', audiences: [] },
  documentDownload: { code: 'document.download', audiences: ['integration', 'client'] },
  userRead: { code: 'user.read', audiences: [] },
  userCreate: { code: 'user.create', audiences: [] },
  userUpdate: { code: 'user.update', audiences: [] },
  sessionManage: { code: 'session.manage', audiences: [] },
  integrationTokenManage: { code: 'integration-token.manage', audiences: [] },
  auditRead: { code: 'audit.read', audiences: [] },
} as const satisfies Record<
  string,
  { readonly code: string; readonly audiences: ReadonlyArray<PermissionAudience> }
>;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
export type PermissionCode = Permission['code'];
export type IntegrationPermission = Extract<
  Permission,
  { readonly audiences: readonly ['integration'] | readonly ['integration', 'client'] }
>;
export type IntegrationPermissionCode = IntegrationPermission['code'];
type ClientPermission = Extract<
  Permission,
  { readonly audiences: readonly ['integration', 'client'] }
>;

const nonEmpty = <Value>(
  values: ReadonlyArray<Value>,
): readonly [Value, ...ReadonlyArray<Value>] => {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('The permission registry must not be empty.');
  return [first, ...rest];
};

const isIntegrationPermission = (permission: Permission): permission is IntegrationPermission =>
  permission.audiences.some((audience) => audience === 'integration');
const isClientPermission = (permission: Permission): permission is ClientPermission =>
  permission.audiences.some((audience) => audience === 'client');

export const PermissionDefinitions = nonEmpty(Object.values(Permissions));
export const PermissionCodes = nonEmpty(PermissionDefinitions.map(({ code }) => code));
export const IntegrationPermissionCodes = nonEmpty(
  PermissionDefinitions.filter(isIntegrationPermission).map(({ code }) => code),
);
export const ClientRolePermissionCodes = PermissionDefinitions.filter(isClientPermission).map(
  ({ code }) => code,
);

export const PermissionCode = Schema.Literals(PermissionCodes);
export const IntegrationPermissionCode = Schema.Literals(IntegrationPermissionCodes);
