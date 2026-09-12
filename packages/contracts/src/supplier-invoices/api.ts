import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiRequestBody, RequestBodyKind } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  SupplierInvoice,
  SupplierInvoiceCreateRequest,
  SupplierInvoiceFailure,
  SupplierInvoiceList,
  SupplierInvoiceAnalysisRequest,
  SupplierInvoiceAnalysisSettings,
  SupplierInvoiceAnalysisStatus,
  SupplierInvoiceAnalysisSettingsUpdate,
  SupplierInvoiceTransitionRequest,
  SupplierInvoiceUpdateRequest,
} from './contracts.js';

export class SupplierInvoicesApi extends HttpApiGroup.make('supplierInvoices', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('supplierInvoiceList', '/api/supplier-invoices', {
    success: SupplierInvoiceList,
    error: SupplierInvoiceFailure.members,
  }).pipe(requirePermissions([Permissions.supplierInvoiceRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('supplierInvoiceGet', '/api/supplier-invoices/:invoiceId', {
    params: { invoiceId: Ulid },
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  }).pipe(requirePermissions([Permissions.supplierInvoiceRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('supplierInvoiceCreate', '/api/supplier-invoices', {
    payload: SupplierInvoiceCreateRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceCreate]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('supplierInvoiceUpdate', '/api/supplier-invoices/:invoiceId', {
    params: { invoiceId: Ulid },
    payload: SupplierInvoiceUpdateRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('supplierInvoiceConfirm', '/api/supplier-invoices/:invoiceId/confirm', {
    params: { invoiceId: Ulid },
    payload: SupplierInvoiceTransitionRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('supplierInvoiceApprove', '/api/supplier-invoices/:invoiceId/approve', {
    params: { invoiceId: Ulid },
    payload: SupplierInvoiceTransitionRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceApprove]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('supplierInvoiceCancel', '/api/supplier-invoices/:invoiceId/cancel', {
    params: { invoiceId: Ulid },
    payload: SupplierInvoiceTransitionRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.get(
    'supplierInvoiceAnalysisSettings',
    '/api/supplier-invoice-analysis/settings',
    {
      success: SupplierInvoiceAnalysisSettings,
      error: SupplierInvoiceFailure.members,
    },
  ).pipe(requirePermissions([Permissions.integrationConfigure]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('supplierInvoiceAnalysisStatus', '/api/supplier-invoice-analysis/status', {
    success: SupplierInvoiceAnalysisStatus,
    error: SupplierInvoiceFailure.members,
  }).pipe(requirePermissions([Permissions.supplierInvoiceAnalyze]), authenticate, frontendSpecific),
  HttpApiEndpoint.put(
    'supplierInvoiceAnalysisSettingsUpdate',
    '/api/supplier-invoice-analysis/settings',
    {
      payload: SupplierInvoiceAnalysisSettingsUpdate,
      success: SupplierInvoiceAnalysisSettings,
      error: SupplierInvoiceFailure.members,
    },
  )
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.integrationConfigure]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('supplierInvoiceAnalyze', '/api/supplier-invoices/analyze', {
    payload: SupplierInvoiceAnalysisRequest,
    success: SupplierInvoice,
    error: SupplierInvoiceFailure.members,
  })
    .annotate(RequestBodyKind, 'supplier-invoice-analysis')
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.supplierInvoiceAnalyze]), authenticate, frontendSpecific),
) {}
