CREATE TABLE `supplier_invoice_analysis_settings` (
	`id` integer PRIMARY KEY,
	`adapter` text NOT NULL,
	`endpoint` text,
	`encrypted_api_key` text,
	`encryption_iv` text,
	`encryption_tag` text,
	`updated_at` integer,
	CONSTRAINT "supplier_invoice_analysis_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "supplier_invoice_analysis_settings_adapter_check" CHECK("adapter" in ('local', 'http')),
	CONSTRAINT "supplier_invoice_analysis_settings_encryption_check" CHECK(("encrypted_api_key" is null and "encryption_iv" is null and "encryption_tag" is null) or ("encrypted_api_key" is not null and "encryption_iv" is not null and "encryption_tag" is not null))
);
--> statement-breakpoint
CREATE TABLE `supplier_invoice_analysis_submissions` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`invoice_id` text,
	`supplier_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`adapter` text NOT NULL,
	`endpoint_host` text,
	`file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`content_sha256` text NOT NULL,
	`content_bytes` integer NOT NULL,
	`consent_at` integer,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_supplier_invoice_analysis_submissions_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`),
	CONSTRAINT `fk_supplier_invoice_analysis_submissions_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
	CONSTRAINT `fk_supplier_invoice_analysis_submissions_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_invoice_analysis_submissions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "supplier_invoice_analysis_submissions_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "supplier_invoice_analysis_submissions_hash_check" CHECK(length("content_sha256") = 64),
	CONSTRAINT "supplier_invoice_analysis_submissions_size_check" CHECK("content_bytes" > 0),
	CONSTRAINT "supplier_invoice_analysis_submissions_status_check" CHECK("status" in ('submitted', 'completed', 'failed'))
);
--> statement-breakpoint
INSERT INTO `supplier_invoice_analysis_settings` (`id`, `adapter`) VALUES (1, 'local');
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('supplier-invoice.analyze');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, 'supplier-invoice.analyze'
FROM `roles`
WHERE `roles`.`name` = 'administrator';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'supplier-invoice.analyze'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
WHERE `team_members`.`profile` IN ('accountant', 'collaborator');
