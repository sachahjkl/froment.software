CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY,
	`jurisdiction` text NOT NULL,
	`functional_currency` text NOT NULL,
	`accounting_initialized` integer DEFAULT false NOT NULL,
	`fiscal_year_start_month` integer DEFAULT 1 NOT NULL,
	`fiscal_year_start_day` integer DEFAULT 1 NOT NULL,
	`default_fiscal_year_months` integer DEFAULT 12 NOT NULL,
	`enabled_modules` text NOT NULL,
	`retention_years` integer DEFAULT 10 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "company_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "company_settings_jurisdiction_check" CHECK("jurisdiction" = 'FR'),
	CONSTRAINT "company_settings_currency_check" CHECK("functional_currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "company_settings_initialized_check" CHECK("accounting_initialized" in (0, 1)),
	CONSTRAINT "company_settings_fiscal_start_check" CHECK("fiscal_year_start_month" between 1 and 12 and "fiscal_year_start_day" between 1 and 31),
	CONSTRAINT "company_settings_fiscal_months_check" CHECK("default_fiscal_year_months" = 12),
	CONSTRAINT "company_settings_modules_json_check" CHECK(json_valid("enabled_modules")),
	CONSTRAINT "company_settings_retention_check" CHECK("retention_years" >= 10),
	CONSTRAINT "company_settings_version_check" CHECK("version" between 1 and 9007199254740991)
);
--> statement-breakpoint
INSERT INTO `company_settings`
	(`id`, `jurisdiction`, `functional_currency`, `accounting_initialized`,
	 `fiscal_year_start_month`, `fiscal_year_start_day`, `default_fiscal_year_months`,
	 `enabled_modules`, `retention_years`, `version`, `updated_at`)
VALUES
	(1, 'FR', 'EUR', 0, 1, 1, 12, '["sales","purchasing","banking","accounting","tax"]', 10, 1, 0);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('company.read'), ('company.update');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, `permissions`.`code`
FROM `roles` CROSS JOIN `permissions`
WHERE `roles`.`name` = 'administrator' AND `permissions`.`code` LIKE 'company.%';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'company.read'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'company.update'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
WHERE `team_members`.`profile` = 'accountant';
