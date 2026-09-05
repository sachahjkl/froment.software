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
          invoiceNumber: "FA-2026-000001",
          pdfAvailable: true,
        },
      ]),
    ],
    ["/api/bootstrap", { available: true }],
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
    if (responses.has(path)) return route.fulfill({ json: responses.get(path) });
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
