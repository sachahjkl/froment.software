import { type ParamMap } from '@angular/router';
import { GlobalAuditQuery } from '@froment/contracts';
import { Option, Schema } from 'effect';

const keys = ['cursor', 'direction', 'limit', 'action', 'resourceType'] as const;

export const auditQuery = (params: ParamMap): GlobalAuditQuery | undefined => {
  if (keys.some((key) => params.getAll(key).length > 1)) return undefined;
  return Option.getOrUndefined(
    Schema.decodeUnknownOption(GlobalAuditQuery)(
      Object.fromEntries(
        keys.filter((key) => params.has(key)).map((key) => [key, params.get(key)]),
      ),
    ),
  );
};
