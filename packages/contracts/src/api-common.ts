import { Schema } from 'effect';

export const RevisionVersionParameter = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
