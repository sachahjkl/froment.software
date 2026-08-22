import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
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

describe('HTTP server', () => {
  let administratorAccessToken: string;
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
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    databaseFilename = join(staticRoot, 'database.sqlite');
    const env = {
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
      PORT: String(port),
      PUBLIC_ORIGIN: baseUrl,
      QUOTE_LINK_HMAC_KEY: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      REFRESH_HMAC_KEY: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      STATIC_ROOT: staticRoot,
    };
    const cwd = join(import.meta.dirname, '../..');
    await execFileAsync(process.execPath, ['dist/migrate.cjs'], { cwd, env });
    server = spawn(process.execPath, ['dist/main.cjs'], { cwd, env, stdio: 'pipe' });
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

  it('serves health, localized OpenAPI, and the client-rendered back-office shell', async () => {
    await expect((await fetch(`${baseUrl}/api/health`)).json()).resolves.toEqual({ status: 'ok' });
    const specification = (await (await fetch(`${baseUrl}/api/openapi.en.json`)).json()) as {
      components: { securitySchemes: { bearer?: object; sessionCookie?: object } };
      paths: { '/api/auth/refresh'?: object; '/api/auth/account'?: object };
    };
    expect(specification.paths).toHaveProperty('/api/auth/refresh');
    expect(specification.paths).toHaveProperty('/api/auth/account');
    expect(specification.components.securitySchemes).toHaveProperty('bearer');
    expect(specification.components.securitySchemes).not.toHaveProperty('sessionCookie');
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

  it('bootstraps one administrator with a PASETO token and refresh cookie', async () => {
    const response = await fetch(`${baseUrl}/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ bootstrapPassword: 'bootstrap-password', ...administrator }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      accessToken: string;
      expiresAt: number;
      mode: string;
    };
    expect(body).toMatchObject({
      accessToken: expect.stringMatching(/^v4\.public\./),
      mode: 'administrator',
    });
    administratorAccessToken = body.accessToken;
    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain('__Secure-froment-refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
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
    const loginBody = (await login.json()) as { accessToken: string };
    const cookie = login.headers.getSetCookie()[0]?.split(';', 1)[0] ?? '';
    const account = await fetch(`${baseUrl}/api/auth/account`, {
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    await expect(account.json()).resolves.toMatchObject({ mode: 'administrator' });
    const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
    });
    expect(refresh.status).toBe(200);
    expect(refresh.headers.getSetCookie()[0]).toContain('__Secure-froment-refresh=');
  });

  it('rejects malformed and mixed bearer credentials', async () => {
    for (const authorization of ['Bearer invalid', `Bearer ${administratorAccessToken},other`]) {
      const response = await fetch(`${baseUrl}/api/clients`, { headers: { authorization } });
      expect(response.status).toBe(401);
    }
  });

  it('creates client password credentials and disables their active access', async () => {
    const authorization = `Bearer ${administratorAccessToken}`;
    const created = await fetch(`${baseUrl}/api/clients`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(clientFields),
    });
    const client = (await created.json()) as { id: string };
    const credentials = { email: 'portal@example.test', password: 'portal-password-123' };
    const access = await fetch(`${baseUrl}/api/clients/${client.id}/access`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    expect(access.status).toBe(200);
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify(credentials),
    });
    const clientToken = ((await login.json()) as { accessToken: string }).accessToken;
    expect(
      (
        await fetch(`${baseUrl}/api/client/quotes`, {
          headers: { authorization: `Bearer ${clientToken}` },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/clients/${client.id}/archive`, {
          method: 'POST',
          headers: { authorization },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/client/quotes`, {
          headers: { authorization: `Bearer ${clientToken}` },
        })
      ).status,
    ).toBe(401);
  });

  it('keeps API tokens as separate Bearer credentials', async () => {
    const created = await fetch(`${baseUrl}/api/tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${administratorAccessToken}`,
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
    const token = (await created.json()) as { secret: string };
    const clients = await fetch(`${baseUrl}/api/clients`, {
      headers: { authorization: `Bearer ${token.secret}` },
    });
    expect(clients.status).toBe(200);
  });

  it('logs out one refresh family and clears its cookie', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify(administrator),
    });
    const cookie = login.headers.getSetCookie()[0]?.split(';', 1)[0] ?? '';
    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie()[0]).toContain('Expires=Thu, 01 Jan 1970');
    const rejected = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
    });
    expect(rejected.status).toBe(401);
  });

  it('serves static, prerendered, and missing routes correctly', async () => {
    const root = await fetch(`${baseUrl}/`);
    expect(root.status).toBe(200);
    expect(await root.text()).toContain('Froment Software');

    const about = await fetch(`${baseUrl}/about`);
    expect(about.status).toBe(200);
    expect(await about.text()).toContain('ng-server-context="ssg"');

    expect((await fetch(`${baseUrl}/missing`)).status).toBe(404);
  });
});
