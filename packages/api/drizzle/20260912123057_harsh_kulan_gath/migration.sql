CREATE TABLE `supplier_invoice_lines` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_supplier_invoice_lines_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`) ON DELETE CASCADE,
	CONSTRAINT "supplier_invoice_lines_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "supplier_invoice_lines_position_check" CHECK("position" >= 0),
	CONSTRAINT "supplier_invoice_lines_description_check" CHECK(length(trim("description")) between 1 and 500),
	CONSTRAINT "supplier_invoice_lines_amounts_check" CHECK("net_total_cents" >= 0 and "vat_rate_basis_points" between 0 and 10000 and "vat_total_cents" >= 0 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `supplier_invoices` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`supplier_id` text NOT NULL,
	`reference` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`currency` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text NOT NULL,
	`source_file_name` text,
	`external_submission_id` text,
	`confirmed_at` integer,
	`approved_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_supplier_invoices_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
	CONSTRAINT `fk_supplier_invoices_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_invoices_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "supplier_invoices_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "supplier_invoices_request_json_check" CHECK(json_valid("request")),
	CONSTRAINT "supplier_invoices_reference_check" CHECK(length(trim("reference")) between 1 and 80),
	CONSTRAINT "supplier_invoices_dates_check" CHECK("invoice_date" glob '????-??-??' and "due_date" glob '????-??-??' and "due_date" >= "invoice_date"),
	CONSTRAINT "supplier_invoices_currency_check" CHECK("currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "supplier_invoices_totals_check" CHECK("net_total_cents" >= 0 and "vat_total_cents" >= 0 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "supplier_invoices_status_check" CHECK("status" in ('draft', 'confirmed', 'approved', 'paid', 'cancelled')),
	CONSTRAINT "supplier_invoices_source_check" CHECK("source" in ('manual', 'ocr')),
	CONSTRAINT "supplier_invoices_version_check" CHECK("version" > 0),
	CONSTRAINT "supplier_invoices_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_invoice_lines_position_unique` ON `supplier_invoice_lines` (`invoice_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_invoices_supplier_reference_unique` ON `supplier_invoices` (`supplier_id`,`reference`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_due_date_index` ON `supplier_invoices` (`due_date`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_status_index` ON `supplier_invoices` (`status`);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES
	('supplier-invoice.read'),
	('supplier-invoice.create'),
	('supplier-invoice.update'),
	('supplier-invoice.approve');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, `permissions`.`code`
FROM `roles` CROSS JOIN `permissions`
WHERE `roles`.`name` = 'administrator' AND `permissions`.`code` LIKE 'supplier-invoice.%';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, `permissions`.`code`
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
CROSS JOIN `permissions`
WHERE `team_members`.`profile` = 'accountant'
	AND `permissions`.`code` LIKE 'supplier-invoice.%';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, `permissions`.`code`
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
CROSS JOIN `permissions`
WHERE `team_members`.`profile` = 'collaborator'
	AND `permissions`.`code` IN ('supplier-invoice.read', 'supplier-invoice.create', 'supplier-invoice.update');
