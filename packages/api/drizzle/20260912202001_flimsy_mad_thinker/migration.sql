PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supplier_invoice_lines` (
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
	CONSTRAINT "supplier_invoice_lines_amounts_check" CHECK("net_total_cents" >= 0 and "vat_rate_basis_points" between 0 and 10000 and "vat_total_cents" >= 0 and "total_cents" in ("net_total_cents", "net_total_cents" + "vat_total_cents"))
);
--> statement-breakpoint
INSERT INTO `__new_supplier_invoice_lines`(`id`, `invoice_id`, `position`, `description`, `net_total_cents`, `vat_rate_basis_points`, `vat_total_cents`, `total_cents`) SELECT `id`, `invoice_id`, `position`, `description`, `net_total_cents`, `vat_rate_basis_points`, `vat_total_cents`, `total_cents` FROM `supplier_invoice_lines`;--> statement-breakpoint
DROP TABLE `supplier_invoice_lines`;--> statement-breakpoint
ALTER TABLE `__new_supplier_invoice_lines` RENAME TO `supplier_invoice_lines`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_invoice_lines_position_unique` ON `supplier_invoice_lines` (`invoice_id`,`position`);
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_lines_tax_total_insert` BEFORE INSERT ON `supplier_invoice_lines`
WHEN NOT EXISTS (
	SELECT 1 FROM `supplier_invoices` i
	WHERE i.`id` = NEW.`invoice_id`
	AND (
		(i.`tax_treatment` IN ('eu-reverse-charge', 'non-eu-import') AND NEW.`total_cents` = NEW.`net_total_cents`)
		OR (i.`tax_treatment` IN ('france', 'foreign-local-tax') AND NEW.`total_cents` = NEW.`net_total_cents` + NEW.`vat_total_cents`)
	)
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_lines_tax_total_insert'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_lines_tax_total_update` BEFORE UPDATE ON `supplier_invoice_lines`
WHEN NOT EXISTS (
	SELECT 1 FROM `supplier_invoices` i
	WHERE i.`id` = NEW.`invoice_id`
	AND (
		(i.`tax_treatment` IN ('eu-reverse-charge', 'non-eu-import') AND NEW.`total_cents` = NEW.`net_total_cents`)
		OR (i.`tax_treatment` IN ('france', 'foreign-local-tax') AND NEW.`total_cents` = NEW.`net_total_cents` + NEW.`vat_total_cents`)
	)
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_lines_tax_total_update'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_lines_confirmed_insert` BEFORE INSERT ON `supplier_invoice_lines`
WHEN EXISTS (SELECT 1 FROM `supplier_invoices` i WHERE i.`id` = NEW.`invoice_id` AND i.`status` <> 'draft')
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_lines_confirmed_insert'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_lines_confirmed_update` BEFORE UPDATE ON `supplier_invoice_lines`
WHEN EXISTS (SELECT 1 FROM `supplier_invoices` i WHERE i.`id` = OLD.`invoice_id` AND i.`status` <> 'draft')
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_lines_confirmed_update'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_lines_confirmed_delete` BEFORE DELETE ON `supplier_invoice_lines`
WHEN EXISTS (SELECT 1 FROM `supplier_invoices` i WHERE i.`id` = OLD.`invoice_id` AND i.`status` <> 'draft')
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_lines_confirmed_delete'); END;
