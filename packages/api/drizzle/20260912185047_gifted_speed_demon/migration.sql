CREATE TABLE `accounting_lettering` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`code` text NOT NULL UNIQUE,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	CONSTRAINT `fk_accounting_lettering_account_id_accounting_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts`(`id`),
	CONSTRAINT `fk_accounting_lettering_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_lettering_lines` (
	`lettering_id` text NOT NULL,
	`line_id` text NOT NULL UNIQUE,
	CONSTRAINT `accounting_lettering_lines_pk` PRIMARY KEY(`lettering_id`, `line_id`),
	CONSTRAINT `fk_accounting_lettering_lines_lettering_id_accounting_lettering_id_fk` FOREIGN KEY (`lettering_id`) REFERENCES `accounting_lettering`(`id`),
	CONSTRAINT `fk_accounting_lettering_lines_line_id_accounting_entry_lines_id_fk` FOREIGN KEY (`line_id`) REFERENCES `accounting_entry_lines`(`id`)
);
