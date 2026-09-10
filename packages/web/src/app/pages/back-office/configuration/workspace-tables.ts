import {
  type ApiTokenValue,
  type CheckoutOperation,
  type EmailTestOperation,
  type GlobalAuditEvent,
  type QuoteConditionPresetValue,
  type TeamInvitation,
  type TeamMember,
} from '@froment/contracts';
import { type WorkspaceTableOptions } from './workspace-table';
import { translate } from '@froment/l10n';

export const memberTableOptions: WorkspaceTableOptions<typeof TeamMember.Type> = {
  columns: [
    { kind: 'text', key: 'name', value: (item) => item.displayName },
    { kind: 'text', key: 'email', value: (item) => item.email },
    {
      kind: 'text',
      key: 'profile',
      value: (item, language) => translate(language, `team.${item.profile}`),
    },
    {
      kind: 'text',
      key: 'status',
      value: (item, language) =>
        translate(language, item.disabledAt === null ? 'team.active' : 'team.disabled'),
    },
  ],
  defaultSort: 'nameAsc',
  id: (item) => item.id,
  searchKeys: ['displayName', 'email'],
  parameters: { q: 'memberQ', sort: 'memberSort', filter: 'memberFilter' },
  filters: [
    { value: 'active', label: 'team.active' },
    { value: 'disabled', label: 'team.disabled' },
  ],
  matchesFilter: (item, filter) => (item.disabledAt === null) === (filter === 'active'),
};

export const invitationTableOptions: WorkspaceTableOptions<typeof TeamInvitation.Type> = {
  columns: [
    { kind: 'text', key: 'name', value: (item) => item.displayName },
    { kind: 'text', key: 'email', value: (item) => item.email },
    {
      kind: 'text',
      key: 'profile',
      value: (item, language) => translate(language, `team.${item.profile}`),
    },
    { kind: 'number', key: 'date', value: (item) => item.createdAt },
    { kind: 'number', key: 'expires', value: (item) => item.expiresAt },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['displayName', 'email'],
  parameters: { q: 'invitationQ', sort: 'invitationSort', filter: 'invitationFilter' },
  filters: [
    { value: 'accountant', label: 'team.accountant' },
    { value: 'collaborator', label: 'team.collaborator' },
  ],
  matchesFilter: (item, filter) => item.profile === filter,
};

export const tokenTableOptions: WorkspaceTableOptions<ApiTokenValue> = {
  columns: [
    { kind: 'text', key: 'name', value: (item) => item.name },
    { kind: 'number', key: 'date', value: (item) => item.createdAt },
    { kind: 'number', key: 'expires', value: (item) => item.expiresAt },
    { kind: 'number', key: 'used', value: (item) => item.lastUsedAt },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['name', 'permissions'],
  filters: [
    { value: 'revoked', label: 'configurationWorkspace.revokedTokens' },
    { value: 'notRevoked', label: 'configurationWorkspace.notRevokedTokens' },
  ],
  matchesFilter: (item, filter) => (item.revokedAt !== null) === (filter === 'revoked'),
};

export const conditionTableOptions: WorkspaceTableOptions<QuoteConditionPresetValue> = {
  columns: [
    { kind: 'text', key: 'name', value: (item) => item.name },
    { kind: 'text', key: 'conditions', value: (item) => item.conditions },
  ],
  defaultSort: 'nameAsc',
  id: (item) => item.id,
  searchKeys: ['name', 'conditions'],
};

export const emailTableOptions: WorkspaceTableOptions<EmailTestOperation> = {
  columns: [
    { kind: 'number', key: 'date', value: (item) => Date.parse(item.createdAt) },
    { kind: 'text', key: 'subject', value: (item) => item.request.subject },
    {
      kind: 'text',
      key: 'status',
      value: (item, language) => translate(language, `emailTest.${item.status}`),
    },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.request.requestId,
  searchKeys: ['request.subject'],
  filters: [
    { value: 'delivered', label: 'emailTest.delivered' },
    { value: 'failed', label: 'emailTest.failed' },
  ],
  matchesFilter: (item, filter) => item.status === filter,
};

export const checkoutTableOptions: WorkspaceTableOptions<CheckoutOperation> = {
  columns: [
    { kind: 'number', key: 'date', value: (item) => Date.parse(item.createdAt) },
    { kind: 'text', key: 'invoice', value: (item) => item.invoiceNumber },
    { kind: 'number', key: 'amount', value: (item) => item.amountCents },
    {
      kind: 'text',
      key: 'status',
      value: (item, language) => translate(language, `checkout.${item.status}`),
    },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.request.requestId,
  searchKeys: ['invoiceNumber'],
  filters: [
    { value: 'paid', label: 'checkout.paid' },
    { value: 'open', label: 'checkout.open' },
  ],
  matchesFilter: (item, filter) => item.status === filter,
};

export const auditTableOptions: WorkspaceTableOptions<GlobalAuditEvent> = {
  columns: [
    { kind: 'number', key: 'date', value: (item) => Date.parse(item.occurredAt) },
    { kind: 'text', key: 'action', value: (item) => item.action },
    { kind: 'text', key: 'resource', value: (item) => `${item.resourceType} ${item.resourceId}` },
    { kind: 'text', key: 'actor', value: (item) => item.actorUserId },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['action', 'resourceType', 'resourceId', 'actorUserId'],
  parameters: { q: 'pageQ', sort: 'pageSort', filter: 'pageFilter' },
};
