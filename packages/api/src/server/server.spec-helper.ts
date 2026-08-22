import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AddressInfo, createServer } from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const reservePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null) {
        server.close();
        reject(new Error('The test server did not reserve a TCP port.'));
        return;
      }
      // SAFETY: A TCP server bound with a host returns an AddressInfo value.
      const port = (address as AddressInfo).port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });

const waitForServer = async (url: string, process: ChildProcess, readOutput: () => string) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(`The server stopped.\n${readOutput().slice(-5_000)}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1_000) })).ok) return;
    } catch {
      // The process has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server did not start.\n${readOutput().slice(-5_000)}`);
};

export interface HttpTestServer {
  readonly baseUrl: string;
  readonly databaseFilename: string;
  readonly output: () => string;
  readonly authorization: Readonly<Record<string, string>>;
  readonly jsonHeaders: Readonly<Record<string, string>>;
  readonly close: () => Promise<void>;
}

export const startHttpTestServer = async (): Promise<HttpTestServer> => {
  const staticRoot = await mkdtemp(join(tmpdir(), 'froment-api-'));
  await cp(join(import.meta.dirname, '../../../web/dist/froment-software/browser'), staticRoot, {
    recursive: true,
  });
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const databaseFilename = join(staticRoot, 'database.sqlite');
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
  const processHandle = spawn(process.execPath, ['dist/main.cjs'], { cwd, env, stdio: 'pipe' });
  let serverOutput = '';
  processHandle.stdout?.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));
  processHandle.stderr?.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));
  await waitForServer(`${baseUrl}/api/health`, processHandle, () => serverOutput);

  const bootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify({
      bootstrapPassword: 'bootstrap-password',
      email: 'administrator@example.test',
      password: 'administrator-password',
    }),
  });
  if (!bootstrap.ok) throw new Error(`Bootstrap failed: ${await bootstrap.text()}`);
  // SAFETY: A successful bootstrap response follows the HTTP API success schema.
  const { accessToken } = (await bootstrap.json()) as { accessToken: string };
  const authorization = { authorization: `Bearer ${accessToken}` };

  return {
    baseUrl,
    databaseFilename,
    output: () => serverOutput,
    authorization,
    jsonHeaders: { ...authorization, 'content-type': 'application/json' },
    close: async () => {
      if (processHandle.exitCode === null) {
        processHandle.kill('SIGTERM');
        await new Promise<void>((resolve) => processHandle.once('exit', () => resolve()));
      }
      await rm(staticRoot, { recursive: true, force: true });
    },
  };
};

export const createClient = async (server: HttpTestServer, displayName = 'HTTP client') => {
  const response = await fetch(`${server.baseUrl}/api/clients`, {
    method: 'POST',
    headers: server.jsonHeaders,
    body: JSON.stringify({
      displayName,
      addressLine1: '1 rue du Test',
      addressLine2: '',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      email: `${displayName.toLowerCase().replaceAll(' ', '-')}@example.test`,
    }),
  });
  if (!response.ok) throw new Error(`Client creation failed: ${await response.text()}`);
  // SAFETY: A successful client creation response follows the HTTP API success schema.
  return (await response.json()) as { id: string; displayName: string };
};

export const setIssuer = async (server: HttpTestServer, displayName = 'Froment Software') => {
  const issuer = {
    displayName,
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
  const response = await fetch(`${server.baseUrl}/api/issuer-settings`, {
    method: 'PUT',
    headers: server.jsonHeaders,
    body: JSON.stringify(issuer),
  });
  if (!response.ok) throw new Error(`Issuer update failed: ${await response.text()}`);
  return issuer;
};

export const createQuote = async (server: HttpTestServer, clientId: string) => {
  const response = await fetch(`${server.baseUrl}/api/quotes`, {
    method: 'POST',
    headers: server.jsonHeaders,
    body: JSON.stringify({
      clientId,
      title: 'Integration quote',
      conditions: 'Payment is due within 30 days.',
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
  if (!response.ok) throw new Error(`Quote creation failed: ${await response.text()}`);
  // SAFETY: A successful quote creation response follows the HTTP API success schema.
  return (await response.json()) as {
    id: string;
    reference: string;
    version: number;
    currentRevision: { id: string; lines: ReadonlyArray<object>; totalCents: number };
  };
};

export const createClientToken = async (server: HttpTestServer, clientId: string) => {
  const credentials = {
    email: `${clientId.toLowerCase()}@portal.example.test`,
    password: 'portal-password-123',
  };
  const access = await fetch(`${server.baseUrl}/api/clients/${clientId}/access`, {
    method: 'POST',
    headers: server.jsonHeaders,
    body: JSON.stringify(credentials),
  });
  if (!access.ok) throw new Error(`Client access creation failed: ${await access.text()}`);
  const login = await fetch(`${server.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: server.baseUrl },
    body: JSON.stringify(credentials),
  });
  if (!login.ok) throw new Error(`Client login failed: ${await login.text()}`);
  // SAFETY: A successful login response follows the HTTP API success schema.
  return ((await login.json()) as { accessToken: string }).accessToken;
};

export const renderQuotePdf = async (server: HttpTestServer, quoteId: string, version = 1) => {
  const response = await fetch(`${server.baseUrl}/api/quotes/${quoteId}/revisions/${version}/pdf`, {
    method: 'POST',
    headers: server.authorization,
  });
  if (!response.ok) throw new Error(`Quote PDF render failed: ${await response.text()}`);
  // SAFETY: A successful render response follows the HTTP API success schema.
  return (await response.json()) as { id: string; byteSize: number; sha256: string };
};

export const acceptQuote = async (server: HttpTestServer, quoteId: string, version = 1) => {
  await renderQuotePdf(server, quoteId, version);
  const sentResponse = await fetch(`${server.baseUrl}/api/quotes/${quoteId}/send`, {
    method: 'POST',
    headers: server.jsonHeaders,
    body: JSON.stringify({ expectedVersion: version }),
  });
  if (!sentResponse.ok) throw new Error(`Quote send failed: ${await sentResponse.text()}`);
  // SAFETY: A successful send response follows the HTTP API success schema.
  const sent = (await sentResponse.json()) as { link: { url: string } };
  const token = new URL(sent.link.url).hash.slice(1);
  const acceptedResponse = await fetch(`${server.baseUrl}/api/public/quote-link/signature`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: server.baseUrl },
    body: JSON.stringify({
      token,
      signerName: 'Ada Lovelace',
      consent: true,
      signature: { kind: 'typed', value: 'Ada Lovelace' },
    }),
  });
  if (!acceptedResponse.ok)
    throw new Error(`Quote acceptance failed: ${await acceptedResponse.text()}`);
  return {
    token,
    sent,
    // SAFETY: A successful acceptance response follows the HTTP API success schema.
    accepted: (await acceptedResponse.json()) as {
      orderId: string;
      orderReference: string;
      acceptedAt: string;
    },
  };
};
