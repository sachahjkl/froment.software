CREATE TABLE `bank_ledger_entries` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`debit_account` text NOT NULL,
	`credit_account` text NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`booked_on` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	`reverses_id` text UNIQUE,
	CONSTRAINT `fk_bank_ledger_entries_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "bank_ledger_kind_check" CHECK("source_kind" in ('debit', 'fee')),
	CONSTRAINT "bank_ledger_amount_check" CHECK("amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "bank_ledger_accounts_check" CHECK("debit_account" <> "credit_account")
);
--> statement-breakpoint
CREATE INDEX `bank_ledger_source_index` ON `bank_ledger_entries` (`source_kind`,`source_id`);--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('ledger.read'), ('ledger.post');--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT id, 'ledger.read' FROM roles WHERE name = 'administrator';--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT id, 'ledger.post' FROM roles WHERE name = 'administrator';--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT r.id, 'ledger.read' FROM roles r JOIN team_members m ON r.name = 'team-' || m.user_id WHERE m.profile = 'accountant';--> statement-breakpoint
CREATE TRIGGER bank_ledger_no_update BEFORE UPDATE ON bank_ledger_entries BEGIN SELECT RAISE(ABORT, 'database.trigger.ledger_immutable'); END;--> statement-breakpoint
CREATE TRIGGER bank_ledger_no_delete BEFORE DELETE ON bank_ledger_entries BEGIN SELECT RAISE(ABORT, 'database.trigger.ledger_immutable'); END;--> statement-breakpoint
CREATE TRIGGER bank_ledger_single_post BEFORE INSERT ON bank_ledger_entries WHEN NEW.reverses_id IS NULL AND EXISTS (
  SELECT 1 FROM bank_ledger_entries e WHERE e.source_kind = NEW.source_kind AND e.source_id = NEW.source_id AND e.reverses_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM bank_ledger_entries r WHERE r.reverses_id = e.id)
) BEGIN SELECT RAISE(ABORT, 'database.trigger.ledger_already_posted'); END;--> statement-breakpoint
CREATE TRIGGER bank_ledger_valid_reversal BEFORE INSERT ON bank_ledger_entries WHEN NEW.reverses_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bank_ledger_entries e WHERE e.id = NEW.reverses_id AND e.reverses_id IS NULL
  AND e.source_kind = NEW.source_kind AND e.source_id = NEW.source_id AND e.amount_cents = NEW.amount_cents
  AND e.debit_account = NEW.credit_account AND e.credit_account = NEW.debit_account AND e.booked_on <= NEW.booked_on
) BEGIN SELECT RAISE(ABORT, 'database.trigger.ledger_invalid_reversal'); END;
