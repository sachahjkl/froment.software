CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY,
	`action` text NOT NULL,
	`actor_user_id` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`metadata` text NOT NULL,
	CONSTRAINT "audit_events_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "audit_events_actor_user_id_check" CHECK("actor_user_id" is null or (length("actor_user_id") = 26 and "actor_user_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("actor_user_id", 1, 1) between '0' and '7')),
	CONSTRAINT "audit_events_action_check" CHECK(length("action") between 3 and 80 and "action" glob '[a-z]*.[a-z]*' and "action" not glob '*[^a-z.-]*'),
	CONSTRAINT "audit_events_resource_type_check" CHECK(length("resource_type") between 1 and 40 and "resource_type" not glob '*[^a-z-]*'),
	CONSTRAINT "audit_events_resource_id_check" CHECK(length(trim("resource_id")) between 1 and 160),
	CONSTRAINT "audit_events_metadata_check" CHECK(json_valid("metadata") and json_type("metadata") = 'object' and length("metadata") <= 4096)
);
--> statement-breakpoint
CREATE INDEX `audit_events_occurred_at_id_index` ON `audit_events` (`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_user_id_index` ON `audit_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_resource_index` ON `audit_events` (`resource_type`,`resource_id`);
--> statement-breakpoint
CREATE TRIGGER `audit_events_update_forbidden`
BEFORE UPDATE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_events_delete_forbidden`
BEFORE DELETE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'audit events are append-only');
END;
