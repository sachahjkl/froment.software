import { Ulid } from '@froment/contracts';
import type Sqlite from 'better-sqlite3';
import { Schema } from 'effect';

import type { AuditService } from '../audit/audit.js';

const ExpiredQuote = Schema.Struct({ id: Ulid, version: Schema.Int });

export const expireSentQuotes = (
  sqlite: Sqlite.Database,
  audit: AuditService,
  now: number,
  quoteId?: string,
) => {
  const expired = sqlite
    .prepare(
      `update quotes set status = 'expired', updated_at = max(updated_at, ?)
       where status = 'sent'
         and (? is null or id = ?)
         and exists (
           select 1 from quote_revisions
           join quote_links on quote_links.revision_id = quote_revisions.id
           where quote_revisions.quote_id = quotes.id
             and quote_revisions.version = quotes.version
             and quote_links.expires_at <= ?
         )
       returning id, version`,
    )
    .all(now, quoteId ?? null, quoteId ?? null, now);
  const quotes = Schema.decodeUnknownSync(Schema.Array(ExpiredQuote))(expired);

  for (const quote of quotes) {
    audit.insert({
      action: 'quote.expired',
      actorUserId: null,
      resourceType: 'quote',
      resourceId: quote.id,
      metadata: { version: String(quote.version) },
      occurredAt: now,
    });
  }
};
