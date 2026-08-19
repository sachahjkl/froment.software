import { Schema } from 'effect';

export const Ulid = Schema.String.check(Schema.isPattern(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/));
export type Ulid = typeof Ulid.Type;
