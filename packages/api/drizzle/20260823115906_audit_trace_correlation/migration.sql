ALTER TABLE `audit_events` ADD `request_id` text;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `trace_id` text;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `span_id` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_events` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`actor_user_id` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`request_id` text,
	`trace_id` text,
	`span_id` text,
	`occurred_at` integer NOT NULL,
	`metadata` text NOT NULL,
	CONSTRAINT "audit_events_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "audit_events_actor_user_id_check" CHECK("actor_user_id" is null or (length("actor_user_id") = 26 and "actor_user_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("actor_user_id", 1, 1) between '0' and '7')),
	CONSTRAINT "audit_events_action_check" CHECK(length("action") between 3 and 80 and "action" glob '[a-z]*.[a-z]*' and "action" not glob '*[^a-z.-]*'),
	CONSTRAINT "audit_events_resource_type_check" CHECK(length("resource_type") between 1 and 40 and "resource_type" not glob '*[^a-z-]*'),
	CONSTRAINT "audit_events_resource_id_check" CHECK(length(trim("resource_id")) between 1 and 160),
	CONSTRAINT "audit_events_request_id_check" CHECK("request_id" is null or (length("request_id") = 36 and "request_id" glob '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-4[0-9a-f][0-9a-f][0-9a-f]-[89ab][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]')),
	CONSTRAINT "audit_events_trace_id_check" CHECK("trace_id" is null or (length("trace_id") = 32 and "trace_id" not glob '*[^0-9a-f]*')),
	CONSTRAINT "audit_events_span_id_check" CHECK("span_id" is null or (length("span_id") = 16 and "span_id" not glob '*[^0-9a-f]*')),
	CONSTRAINT "audit_events_metadata_check" CHECK(json_valid("metadata") and json_type("metadata") = 'object' and length("metadata") <= 4096)
);
--> statement-breakpoint
INSERT INTO `__new_audit_events`(`id`, `action`, `actor_user_id`, `resource_type`, `resource_id`, `occurred_at`, `metadata`) SELECT `id`, `action`, `actor_user_id`, `resource_type`, `resource_id`, `occurred_at`, `metadata` FROM `audit_events`;--> statement-breakpoint
DROP TABLE `audit_events`;--> statement-breakpoint
ALTER TABLE `__new_audit_events` RENAME TO `audit_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_events_occurred_at_id_index` ON `audit_events` (`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_user_id_index` ON `audit_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_resource_index` ON `audit_events` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_events_request_id_index` ON `audit_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `audit_events_trace_id_index` ON `audit_events` (`trace_id`);--> statement-breakpoint
CREATE TRIGGER `audit_events_delete_forbidden` BEFORE DELETE ON `audit_events` BEGIN SELECT RAISE(ABORT, 'database.trigger.audit_events_delete_forbidden'); END;--> statement-breakpoint
CREATE TRIGGER `audit_events_update_forbidden` BEFORE UPDATE ON `audit_events` BEGIN SELECT RAISE(ABORT, 'database.trigger.audit_events_update_forbidden'); END;
