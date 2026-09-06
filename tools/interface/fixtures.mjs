export const clientId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
export const quoteId = "01ARZ3NDEKTSV4RRFFQ69G5FAY";
export const invoiceId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const revisionId = "01ARZ3NDEKTSV4RRFFQ69G5FAZ";
const orderId = "01ARZ3NDEKTSV4RRFFQ69G5FAX";
const createdAt = "2026-09-05T08:00:00.000Z";
export const accountEmail = "administration.et.comptabilite@entreprise-internationale.example";
export const quoteToken = "A".repeat(43);

const client = {
  id: clientId,
  displayName: "Atelier international de conception et de développement des systèmes industriels",
  addressLine1: "128 avenue de la République",
  addressLine2: "Bâtiment des ateliers — service comptabilité",
  postalCode: "75011",
  city: "Paris",
  country: "France",
  email: "comptabilite.et.administration@entreprise-internationale.example",
  archived: false,
  updatedAt: 1788600000000,
};

const issuer = {
  displayName: "Entreprise de démonstration",
  addressLine1: "12 rue des Ateliers",
  addressLine2: "",
  postalCode: "75011",
  city: "Paris",
  country: "France",
  email: "contact@entreprise.example",
  phone: "+33 1 23 45 67 89",
  registrationNumber: "123456789",
  vatNumber: "FR123456789",
};

const lines = [
  "Analyse technique et recommandations pour la reprise du logiciel existant",
  "Développement des fonctionnalités de gestion et intégration des systèmes",
  "Documentation, transfert et accompagnement de la mise en production",
].map((description, position) => ({
  id: `${clientId.slice(0, -1)}${position}`,
  position,
  description,
  quantityMilli: 1000,
  unitPriceCents: 100000,
  vatRateBasisPoints: 2000,
  netTotalCents: 100000,
  vatTotalCents: 20000,
  totalCents: 120000,
}));

const revision = {
  id: revisionId,
  version: 1,
  previewAvailable: true,
  clientDisplayName: client.displayName,
  title: "Audit et reprise du système de gestion des équipements et des interventions",
  conditions:
    "Périmètre : audit, recommandations et restitution.\nUn accord écrit précède toute intervention supplémentaire.",
  currency: "EUR",
  netTotalCents: 300000,
  vatTotalCents: 60000,
  totalCents: 360000,
  createdAt,
  createdByUserId: clientId,
  lines,
};

const quote = {
  id: quoteId,
  reference: "DE-2026-000001",
  clientId,
  status: "draft",
  version: 1,
  currentRevision: revision,
  revisions: [revision],
};

const quoteSummary = {
  id: quoteId,
  reference: quote.reference,
  clientId,
  clientDisplayName: client.displayName,
  status: "draft",
  version: 1,
  title: revision.title,
  currency: "EUR",
  totalCents: 360000,
  updatedAt: createdAt,
};

const order = {
  id: orderId,
  reference: "CO-2026-000001",
  quoteId,
  quoteReference: quote.reference,
  revisionId,
  clientId,
  clientDisplayName: client.displayName,
  title: revision.title,
  currency: "EUR",
  totalCents: 360000,
  createdAt,
  invoiceId,
};

const invoiceRevision = {
  ...revision,
  invoiceNumber: null,
  issuedAt: null,
  serviceDate: "2026-09-05",
  dueDate: "2026-10-05",
  paymentTerms: "Virement à trente jours.",
};

const invoice = {
  payments: [],
  id: invoiceId,
  orderId,
  orderReference: order.reference,
  clientId,
  status: "draft",
  version: 1,
  invoiceNumber: null,
  issuedAt: null,
  paidAt: null,
  voidedAt: null,
  currentRevision: invoiceRevision,
  revisions: [invoiceRevision],
  pdf: null,
};

export const issuedInvoice = {
  ...invoice,
  status: "issued",
  invoiceNumber: "FA-2026-000001",
  issuedAt: createdAt,
  currentRevision: { ...invoiceRevision, invoiceNumber: "FA-2026-000001", issuedAt: createdAt },
  revisions: [{ ...invoiceRevision, invoiceNumber: "FA-2026-000001", issuedAt: createdAt }],
  payments: [
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FB9",
      requestId: "7a476442-20ae-4a53-88f4-18762e7a1100",
      expectedVersion: 1,
      amountCents: 10000,
      paidOn: "2026-09-05",
      method: "transfer",
      reference: "BANK-001",
      recordedAt: createdAt,
      recordedByUserId: clientId,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
    },
  ],
};

