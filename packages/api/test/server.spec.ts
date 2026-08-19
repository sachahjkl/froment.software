import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

import { Api } from '@froment/contracts';
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
  let server: ChildProcess;
  let staticRoot: string;

  beforeAll(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'froment-api-'));
    await writeFile(join(staticRoot, 'index.html'), '<h1>Froment Software</h1>');
    await mkdir(join(staticRoot, 'about'));
    await writeFile(join(staticRoot, 'about', 'index.html'), '<h1>About</h1>');
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['dist/main.cjs'], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, PORT: String(port), STATIC_ROOT: staticRoot },
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
