import Sqlite from 'better-sqlite3';
import { DateTime } from 'effect';
import { describe, expect, it } from 'vitest';

import { allocateBusinessReference, businessYear } from './business-references.js';

describe('business references', () => {
  const zone = DateTime.zoneMakeNamedUnsafe('Europe/Paris');

  it('uses the business year at the Europe/Paris New Year boundary', () => {
    expect(businessYear(Date.parse('2026-12-31T22:59:59.999Z'), zone)).toBe(2026);
    expect(businessYear(Date.parse('2026-12-31T23:00:00.000Z'), zone)).toBe(2027);
  });

  it('allocates independent annual sequences with exactly six digits', () => {
    const sqlite = new Sqlite(':memory:');
    sqlite.exec(`create table business_reference_counters (
      kind text not null, year integer not null, next_value integer not null,
      primary key (kind, year), check (next_value between 1 and 1000000)
    )`);

    expect(allocateBusinessReference(sqlite, 'quote', 2026)).toBe('DE-2026-000001');
    expect(allocateBusinessReference(sqlite, 'quote', 2026)).toBe('DE-2026-000002');
    expect(allocateBusinessReference(sqlite, 'order', 2026)).toBe('CO-2026-000001');
    expect(allocateBusinessReference(sqlite, 'quote', 2027)).toBe('DE-2027-000001');
    sqlite
      .prepare(
        "update business_reference_counters set next_value = 1000000 where kind = 'quote' and year = 2026",
      )
      .run();
    expect(() => allocateBusinessReference(sqlite, 'quote', 2026)).toThrow(
      'business.reference.sequence_exhausted',
    );
    sqlite.close();
  });
});
