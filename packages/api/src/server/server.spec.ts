import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

import Sqlite from 'better-sqlite3';
import { CookieJar } from 'tough-cookie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cookieHeaders, storeResponseCookies } from './cookies.spec-helper.js';

const execFileAsync = promisify(execFile);
const serverStartAttempts = 5;
const administrator = {
  email: 'administrator@example.test',
  password: 'administrator-password',
} as const;
const clientFields = {
  displayName: 'Portal client',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
} as const;

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
      throw new Error(`The server stopped.\n${readOutput().slice(-5_000)}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The process has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server did not start.\n${readOutput().slice(-5_000)}`);
};

const stopProcess = async (process: ChildProcess) => {
  if (process.exitCode !== null || process.signalCode !== null) return;
  process.kill('SIGTERM');
  await new Promise<void>((resolve) => process.once('exit', () => resolve()));
};

describe('HTTP server', () => {
  let administratorSessionHeaders: Readonly<Record<string, string>>;
  let baseUrl: string;
  let databaseFilename: string;
  let server: ChildProcess;
  let serverOutput = '';
  let staticRoot: string;

  beforeAll(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'froment-api-'));
    await cp(join(import.meta.dirname, '../../../web/dist/froment-software/browser'), staticRoot, {
      recursive: true,
    });
    databaseFilename = join(staticRoot, 'database.sqlite');
    const baseEnv = {
      ...process.env,
      API_TOKEN_HMAC_KEY: 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      BOOTSTRAP_PASSWORD_SCRYPT:
        'scrypt$16384$8$1$ABEiM0RVZneImaq7zN3u_w$bDQwYDYiQ_8HCiJ3-qXFtXFeV9FhIOa7E8VSgT__uegLrk4vqD6U920ImYTwk5RABOZsIk96bUNH1G9wbCXf1Q',
      BUSINESS_TIME_ZONE: 'Europe/Paris',
      DATABASE_PATH: databaseFilename,
      DEPLOYMENT_METADATA: JSON.stringify({
        commit: '6c9757782e249d4db6ffb804349b7da620494565',
        packages: [],
      }),
      MIGRATIONS_ROOT: join(import.meta.dirname, '../../drizzle'),
      OTEL_SDK_DISABLED: 'true',
      PASETO_SECRET_KEY:
        'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA',
      QUOTE_LINK_HMAC_KEY: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      REFRESH_HMAC_KEY: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      STATIC_ROOT: staticRoot,
      TRUSTED_PROXY_ADDRESSES: '127.0.0.1,::ffff:127.0.0.1',
    };
    const cwd = join(import.meta.dirname, '../..');
    await execFileAsync(process.execPath, ['dist/migrate.cjs'], {
      cwd,
      env: { ...baseEnv, PORT: '0', PUBLIC_ORIGIN: 'http://127.0.0.1' },
    });
    for (let attempt = 1; attempt <= serverStartAttempts; attempt += 1) {
      const port = await reservePort();
      baseUrl = `http://127.0.0.1:${port}`;
      const env = { ...baseEnv, PORT: String(port), PUBLIC_ORIGIN: baseUrl };
      serverOutput = '';
      server = spawn(process.execPath, ['dist/main.cjs'], { cwd, env, stdio: 'pipe' });
      server.stdout?.on('data', (chunk: Buffer) => {
        serverOutput += chunk.toString();
      });
      server.stderr?.on('data', (chunk: Buffer) => {
        serverOutput += chunk.toString();
      });
      try {
        await waitForServer(`${baseUrl}/api/health`, server, () => serverOutput);
        break;
      } catch (error) {
        await stopProcess(server);
        if (!serverOutput.includes('EADDRINUSE') || attempt === serverStartAttempts) throw error;
      }
    }
  });

  afterAll(async () => {
    await stopProcess(server);
    await rm(staticRoot, { recursive: true, force: true });
  });

  it('serves health, localized API documentation, and the back-office shell', async () => {
    await expect((await fetch(`${baseUrl}/api/health`)).json()).resolves.toEqual({ status: 'ok' });

    for (const path of ['/api/docs', '/api/docs/fr', '/api/docs/en']) {
      const documentation = await fetch(`${baseUrl}${path}`);
      expect(documentation.status).toBe(200);
      expect(documentation.headers.get('content-type')).toContain('text/html');
      expect(await documentation.text()).toContain('window.Scalar.createApiReference');
    }

    const frenchResponse = await fetch(`${baseUrl}/api/openapi.fr.json`);
    const englishResponse = await fetch(`${baseUrl}/api/openapi.en.json`);
    expect(frenchResponse.status).toBe(200);
    expect(englishResponse.status).toBe(200);
    const frenchSpecification = (await frenchResponse.json()) as { info: { title: string } };
    const englishSpecification = (await englishResponse.json()) as {
      info: { title: string };
      components: {
        securitySchemes: {
          bearer?: { scheme?: string; description?: string };
          sessionCookie?: object;
        };
      };
      paths: { '/api/auth/refresh'?: object; '/api/auth/account'?: object };
    };
    expect(frenchSpecification.info.title).toBe('API Froment Software');
    expect(englishSpecification.info.title).toBe('Froment Software API');
    expect(englishSpecification.paths).toHaveProperty('/api/auth/refresh');
    expect(englishSpecification.paths).toHaveProperty('/api/auth/account');
    expect(englishSpecification.components.securitySchemes.bearer).toMatchObject({
      scheme: 'bearer',
      description: 'API token sent with the Bearer scheme.',
    });
    expect(englishSpecification.components.securitySchemes).not.toHaveProperty('sessionCookie');
    const shell = await fetch(`${baseUrl}/backoffice/login`, { headers: { accept: 'text/html' } });
    expect(await shell.text()).toContain('<app-root></app-root>');
  });

  it('replaces supplied request identifiers and returns exact deployment metadata', async () => {
    const first = await fetch(`${baseUrl}/api/health`, {
      headers: { 'x-request-id': 'client-controlled' },
    });
    const second = await fetch(`${baseUrl}/api/health`);
    const firstRequestId = first.headers.get('x-request-id');
    expect(firstRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(firstRequestId).not.toBe('client-controlled');
    expect(second.headers.get('x-request-id')).not.toBe(firstRequestId);

    const version = await fetch(`${baseUrl}/api/version`);
    expect(version.headers.get('cache-control')).toBe('no-store');
    await expect(version.json()).resolves.toEqual({
      commit: '6c9757782e249d4db6ffb804349b7da620494565',
      packages: [],
    });
  });

  it('requires the configured Origin for bootstrap', async () => {
    const response = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.test' },
      body: JSON.stringify({ bootstrapPassword: 'bootstrap-password', ...administrator }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'request.invalid_origin' });
  });

  it('rejects fixed and chunked oversized request bodies without stopping the server', async () => {
    const fixed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email: `${'a'.repeat(33_000)}@example.test`, password: 'password' }),
    });
    expect(fixed.status).toBe(413);
    await expect(fixed.json()).resolves.toMatchObject({ code: 'request.too_large' });

    const chunked = await new Promise<{ readonly body: string; readonly status: number }>(
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
    expect(chunked.status).toBe(413);
    expect(JSON.parse(chunked.body)).toMatchObject({ code: 'request.too_large' });
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
  });

  it('bootstraps one administrator with access and refresh cookies', async () => {
    const response = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ bootstrapPassword: 'bootstrap-password', ...administrator }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      expiresAt: expect.any(Number),
      mode: 'administrator',
    });
    const cookies = response.headers.getSetCookie();
    const accessCookie = cookies.find((cookie) => cookie.startsWith('__Secure-froment-access='));
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('__Secure-froment-refresh='));
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Secure');
    expect(accessCookie).toContain('SameSite=Strict');
    expect(accessCookie).toContain('Path=/api');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api/auth');
    const jar = new CookieJar();
    await storeResponseCookies(jar, response, baseUrl);
    administratorSessionHeaders = await cookieHeaders(jar, `${baseUrl}/api`);
    const sqlite = new Sqlite(databaseFilename, { readonly: true });
    expect(sqlite.prepare('select count(*) from password_credentials').pluck().get()).toBe(1);
    expect(sqlite.prepare('select count(*) from refresh_sessions').pluck().get()).toBe(1);
    expect(() => sqlite.prepare('select * from access_credentials').all()).toThrow();
    expect(() => sqlite.prepare('select * from sessions').all()).toThrow();
    sqlite.close();
  }, 10_000);

  it('authenticates the account and rotates its refresh token', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify(administrator),
    });
    expect(login.status).toBe(200);
    const jar = new CookieJar();
    await storeResponseCookies(jar, login, baseUrl);
    const account = await fetch(`${baseUrl}/api/auth/account`, {
      headers: await cookieHeaders(jar, `${baseUrl}/api/auth/account`),
    });
    await expect(account.json()).resolves.toMatchObject({ mode: 'administrator' });
    const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { ...(await cookieHeaders(jar, `${baseUrl}/api/auth/refresh`)), origin: baseUrl },
    });
    expect(refresh.status).toBe(200);
    expect(refresh.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('__Secure-froment-refresh='),
        expect.stringContaining('__Secure-froment-access='),
      ]),
    );
  });

  it('rejects malformed and mixed bearer credentials', async () => {
    for (const authorization of ['Bearer invalid', 'Bearer v4.public.invalid']) {
      const response = await fetch(`${baseUrl}/api/clients`, { headers: { authorization } });
      expect(response.status).toBe(401);
    }
    const mixed = await fetch(`${baseUrl}/api/clients`, {
      headers: {
        authorization: 'Bearer froment_api_v1_mixed',
        ...administratorSessionHeaders,
      },
    });
    expect(mixed.status).toBe(401);
  });

  it('creates client password credentials and disables their active access', async () => {
    const sessionHeaders = administratorSessionHeaders;
    const created = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: { ...sessionHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(clientFields),
    });
    const client = (await created.json()) as { id: string };
    const credentials = { email: 'portal@example.test', password: 'portal-password-123' };
    const access = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: { ...sessionHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    expect(access.status).toBe(200);
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify(credentials),
    });
    const clientJar = new CookieJar();
    await storeResponseCookies(clientJar, login, baseUrl);
    const clientSessionHeaders = await cookieHeaders(clientJar, `${baseUrl}/api/client`);
    expect(
      (
        await fetch(`${baseUrl}/api/client/quotes`, {
          headers: clientSessionHeaders,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
          method: 'POST',
          headers: sessionHeaders,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/client/quotes`, {
          headers: clientSessionHeaders,
        })
      ).status,
    ).toBe(401);
  });

  it('keeps API tokens as separate Bearer credentials', async () => {
    const created = await fetch(`${baseUrl}/api/tokens`, {
      method: 'POST',
      headers: {
        ...administratorSessionHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'automation',
        permissions: ['client.read'],
        expiresAt: Date.now() + 86_400_000,
        rateLimitPerMinute: 60,
      }),
    });
    expect(created.status).toBe(200);
    const token = (await created.json()) as { secret: string; token: { id: string } };
    const clients = await fetch(`${baseUrl}/api/clients`, {
      headers: { authorization: `Bearer ${token.secret}` },
    });
    expect(clients.status).toBe(200);

    const denied = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(clientFields),
    });
    expect(denied.status).toBe(403);
    expect(
      (await fetch(`${baseUrl}/api/clients`, { headers: administratorSessionHeaders })).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/clients`, {
          headers: { authorization: 'Bearer froment_api_v1_invalid.invalid' },
        })
      ).status,
    ).toBe(401);

    const database = new Sqlite(databaseFilename, { readonly: true });
    const events = database
      .prepare(
        `select actor_user_id as actorUserId, resource_type as resourceType,
                resource_id as resourceId, occurred_at as occurredAt, metadata
         from audit_events
         where action = 'api.token-used' and resource_id = ?
         order by occurred_at, id`,
      )
      .all(token.token.id) as ReadonlyArray<{
      readonly actorUserId: string;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly occurredAt: number;
      readonly metadata: string;
    }>;
    database.close();
    expect(events).toHaveLength(2);
    expect(events.map(({ metadata }) => JSON.parse(metadata))).toEqual([
      { route: 'GET /api/clients', result: '200' },
      { route: 'POST /api/clients', result: '403' },
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: expect.any(String),
          resourceType: 'api-token',
          resourceId: token.token.id,
          occurredAt: expect.any(Number),
        }),
      ]),
    );
  });

  it('logs out one refresh family and clears its cookie', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify(administrator),
    });
    const jar = new CookieJar();
    await storeResponseCookies(jar, login, baseUrl);
    const sessionHeaders = await cookieHeaders(jar, `${baseUrl}/api/auth`);
    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { ...sessionHeaders, origin: baseUrl },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('__Secure-froment-refresh=;'),
        expect.stringContaining('__Secure-froment-access=;'),
      ]),
    );
    const rejected = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { ...sessionHeaders, origin: baseUrl },
    });
    expect(rejected.status).toBe(401);
  });

  it('rate-limits refresh attempts by token and trusted client address', async () => {
    const firstToken = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          cookie: `__Secure-froment-refresh=${firstToken}`,
          origin: baseUrl,
          'x-real-ip': '192.0.2.1',
        },
      });
      expect(response.status).toBe(401);
    }
    const tokenLimited = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `__Secure-froment-refresh=${firstToken}`,
        origin: baseUrl,
        'x-real-ip': '192.0.2.1',
      },
    });
    expect(tokenLimited.status).toBe(429);

    const otherToken = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: '__Secure-froment-refresh=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        origin: baseUrl,
        'x-real-ip': '192.0.2.1',
      },
    });
    expect(otherToken.status).toBe(401);

    let limited: Response | undefined;
    for (let attempt = 0; attempt < 601 && limited === undefined; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { origin: baseUrl, 'x-real-ip': '192.0.2.3' },
      });
      if (response.status === 429) limited = response;
    }
    if (limited === undefined) throw new Error('The refresh quota did not reject a request.');
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ code: 'request.rate_limited' });

    const otherAddress = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { origin: baseUrl, 'x-real-ip': '192.0.2.4' },
    });
    expect(otherAddress.status).toBe(401);
  });

  it('serves static, prerendered, and missing routes correctly', async () => {
    const root = await fetch(`${baseUrl}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get('cache-control')).toBe('no-store');
    expect(await root.text()).toContain('Froment Software');

    const about = await fetch(`${baseUrl}/about`);
    expect(about.status).toBe(200);
    expect(about.headers.get('cache-control')).toBe('no-store');
    expect(await about.text()).toContain('ng-server-context="ssg"');

    expect((await fetch(`${baseUrl}/missing`)).status).toBe(404);
  });
});
