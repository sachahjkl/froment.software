CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY,
	`revision_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_invoice_lines_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT "invoice_lines_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_lines_position_check" CHECK("position" between 0 and 19),
	CONSTRAINT "invoice_lines_description_check" CHECK(length(trim("description")) between 1 and 160),
	CONSTRAINT "invoice_lines_input_check" CHECK("quantity_milli" between 1 and 9007199254740991 and "unit_price_cents" between 0 and 9007199254740991 and "vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "invoice_lines_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `invoice_number_counter` (
	`id` integer PRIMARY KEY,
	`next_value` integer NOT NULL,
	CONSTRAINT "invoice_number_counter_id_check" CHECK("id" = 1),
	CONSTRAINT "invoice_number_counter_next_value_check" CHECK("next_value" >= 1)
);
--> statement-breakpoint
CREATE TABLE `invoice_revisions` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`version` integer NOT NULL,
	`invoice_number` text,
	`issued_at` integer,
	`client_display_name` text NOT NULL,
	`title` text NOT NULL,
	`service_date` text NOT NULL,
	`due_date` text NOT NULL,
	`payment_terms` text NOT NULL,
	`currency` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_version` integer NOT NULL,
	`render_snapshot` text NOT NULL,
	CONSTRAINT `fk_invoice_revisions_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_revisions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_revisions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_revisions_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoice_revisions_number_check" CHECK(("invoice_number" is null and "issued_at" is null) or ("invoice_number" glob 'F-[0-9]*' and length("invoice_number") >= 8 and "issued_at" is not null)),
	CONSTRAINT "invoice_revisions_client_display_name_check" CHECK(length(trim("client_display_name")) > 0),
	CONSTRAINT "invoice_revisions_title_check" CHECK(length(trim("title")) between 1 and 120),
	CONSTRAINT "invoice_revisions_dates_check" CHECK("service_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and "due_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and "due_date" >= "service_date"),
	CONSTRAINT "invoice_revisions_payment_terms_check" CHECK(length("payment_terms") <= 2000),
	CONSTRAINT "invoice_revisions_currency_check" CHECK("currency" = 'EUR'),
	CONSTRAINT "invoice_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "invoice_revisions_render_check" CHECK("template_id" = 'invoice-default' and "template_version" = 1 and json_valid("render_snapshot"))
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`client_id` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`invoice_number` text,
	`issued_at` integer,
	`paid_at` integer,
	`voided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_invoices_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
	CONSTRAINT `fk_invoices_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "invoices_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoices_status_check" CHECK("status" in ('draft', 'issued', 'paid', 'void')),
	CONSTRAINT "invoices_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoices_number_state_check" CHECK(("status" = 'draft' and "invoice_number" is null and "issued_at" is null) or ("status" in ('issued', 'paid', 'void') and "invoice_number" glob 'F-[0-9]*' and length("invoice_number") >= 8 and "issued_at" is not null)),
	CONSTRAINT "invoices_terminal_state_check" CHECK(("status" = 'paid' and "paid_at" is not null and "voided_at" is null) or ("status" = 'void' and "voided_at" is not null and "paid_at" is null) or ("status" in ('draft', 'issued') and "paid_at" is null and "voided_at" is null)),
	CONSTRAINT "invoices_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_lines_revision_id_position_unique` ON `invoice_lines` (`revision_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_revisions_invoice_id_version_unique` ON `invoice_revisions` (`invoice_id`,`version`);--> statement-breakpoint
CREATE INDEX `invoice_revisions_created_by_user_id_index` ON `invoice_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_order_id_unique` ON `invoices` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_client_id_index` ON `invoices` (`client_id`);
--> statement-breakpoint
INSERT INTO `invoice_number_counter` (`id`, `next_value`) VALUES (1, 1);
--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update`
BEFORE UPDATE ON `invoice_revisions`
BEGIN
	SELECT RAISE(ABORT, 'invoice revisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_delete`
BEFORE DELETE ON `invoice_revisions`
BEGIN
	SELECT RAISE(ABORT, 'invoice revisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_lines_no_update`
BEFORE UPDATE ON `invoice_lines`
BEGIN
	SELECT RAISE(ABORT, 'invoice lines are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_lines_no_delete`
BEFORE DELETE ON `invoice_lines`
BEGIN
	SELECT RAISE(ABORT, 'invoice lines are append-only');
END;
