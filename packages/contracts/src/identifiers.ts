import { Schema } from 'effect';

export const DisplayName = Schema.String.check(Schema.isPattern(/\S/));
export type DisplayName = typeof DisplayName.Type;

export const Ulid = Schema.String.check(Schema.isPattern(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/));
export type Ulid = typeof Ulid.Type;
