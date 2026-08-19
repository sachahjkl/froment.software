import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

import { Api } from '@froment/contracts';
import Sqlite from 'better-sqlite3';
import { Effect } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { HttpApiClient } from 'effect/unstable/httpapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

const waitForServer = async (url: string, process: ChildProcess) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`The server stopped with exit code ${process.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('The server did not start before the timeout.');
};

describe('HTTP server', () => {
  let baseUrl: string;
  let administratorAccessIdentifier: string | undefined;
  let databaseFilename: string;
  let server: ChildProcess;
  let staticRoot: string;

  beforeAll(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'froment-api-'));
    await writeFile(join(staticRoot, 'index.html'), '<h1>Froment Software</h1>');
    await mkdir(join(staticRoot, 'about'));
    await writeFile(join(staticRoot, 'about', 'index.html'), '<h1>About</h1>');
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    databaseFilename = join(staticRoot, 'database.sqlite');
    server = spawn(process.execPath, ['dist/main.cjs'], {
      cwd: join(import.meta.dirname, '..'),
      env: {
        ...process.env,
        ACCESS_HMAC_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        BOOTSTRAP_PASSWORD_SHA512:
          'ee509509a3a15f6a7224fdf24525275f2cfc9802d369266eb5797ad12cfcbaaba9e0a13673063908cc41de82c35db7e16871f3185ecdbf104b67402e95e5b5f9',
        DATABASE_PATH: databaseFilename,
        MIGRATIONS_ROOT: join(import.meta.dirname, '..', 'drizzle'),
        PORT: String(port),
        STATIC_ROOT: staticRoot,
        SESSION_HMAC_KEY: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      },
      stdio: 'pipe',
    });
    await waitForServer(`${baseUrl}/api/health`, server);
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

  it('creates the initial administrator and session once', async () => {
    const initialStatus = await fetch(`${baseUrl}/api/bootstrap`);
    await expect(initialStatus.json()).resolves.toEqual({ available: true });

    const rejected = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'bootstrap-password' }),
    });
    expect(rateLimitedBootstrap.status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const created = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    expect(sqlite.prepare('select count(*) from role_permissions').pluck().get()).toBe(30);
    expect(sqlite.prepare('select count(*) from access_credentials').pluck().get()).toBe(1);
    expect(sqlite.prepare('select count(*) from sessions').pluck().get()).toBe(1);
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
        'x-csrf-token': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
    expect(rejectedLogout.status).toBe(401);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader, 'x-csrf-token': csrfToken ?? '' },
    });
    expect(logout.status).toBe(200);
    await expect(logout.json()).resolves.toEqual({ authenticated: false, mode: null });

    const repeatedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader, 'x-csrf-token': csrfToken ?? '' },
    });
    expect(repeatedLogout.status).toBe(200);
    expect(repeatedLogout.headers.getSetCookie()).toHaveLength(2);

    const loggedOutStatus = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: cookieHeader },
    });
    await expect(loggedOutStatus.json()).resolves.toEqual({ authenticated: false, mode: null });

    const loginRejected = fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        mode: 'administrator',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const rateLimited = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'administrator' }),
    });
    expect(rateLimited.status).toBe(429);
    expect((await loginRejected).status).toBe(401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'client' }),
    });
    expect(modeMismatch.status).toBe(401);

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const extraLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessIdentifier: result.accessIdentifier, mode: 'administrator' }),
      });
      expect(extraLogin.status).toBe(200);
    }
    const boundedSqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(
      boundedSqlite.prepare('select count(*) from sessions').pluck().get(),
    ).toBeLessThanOrEqual(10);
    boundedSqlite.close();

    const finalStatus = await fetch(`${baseUrl}/api/bootstrap`);
    await expect(finalStatus.json()).resolves.toEqual({ available: false });
    const conflict = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
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
      },
      body: JSON.stringify({ displayName: 'Acme' }),
    });
    expect(missingCsrf.status).toBe(403);
    await expect(missingCsrf.json()).resolves.toMatchObject({
      _tag: 'CsrfRejected',
      code: 'authentication.invalid_csrf',
    });

    const createdResponse = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'content-type': 'application/json',
        'x-csrf-token': administratorCsrf,
      },
      body: JSON.stringify({ displayName: '  Acme  ' }),
    });
    expect(createdResponse.status).toBe(200);
    const client = (await createdResponse.json()) as {
      id: string;
      displayName: string;
      archived: boolean;
    };
    expect(client).toEqual({
      id: expect.stringMatching(/^[0-7][0-9A-Z]{25}$/),
      displayName: 'Acme',
      archived: false,
    });

    const accessResponse = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
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
      headers: { 'content-type': 'application/json' },
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

    const archiveResponse = await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(archiveResponse.status).toBe(200);
    await expect(archiveResponse.json()).resolves.toEqual({ ...client, archived: true });

    const revokedSession = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: clientCookieHeader },
    });
    await expect(revokedSession.json()).resolves.toEqual({ authenticated: false, mode: null });

    const archivedAccess = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: {
        cookie: administratorCookieHeader,
        'x-csrf-token': administratorCsrf,
      },
    });
    expect(archivedAccess.status).toBe(409);

    const finalList = await fetch(`${baseUrl}/api/clients`, {
      headers: { cookie: administratorCookieHeader },
    });
    await expect(finalList.json()).resolves.toEqual([{ ...client, archived: true }]);

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
    ).toBe(1);
    sqlite.close();
  });

  it('rejects oversized request bodies', async () => {
    await expect(
      fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessIdentifier: 'A'.repeat(9_000), mode: 'administrator' }),
      }),
    ).rejects.toThrow();
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
  });

  it('serves a static file', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Froment Software');
  });

  it('serves a prerendered route', async () => {
    const response = await fetch(`${baseUrl}/about`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('About');
  });

  it('returns 404 for an unknown path', async () => {
    const response = await fetch(`${baseUrl}/missing`);
    expect(response.status).toBe(404);
  });
});