const invoiceSummary = {
  recordedPaidCents: 0,
  id: invoiceId,
  orderId,
  orderReference: order.reference,
  clientId,
  clientDisplayName: client.displayName,
  status: "draft",
  version: 1,
  invoiceNumber: null,
  title: revision.title,
  dueDate: invoiceRevision.dueDate,
  currency: "EUR",
  totalCents: 360000,
  updatedAt: createdAt,
  pdf: null,
};

const publicQuote = {
  status: "sent",
  canSign: true,
  expiresAt: "2026-10-05T08:00:00.000Z",
  snapshot: {
    ...revision,
    templateId: "quote-default",
    templateVersion: 1,
    quoteId,
    quoteReference: quote.reference,
    revisionId,
    issuer,
    client,
  },
};

export async function mockApi(
  page,
  { mode = "administrator", empty = false, unavailable = false } = {},
) {
  const unexpected = [];
  const list = (items) => (empty ? [] : items);
  const responses = new Map([
    ["/api/clients", list([client])],
    [`/api/clients/${clientId}`, client],
    [`/api/clients/${clientId}/access`, []],
    [`/api/clients/${clientId}/access-accounts`, []],
    ["/api/quotes", list([quoteSummary])],
    [`/api/quotes/${quoteId}`, quote],
    ["/api/orders", list([order])],
    ["/api/invoices", list([invoiceSummary])],
    [`/api/invoices/${invoiceId}`, invoice],
    ["/api/issuer-settings", issuer],
    ["/api/quote-condition-presets", []],
    ["/api/catalog", []],
    ["/api/banking/transactions", []],
    [
      "/api/integrations",
      ["email", "signature", "payment", "banking", "electronic-invoice"].map((kind) => ({
        kind,
        mode: "simulation",
      })),
    ],
    ["/api/integrations/operations", []],
    ["/api/email-drafts", []],
    ["/api/email-templates", []],
    ["/api/reminders", []],
    [
      "/api/integrations/retries",
      [
        {
          operationId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          attempts: 5,
          status: "exhausted",
          nextAttemptAt: null,
          error: "integration.unavailable",
        },
      ],
    ],
    ["/api/tokens", { items: [], nextCursor: null }],
    [`/api/affairs/${quoteId}/events`, []],
    ["/api/public/quote-link", publicQuote],
    ["/api/client/quotes", list([{ ...quoteSummary, status: "sent", pdfAvailable: true }])],
    ["/api/client/orders", list([{ ...order, status: "confirmed", pdfAvailable: true }])],
    [
      "/api/client/invoices",
      list([
        {
          ...invoiceSummary,
          status: "issued",
          recordedPaidCents: 10000,
          remainingCents: 350000,
          invoiceNumber: "FA-2026-000001",
          pdfAvailable: true,
        },
      ]),
    ],
    ["/api/bootstrap", { available: true }],
    [
      "/api/auth/sessions",
      [
        {
          id: clientId,
          startedAt: createdAt,
          renewedAt: createdAt,
          expiresAt: "2026-10-05T08:00:00.000Z",
          current: true,
        },
        {
          id: quoteId,
          startedAt: createdAt,
          renewedAt: createdAt,
          expiresAt: "2026-10-05T08:00:00.000Z",
          current: false,
        },
      ],
    ],
  ]);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/refresh" || path === "/api/auth/login") {
      return route.fulfill({ json: { expiresAt: Date.now() + 600000, mode } });
    }
    if (path === "/api/auth/account") {
      return route.fulfill({ json: { userId: clientId, email: accountEmail, mode } });
    }
    if (unavailable) return route.fulfill({ status: 503, json: {} });
    if (path === "/api/auth/passkeys") return route.fulfill({ json: [] });
    if (path === `/api/banking/transactions/${quoteId}/history`) {
      return route.fulfill({
        json: [
          {
            id: quoteId,
            paymentId: clientId,
            invoiceId,
            amountCents: 10000,
            feeCents: 0,
            invoiceNumber: "FA-2026-000001",
            matchedAt: createdAt,
            matchedByUserId: clientId,
            cancelledAt: createdAt,
            cancelledByUserId: clientId,
            cancellationReason: "Incorrect association",
          },
        ],
      });
    }
    if (path === "/api/banking/import") {
      responses.set("/api/invoices", [
        { ...invoiceSummary, status: "issued", invoiceNumber: "FA-2026-000001" },
      ]);
      responses.set("/api/banking/transactions", [
        {
          id: quoteId,
          account: "MAIN",
          reference: "BANK-001",
          bookedOn: "2026-09-01",
          amountCents: 10000,
          description: "Client payment",
          importedAt: createdAt,
          matchedCents: 0,
          allocations: [],
        },
      ]);
      return route.fulfill({ json: { added: 1, existing: 0 } });
    }
    if (path === `/api/banking/invoices/${invoiceId}/payments`) {
      const allocated = responses
        .get("/api/banking/transactions")
        .flatMap((row) => row.allocations)
        .reduce((sum, item) => sum + item.amountCents, 0);
      return route.fulfill({
        json: [
          {
            id: clientId,
            paidOn: "2026-09-01",
            reference: "PAYMENT",
            amountCents: 10300,
            availableCents: 10300 - allocated,
          },
        ],
      });
    }
    if (path === `/api/banking/transactions/${quoteId}/match`) {
      const request = route.request().postDataJSON();
      responses.set(
        "/api/banking/transactions",
        responses.get("/api/banking/transactions").map((row) => ({
          ...row,
          matchedCents: row.matchedCents + request.amountCents - request.feeCents,
          allocations: [
            ...row.allocations,
            {
              matchId: row.allocations.length === 0 ? clientId : invoiceId,
              paymentId: request.paymentId,
              invoiceId,
              invoiceNumber: "FA-2026-000001",
              amountCents: request.amountCents,
              feeCents: request.feeCents,
              paymentCancelled: false,
            },
          ],
        })),
      );
      return route.fulfill({ json: responses.get("/api/banking/transactions") });
    }
    if (path === "/api/integrations/operations" && route.request().method() === "POST") {
      const request = route.request().postDataJSON();
      responses.set(
        "/api/email-drafts",
        responses.get("/api/email-drafts").filter((draft) => draft.id !== request.requestId),
      );
      const operation = {
        id: quoteId,
        request,
        receipt: { id: `simulation:${request.requestId}`, mode: "simulation", status: "simulated" },
        createdAt,
        createdByUserId: clientId,
      };
      responses.set(path, [operation]);
      return route.fulfill({ json: operation });
    }
    if (responses.has(path)) return route.fulfill({ json: responses.get(path) });
    if (path.startsWith("/api/email-drafts/") && route.request().method() === "PUT") {
      const request = route.request().postDataJSON();
      const id = path.split("/").at(-1);
      const draft = { ...request, id, version: request.expectedVersion + 1, updatedAt: createdAt };
      responses.set("/api/email-drafts", [
        draft,
        ...responses.get("/api/email-drafts").filter((item) => item.id !== id),
      ]);
      return route.fulfill({ json: draft });
    }
    if (path.startsWith("/api/email-templates/") && route.request().method() === "PUT") {
      const request = route.request().postDataJSON();
      const id = path.split("/").at(-1);
      const template = {
        ...request,
        id,
        version: request.expectedVersion + 1,
        updatedAt: createdAt,
      };
      responses.set("/api/email-templates", [
        template,
        ...responses.get("/api/email-templates").filter((item) => item.id !== id),
      ]);
      return route.fulfill({ json: template });
    }
    if (path.startsWith("/api/reminders/") && route.request().method() === "PUT") {
      const request = route.request().postDataJSON();
      const id = path.split("/").at(-1);
      const reminder = {
        ...request,
        id,
        invoiceReference: "FA-2026-000001",
        status: "scheduled",
        reason: null,
        operationId: null,
        createdByUserId: clientId,
        createdAt,
      };
      responses.set("/api/reminders", [
        reminder,
        ...responses.get("/api/reminders").filter((item) => item.id !== id),
      ]);
      return route.fulfill({ json: reminder });
    }
    if (path.startsWith("/api/reminders/") && path.endsWith("/cancel")) {
      const id = path.split("/").at(-2);
      const reminder = {
        ...responses.get("/api/reminders").find((item) => item.id === id),
        status: "cancelled",
      };
      responses.set(
        "/api/reminders",
        responses.get("/api/reminders").map((item) => (item.id === id ? reminder : item)),
      );
      return route.fulfill({ json: reminder });
    }
    if (path.endsWith("/preview")) {
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="fr"><title>Aperçu de test</title><main><h1>Document de démonstration</h1><p>Contenu utilisé pour vérifier le cadre de prévisualisation.</p></main></html>',
      });
    }
    if (path.endsWith("/pdf")) {
      return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" });
    }
    unexpected.push(path);
    return route.fulfill({ status: 404, json: {} });
  });
  return unexpected;
}
