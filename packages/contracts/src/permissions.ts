import { Schema } from 'effect';

export const PermissionAudience = Schema.Literals(['api-token', 'client']);
export type PermissionAudience = typeof PermissionAudience.Type;

export const Permissions = {
  clientRead: { code: 'client.read', audiences: ['api-token'] },
  clientCreate: { code: 'client.create', audiences: ['api-token'] },
  clientUpdate: { code: 'client.update', audiences: ['api-token'] },
  clientArchive: { code: 'client.archive', audiences: ['api-token'] },
  clientAccessCreate: { code: 'client.access.create', audiences: [] },
  quoteRead: { code: 'quote.read', audiences: ['api-token', 'client'] },
  quoteCreate: { code: 'quote.create', audiences: ['api-token'] },
  quoteUpdate: { code: 'quote.update', audiences: ['api-token'] },
  quoteDelete: { code: 'quote.delete', audiences: ['api-token'] },
  quoteSend: { code: 'quote.send', audiences: ['api-token'] },
  quoteSign: { code: 'quote.sign', audiences: [] },
  orderRead: { code: 'order.read', audiences: ['api-token', 'client'] },
  orderCreate: { code: 'order.create', audiences: [] },
  orderUpdate: { code: 'order.update', audiences: [] },
  invoiceRead: { code: 'invoice.read', audiences: ['api-token', 'client'] },
  invoiceCreate: { code: 'invoice.create', audiences: ['api-token'] },
  invoiceUpdate: { code: 'invoice.update', audiences: ['api-token'] },
  invoiceIssue: { code: 'invoice.issue', audiences: ['api-token'] },
  invoiceSend: { code: 'invoice.send', audiences: [] },
  invoiceMarkPaid: { code: 'invoice.mark-paid', audiences: ['api-token'] },
  invoiceVoid: { code: 'invoice.void', audiences: ['api-token'] },
  templateRead: { code: 'template.read', audiences: [] },
  templateSelect: { code: 'template.select', audiences: [] },
  documentRender: { code: 'document.render', audiences: [] },
  documentDownload: { code: 'document.download', audiences: ['api-token', 'client'] },
  userRead: { code: 'user.read', audiences: [] },
  userCreate: { code: 'user.create', audiences: [] },
  userUpdate: { code: 'user.update', audiences: [] },
  sessionManage: { code: 'session.manage', audiences: [] },
  apiTokenManage: { code: 'api-token.manage', audiences: [] },
  auditRead: { code: 'audit.read', audiences: [] },
} as const satisfies Record<
  string,
  { readonly code: string; readonly audiences: ReadonlyArray<PermissionAudience> }
>;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
export type PermissionCode = Permission['code'];
export type ApiTokenPermission = Extract<
  Permission,
  { readonly audiences: readonly ['api-token'] | readonly ['api-token', 'client'] }
>;
export type ApiTokenPermissionCode = ApiTokenPermission['code'];
type ClientPermission = Extract<
  Permission,
  { readonly audiences: readonly ['api-token', 'client'] }
>;

const nonEmpty = <Value>(
  values: ReadonlyArray<Value>,
): readonly [Value, ...ReadonlyArray<Value>] => {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('The permission registry must not be empty.');
  return [first, ...rest];
};

const isApiTokenPermission = (permission: Permission): permission is ApiTokenPermission =>
  permission.audiences.some((audience) => audience === 'api-token');
const isClientPermission = (permission: Permission): permission is ClientPermission =>
  permission.audiences.some((audience) => audience === 'client');

export const PermissionDefinitions = nonEmpty(Object.values(Permissions));
export const PermissionCodes = nonEmpty(PermissionDefinitions.map(({ code }) => code));
export const ApiTokenPermissionCodes = nonEmpty(
  PermissionDefinitions.filter(isApiTokenPermission).map(({ code }) => code),
);
export const ClientRolePermissionCodes = PermissionDefinitions.filter(isClientPermission).map(
  ({ code }) => code,
);

export const PermissionCode = Schema.Literals(PermissionCodes);
export const ApiTokenPermissionCode = Schema.Literals(ApiTokenPermissionCodes);
