import { GlobalAuditQuery } from '@froment/contracts';
import { Schema } from 'effect';

export function auditQuerySchema(pageSize: number) {
  return Schema.toType(GlobalAuditQuery).check(
    Schema.makeFilter((query) => query.limit === undefined || query.limit <= pageSize, {
      message: 'audit.limit_exceeded',
    }),
  );
}
