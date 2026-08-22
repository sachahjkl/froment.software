DROP TRIGGER IF EXISTS api_token_permissions_delete_guard;--> statement-breakpoint
CREATE TRIGGER `api_token_permissions_delete_guard` BEFORE DELETE ON `api_token_permissions` BEGIN SELECT RAISE(ABORT, 'database.trigger.api_token_permissions_delete_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS api_token_permissions_update_guard;--> statement-breakpoint
CREATE TRIGGER `api_token_permissions_update_guard` BEFORE UPDATE ON `api_token_permissions` BEGIN SELECT RAISE(ABORT, 'database.trigger.api_token_permissions_update_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS api_tokens_active_name_insert_guard;--> statement-breakpoint
CREATE TRIGGER `api_tokens_active_name_insert_guard` BEFORE INSERT ON `api_tokens` WHEN EXISTS (SELECT 1 FROM `api_tokens` WHERE `name` = NEW.`name` AND `revoked_at` IS NULL AND `expires_at` > NEW.`created_at`) BEGIN SELECT RAISE(ABORT, 'database.trigger.api_tokens_active_name_insert_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS api_tokens_delete_guard;--> statement-breakpoint
CREATE TRIGGER `api_tokens_delete_guard` BEFORE DELETE ON `api_tokens` BEGIN SELECT RAISE(ABORT, 'database.trigger.api_tokens_delete_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS api_tokens_immutable_guard;--> statement-breakpoint
CREATE TRIGGER `api_tokens_immutable_guard` BEFORE UPDATE ON `api_tokens` WHEN new.`id` <> old.`id` OR new.`user_id` <> old.`user_id` OR new.`name` <> old.`name` OR new.`token_hmac` <> old.`token_hmac` OR new.`created_at` <> old.`created_at` OR new.`expires_at` <> old.`expires_at` OR new.`rate_limit_per_minute` <> old.`rate_limit_per_minute` OR (old.`revoked_at` IS NOT NULL AND new.`revoked_at` IS NOT old.`revoked_at`) OR (old.`revoked_by_user_id` IS NOT NULL AND new.`revoked_by_user_id` IS NOT old.`revoked_by_user_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.api_tokens_immutable_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS api_tokens_name_insert_guard;--> statement-breakpoint
CREATE TRIGGER `api_tokens_name_insert_guard` BEFORE INSERT ON `api_tokens` WHEN NEW.`name` <> trim(NEW.`name`) BEGIN SELECT RAISE(ABORT, 'database.trigger.api_tokens_name_insert_guard'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_delete_forbidden;--> statement-breakpoint
CREATE TRIGGER `audit_events_delete_forbidden` BEFORE DELETE ON `audit_events` BEGIN SELECT RAISE(ABORT, 'database.trigger.audit_events_delete_forbidden'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_update_forbidden;--> statement-breakpoint
CREATE TRIGGER `audit_events_update_forbidden` BEFORE UPDATE ON `audit_events` BEGIN SELECT RAISE(ABORT, 'database.trigger.audit_events_update_forbidden'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS clients_kind_before_insert;--> statement-breakpoint
CREATE TRIGGER `clients_kind_before_insert` BEFORE INSERT ON `clients` BEGIN SELECT RAISE(ABORT, 'database.trigger.clients_kind_before_insert') WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = NEW.`id` AND `users`.`kind` = 'client'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS document_artifacts_immutable_delete;--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_delete` BEFORE DELETE ON `document_artifacts` BEGIN SELECT RAISE(ABORT, 'database.trigger.document_artifacts_immutable_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS document_artifacts_immutable_update;--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_update` BEFORE UPDATE ON `document_artifacts` BEGIN SELECT RAISE(ABORT, 'database.trigger.document_artifacts_immutable_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_lines_no_delete;--> statement-breakpoint
CREATE TRIGGER `invoice_lines_no_delete` BEFORE DELETE ON `invoice_lines` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_lines_no_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_lines_no_update;--> statement-breakpoint
CREATE TRIGGER `invoice_lines_no_update` BEFORE UPDATE ON `invoice_lines` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_lines_no_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_pdf_jobs_business_relation_insert;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_insert` BEFORE INSERT ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_pdf_jobs_business_relation_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_pdf_jobs_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_update` BEFORE UPDATE OF `invoice_revision_id`, `invoice_id`, `invoice_number`, `version` ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_pdf_jobs_business_relation_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_revisions_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_business_relation_update` BEFORE UPDATE OF `invoice_id`, `version`, `invoice_number` ON `invoice_revisions` WHEN EXISTS (SELECT 1 FROM `invoice_pdf_jobs` WHERE `invoice_revision_id` = OLD.`id` AND (`invoice_id` <> NEW.`invoice_id` OR `version` <> NEW.`version` OR `invoice_number` <> NEW.`invoice_number`)) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_business_relation_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_revisions_no_delete;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_delete` BEFORE DELETE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_no_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_revisions_no_update;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update` BEFORE UPDATE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_no_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoices_business_relation_insert;--> statement-breakpoint
CREATE TRIGGER `invoices_business_relation_insert` BEFORE INSERT ON `invoices` WHEN NOT EXISTS (SELECT 1 FROM `orders` WHERE `id` = NEW.`order_id` AND `client_id` = NEW.`client_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoices_business_relation_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS invoices_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `invoices_business_relation_update` BEFORE UPDATE OF `order_id`, `client_id` ON `invoices` WHEN NOT EXISTS (SELECT 1 FROM `orders` WHERE `id` = NEW.`order_id` AND `client_id` = NEW.`client_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoices_business_relation_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_business_relation_insert;--> statement-breakpoint
CREATE TRIGGER `orders_business_relation_insert` BEFORE INSERT ON `orders` WHEN NOT EXISTS (SELECT 1 FROM `quotes` WHERE `id` = NEW.`quote_id` AND `client_id` = NEW.`client_id`) OR NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_signatures` WHERE `id` = NEW.`signature_id` AND `quote_id` = NEW.`quote_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.orders_business_relation_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_immutable_delete;--> statement-breakpoint
CREATE TRIGGER `orders_immutable_delete` BEFORE DELETE ON `orders` BEGIN SELECT RAISE(ABORT, 'database.trigger.orders_immutable_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_immutable_update;--> statement-breakpoint
CREATE TRIGGER `orders_immutable_update` BEFORE UPDATE ON `orders` BEGIN SELECT RAISE(ABORT, 'database.trigger.orders_immutable_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_invoice_lines_immutable_insert;--> statement-breakpoint
CREATE TRIGGER `published_invoice_lines_immutable_insert` BEFORE INSERT ON `invoice_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `invoice_revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_invoice_lines_immutable_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_quote_lines_immutable_delete;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_delete` BEFORE DELETE ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_lines_immutable_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_quote_lines_immutable_insert;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_insert` BEFORE INSERT ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_lines_immutable_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_quote_lines_immutable_update;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_update` BEFORE UPDATE ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_lines_immutable_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_quote_revisions_immutable_delete;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_delete` BEFORE DELETE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_revisions_immutable_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS published_quote_revisions_immutable_update;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update` BEFORE UPDATE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_revisions_immutable_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quote_links_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `quote_links_business_relation_update` BEFORE UPDATE OF `revision_id` ON `quote_links` WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `link_id` = OLD.`id` AND `revision_id` <> NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_links_business_relation_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quote_revisions_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `quote_revisions_business_relation_update` BEFORE UPDATE OF `quote_id` ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) OR EXISTS (SELECT 1 FROM `orders` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_revisions_business_relation_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quote_signatures_business_relation_insert;--> statement-breakpoint
CREATE TRIGGER `quote_signatures_business_relation_insert` BEFORE INSERT ON `quote_signatures` WHEN NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_links` WHERE `id` = NEW.`link_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_signatures_business_relation_insert'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quote_signatures_immutable_delete;--> statement-breakpoint
CREATE TRIGGER `quote_signatures_immutable_delete` BEFORE DELETE ON `quote_signatures` BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_signatures_immutable_delete'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quote_signatures_immutable_update;--> statement-breakpoint
CREATE TRIGGER `quote_signatures_immutable_update` BEFORE UPDATE ON `quote_signatures` BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_signatures_immutable_update'); END;--> statement-breakpoint
DROP TRIGGER IF EXISTS quotes_business_relation_update;--> statement-breakpoint
CREATE TRIGGER `quotes_business_relation_update` BEFORE UPDATE OF `client_id` ON `quotes` WHEN EXISTS (SELECT 1 FROM `orders` WHERE `quote_id` = OLD.`id` AND `client_id` <> NEW.`client_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quotes_business_relation_update'); END;
