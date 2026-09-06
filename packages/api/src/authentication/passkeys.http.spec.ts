import { PasskeyList, PasskeyRegistrationOptions, PasskeyLoginOptions } from '@froment/contracts';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { cookieHeaders, storeResponseCookies } from '../server/cookies.spec-helper.js';
import { startHttpTestServer } from '../server/server.spec-helper.js';

it('registers, authenticates and revokes real signed passkey credentials with single-use browser-bound challenges', async () => {
  const server = await startHttpTestServer();
  const cookies = new CookieJar();
  const sqlite = new Sqlite(server.databaseFilename);
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error('passkey.test.key');
  const credentialId = randomBytes(32);
  const credential = {
    id: credentialId.toString('base64url'),
    rawId: credentialId.toString('base64url'),
    type: 'public-key',
    clientExtensionResults: {},
  };
  const post = async (path: string, body: typeof Schema.Json.Type, authenticated = false) => {
    const headers = await cookieHeaders(cookies, `${server.baseUrl}/api/auth/passkeys`);
    const response = await fetch(`${server.baseUrl}/api/auth/passkeys/${path}`, {
      method: 'POST',
      headers: {
        cookie: [authenticated ? server.sessionHeaders['cookie'] : '', headers['cookie']]
          .filter(Boolean)
          .join('; '),
        'content-type': 'application/json',
        origin: server.baseUrl,
      },
      body: JSON.stringify(body),
    });
    await storeResponseCookies(cookies, response, server.baseUrl);
    return response;
  };
  const authenticatorData = (flags: number, counter: number) => {
    const result = Buffer.alloc(37);
    createHash('sha256').update(new URL(server.baseUrl).hostname).digest().copy(result);
    result[32] = flags;
    result.writeUInt32BE(counter, 33);
    return result;
  };
  try {
    const request = { name: 'Test key', password: 'administrator-password' };
    const anonymous = await post('register/options', request);
    expect(anonymous.status, `${await anonymous.text()}\n${server.output()}`).toBe(401);
    expect(
      (await post('register/options', { ...request, password: 'incorrect-password' }, true)).status,
    ).toBe(400);
    const prepared = await post('register/options', request, true);
    expect(prepared.status).toBe(200);
    const options = Schema.decodeUnknownSync(PasskeyRegistrationOptions)(await prepared.json());
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: options.challenge,
        origin: server.baseUrl,
      }),
    ).toString('base64url');
    const key = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x, 'base64url')],
        [-3, Buffer.from(jwk.y, 'base64url')],
      ]),
    );
    const length = Buffer.alloc(2);
    length.writeUInt16BE(credentialId.length);
    const authData = Buffer.concat([
      authenticatorData(0x45, 0),
      Buffer.alloc(16),
      length,
      credentialId,
      key,
    ]);
    const attestation = isoCBOR.encode(
      new Map<string, string | Uint8Array | Map<string, string>>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );
    const registration = {
      ...credential,
      response: {
        clientDataJSON,
        attestationObject: Buffer.from(attestation).toString('base64url'),
      },
    };
    expect((await post('register/verify', registration, true)).status).toBe(204);
    expect((await post('register/verify', registration, true)).status).toBe(400);
    const listed = await fetch(`${server.baseUrl}/api/auth/passkeys`, {
      headers: server.sessionHeaders,
    });
    const keys = Schema.decodeUnknownSync(PasskeyList)(await listed.json());
    expect(keys).toHaveLength(1);
    expect(JSON.stringify(keys)).not.toContain(credential.id);
    const keyId = keys[0]?.id;
    if (keyId === undefined) throw new Error('passkey.test.missing');

    const prepareAssertion = async (counter: number, flags = 0x05, origin = server.baseUrl) => {
      const prepared = await post('login/options', {});
      expect(prepared.status).toBe(200);
      const loginOptions = Schema.decodeUnknownSync(PasskeyLoginOptions)(await prepared.json());
      const clientData = Buffer.from(
        JSON.stringify({ type: 'webauthn.get', challenge: loginOptions.challenge, origin }),
      );
      const authData = authenticatorData(flags, counter);
      const signature = sign(
        'sha256',
        Buffer.concat([authData, createHash('sha256').update(clientData).digest()]),
        privateKey,
      );
      return {
        ...credential,
        response: {
          clientDataJSON: clientData.toString('base64url'),
          authenticatorData: authData.toString('base64url'),
          signature: signature.toString('base64url'),
          userHandle: options.user.id,
        },
      };
    };
    const assertion = await prepareAssertion(1);
    expect(
      (
        await fetch(`${server.baseUrl}/api/auth/passkeys/login/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: server.baseUrl },
          body: JSON.stringify(assertion),
        })
      ).status,
    ).toBe(400);
    const login = await post('login/verify', assertion);
    expect(login.status).toBe(200);
    expect(await login.json()).toMatchObject({ mode: 'administrator' });
    expect((await post('login/verify', assertion)).status).toBe(400);
    expect((await post('login/verify', await prepareAssertion(1))).status).toBe(400);
    expect((await post('login/verify', await prepareAssertion(2, 0x01))).status).toBe(400);
    expect(
      (await post('login/verify', await prepareAssertion(2, 0x05, 'https://attacker.example')))
        .status,
    ).toBe(400);
    const expired = await prepareAssertion(2);
    sqlite.prepare('update passkey_challenges set expires_at = 0').run();
    expect((await post('login/verify', expired)).status).toBe(400);
    const disabled = await prepareAssertion(2);
    const userId = Buffer.from(options.user.id, 'base64url').toString();
    sqlite.prepare('update users set disabled_at = ? where id = ?').run(Date.now(), userId);
    expect((await post('login/verify', disabled)).status).toBe(400);
    sqlite.prepare('update users set disabled_at = null where id = ?').run(userId);
    const removal = await fetch(`${server.baseUrl}/api/auth/passkeys/${keyId}/remove`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify({ password: 'administrator-password' }),
    });
    expect(removal.status).toBe(204);
    expect(
      (
        await fetch(`${server.baseUrl}/api/auth/account`, {
          headers: await cookieHeaders(cookies, `${server.baseUrl}/api/auth/account`),
        })
      ).status,
    ).toBe(401);
    expect(
      (await fetch(`${server.baseUrl}/api/auth/account`, { headers: server.sessionHeaders }))
        .status,
    ).toBe(200);
    expect(sqlite.prepare('select count(*) from passkeys').pluck().get()).toBe(0);
    expect(
      sqlite
        .prepare("select count(*) from audit_events where action like 'authentication.passkey-%'")
        .pluck()
        .get(),
    ).toBe(3);
  } finally {
    sqlite.close();
    await server.close();
  }
}, 20000);

it('rejects cross-origin challenges and rate-limits anonymous options without exposing account data', async () => {
  const server = await startHttpTestServer();
  try {
    const url = `${server.baseUrl}/api/auth/passkeys/login/options`;
    expect(
      (await fetch(url, { method: 'POST', headers: { origin: 'https://attacker.example' } }))
        .status,
    ).toBe(403);
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await fetch(url, { method: 'POST', headers: { origin: server.baseUrl } });
      expect(result.status).toBe(200);
      expect(result.headers.get('cache-control')).toContain('no-store');
      expect(result.headers.get('set-cookie')).toContain('HttpOnly');
      expect(result.headers.get('set-cookie')).toContain('Secure');
      expect(result.headers.get('set-cookie')).toContain('Max-Age=300');
      const options = await result.json();
      expect(options).not.toHaveProperty('allowCredentials');
      expect(options).not.toHaveProperty('user');
    }
    expect((await fetch(url, { method: 'POST', headers: { origin: server.baseUrl } })).status).toBe(
      429,
    );
  } finally {
    await server.close();
  }
}, 15000);
