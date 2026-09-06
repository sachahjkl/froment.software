import { Schema } from 'effect';
import { AccountPassword, AuthenticationRequired, RequestRateLimited } from './contracts.js';
import { Ulid } from '../identifiers.js';

const BinaryText = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]+$/),
  Schema.isMaxLength(65536),
);
const CredentialId = BinaryText.check(Schema.isMaxLength(2048));
const Name = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(80));
const Transport = Schema.String.check(Schema.isMaxLength(32));
const Descriptor = Schema.Struct({ id: CredentialId, type: Schema.Literal('public-key') });
export const PasskeyRegistrationOptions = Schema.Struct({
  challenge: BinaryText,
  rp: Schema.Struct({ id: Schema.String, name: Schema.String }),
  user: Schema.Struct({ id: BinaryText, name: Schema.String, displayName: Schema.String }),
  pubKeyCredParams: Schema.Array(
    Schema.Struct({ type: Schema.Literal('public-key'), alg: Schema.Int }),
  ),
  timeout: Schema.Number,
  excludeCredentials: Schema.Array(Descriptor),
  attestation: Schema.Literal('none'),
  authenticatorSelection: Schema.Struct({
    residentKey: Schema.Literal('required'),
    userVerification: Schema.Literal('required'),
  }),
});
export const PasskeyLoginOptions = Schema.Struct({
  challenge: BinaryText,
  rpId: Schema.String,
  timeout: Schema.Number,
  userVerification: Schema.Literal('required'),
});
const Credential = {
  id: CredentialId,
  rawId: CredentialId,
  type: Schema.Literal('public-key'),
  clientExtensionResults: Schema.Struct({}),
};
export const PasskeyRegistrationResponse = Schema.Struct({
  ...Credential,
  response: Schema.Struct({
    clientDataJSON: BinaryText,
    attestationObject: BinaryText,
    transports: Schema.optionalKey(Schema.Array(Transport).check(Schema.isMaxLength(10))),
  }),
});
export const PasskeyLoginResponse = Schema.Struct({
  ...Credential,
  response: Schema.Struct({
    clientDataJSON: BinaryText,
    authenticatorData: BinaryText,
    signature: BinaryText,
    userHandle: BinaryText,
  }),
});
export const PasskeyRegistrationRequest = Schema.Struct({ name: Name, password: AccountPassword });
export const PasskeyRemovalRequest = Schema.Struct({ password: AccountPassword });
export const Passkey = Schema.Struct({
  id: Ulid,
  name: Name,
  createdAt: Schema.Int,
  lastUsedAt: Schema.NullOr(Schema.Int),
});
export const PasskeyList = Schema.Array(Passkey);
export class PasskeyRejected extends Schema.TaggedError<PasskeyRejected>()(
  'PasskeyRejected',
  {
    code: Schema.Literal('passkey.rejected'),
  },
  { httpApiStatus: 400 },
) {}
export const PasskeyFailure = Schema.Union([
  PasskeyRejected,
  AuthenticationRequired,
  RequestRateLimited,
]);
