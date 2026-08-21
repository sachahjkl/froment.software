import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

import {
  Api,
  ClientInvoiceList,
  ClientOrderList,
  ClientQuoteList,
  ClientSummary,
  OrderList,
  QuoteDetail,
} from '@froment/contracts';
import Sqlite from 'better-sqlite3';
import { Effect, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { HttpApiClient } from 'effect/unstable/httpapi';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const deploymentMetadata = {
  commit: '6c9757782e249d4db6ffb804349b7da620494565',
  packages: [
    { name: '@froment/api', version: '0.2.0' },
    { name: '@froment/contracts', version: '0.2.0' },
    { name: '@froment/documents', version: '0.2.0' },
    { name: '@froment/l10n', version: '0.2.0' },
    { name: '@froment/web', version: '0.2.0' },
    { name: 'froment-software', version: '0.2.0' },
  ],
};
const emptyClientDetails = {
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
};
const execFileAsync = promisify(execFile);

const reservePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || address === null) {
        server.close();
        reject(new Error('The test server did not reserve a TCP port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitForServer = async (url: string, process: ChildProcess, readOutput: () => string) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(
        `The server stopped with exit code ${process.exitCode}.\n${readOutput().slice(-5_000)}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The process has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server did not start before the timeout.\n${readOutput().slice(-5_000)}`);
};

describe('HTTP server', () => {
  let baseUrl: string;
  let administratorAccessIdentifier: string | undefined;
  let databaseFilename: string;
  let server: ChildProcess;
  let serverOutput = '';
  let staticRoot: string;

  beforeAll(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'froment-api-'));
    await cp(join(import.meta.dirname, '../../web/dist/froment-software/browser'), staticRoot, {
      recursive: true,
    });
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    databaseFilename = join(staticRoot, 'database.sqlite');
    const env = {
      ...process.env,
      ACCESS_HMAC_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      BOOTSTRAP_PASSWORD_SCRYPT:
        'scrypt$16384$8$1$ABEiM0RVZneImaq7zN3u_w$bDQwYDYiQ_8HCiJ3-qXFtXFeV9FhIOa7E8VSgT__uegLrk4vqD6U920ImYTwk5RABOZsIk96bUNH1G9wbCXf1Q',
      BUSINESS_TIME_ZONE: 'Europe/Paris',
      DATABASE_PATH: databaseFilename,
      DEPLOYMENT_METADATA: JSON.stringify(deploymentMetadata),
      MIGRATIONS_ROOT: join(import.meta.dirname, '..', 'drizzle'),
      PORT: String(port),
      PUBLIC_ORIGIN: baseUrl,
      QUOTE_LINK_HMAC_KEY: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      STATIC_ROOT: staticRoot,
      SESSION_HMAC_KEY: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      OTEL_SDK_DISABLED: 'true',
    };
    const cwd = join(import.meta.dirname, '..');
    await execFileAsync(process.execPath, ['dist/migrate.cjs'], { cwd, env });
    server = spawn(process.execPath, ['dist/main.cjs'], {
      cwd,
      env,
      stdio: 'pipe',
    });
    server.stdout?.on('data', (chunk: Buffer) => {
      serverOutput += chunk.toString();
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      serverOutput += chunk.toString();
    });
    await waitForServer(`${baseUrl}/api/health`, server, () => serverOutput);
  });

  afterAll(async () => {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise<void>((resolve) => server.once('exit', () => resolve()));
    }
    await rm(staticRoot, { recursive: true, force: true });
  });

  it('returns the typed health response', async () => {
    const status = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api, {
          transformClient: HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
        });
        return yield* client.health();
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    );
    expect(status).toEqual({ status: 'ok' });
  });

  it('returns a unique server request identifier', async () => {
    const suppliedRequestId = 'client-controlled';
    const first = await fetch(`${baseUrl}/api/health`, {
      headers: { 'x-request-id': suppliedRequestId },
    });
    const second = await fetch(`${baseUrl}/api/health`);
    const firstRequestId = first.headers.get('x-request-id');
    const secondRequestId = second.headers.get('x-request-id');

    expect(firstRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(firstRequestId).not.toBe(suppliedRequestId);
    expect(secondRequestId).not.toBe(firstRequestId);
  });

  it('returns exact deployment metadata without a build date', async () => {
    const response = await fetch(`${baseUrl}/api/version`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const metadata = await response.json();
    expect(metadata).toEqual(deploymentMetadata);
    expect(metadata).not.toHaveProperty('builtAt');
    expect(metadata).not.toHaveProperty('date');
  });

  it('creates the initial administrator and session once', async () => {
    const initialStatus = await fetch(`${baseUrl}/api/bootstrap`);
    await expect(initialStatus.json()).resolves.toEqual({ available: true });

    for (const origin of [undefined, 'null', 'https://attacker.example', `${baseUrl}:444`]) {
      const headers = new Headers({ 'content-type': 'application/json' });
      if (origin !== undefined) headers.set('origin', origin);
      const invalidOrigin = await fetch(`${baseUrl}/api/bootstrap`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: 'bootstrap-password' }),
      });
      expect(invalidOrigin.status).toBe(403);
      await expect(invalidOrigin.json()).resolves.toEqual({ code: 'request.invalid_origin' });
    }

    const rejected = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ password: 'wrong' }),
    });
    const rejectedBody = await rejected.json();
    expect({ status: rejected.status, body: rejectedBody }).toEqual({
      status: 401,
      body: {
        _tag: 'BootstrapRejected',
        code: 'bootstrap.invalid_credentials',
      },
    });

    const rateLimitedBootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ password: 'bootstrap-password' }),
    });
    expect(rateLimitedBootstrap.status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const created = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ password: 'bootstrap-password' }),
    });
    expect(created.status).toBe(200);
    expect(created.headers.get('cache-control')).toBe('no-store');
    expect(created.headers.get('vary')).toBe('Cookie');
    const result = (await created.json()) as {
      accessIdentifier: string;
    };
    expect(result).toEqual({
      accessIdentifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    administratorAccessIdentifier = result.accessIdentifier;
    const cookies = created.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.join('\n')).toContain('__Host-froment-session=');
    expect(cookies.join('\n')).toContain('__Host-froment-csrf=');
    for (const cookie of cookies) {
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
    }
    expect(cookies.find((cookie) => cookie.startsWith('__Host-froment-session='))).toContain(
      'HttpOnly',
    );

    const sqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      sqlite.prepare("select count(*) from users where kind = 'administrator'").pluck().get(),
    ).toBe(1);
    expect(
      sqlite.prepare("select count(*) from roles where name = 'administrator'").pluck().get(),
    ).toBe(1);
    expect(sqlite.prepare('select count(*) from user_roles').pluck().get()).toBe(1);
    expect(sqlite.prepare('select count(*) from role_permissions').pluck().get()).toBe(34);
    expect(sqlite.prepare('select count(*) from access_credentials').pluck().get()).toBe(1);
    expect(sqlite.prepare('select count(*) from sessions').pluck().get()).toBe(1);
    expect(
      sqlite
        .prepare(
          "select count(*) from audit_events where action = 'administrator.bootstrapped' and actor_user_id is null",
        )
        .pluck()
        .get(),
    ).toBe(1);
    sqlite.close();

    const cookieHeader = cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
    const sessionStatus = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookieHeader },
    });
    expect(sessionStatus.headers.get('cache-control')).toBe('no-store');
    await expect(sessionStatus.json()).resolves.toEqual({
      authenticated: true,
      mode: 'administrator',
    });

    const csrfToken = cookies
      .find((cookie) => cookie.startsWith('__Host-froment-csrf='))
      ?.split(';', 1)[0]
      .split('=', 2)[1];
    const rejectedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        origin: baseUrl,
        'x-csrf-token': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
    expect(rejectedLogout.status).toBe(401);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader, origin: baseUrl, 'x-csrf-token': csrfToken ?? '' },
    });
    expect(logout.status).toBe(200);
    await expect(logout.json()).resolves.toEqual({ authenticated: false, mode: null });

    const repeatedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader, origin: baseUrl, 'x-csrf-token': csrfToken ?? '' },
    });
    expect(repeatedLogout.status).toBe(200);
    expect(repeatedLogout.headers.getSetCookie()).toHaveLength(2);

    const logoutSqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      logoutSqlite
        .prepare("select count(*) from audit_events where action = 'authentication.logout'")
        .pluck()
        .get(),
    ).toBe(1);
    logoutSqlite.close();

    const loggedOutStatus = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookieHeader },
    });
    await expect(loggedOutStatus.json()).resolves.toEqual({ authenticated: false, mode: null });

    const [loginRejected, concurrentValidLogin] = await Promise.all([
      fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({
          accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          mode: 'administrator',
        }),
      }),
      fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'administrator' }),
      }),
    ]);
    expect(loginRejected.status).toBe(401);
    expect(concurrentValidLogin.status).toBe(200);

    const firstLimitedIdentifierAttempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({
        accessIdentifier: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        mode: 'administrator',
      }),
    });
    expect(firstLimitedIdentifierAttempt.status).toBe(429);
    const rateLimited = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({
        accessIdentifier: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        mode: 'administrator',
      }),
    });
    expect(rateLimited.status).toBe(429);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'administrator' }),
    });
    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toEqual({
      authenticated: true,
      mode: 'administrator',
    });
    expect(login.headers.getSetCookie()).toHaveLength(2);

    const modeMismatch = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'client' }),
    });
    expect(modeMismatch.status).toBe(429);

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const extraLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'administrator' }),
      });
      expect(extraLogin.status).toBe(200);
    }
    const boundedSqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      boundedSqlite.prepare('select count(*) from sessions').pluck().get(),
    ).toBeLessThanOrEqual(10);
    expect(
      boundedSqlite
        .prepare(
          "select count(*) from audit_events where action = 'authentication.login-succeeded'",
        )
        .pluck()
        .get(),
    ).toBe(13);
    boundedSqlite.close();

    const finalStatus = await fetch(`${baseUrl}/api/bootstrap`);
    await expect(finalStatus.json()).resolves.toEqual({ available: false });
    const conflict = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ password: 'bootstrap-password' }),
    });
    expect(conflict.status).toBe(409);
  });

  it('manages clients through permission and CSRF protected routes', async () => {
    if (administratorAccessIdentifier === undefined) {
      throw new Error('The administrator access identifier is unavailable.');
    }

    const anonymousList = await fetch(`${baseUrl}/api/clients`);
    expect(anonymousList.status).toBe(401);
    expect(anonymousList.headers.get('cache-control')).toBe('no-store');

    const administratorLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({
        accessIdentifier: administratorAccessIdentifier,
        mode: 'administrator',
      }),
    });
    expect(administratorLogin.status).toBe(200);
    const administratorCookies = administratorLogin.headers.getSetCookie();
    const administratorCookieHeader = administratorCookies
      .map((cookie) => cookie.split(';', 1)[0])
      .join('; ');
    const administratorCsrf = administratorCookies
      .find((cookie) => cookie.startsWith('__Host-froment-csrf='))
      ?.split(';', 1)[0]
      .split('=', 2)[1];
    if (administratorCsrf === undefined) {
      throw new Error('The administrator CSRF token is unavailable.');
    }

    const initialList = await fetch(`${baseUrl}/api/clients`, {
      headers: { cookie: administratorCookieHeader },
    });
    expect(initialList.status).toBe(200);
    await expect(initialList.json()).resolves.toEqual([]);

    const missingCsrf = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
      },
      body: JSON.stringify({ ...emptyClientDetails, displayName: 'Acme' }),
    });
    expect(missingCsrf.status).toBe(403);
    await expect(missingCsrf.json()).resolves.toMatchObject({
      _tag: 'CsrfRejected',
      code: 'authentication.invalid_csrf',
    });

    const foreignOrigin = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify({ ...emptyClientDetails, displayName: 'Acme' }),
    });
    expect(foreignOrigin.status).toBe(403);

    const createdResponse = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify({ ...emptyClientDetails, displayName: '  Acme  ' }),
    });
    expect(createdResponse.status).toBe(200);
    const client = (await createdResponse.json()) as {
      id: string;
      displayName: string;
      archived: boolean;
      updatedAt: number;
    };
    expect(client).toEqual({
      id: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      displayName: 'Acme',
      ...emptyClientDetails,
      archived: false,
      updatedAt: expect.any(Number),
    });

    const detailResponse = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      headers: { cookie: administratorCookieHeader },
    });
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toEqual(client);

    const updateBody = {
      ...emptyClientDetails,
      displayName: 'Acme Conseil',
      city: 'Lyon',
      expectedUpdatedAt: client.updatedAt,
    };
    const updateWithoutCsrf = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
      },
      body: JSON.stringify(updateBody),
    });
    expect(updateWithoutCsrf.status).toBe(403);
    const updateResponse = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify(updateBody),
    });
    expect(updateResponse.status).toBe(200);
    const updatedClient = (await updateResponse.json()) as typeof client;
    expect(updatedClient).toEqual({
      ...client,
      displayName: 'Acme Conseil',
      city: 'Lyon',
      updatedAt: expect.any(Number),
    });
    expect(updatedClient.updatedAt).toBeGreaterThan(client.updatedAt);

    const staleUpdate = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify(updateBody),
    });
    expect(staleUpdate.status).toBe(409);
    await expect(staleUpdate.json()).resolves.toMatchObject({
      code: 'client.version_conflict',
    });

    const accessResponse = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(accessResponse.status).toBe(200);
    const access = (await accessResponse.json()) as {
      clientId: string;
      accessIdentifier: string;
    };
    expect(access).toEqual({
      clientId: client.id,
      accessIdentifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });

    const clientLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: access.accessIdentifier, mode: 'client' }),
    });
    expect(clientLogin.status).toBe(200);
    const clientCookieHeader = clientLogin.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';', 1)[0])
      .join('; ');
    const clientSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: clientCookieHeader },
    });
    await expect(clientSession.json()).resolves.toEqual({ authenticated: true, mode: 'client' });
    const forbiddenList = await fetch(`${baseUrl}/api/clients`, {
      headers: { cookie: clientCookieHeader },
    });
    expect(forbiddenList.status).toBe(403);
    await expect(forbiddenList.json()).resolves.toMatchObject({
      _tag: 'PermissionDenied',
      code: 'authentication.permission_denied',
    });
    const forbiddenDetail = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      headers: { cookie: clientCookieHeader },
    });
    expect(forbiddenDetail.status).toBe(403);

    const roleSqlite = new Sqlite(databaseFilename);
    roleSqlite
      .prepare(
        "insert into user_roles (user_id, role_id) select ?, id from roles where name = 'administrator'",
      )
      .run(client.id);
    roleSqlite.close();
    const forbiddenAdministratorRole = await fetch(`${baseUrl}/api/clients`, {
      headers: { cookie: clientCookieHeader },
    });
    expect(forbiddenAdministratorRole.status).toBe(403);

    const rotatedAccessResponse = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(rotatedAccessResponse.status).toBe(200);
    const rotatedAccess = (await rotatedAccessResponse.json()) as typeof access;
    const rotatedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: rotatedAccess.accessIdentifier, mode: 'client' }),
    });
    expect(rotatedLogin.status).toBe(200);
    const rotatedSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: clientCookieHeader },
    });
    await expect(rotatedSession.json()).resolves.toEqual({ authenticated: false, mode: null });
    const rotatedSqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      rotatedSqlite
        .prepare(
          'select count(*) from access_credentials where user_id = ? and revoked_at is not null',
        )
        .pluck()
        .get(client.id),
    ).toBe(1);
    expect(
      rotatedSqlite
        .prepare('select count(*) from access_credentials where user_id = ? and revoked_at is null')
        .pluck()
        .get(client.id),
    ).toBe(1);
    rotatedSqlite.close();

    const archiveResponse = await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(archiveResponse.status).toBe(200);
    const archivedClient = (await archiveResponse.json()) as typeof client;
    expect(archivedClient).toEqual({
      ...updatedClient,
      archived: true,
      updatedAt: expect.any(Number),
    });
    const repeatedArchive = await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(repeatedArchive.status).toBe(200);
    await expect(repeatedArchive.json()).resolves.toEqual(archivedClient);

    const archivedUpdate = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify({ ...updateBody, expectedUpdatedAt: archivedClient.updatedAt }),
    });
    expect(archivedUpdate.status).toBe(409);
    await expect(archivedUpdate.json()).resolves.toMatchObject({ code: 'client.archived' });

    for (let attempt = 0; attempt < 57; attempt += 1) {
      const boundedUpdate = await fetch(`${baseUrl}/api/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          cookie: administratorCookieHeader,
          'content-type': 'application/json',
          origin: baseUrl,
          'x-csrf-token': administratorCsrf,
        },
        body: JSON.stringify({ ...updateBody, expectedUpdatedAt: archivedClient.updatedAt }),
      });
      expect(boundedUpdate.status).toBe(409);
    }
    const rateLimitedUpdate = await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify({ ...updateBody, expectedUpdatedAt: archivedClient.updatedAt }),
    });
    expect(rateLimitedUpdate.status).toBe(429);

    const revokedSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: clientCookieHeader },
    });
    await expect(revokedSession.json()).resolves.toEqual({ authenticated: false, mode: null });

    const archivedAccess = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(archivedAccess.status).toBe(409);

    const reactivateResponse = await fetch(`${baseUrl}/api/clients/${client.id}/reactivate`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        origin: baseUrl,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(reactivateResponse.status).toBe(200);
    const reactivatedClient = (await reactivateResponse.json()) as typeof client;
    expect(reactivatedClient).toEqual({
      ...updatedClient,
      archived: false,
      updatedAt: expect.any(Number),
    });

    const finalList = await fetch(`${baseUrl}/api/clients`, {
      headers: { cookie: administratorCookieHeader },
    });
    await expect(finalList.json()).resolves.toEqual([reactivatedClient]);

    const sqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      sqlite
        .prepare('select typeof(secret_hmac) from access_credentials where user_id = ?')
        .pluck()
        .get(client.id),
    ).toBe('blob');
    expect(
      sqlite
        .prepare(
          'select count(*) from access_credentials where user_id = ? and revoked_at is not null',
        )
        .pluck()
        .get(client.id),
    ).toBe(2);
    expect(
      sqlite
        .prepare(
          `select action from audit_events
           where resource_type = 'client' and resource_id = ? order by occurred_at, id`,
        )
        .pluck()
        .all(client.id),
    ).toEqual([
      'client.created',
      'client.updated',
      'client.access-created',
      'client.access-created',
      'client.archived',
      'client.reactivated',
    ]);
    expect(
      sqlite
        .prepare('select count(*) from audit_events where metadata like ?')
        .pluck()
        .get(`%${access.accessIdentifier}%`),
    ).toBe(0);
    sqlite.close();
  });

  it('creates and revises draft quotes with complete history', async () => {
    if (administratorAccessIdentifier === undefined) {
      throw new Error('The administrator access identifier is unavailable.');
    }
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({
        accessIdentifier: administratorAccessIdentifier,
        mode: 'administrator',
      }),
    });
    expect(login.status).toBe(200);
    const cookies = login.headers.getSetCookie();
    const cookie = cookies.map((value) => value.split(';', 1)[0]).join('; ');
    const csrf = cookies
      .find((value) => value.startsWith('__Host-froment-csrf='))
      ?.split(';', 1)[0]
      .split('=', 2)[1];
    if (csrf === undefined) throw new Error('The administrator CSRF token is unavailable.');
    const writeHeaders = {
      cookie,
      'content-type': 'application/json',
      origin: baseUrl,
      'x-csrf-token': csrf,
    };
    const presetCreate = await fetch(`${baseUrl}/api/quote-condition-presets`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        name: 'Standard payment',
        conditions: 'Payment is due within 30 days.',
      }),
    });
    expect(presetCreate.status).toBe(200);
    const conditionPreset = (await presetCreate.json()) as {
      id: string;
      name: string;
      conditions: string;
    };
    expect(conditionPreset).toMatchObject({
      id: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      name: 'Standard payment',
      conditions: 'Payment is due within 30 days.',
    });
    const duplicatePreset = await fetch(`${baseUrl}/api/quote-condition-presets`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        name: 'Standard payment',
        conditions: 'Different text.',
      }),
    });
    expect(duplicatePreset.status).toBe(409);
    await expect(duplicatePreset.json()).resolves.toMatchObject({
      code: 'quote_condition_preset.name_conflict',
    });
    const presetUpdate = await fetch(
      `${baseUrl}/api/quote-condition-presets/${conditionPreset.id}`,
      {
        method: 'PUT',
        headers: writeHeaders,
        body: JSON.stringify({
          name: 'Standard payment',
          conditions: 'Payment is due within 45 days.',
        }),
      },
    );
    expect(presetUpdate.status).toBe(200);
    conditionPreset.conditions = 'Payment is due within 45 days.';
    const presetList = await fetch(`${baseUrl}/api/quote-condition-presets`, {
      headers: { cookie },
    });
    expect(presetList.status).toBe(200);
    await expect(presetList.json()).resolves.toEqual([conditionPreset]);

    const issuerA = {
      displayName: 'Froment Software A',
      addressLine1: '10 rue du Code',
      addressLine2: '',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      email: 'hello@example.test',
      phone: '+33 1 23 45 67 89',
      registrationNumber: '123 456 789 00012',
      vatNumber: 'FR00123456789',
    };
    const issuerResponse = await fetch(`${baseUrl}/api/issuer-settings`, {
      method: 'PUT',
      headers: writeHeaders,
      body: JSON.stringify(issuerA),
    });
    expect(issuerResponse.status).toBe(200);
    await expect(issuerResponse.json()).resolves.toEqual(issuerA);

    const clientResponse = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        ...emptyClientDetails,
        displayName: 'Quote client',
        addressLine1: '1 rue du Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        email: 'client@example.test',
      }),
    });
    expect(clientResponse.status).toBe(200);
    const client = Schema.decodeUnknownSync(ClientSummary)(await clientResponse.json());
    const clientAccessResponse = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: writeHeaders,
    });
    expect(clientAccessResponse.status).toBe(200);
    const clientAccess = (await clientAccessResponse.json()) as { accessIdentifier: string };
    const clientLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: clientAccess.accessIdentifier, mode: 'client' }),
    });
    expect(clientLogin.status).toBe(200);
    const clientCookie = clientLogin.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ');
    const createResponse = await fetch(`${baseUrl}/api/quotes`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        clientId: client.id,
        title: 'Initial quote',
        conditions: conditionPreset.conditions,
        lines: [
          {
            description: 'Consulting',
            quantityMilli: 1_500,
            unitPriceCents: 10_001,
            vatRateBasisPoints: 2_000,
          },
        ],
      }),
    });
    expect(createResponse.status).toBe(200);
    expect(createResponse.headers.get('cache-control')).toBe('no-store');
    const quote = Schema.decodeUnknownSync(QuoteDetail)(await createResponse.json());
    expect(quote).toMatchObject({
      version: 1,
      status: 'draft',
      currentRevision: {
        netTotalCents: 15_002,
        vatTotalCents: 3_000,
        totalCents: 18_002,
      },
    });
    expect(quote.currentRevision.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);
    expect(quote.revisions).toHaveLength(1);
    const hiddenDraftQuotes = await fetch(`${baseUrl}/api/client/quotes`, {
      headers: { cookie: clientCookie },
    });
    expect(hiddenDraftQuotes.status).toBe(200);
    expect(hiddenDraftQuotes.headers.get('cache-control')).toBe('no-store');
    await expect(hiddenDraftQuotes.json()).resolves.toEqual([]);
    const administratorClientEndpoint = await fetch(`${baseUrl}/api/client/quotes`, {
      headers: { cookie },
    });
    expect(administratorClientEndpoint.status).toBe(403);
    const presetDelete = await fetch(
      `${baseUrl}/api/quote-condition-presets/${conditionPreset.id}`,
      {
        method: 'DELETE',
        headers: writeHeaders,
      },
    );
    expect(presetDelete.status).toBe(200);
    await expect(presetDelete.json()).resolves.toEqual(conditionPreset);
    const quoteAfterPresetDelete = await fetch(`${baseUrl}/api/quotes/${quote.id}`, {
      headers: { cookie },
    });
    await expect(quoteAfterPresetDelete.json()).resolves.toMatchObject({
      currentRevision: { conditions: conditionPreset.conditions },
    });
    const firstPreview = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/1/preview`, {
      headers: { cookie },
    });
    expect(firstPreview.status).toBe(200);
    expect(firstPreview.headers.get('content-type')).toContain('text/html');
    expect(firstPreview.headers.get('cache-control')).toBe('no-store');
    expect(firstPreview.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(firstPreview.headers.get('x-content-type-options')).toBe('nosniff');
    const firstPreviewHtml = await firstPreview.text();
    expect(firstPreviewHtml).toContain('Froment Software A');
    expect(firstPreviewHtml).toContain('1 rue du Test');

    const pdfRender = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      method: 'POST',
      headers: writeHeaders,
    });
    expect(pdfRender.status).toBe(200);
    const artifact = (await pdfRender.json()) as {
      readonly id: string;
      readonly byteSize: number;
      readonly sha256: string;
    };
    expect(artifact.byteSize).toBeGreaterThan(1_000);
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    const repeatedPdfRender = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      method: 'POST',
      headers: writeHeaders,
    });
    await expect(repeatedPdfRender.json()).resolves.toMatchObject({ id: artifact.id });
    const pdfDownload = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      headers: { cookie },
    });
    expect(pdfDownload.status).toBe(200);
    expect(pdfDownload.headers.get('content-type')).toContain('application/pdf');
    expect(pdfDownload.headers.get('content-disposition')).toContain(`${quote.reference}-v1.pdf`);
    const pdf = new Uint8Array(await pdfDownload.arrayBuffer());
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.byteLength).toBe(artifact.byteSize);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(artifact.sha256);

    const issuerB = { ...issuerA, displayName: 'Froment Software B' };
    const issuerUpdate = await fetch(`${baseUrl}/api/issuer-settings`, {
      method: 'PUT',
      headers: writeHeaders,
      body: JSON.stringify(issuerB),
    });
    expect(issuerUpdate.status).toBe(200);

    const oversizedAmount = await fetch(`${baseUrl}/api/quotes`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        clientId: client.id,
        title: 'Oversized quote',
        conditions: '',
        lines: [
          {
            description: 'Oversized line',
            quantityMilli: Number.MAX_SAFE_INTEGER,
            unitPriceCents: Number.MAX_SAFE_INTEGER,
            vatRateBasisPoints: 0,
          },
        ],
      }),
    });
    expect(oversizedAmount.status).toBe(422);
    await expect(oversizedAmount.json()).resolves.toMatchObject({
      code: 'quote.amount_too_large',
    });

    const revisionPayload = {
      expectedVersion: 1,
      title: 'Revised quote',
      conditions: '',
      lines: [
        {
          description: 'Delivery',
          quantityMilli: 1,
          unitPriceCents: 500,
          vatRateBasisPoints: 5_000,
        },
      ],
    };
    const revisionResponse = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(revisionPayload),
    });
    expect(revisionResponse.status).toBe(200);
    const revised = Schema.decodeUnknownSync(QuoteDetail)(await revisionResponse.json());
    expect(revised.version).toBe(2);
    expect(revised.currentRevision).toMatchObject({ title: 'Revised quote', totalCents: 2 });
    expect(revised.revisions).toHaveLength(2);
    const unchangedFirstPreview = await fetch(
      `${baseUrl}/api/quotes/${quote.id}/revisions/1/preview`,
      { headers: { cookie } },
    );
    expect(await unchangedFirstPreview.text()).toContain('Froment Software A');
    const secondPreview = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/2/preview`, {
      headers: { cookie },
    });
    expect(await secondPreview.text()).toContain('Froment Software B');

    const conflict = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(revisionPayload),
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      code: 'quote.version_conflict',
      currentVersion: 2,
    });

    const anonymousSend = await fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(anonymousSend.status).toBe(403);

    const missingSendCsrf = await fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(missingSendCsrf.status).toBe(403);

    const missingCurrentPdf = await fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(missingCurrentPdf.status).toBe(409);
    await expect(missingCurrentPdf.json()).resolves.toMatchObject({ code: 'quote.pdf_required' });

    const staleSend = await fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(staleSend.status).toBe(409);
    await expect(staleSend.json()).resolves.toMatchObject({
      code: 'quote.version_conflict',
      currentVersion: 2,
    });

    const secondPdfRender = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions/2/pdf`, {
      method: 'POST',
      headers: writeHeaders,
    });
    expect(secondPdfRender.status).toBe(200);
    const secondArtifact = (await secondPdfRender.json()) as {
      readonly byteSize: number;
      readonly sha256: string;
    };

    const sendRequests = await Promise.all([
      fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
      fetch(`${baseUrl}/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
    ]);
    expect(sendRequests.map((response) => response.status).sort()).toEqual([200, 409]);
    const sentResponse = sendRequests.find((response) => response.status === 200);
    if (sentResponse === undefined) throw new Error('The successful quote send is unavailable.');
    const sent = (await sentResponse.json()) as {
      quoteId: string;
      revisionId: string;
      status: string;
      version: number;
      link: { id: string; url: string; expiresAt: string };
    };
    expect(sent).toMatchObject({
      quoteId: quote.id,
      revisionId: revised.currentRevision.id,
      status: 'sent',
      version: 2,
      link: {
        id: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
        url: expect.stringMatching(
          new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/quote#[A-Za-z0-9_-]{43}$`),
        ),
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/),
      },
    });

    const linkToken = new URL(sent.link.url).hash.slice(1);
    if (linkToken.length === 0) throw new Error('The quote link token is unavailable.');
    const publicHeaders = { 'content-type': 'application/json', origin: baseUrl };
    const consultation = await fetch(`${baseUrl}/api/public/quote-link`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token: linkToken }),
    });
    expect(consultation.status).toBe(200);
    expect(consultation.headers.get('cache-control')).toBe('no-store');
    expect(consultation.headers.get('referrer-policy')).toBe('no-referrer');
    await expect(consultation.json()).resolves.toMatchObject({
      status: 'sent',
      canSign: true,
      snapshot: {
        quoteId: quote.id,
        revisionId: revised.currentRevision.id,
        title: 'Revised quote',
        issuer: { displayName: 'Froment Software B' },
        client: { displayName: 'Quote client' },
        totalCents: 2,
      },
    });

    const publicPdf = await fetch(`${baseUrl}/api/public/quote-link/pdf`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token: linkToken }),
    });
    expect(publicPdf.status).toBe(200);
    expect(publicPdf.headers.get('cache-control')).toBe('no-store');
    expect(publicPdf.headers.get('referrer-policy')).toBe('no-referrer');
    expect(publicPdf.headers.get('x-content-type-options')).toBe('nosniff');
    expect(publicPdf.headers.get('content-disposition')).toContain(`${quote.reference}-v2.pdf`);
    const publicPdfContent = new Uint8Array(await publicPdf.arrayBuffer());
    expect(new TextDecoder().decode(publicPdfContent.slice(0, 5))).toBe('%PDF-');
    expect(publicPdfContent.byteLength).toBe(secondArtifact.byteSize);
    expect(createHash('sha256').update(publicPdfContent).digest('hex')).toBe(secondArtifact.sha256);

    const unknownToken = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
    const unknownConsultation = await fetch(`${baseUrl}/api/public/quote-link`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token: unknownToken }),
    });
    expect(unknownConsultation.status).toBe(404);
    await expect(unknownConsultation.json()).resolves.toMatchObject({
      code: 'quote_link.not_found',
    });

    const sentRevision = await fetch(`${baseUrl}/api/quotes/${quote.id}/revisions`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ ...revisionPayload, expectedVersion: 2 }),
    });
    expect(sentRevision.status).toBe(409);
    await expect(sentRevision.json()).resolves.toMatchObject({ code: 'quote.not_editable' });

    const signaturePayload = {
      token: linkToken,
      signerName: 'Ada Lovelace',
      consent: true,
      signature: { kind: 'typed', value: 'Ada Lovelace' },
    };
    const signatureResponses = await Promise.all([
      fetch(`${baseUrl}/api/public/quote-link/signature`, {
        method: 'POST',
        headers: { ...publicHeaders, 'user-agent': 'Froment acceptance test' },
        body: JSON.stringify(signaturePayload),
      }),
      fetch(`${baseUrl}/api/public/quote-link/signature`, {
        method: 'POST',
        headers: { ...publicHeaders, 'user-agent': 'Froment acceptance test' },
        body: JSON.stringify(signaturePayload),
      }),
    ]);
    expect(signatureResponses.map((response) => response.status).sort()).toEqual([200, 409]);
    const acceptedResponse = signatureResponses.find((response) => response.status === 200);
    if (acceptedResponse === undefined)
      throw new Error('The quote acceptance result is unavailable.');
    const accepted = (await acceptedResponse.json()) as {
      quoteId: string;
      revisionId: string;
      signatureId: string;
      orderId: string;
      orderReference: string;
      quoteReference: string;
      status: string;
      acceptedAt: string;
      evidenceSha256: string;
    };
    expect(accepted).toMatchObject({
      quoteId: quote.id,
      revisionId: revised.currentRevision.id,
      signatureId: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      orderId: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      orderReference: 'CO-2026-000001',
      quoteReference: quote.reference,
      status: 'accepted',
      acceptedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/),
      evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const acceptedClientQuotesResponse = await fetch(`${baseUrl}/api/client/quotes`, {
      headers: { cookie: clientCookie },
    });
    const acceptedClientQuotes = Schema.decodeUnknownSync(ClientQuoteList)(
      await acceptedClientQuotesResponse.json(),
    );
    expect(acceptedClientQuotes).toEqual([
      {
        id: quote.id,
        reference: quote.reference,
        status: 'accepted',
        title: 'Revised quote',
        currency: 'EUR',
        totalCents: 2,
        updatedAt: accepted.acceptedAt,
        pdfAvailable: true,
      },
    ]);
    const acceptedClientOrdersResponse = await fetch(`${baseUrl}/api/client/orders`, {
      headers: { cookie: clientCookie },
    });
    const acceptedClientOrders = Schema.decodeUnknownSync(ClientOrderList)(
      await acceptedClientOrdersResponse.json(),
    );
    expect(acceptedClientOrders).toEqual([
      {
        id: accepted.orderId,
        reference: accepted.orderReference,
        quoteId: quote.id,
        quoteReference: quote.reference,
        status: 'confirmed',
        title: 'Revised quote',
        currency: 'EUR',
        totalCents: 2,
        createdAt: accepted.acceptedAt,
        invoiceId: null,
        pdfAvailable: true,
      },
    ]);
    const clientOrderPdfResponse = await fetch(
      `${baseUrl}/api/client/orders/${accepted.orderId}/pdf`,
      { headers: { cookie: clientCookie } },
    );
    expect(clientOrderPdfResponse.status).toBe(200);
    const clientOrderPdf = Buffer.from(await clientOrderPdfResponse.arrayBuffer());
    expect(clientOrderPdf.subarray(0, 5).toString()).toBe('%PDF-');
    const rejectedSignature = signatureResponses.find((response) => response.status === 409);
    await expect(rejectedSignature?.json()).resolves.toMatchObject({
      code: 'quote_link.not_signable',
    });

    const acceptedConsultation = await fetch(`${baseUrl}/api/public/quote-link`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token: linkToken }),
    });
    await expect(acceptedConsultation.json()).resolves.toMatchObject({
      status: 'accepted',
      canSign: false,
    });

    const anonymousOrderList = await fetch(`${baseUrl}/api/orders`);
    expect(anonymousOrderList.status).toBe(401);
    const missingOrderPdf = await fetch(`${baseUrl}/api/orders/${quote.id}/pdf`, {
      headers: { cookie },
    });
    expect(missingOrderPdf.status).toBe(404);
    const inaccessibleClientOrderPdf = await fetch(`${baseUrl}/api/client/orders/${quote.id}/pdf`, {
      headers: { cookie: clientCookie },
    });
    expect(inaccessibleClientOrderPdf.status).toBe(404);
    const orderListResponse = await fetch(`${baseUrl}/api/orders`, { headers: { cookie } });
    expect(orderListResponse.status).toBe(200);
    expect(orderListResponse.headers.get('cache-control')).toBe('no-store');
    const orderList = Schema.decodeUnknownSync(OrderList)(await orderListResponse.json());
    expect(orderList).toEqual([
      {
        id: accepted.orderId,
        reference: accepted.orderReference,
        quoteId: quote.id,
        quoteReference: quote.reference,
        revisionId: revised.currentRevision.id,
        clientId: client.id,
        clientDisplayName: 'Quote client',
        title: 'Revised quote',
        currency: 'EUR',
        totalCents: 2,
        createdAt: accepted.acceptedAt,
        invoiceId: null,
      },
    ]);

    const orderPreview = await fetch(`${baseUrl}/api/orders/${accepted.orderId}/preview`, {
      headers: { cookie },
    });
    expect(orderPreview.status).toBe(200);
    expect(orderPreview.headers.get('content-security-policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
    const orderPreviewHtml = await orderPreview.text();
    expect(orderPreviewHtml).toContain(accepted.orderReference);
    expect(orderPreviewHtml).toContain(quote.reference);

    const orderPdfResponses = await Promise.all([
      fetch(`${baseUrl}/api/orders/${accepted.orderId}/pdf`, {
        method: 'POST',
        headers: writeHeaders,
      }),
      fetch(`${baseUrl}/api/orders/${accepted.orderId}/pdf`, {
        method: 'POST',
        headers: writeHeaders,
      }),
    ]);
    expect(orderPdfResponses.map((response) => response.status)).toEqual([200, 200]);
    const orderArtifacts = (await Promise.all(
      orderPdfResponses.map((response) => response.json()),
    )) as Array<{ id: string; orderId: string; kind: string; sha256: string }>;
    expect(orderArtifacts[0]).toEqual(orderArtifacts[1]);
    expect(orderArtifacts[0]).toMatchObject({
      orderId: accepted.orderId,
      kind: 'order-pdf',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const orderPdfDownload = await fetch(`${baseUrl}/api/orders/${accepted.orderId}/pdf`, {
      headers: { cookie },
    });
    expect(orderPdfDownload.status).toBe(200);
    expect(orderPdfDownload.headers.get('content-disposition')).toContain(
      `${accepted.orderReference}.pdf`,
    );
    const orderPdf = Buffer.from(await orderPdfDownload.arrayBuffer());
    expect(orderPdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(createHash('sha256').update(orderPdf).digest('hex')).toBe(orderArtifacts[0]?.sha256);
    const ordersWithPdf = await fetch(`${baseUrl}/api/client/orders`, {
      headers: { cookie: clientCookie },
    });
    await expect(ordersWithPdf.json()).resolves.toEqual([
      { ...acceptedClientOrders[0], pdfAvailable: true },
    ]);
    expect(clientOrderPdf).toEqual(orderPdf);

    const invoiceCreatePayload = {
      orderId: accepted.orderId,
      serviceDate: '2026-08-20',
      dueDate: '2026-09-19',
      paymentTerms: 'Payment due within 30 days.',
    };
    for (const invalidDate of ['2026-02-30', '2026-13-01', '2026-01-00']) {
      const invalidInvoiceCreate = await fetch(`${baseUrl}/api/invoices`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ ...invoiceCreatePayload, serviceDate: invalidDate }),
      });
      expect(invalidInvoiceCreate.status).toBe(422);
      await expect(invalidInvoiceCreate.json()).resolves.toMatchObject({
        code: 'invoice.invalid_dates',
      });
    }
    const reversedInvoiceDates = await fetch(`${baseUrl}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        ...invoiceCreatePayload,
        serviceDate: '2026-09-20',
        dueDate: '2026-09-19',
      }),
    });
    expect(reversedInvoiceDates.status).toBe(422);
    await expect(reversedInvoiceDates.json()).resolves.toMatchObject({
      code: 'invoice.invalid_dates',
    });
    const invoiceCreate = await fetch(`${baseUrl}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(invoiceCreatePayload),
    });
    expect(invoiceCreate.status).toBe(200);
    const invoice = (await invoiceCreate.json()) as {
      id: string;
      orderId: string;
      status: string;
      version: number;
      invoiceNumber: string | null;
      currentRevision: {
        title: string;
        serviceDate: string;
        dueDate: string;
        totalCents: number;
        lines: Array<{
          description: string;
          quantityMilli: number;
          unitPriceCents: number;
          vatRateBasisPoints: number;
        }>;
      };
    };
    expect(invoice).toMatchObject({
      id: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      orderId: accepted.orderId,
      status: 'draft',
      version: 1,
      invoiceNumber: null,
      currentRevision: {
        title: 'Revised quote',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        totalCents: 2,
      },
    });
    const hiddenDraftInvoices = await fetch(`${baseUrl}/api/client/invoices`, {
      headers: { cookie: clientCookie },
    });
    expect(hiddenDraftInvoices.status).toBe(200);
    await expect(hiddenDraftInvoices.json()).resolves.toEqual([]);
    const orderWithDraftInvoice = await fetch(`${baseUrl}/api/client/orders`, {
      headers: { cookie: clientCookie },
    });
    await expect(orderWithDraftInvoice.json()).resolves.toEqual([
      { ...acceptedClientOrders[0], invoiceId: null, pdfAvailable: true },
    ]);
    const invoicedOrderListResponse = await fetch(`${baseUrl}/api/orders`, {
      headers: { cookie },
    });
    const invoicedOrderList = Schema.decodeUnknownSync(OrderList)(
      await invoicedOrderListResponse.json(),
    );
    expect(invoicedOrderList).toEqual([{ ...orderList[0], invoiceId: invoice.id }]);
    const duplicateInvoice = await fetch(`${baseUrl}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify(invoiceCreatePayload),
    });
    expect(duplicateInvoice.status).toBe(409);
    await expect(duplicateInvoice.json()).resolves.toMatchObject({
      code: 'invoice.already_exists',
      invoiceId: invoice.id,
    });

    const revisedInvoiceResponse = await fetch(`${baseUrl}/api/invoices/${invoice.id}/revisions`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({
        expectedVersion: 1,
        title: 'Final invoice',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        paymentTerms: 'Payment due within 30 days.',
        lines: invoice.currentRevision.lines.map((line) => ({
          description: line.description,
          quantityMilli: line.quantityMilli,
          unitPriceCents: line.unitPriceCents,
          vatRateBasisPoints: line.vatRateBasisPoints,
        })),
      }),
    });
    expect(revisedInvoiceResponse.status).toBe(200);
    const revisedInvoice = (await revisedInvoiceResponse.json()) as {
      version: number;
      currentRevision: { title: string };
    };
    expect(revisedInvoice).toMatchObject({
      version: 2,
      currentRevision: { title: 'Final invoice' },
    });

    const issueRequests = await Promise.all([
      fetch(`${baseUrl}/api/invoices/${invoice.id}/issue`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
      fetch(`${baseUrl}/api/invoices/${invoice.id}/issue`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
    ]);
    const issueStatuses = issueRequests.map((response) => response.status);
    if (issueStatuses.some((status) => status !== 200)) {
      throw new Error(
        `Invoice issue failed: ${JSON.stringify(await Promise.all(issueRequests.map((response) => response.clone().text())))}\n${serverOutput.slice(-5_000)}`,
      );
    }
    const issueResults = (await Promise.all(
      issueRequests.map((response) => response.json()),
    )) as Array<{
      invoiceId: string;
      revisionId: string;
      version: number;
      status: string;
      invoiceNumber: string;
      issuedAt: string;
    }>;
    expect(issueResults[0]).toEqual(issueResults[1]);
    expect(issueResults[0]).toMatchObject({
      invoiceId: invoice.id,
      revisionId: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      version: 3,
      status: 'issued',
      invoiceNumber: 'FA-2026-000001',
      issuedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/),
    });
    const invalidIssueRetry = await fetch(`${baseUrl}/api/invoices/${invoice.id}/issue`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ expectedVersion: 99 }),
    });
    expect(invalidIssueRetry.status).toBe(409);
    await expect(invalidIssueRetry.json()).resolves.toMatchObject({
      code: 'invoice.version_conflict',
      currentVersion: 3,
    });

    const issuedInvoicePdfDownload = await fetch(
      `${baseUrl}/api/invoices/${invoice.id}/revisions/3/pdf`,
      { headers: { cookie } },
    );
    expect(issuedInvoicePdfDownload.status).toBe(200);
    const issuedInvoicePdf = Buffer.from(await issuedInvoicePdfDownload.arrayBuffer());
    expect(issuedInvoicePdf.subarray(0, 5).toString()).toBe('%PDF-');

    const issuedClientInvoices = await fetch(`${baseUrl}/api/client/invoices`, {
      headers: { cookie: clientCookie },
    });
    await expect(issuedClientInvoices.json()).resolves.toEqual([
      expect.objectContaining({ id: invoice.id, pdfAvailable: true }),
    ]);
    const issuedClientInvoicePdf = await fetch(`${baseUrl}/api/client/invoices/${invoice.id}/pdf`, {
      headers: { cookie: clientCookie },
    });
    expect(issuedClientInvoicePdf.status).toBe(200);
    expect(Buffer.from(await issuedClientInvoicePdf.arrayBuffer())).toEqual(issuedInvoicePdf);

    const invoicePreview = await fetch(
      `${baseUrl}/api/invoices/${invoice.id}/revisions/3/preview`,
      { headers: { cookie } },
    );
    expect(invoicePreview.status).toBe(200);
    expect(invoicePreview.headers.get('content-type')).toContain('text/html');
    expect(invoicePreview.headers.get('content-security-policy')).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
    await expect(invoicePreview.text()).resolves.toEqual(expect.stringContaining('FA-2026-000001'));

    const invoicePdfResponses = await Promise.all([
      fetch(`${baseUrl}/api/invoices/${invoice.id}/revisions/3/pdf`, {
        method: 'POST',
        headers: writeHeaders,
      }),
      fetch(`${baseUrl}/api/invoices/${invoice.id}/revisions/3/pdf`, {
        method: 'POST',
        headers: writeHeaders,
      }),
    ]);
    expect(invoicePdfResponses.map((response) => response.status)).toEqual([200, 200]);
    const invoiceArtifacts = (await Promise.all(
      invoicePdfResponses.map((response) => response.json()),
    )) as Array<{
      id: string;
      invoiceRevisionId: string;
      kind: string;
      contentType: string;
      byteSize: number;
      sha256: string;
    }>;
    expect(invoiceArtifacts[0]).toEqual(invoiceArtifacts[1]);
    expect(invoiceArtifacts[0]).toMatchObject({
      invoiceRevisionId: issueResults[0]?.revisionId,
      kind: 'invoice-pdf',
      contentType: 'application/pdf',
      byteSize: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const invoicePdfDownload = await fetch(
      `${baseUrl}/api/invoices/${invoice.id}/revisions/3/pdf`,
      { headers: { cookie } },
    );
    expect(invoicePdfDownload.status).toBe(200);
    expect(invoicePdfDownload.headers.get('content-type')).toContain('application/pdf');
    expect(invoicePdfDownload.headers.get('content-disposition')).toContain(
      `FA-2026-000001-v3.pdf`,
    );
    const invoicePdf = Buffer.from(await invoicePdfDownload.arrayBuffer());
    expect(invoicePdf).toEqual(issuedInvoicePdf);
    expect(invoicePdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(invoicePdf.byteLength).toBe(invoiceArtifacts[0]?.byteSize);
    expect(createHash('sha256').update(invoicePdf).digest('hex')).toBe(invoiceArtifacts[0]?.sha256);

    const clientInvoiceListResponse = await fetch(`${baseUrl}/api/client/invoices`, {
      headers: { cookie: clientCookie },
    });
    const clientInvoices = Schema.decodeUnknownSync(ClientInvoiceList)(
      await clientInvoiceListResponse.json(),
    );
    expect(clientInvoices).toEqual([
      expect.objectContaining({
        id: invoice.id,
        orderId: accepted.orderId,
        status: 'issued',
        invoiceNumber: 'FA-2026-000001',
        title: 'Final invoice',
        pdfAvailable: true,
      }),
    ]);
    const orderWithIssuedInvoice = await fetch(`${baseUrl}/api/client/orders`, {
      headers: { cookie: clientCookie },
    });
    await expect(orderWithIssuedInvoice.json()).resolves.toEqual([
      { ...acceptedClientOrders[0], invoiceId: invoice.id, pdfAvailable: true },
    ]);
    const clientQuotePdf = await fetch(`${baseUrl}/api/client/quotes/${quote.id}/pdf`, {
      headers: { cookie: clientCookie },
    });
    expect(clientQuotePdf.status).toBe(200);
    expect(clientQuotePdf.headers.get('cache-control')).toBe('no-store');
    expect(clientQuotePdf.headers.get('content-disposition')).toContain(
      `${quote.reference}-v2.pdf`,
    );
    expect(Buffer.from(await clientQuotePdf.arrayBuffer())).toEqual(Buffer.from(publicPdfContent));
    const clientInvoicePdf = await fetch(`${baseUrl}/api/client/invoices/${invoice.id}/pdf`, {
      headers: { cookie: clientCookie },
    });
    expect(clientInvoicePdf.status).toBe(200);
    expect(clientInvoicePdf.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await clientInvoicePdf.arrayBuffer())).toEqual(invoicePdf);

    const foreignClientResponse = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ ...emptyClientDetails, displayName: 'Foreign tenant' }),
    });
    const foreignClient = Schema.decodeUnknownSync(ClientSummary)(
      await foreignClientResponse.json(),
    );
    const foreignAccessResponse = await fetch(`${baseUrl}/api/clients/${foreignClient.id}/access`, {
      method: 'POST',
      headers: writeHeaders,
    });
    const foreignAccess = (await foreignAccessResponse.json()) as { accessIdentifier: string };
    const foreignLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: foreignAccess.accessIdentifier, mode: 'client' }),
    });
    const foreignCookie = foreignLogin.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ');
    for (const path of ['quotes', 'orders', 'invoices']) {
      const foreignList = await fetch(`${baseUrl}/api/client/${path}`, {
        headers: { cookie: foreignCookie },
      });
      expect(foreignList.status).toBe(200);
      await expect(foreignList.json()).resolves.toEqual([]);
    }
    for (const path of [`quotes/${quote.id}/pdf`, `invoices/${invoice.id}/pdf`]) {
      const foreignPdf = await fetch(`${baseUrl}/api/client/${path}`, {
        headers: { cookie: foreignCookie },
      });
      expect(foreignPdf.status).toBe(404);
      await expect(foreignPdf.json()).resolves.toMatchObject({ code: 'document.not_found' });
    }

    const invoiceList = await fetch(`${baseUrl}/api/invoices`, { headers: { cookie } });
    expect(invoiceList.status).toBe(200);
    await expect(invoiceList.json()).resolves.toMatchObject([
      {
        id: invoice.id,
        orderId: accepted.orderId,
        status: 'issued',
        version: 3,
        invoiceNumber: 'FA-2026-000001',
        title: 'Final invoice',
      },
    ]);

    const invoiceSqlite = new Sqlite(databaseFilename);
    expect(
      invoiceSqlite
        .prepare(
          "select next_value from business_reference_counters where kind = 'invoice' and year = 2026",
        )
        .pluck()
        .get(),
    ).toBe(2);
    expect(
      invoiceSqlite
        .prepare(
          "select count(*) from audit_events where action = 'invoice.issued' and resource_id = ?",
        )
        .pluck()
        .get(invoice.id),
    ).toBe(1);
    expect(
      invoiceSqlite
        .prepare(
          `select count(*) from audit_events
           where action = 'document.rendered' and json_extract(metadata, '$.invoiceId') = ?`,
        )
        .pluck()
        .get(invoice.id),
    ).toBe(1);
    expect(() =>
      invoiceSqlite
        .prepare('update invoice_revisions set title = title where invoice_id = ?')
        .run(invoice.id),
    ).toThrow('invoice revisions are append-only');
    expect(() =>
      invoiceSqlite
        .prepare(
          `delete from invoice_lines where revision_id in
           (select id from invoice_revisions where invoice_id = ?)`,
        )
        .run(invoice.id),
    ).toThrow('invoice lines are append-only');

    const terminalResponses = await Promise.all([
      fetch(`${baseUrl}/api/invoices/${invoice.id}/mark-paid`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 3 }),
      }),
      fetch(`${baseUrl}/api/invoices/${invoice.id}/void`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 3 }),
      }),
    ]);
    expect(terminalResponses.map((response) => response.status).sort()).toEqual([200, 409]);
    const terminalBodies = (await Promise.all(
      terminalResponses.map((response) => response.json()),
    )) as Array<{
      code?: string;
      currentStatus?: 'paid' | 'void';
      status?: 'paid' | 'void';
      paidAt?: string | null;
      voidedAt?: string | null;
    }>;
    const terminalInvoice = terminalBodies.find((body) => body.status !== undefined);
    const rejectedTransition = terminalBodies.find((body) => body.code !== undefined);
    expect(terminalInvoice?.status).toMatch(/^(paid|void)$/);
    expect(rejectedTransition).toMatchObject({
      code: 'invoice.invalid_transition',
      currentStatus: terminalInvoice?.status,
    });
    expect(
      terminalInvoice?.status === 'paid' ? terminalInvoice.paidAt : terminalInvoice?.voidedAt,
    ).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/));

    const repeatedTerminal = await fetch(
      `${baseUrl}/api/invoices/${invoice.id}/${terminalInvoice?.status === 'paid' ? 'mark-paid' : 'void'}`,
      {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify({ expectedVersion: 3 }),
      },
    );
    expect(repeatedTerminal.status).toBe(200);
    await expect(repeatedTerminal.json()).resolves.toMatchObject({
      status: terminalInvoice?.status,
    });
    expect(
      invoiceSqlite
        .prepare(
          "select count(*) from audit_events where action in ('invoice.marked-paid', 'invoice.voided') and resource_id = ?",
        )
        .pluck()
        .get(invoice.id),
    ).toBe(1);

    const issueTerminal = await fetch(`${baseUrl}/api/invoices/${invoice.id}/issue`, {
      method: 'POST',
      headers: writeHeaders,
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(issueTerminal.status).toBe(409);
    await expect(issueTerminal.json()).resolves.toMatchObject({
      code: 'invoice.invalid_transition',
      currentStatus: terminalInvoice?.status,
    });
    invoiceSqlite.close();

    const list = await fetch(`${baseUrl}/api/quotes`, { headers: { cookie } });
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject([
      { id: quote.id, status: 'accepted', version: 2 },
    ]);
    const get = await fetch(`${baseUrl}/api/quotes/${quote.id}`, { headers: { cookie } });
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      id: quote.id,
      status: 'accepted',
      revisions: [{ version: 1 }, { version: 2 }],
    });

    expect(serverOutput).not.toContain(linkToken);
    expect(serverOutput).not.toContain(unknownToken);
    const linkSqlite = new Sqlite(databaseFilename);
    const storedLink = linkSqlite
      .prepare(
        'select typeof(token_hmac) as storageType, length(token_hmac) as byteSize from quote_links where id = ?',
      )
      .get(sent.link.id);
    expect(storedLink).toEqual({ storageType: 'blob', byteSize: 32 });
    expect(
      linkSqlite
        .prepare('select count(*) from quote_links where token_hmac = ?')
        .pluck()
        .get(linkToken),
    ).toBe(0);
    const storedSignature = linkSqlite
      .prepare(
        `select signer_name as signerName, consent, signature_kind as signatureKind,
                signature_value as signatureValue, ip_address as ipAddress,
                user_agent as userAgent, snapshot_sha256 as snapshotSha256,
                pdf_sha256 as pdfSha256, audit_event_id as auditEventId,
                evidence_content as evidenceContent, evidence_sha256 as evidenceSha256
         from quote_signatures where id = ?`,
      )
      .get(accepted.signatureId) as {
      signerName: string;
      consent: number;
      signatureKind: string;
      signatureValue: string;
      ipAddress: string;
      userAgent: string;
      snapshotSha256: string;
      pdfSha256: string;
      auditEventId: string;
      evidenceContent: Buffer;
      evidenceSha256: string;
    };
    expect(storedSignature).toMatchObject({
      signerName: 'Ada Lovelace',
      consent: 1,
      signatureKind: 'typed',
      signatureValue: 'Ada Lovelace',
      ipAddress: expect.stringMatching(/127\.0\.0\.1$/),
      userAgent: 'Froment acceptance test',
      pdfSha256: secondArtifact.sha256,
      evidenceSha256: accepted.evidenceSha256,
    });
    expect(createHash('sha256').update(storedSignature.evidenceContent).digest('hex')).toBe(
      storedSignature.evidenceSha256,
    );
    const evidence = JSON.parse(storedSignature.evidenceContent.toString()) as {
      quoteId: string;
      revisionId: string;
      linkId: string;
      signatureId: string;
      orderId: string;
      auditEventId: string;
      snapshotSha256: string;
      pdfSha256: string;
      snapshot: { title: string };
    };
    expect(evidence).toMatchObject({
      quoteId: quote.id,
      revisionId: revised.currentRevision.id,
      linkId: sent.link.id,
      signatureId: accepted.signatureId,
      orderId: accepted.orderId,
      auditEventId: storedSignature.auditEventId,
      snapshotSha256: storedSignature.snapshotSha256,
      pdfSha256: secondArtifact.sha256,
      snapshot: { title: 'Revised quote' },
    });
    expect(
      linkSqlite
        .prepare('select count(*) from quote_signatures where quote_id = ?')
        .pluck()
        .get(quote.id),
    ).toBe(1);
    expect(
      linkSqlite.prepare('select count(*) from orders where quote_id = ?').pluck().get(quote.id),
    ).toBe(1);
    expect(
      linkSqlite
        .prepare('select consumed_at is not null from quote_links where id = ?')
        .pluck()
        .get(sent.link.id),
    ).toBe(1);
    linkSqlite
      .prepare('update quote_links set revoked_at = ? where id = ?')
      .run(Date.now(), sent.link.id);
    expect(
      (
        await fetch(`${baseUrl}/api/public/quote-link`, {
          method: 'POST',
          headers: publicHeaders,
          body: JSON.stringify({ token: linkToken }),
        })
      ).status,
    ).toBe(404);
    linkSqlite
      .prepare('update quote_links set revoked_at = null, expires_at = created_at + 1 where id = ?')
      .run(sent.link.id);
    linkSqlite.close();
    expect(
      (
        await fetch(`${baseUrl}/api/public/quote-link`, {
          method: 'POST',
          headers: publicHeaders,
          body: JSON.stringify({ token: linkToken }),
        })
      ).status,
    ).toBe(404);

    const archive = await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
      method: 'POST',
      headers: writeHeaders,
    });
    expect(archive.status).toBe(200);

    const auditSqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      auditSqlite
        .prepare(
          `select action from audit_events
           where resource_type = 'quote' and resource_id = ? order by occurred_at, id`,
        )
        .pluck()
        .all(quote.id),
    ).toEqual(['quote.created', 'quote.revised', 'quote.sent', 'quote.accepted']);
    expect(
      auditSqlite
        .prepare(
          `select count(*) from audit_events
           where action = 'document.rendered' and json_extract(metadata, '$.quoteId') = ?`,
        )
        .pluck()
        .get(quote.id),
    ).toBe(2);
    expect(
      auditSqlite
        .prepare('select count(*) from audit_events where metadata like ?')
        .pluck()
        .get(`%${linkToken}%`),
    ).toBe(0);
    expect(
      auditSqlite
        .prepare("select count(*) from audit_events where action = 'issuer.updated'")
        .pluck()
        .get(),
    ).toBe(2);
    auditSqlite.close();
  }, 15_000);

  it('rejects oversized request bodies', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ accessIdentifier: 'A'.repeat(33_000), mode: 'administrator' }),
    });
    expect(response.status).toBe(413);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ code: 'request.too_large' });
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
  });

  it('returns 413 for an oversized chunked body', async () => {
    const response = await new Promise<{ readonly body: string; readonly status: number }>(
      (resolve, reject) => {
        const request = httpRequest(
          `${baseUrl}/api/auth/login`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: baseUrl },
          },
          (incoming) => {
            const chunks: Array<Buffer> = [];
            incoming.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            incoming.on('end', () =>
              resolve({
                body: Buffer.concat(chunks).toString('utf8'),
                status: incoming.statusCode ?? 0,
              }),
            );
          },
        );
        request.on('error', reject);
        request.write('A'.repeat(17_000));
        request.end('B'.repeat(17_000));
      },
    );

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({ code: 'request.too_large' });
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
  });

  it('serves a static file', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Froment Software');
  });

  it('serves the application shell for refreshed back-office routes', async () => {
    const response = await fetch(`${baseUrl}/backoffice/login/client`, {
      headers: { accept: 'text/html' },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<app-root></app-root>');
    expect(html).not.toContain('ng-server-context="ssg"');
    expect(html).not.toContain('Audit et rénovation de logiciels métier.');
  });

  it('bootstraps the client login route from the application shell', async () => {
    const browser = await chromium.launch({ executablePath: process.env['CHROMIUM_PATH'] });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/backoffice/login/client`);
      await page.locator('#back-office-title').waitFor();

      expect(await page.locator('#back-office-title').textContent()).toBeTruthy();
      expect(await page.locator('#client-tab').getAttribute('aria-current')).toBe('page');
      await page.locator('#back-office-access-identifier').waitFor();
      expect(await page.locator('main app-home').count()).toBe(0);
    } finally {
      await browser.close();
    }
  });

  it('serves a prerendered route', async () => {
    const response = await fetch(`${baseUrl}/about`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('ng-server-context="ssg"');
    expect(html).toContain('<app-about');
  });

  it('returns 404 for an unknown path', async () => {
    const response = await fetch(`${baseUrl}/missing`);
    expect(response.status).toBe(404);
  });
});
