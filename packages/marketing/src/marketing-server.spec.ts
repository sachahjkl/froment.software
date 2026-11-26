import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ChildProcess;
let staticRoot: string;
let baseUrl: string;

beforeAll(async () => {
  staticRoot = await mkdtemp(join(tmpdir(), 'froment-marketing-'));
  await mkdir(join(staticRoot, 'fr'));
  await writeFile(join(staticRoot, 'fr/index.html'), '<h1>Vitrine</h1>');
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (typeof address === 'string' || !address) return reject(new Error('No port available'));
      socket.close(() => resolve(address.port));
    });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/marketing.cjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      APP_ENV: 'production',
      BACKOFFICE_ORIGIN: 'https://backoffice.froment.software',
      DEPLOYMENT_METADATA: JSON.stringify({
        commit: '6c9757782e249d4db6ffb804349b7da620494565',
        packages: [],
      }),
      PORT: String(port),
      PUBLIC_ORIGIN: baseUrl,
      SITE_PHASE: 'live',
      STATIC_ROOT: staticRoot,
    },
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Marketing server exited with ${server.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Marketing server did not start');
}, 20_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise<void>((resolve) => server.once('exit', () => resolve()));
  }
  if (staticRoot) await rm(staticRoot, { recursive: true, force: true });
});

it('serves only the marketing site and redirects legacy business pages', async () => {
  const root = await fetch(baseUrl, { redirect: 'manual' });
  expect(root.status).toBe(302);
  expect(root.headers.get('location')).toBe('/en');

  const landing = await fetch(`${baseUrl}/fr`);
  expect(landing.status).toBe(200);
  expect(await landing.text()).toContain('Vitrine');

  const backoffice = await fetch(`${baseUrl}/backoffice/login?next=clients`, {
    redirect: 'manual',
  });
  expect(backoffice.headers.get('location')).toBe(
    'https://backoffice.froment.software/login?next=clients',
  );
  const repeatedSlash = await fetch(`${baseUrl}/backoffice//example.test`, {
    redirect: 'manual',
  });
  expect(new URL(repeatedSlash.headers.get('location') ?? baseUrl).origin).toBe(
    'https://backoffice.froment.software',
  );

  const quote = await fetch(`${baseUrl}/quote/example`, { redirect: 'manual' });
  expect(quote.headers.get('location')).toBe('https://backoffice.froment.software/quote/example');
  expect((await fetch(`${baseUrl}/api/auth/account`)).status).toBe(404);
  const version = await fetch(`${baseUrl}/api/version`);
  expect(version.headers.get('cache-control')).toBe('no-store');
  expect(await version.json()).toEqual({
    commit: '6c9757782e249d4db6ffb804349b7da620494565',
    packages: [],
  });

  const feed = await fetch(`${baseUrl}/notes/feed`, {
    headers: { 'accept-language': 'en' },
  });
  expect(feed.status).toBe(200);
  expect(feed.headers.get('content-type')).toContain('application/atom+xml');
  expect(feed.headers.get('content-language')).toBe('fr');
  expect(feed.headers.get('cache-control')).toBe('no-cache');
  const xml = await feed.text();
  expect(xml).toContain(`<id>${baseUrl}/notes/feed</id>`);
  expect(xml).toContain(`href="${baseUrl}/fr/notes/`);
  expect(xml).toContain(`hreflang="en"`);
  expect((await fetch(`${baseUrl}/api/blog/feed`)).status).toBe(404);

  const releases = await fetch(`${baseUrl}/changelog/feed`);
  expect(releases.status).toBe(200);
  expect(releases.headers.get('content-type')).toContain('application/atom+xml');
  const releasesXml = await releases.text();
  expect(releasesXml).toContain(`<id>${baseUrl}/changelog/feed</id>`);
  expect(releasesXml).toContain(`<id>${baseUrl}/fr/changelog#v0.1.0</id>`);
  expect(releasesXml).toContain('&lt;strong&gt;');

  const runtime = await fetch(`${baseUrl}/runtime-config.js`);
  expect(runtime.headers.get('cache-control')).toBe('no-store');
  expect(await runtime.text()).toContain('"appEnvironment":"production"');
});

it('opens the filigrane page only with the engraved token', async () => {
  const secret = await fetch(`${baseUrl}/filigrane?sceau=gf1MDAWPoTGY`);
  expect(secret.status).toBe(200);
  expect(secret.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(await secret.text()).toContain('<title>Le filigrane</title>');

  const unknown = await fetch(`${baseUrl}/nulle-part`);
  const unknownBody = await unknown.text();
  for (const guess of ['/filigrane', '/filigrane?sceau=gf1MDAWPoTGZ', '/filigrane?sceau=']) {
    const response = await fetch(`${baseUrl}${guess}`);
    expect(response.status).toBe(unknown.status);
    expect(response.headers.get('content-type')).toBe(unknown.headers.get('content-type'));
    expect(await response.text()).toBe(unknownBody);
  }
});
