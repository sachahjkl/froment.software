import { ApiTokenCreated } from '@froment/contracts';
import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { startHttpTestServer } from '../server/server.spec-helper.js';

it('separates payment export from payment writes and banking access for API tokens', async () => {
  const server = await startHttpTestServer();
  try {
    for (const permission of ['payment.read', 'invoice.mark-paid']) {
      const created = await fetch(`${server.baseUrl}/api/tokens`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          name: permission,
          permissions: [permission],
          expiresAt: Date.now() + 86_400_000,
          rateLimitPerMinute: 60,
        }),
      });
      expect(created.status).toBe(200);
      const token = Schema.decodeUnknownSync(ApiTokenCreated)(await created.json());
      const headers = {
        authorization: `Bearer ${token.secret}`,
        'content-type': 'application/json',
      };
      const exported = await fetch(
        `${server.baseUrl}/api/invoice-payments/export?from=2026-09-01&to=2026-09-06`,
        { headers },
      );
      if (permission === 'payment.read') {
        expect(exported.status).toBe(200);
        const payment = await fetch(
          `${server.baseUrl}/api/invoices/01ARZ3NDEKTSV4RRFFQ69G5FAV/payments`,
          {
            method: 'POST',
            headers,
            body: '{}',
          },
        );
        expect(payment.status).toBe(403);
      } else {
        expect(exported.status).toBe(403);
      }
      expect((await fetch(`${server.baseUrl}/api/banking/transactions`, { headers })).status).toBe(
        403,
      );
    }
  } finally {
    await server.close();
  }
}, 15000);
