CREATE TABLE `accounting_accounts` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`system` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "accounting_accounts_code_check" CHECK("code" glob '[0-9][0-9]*' and length("code") between 2 and 20),
	CONSTRAINT "accounting_accounts_kind_check" CHECK("kind" in ('asset','liability','equity','income','expense')),
	CONSTRAINT "accounting_accounts_label_check" CHECK(length(trim("label")) between 1 and 160)
);
--> statement-breakpoint
CREATE TABLE `accounting_entries` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`journal_id` text NOT NULL,
	`period_id` text NOT NULL,
	`entry_date` text NOT NULL,
	`reference` text NOT NULL,
	`description` text NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reversal_of_entry_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`posted_at` integer,
	`posted_by_user_id` text,
	CONSTRAINT `fk_accounting_entries_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`),
	CONSTRAINT `fk_accounting_entries_period_id_accounting_periods_id_fk` FOREIGN KEY (`period_id`) REFERENCES `accounting_periods`(`id`),
	CONSTRAINT `fk_accounting_entries_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_accounting_entries_posted_by_user_id_users_id_fk` FOREIGN KEY (`posted_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "accounting_entries_status_check" CHECK("status" in ('draft','posted','reversed'))
);
--> statement-breakpoint
CREATE TABLE `accounting_entry_lines` (
	`id` text PRIMARY KEY,
	`entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`account_id` text NOT NULL,
	`label` text NOT NULL,
	`debit_cents` integer NOT NULL,
	`credit_cents` integer NOT NULL,
	CONSTRAINT `fk_accounting_entry_lines_entry_id_accounting_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `accounting_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_accounting_entry_lines_account_id_accounting_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts`(`id`),
	CONSTRAINT "accounting_lines_amount_check" CHECK("debit_cents" >= 0 and "credit_cents" >= 0 and ("debit_cents" = 0 or "credit_cents" = 0))
);
--> statement-breakpoint
CREATE TABLE `accounting_evidence` (
	`id` text PRIMARY KEY,
	`entry_id` text NOT NULL,
	`file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`content` blob NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	CONSTRAINT `fk_accounting_evidence_entry_id_accounting_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `accounting_entries`(`id`),
	CONSTRAINT `fk_accounting_evidence_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_journals` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "accounting_journals_kind_check" CHECK("kind" in ('sales','purchases','bank','general','opening'))
);
--> statement-breakpoint
CREATE TABLE `accounting_periods` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`final_closed` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "accounting_periods_dates_check" CHECK("ends_on" >= "starts_on"),
	CONSTRAINT "accounting_periods_status_check" CHECK("status" in ('open','locked','closed'))
);
--> statement-breakpoint
CREATE INDEX `accounting_entries_date_index` ON `accounting_entries` (`entry_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_lines_position_unique` ON `accounting_entry_lines` (`entry_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_evidence_sha_unique` ON `accounting_evidence` (`entry_id`,`sha256`);--> statement-breakpoint
INSERT INTO `accounting_accounts` (`id`,`code`,`label`,`kind`,`system`,`archived`,`version`,`created_at`,`updated_at`) VALUES
('01ARZ3NDEKTSV4RRFFQ69G5F00','101','Capital','equity',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F01','120','Résultat de l’exercice','equity',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F02','129','Résultat de l’exercice — perte','equity',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F03','401','Fournisseurs','liability',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F04','411','Clients','asset',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F05','44566','TVA déductible','asset',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F15','4452','TVA due intracommunautaire','liability',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F16','44551','TVA à décaisser','liability',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F06','44571','TVA collectée','liability',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F07','512','Banque','asset',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F08','606','Achats non stockés','expense',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F09','607','Achats de marchandises','expense',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F0A','706','Prestations de services','income',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F0B','707','Ventes de marchandises','income',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F0C','758','Produits divers','income',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F0D','768','Autres produits financiers','income',1,0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F0E','668','Autres charges financières','expense',1,0,1,0,0);--> statement-breakpoint
INSERT INTO `accounting_accounts` (`id`,`code`,`label`,`kind`,`system`,`archived`,`version`,`created_at`,`updated_at`) VALUES
('01ARZ3NDEKTSV4RRFFQ69G5F0F','627','Services bancaires','expense',1,0,1,0,0);--> statement-breakpoint
INSERT INTO `accounting_journals` (`id`,`code`,`label`,`kind`,`archived`,`version`,`created_at`,`updated_at`) VALUES
('01ARZ3NDEKTSV4RRFFQ69G5F10','VE','Ventes','sales',0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F11','AC','Achats','purchases',0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F12','BQ','Banque','bank',0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F13','OD','Opérations diverses','general',0,1,0,0),
('01ARZ3NDEKTSV4RRFFQ69G5F14','AN','À nouveaux','opening',0,1,0,0);--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES
('accounting.read'),
('accounting.write'),
('accounting.validate'),
('accounting.close'),
('accounting.export'),
('accounting.evidence'),
('demo.reset');--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, `permissions`.`code` FROM `roles` CROSS JOIN `permissions`
WHERE `roles`.`name` = 'administrator'
AND `permissions`.`code` IN ('accounting.read','accounting.write','accounting.validate','accounting.close','accounting.export','accounting.evidence','demo.reset');--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, `permissions`.`code` FROM `roles`
JOIN `team_members` ON `roles`.`name` = 'team-' || `team_members`.`user_id`
CROSS JOIN `permissions`
WHERE `team_members`.`profile` = 'accountant'
AND `permissions`.`code` IN ('accounting.read','accounting.write','accounting.export','accounting.evidence');--> statement-breakpoint
CREATE TRIGGER `accounting_entries_posted_immutable_delete` BEFORE DELETE ON `accounting_entries` WHEN OLD.`status` <> 'draft' BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_entries_posted_immutable_delete'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_entries_posted_immutable_update` BEFORE UPDATE ON `accounting_entries` WHEN OLD.`status` <> 'draft' AND NOT (OLD.`status` = 'posted' AND NEW.`status` = 'reversed' AND NEW.`version` = OLD.`version` + 1) BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_entries_posted_immutable_update'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_lines_posted_immutable_insert` BEFORE INSERT ON `accounting_entry_lines` WHEN EXISTS (SELECT 1 FROM `accounting_entries` WHERE `id` = NEW.`entry_id` AND `status` <> 'draft') BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_lines_posted_immutable_insert'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_lines_posted_immutable_update` BEFORE UPDATE ON `accounting_entry_lines` WHEN EXISTS (SELECT 1 FROM `accounting_entries` WHERE `id` = OLD.`entry_id` AND `status` <> 'draft') BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_lines_posted_immutable_update'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_lines_posted_immutable_delete` BEFORE DELETE ON `accounting_entry_lines` WHEN EXISTS (SELECT 1 FROM `accounting_entries` WHERE `id` = OLD.`entry_id` AND `status` <> 'draft') BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_lines_posted_immutable_delete'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_evidence_immutable_update` BEFORE UPDATE ON `accounting_evidence` BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_evidence_immutable_update'); END;--> statement-breakpoint
CREATE TRIGGER `accounting_evidence_immutable_delete` BEFORE DELETE ON `accounting_evidence` BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_evidence_immutable_delete'); END;
