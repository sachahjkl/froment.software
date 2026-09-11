CREATE TRIGGER invoice_payments_active_insert BEFORE INSERT ON invoice_payments
WHEN NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by_user_id IS NOT NULL OR NEW.cancellation_reason IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_payments_active_insert'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_payments_immutable_update BEFORE UPDATE ON invoice_payments
WHEN NEW.id IS NOT OLD.id
  OR NEW.invoice_id IS NOT OLD.invoice_id
  OR NEW.request_id IS NOT OLD.request_id
  OR NEW.expected_version IS NOT OLD.expected_version
  OR NEW.amount_cents IS NOT OLD.amount_cents
  OR NEW.paid_on IS NOT OLD.paid_on
  OR NEW.method IS NOT OLD.method
  OR NEW.reference IS NOT OLD.reference
  OR NEW.recorded_at IS NOT OLD.recorded_at
  OR NEW.recorded_by_user_id IS NOT OLD.recorded_by_user_id
  OR OLD.cancelled_at IS NOT NULL
  OR NEW.cancelled_at IS NULL
  OR NEW.cancelled_by_user_id IS NULL
  OR NEW.cancellation_reason IS NULL
  OR length(trim(NEW.cancellation_reason)) NOT BETWEEN 1 AND 500
  OR NEW.cancelled_at < OLD.recorded_at
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_payments_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_payments_immutable_delete BEFORE DELETE ON invoice_payments
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_payments_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER bank_transactions_immutable_update BEFORE UPDATE ON bank_transactions
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_transactions_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER bank_transactions_immutable_delete BEFORE DELETE ON bank_transactions
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_transactions_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER bank_matches_active_insert BEFORE INSERT ON bank_matches
WHEN NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by_user_id IS NOT NULL OR NEW.cancellation_reason IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_matches_active_insert'); END;
--> statement-breakpoint
CREATE TRIGGER bank_matches_immutable_update BEFORE UPDATE ON bank_matches
WHEN NEW.id IS NOT OLD.id
  OR NEW.request_id IS NOT OLD.request_id
  OR NEW.transaction_id IS NOT OLD.transaction_id
  OR NEW.payment_id IS NOT OLD.payment_id
  OR NEW.amount_cents IS NOT OLD.amount_cents
  OR NEW.fee_cents IS NOT OLD.fee_cents
  OR NEW.matched_at IS NOT OLD.matched_at
  OR NEW.matched_by_user_id IS NOT OLD.matched_by_user_id
  OR OLD.cancelled_at IS NOT NULL
  OR NEW.cancelled_at IS NULL
  OR NEW.cancelled_by_user_id IS NULL
  OR NEW.cancellation_reason IS NULL
  OR length(trim(NEW.cancellation_reason)) NOT BETWEEN 1 AND 500
  OR NEW.cancelled_at < OLD.matched_at
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_matches_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER bank_matches_immutable_delete BEFORE DELETE ON bank_matches
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_matches_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER issued_invoices_immutable_update BEFORE UPDATE ON invoices
WHEN (OLD.status <> 'draft' OR OLD.issued_at IS NOT NULL) AND (
  NEW.id IS NOT OLD.id
  OR NEW.order_id IS NOT OLD.order_id
  OR NEW.client_id IS NOT OLD.client_id
  OR NEW.version IS NOT OLD.version
  OR NEW.invoice_number IS NOT OLD.invoice_number
  OR NEW.issued_at IS NOT OLD.issued_at
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.status = 'draft'
  OR (OLD.status = 'void' AND NEW.status <> 'void')
  OR (NEW.status = OLD.status AND (NEW.paid_at IS NOT OLD.paid_at OR NEW.voided_at IS NOT OLD.voided_at))
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.issued_invoices_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER issued_invoices_immutable_delete BEFORE DELETE ON invoices
WHEN OLD.status <> 'draft' OR OLD.issued_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'database.trigger.issued_invoices_immutable'); END;
