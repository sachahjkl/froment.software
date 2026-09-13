PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supplier_payment_batch_items` (
	`batch_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`functional_amount_cents` integer NOT NULL,
	CONSTRAINT `supplier_payment_batch_items_pk` PRIMARY KEY(`batch_id`, `invoice_id`),
	CONSTRAINT `fk_supplier_payment_batch_items_batch_id_supplier_payment_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `supplier_payment_batches`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_supplier_payment_batch_items_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`),
	CONSTRAINT "supplier_payment_batch_items_amount_check" CHECK("amount_cents" > 0),
	CONSTRAINT "supplier_payment_batch_items_functional_amount_check" CHECK("functional_amount_cents" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_supplier_payment_batch_items`(`batch_id`, `invoice_id`, `amount_cents`, `functional_amount_cents`)
SELECT item.`batch_id`, item.`invoice_id`, item.`amount_cents`,
  invoice.`functional_total_cents` - coalesce((
    SELECT sum(credit.`functional_total_cents`)
    FROM `supplier_invoices` credit
    WHERE credit.`source_invoice_id` = invoice.`id`
      AND credit.`document_kind` = 'credit'
      AND credit.`status` IN ('approved', 'paid')
  ), 0)
FROM `supplier_payment_batch_items` item
JOIN `supplier_invoices` invoice ON invoice.`id` = item.`invoice_id`;--> statement-breakpoint
DROP TABLE `supplier_payment_batch_items`;--> statement-breakpoint
ALTER TABLE `__new_supplier_payment_batch_items` RENAME TO `supplier_payment_batch_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `supplier_payment_batch_items_invoice_id_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_payment_batch_items_invoice_id_unique` ON `supplier_payment_batch_items` (`invoice_id`);
