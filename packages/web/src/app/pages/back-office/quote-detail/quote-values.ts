import { Ulid, type UlidValue } from '@froment/contracts';
import { Option, Schema } from 'effect';

export function quoteIdentifier(value: string | null): UlidValue | undefined {
  return Option.getOrUndefined(Schema.decodeUnknownOption(Ulid)(value));
}
