import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('the production Node runtime loads public trust and verifies HTTPS certificates', async () => {
  const bundlePath = process.env['SSL_CERT_FILE'];
  assert.ok(bundlePath);
  const bundle = await readFile(bundlePath, 'utf8');
  const certificates = [
    ...bundle.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g),
  ];
  assert.ok(certificates.length > 0);
  const directory = await mkdtemp(join(tmpdir(), 'froment-tls-'));
  try {
    const emptyDirectory = join(directory, 'empty');
    await mkdir(emptyDirectory);
    const certificatePath = join(directory, 'certificate.pem');
    const keyPath = join(directory, 'key.pem');
    await execFileAsync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-noenc',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,digitalSignature,keyCertSign',
      '-keyout',
      keyPath,
      '-out',
      certificatePath,
    ]);
    const environment = {
      ...process.env,
      SSL_CERT_FILE: bundlePath,
      NIX_SSL_CERT_FILE: bundlePath,
      SSL_CERT_DIR: emptyDirectory,
      NODE_EXTRA_CA_CERTS: '',
      NODE_OPTIONS: '',
    };
    const trusted = await execFileAsync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import { X509Certificate } from 'node:crypto';
      import { getCACertificates } from 'node:tls';
      console.log(JSON.stringify(getCACertificates('system').map((pem) => new X509Certificate(pem).fingerprint256)));
    `,
      ],
      { env: environment },
    );
    const fingerprints: unknown = JSON.parse(trusted.stdout);
    assert.ok(Array.isArray(fingerprints));
    for (const [pem] of certificates)
      assert.ok(fingerprints.includes(new X509Certificate(pem).fingerprint256));

    const server = createServer(
      {
        key: await readFile(keyPath),
        cert: await readFile(certificatePath),
      },
      (_request, response) => {
        response.end('ok');
      },
    );
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      assert.ok(address !== null && typeof address !== 'string');
      const probe = `
        try {
          const response = await fetch(process.argv[1], { signal: AbortSignal.timeout(5000) });
          console.log(await response.text());
        } catch (error) {
          console.log(error.cause?.code ?? error.name);
          process.exitCode = 1;
        }
      `;
      const arguments_ = ['--input-type=module', '-e', probe, `https://127.0.0.1:${address.port}`];
      await assert.rejects(execFileAsync(process.execPath, arguments_, { env: environment }), {
        stdout: 'DEPTH_ZERO_SELF_SIGNED_CERT\n',
      });
      const accepted = await execFileAsync(process.execPath, arguments_, {
        env: { ...environment, SSL_CERT_FILE: certificatePath, NIX_SSL_CERT_FILE: certificatePath },
      });
      assert.equal(accepted.stdout, 'ok\n');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
