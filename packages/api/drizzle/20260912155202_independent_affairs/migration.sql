CREATE TABLE `affair_quotes` (
	`affair_id` text NOT NULL,
	`quote_id` text NOT NULL UNIQUE,
	`linked_at` integer NOT NULL,
	`linked_by_user_id` text NOT NULL,
	CONSTRAINT `affair_quotes_pk` PRIMARY KEY(`affair_id`, `quote_id`),
	CONSTRAINT `fk_affair_quotes_affair_id_affairs_id_fk` FOREIGN KEY (`affair_id`) REFERENCES `affairs`(`id`),
	CONSTRAINT `fk_affair_quotes_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`),
	CONSTRAINT `fk_affair_quotes_linked_by_user_id_users_id_fk` FOREIGN KEY (`linked_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `affairs` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`reference` text NOT NULL UNIQUE,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_affairs_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "affairs_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "affairs_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "affairs_reference_check" CHECK("reference" glob 'AF-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'),
	CONSTRAINT "affairs_title_check" CHECK(length(trim("title")) between 1 and 160),
	CONSTRAINT "affairs_status_check" CHECK("status" in ('open', 'closed')),
	CONSTRAINT "affairs_version_check" CHECK("version" >= 1),
	CONSTRAINT "affairs_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_business_reference_counters` (
	`kind` text NOT NULL,
	`year` integer NOT NULL,
	`next_value` integer NOT NULL,
	CONSTRAINT `business_reference_counters_pk` PRIMARY KEY(`kind`, `year`),
	CONSTRAINT "business_reference_counters_kind_check" CHECK("kind" in ('quote', 'order', 'invoice', 'credit-note', 'affair')),
	CONSTRAINT "business_reference_counters_year_check" CHECK("year" between 1 and 9999),
	CONSTRAINT "business_reference_counters_next_value_check" CHECK("next_value" between 1 and 1000000)
);
--> statement-breakpoint
INSERT INTO `__new_business_reference_counters`(`kind`, `year`, `next_value`) SELECT `kind`, `year`, `next_value` FROM `business_reference_counters`;--> statement-breakpoint
DROP TABLE `business_reference_counters`;--> statement-breakpoint
ALTER TABLE `__new_business_reference_counters` RENAME TO `business_reference_counters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `affair_quotes_affair_index` ON `affair_quotes` (`affair_id`);--> statement-breakpoint
CREATE INDEX `affairs_client_index` ON `affairs` (`client_id`);
--> statement-breakpoint
INSERT INTO affairs
  (id, request_id, reference, client_id, title, status, version, created_at, updated_at)
SELECT ranked.id,
  lower(substr(hex(randomblob(16)), 1, 8) || '-' || substr(hex(randomblob(16)), 1, 4) || '-4' || substr(hex(randomblob(16)), 1, 3) || '-8' || substr(hex(randomblob(16)), 1, 3) || '-' || substr(hex(randomblob(16)), 1, 12)),
  'AF-' || ranked.year || '-' || printf('%06d', ranked.sequence),
  ranked.client_id,
  ranked.title,
  ranked.status,
  1,
  ranked.created_at,
  ranked.updated_at
FROM (
  SELECT q.id, q.client_id, r.title, q.created_at, q.updated_at,
    substr(q.reference, 4, 4) as year,
    row_number() over (partition by substr(q.reference, 4, 4) order by q.created_at, q.id) as sequence,
    case when q.status in ('rejected', 'expired', 'cancelled') then 'closed' else 'open' end as status
  FROM quotes q
  JOIN quote_revisions r ON r.quote_id = q.id AND r.version = q.version
) ranked;
--> statement-breakpoint
INSERT INTO affair_quotes (affair_id, quote_id, linked_at, linked_by_user_id)
SELECT q.id, q.id, q.created_at,
  coalesce((select actor_user_id from audit_events where resource_type = 'quote' and resource_id = q.id and actor_user_id is not null order by occurred_at limit 1), q.client_id)
FROM quotes q;
--> statement-breakpoint
INSERT INTO business_reference_counters (kind, year, next_value)
SELECT 'affair', cast(substr(reference, 4, 4) as integer), count(*) + 1
FROM affairs
GROUP BY substr(reference, 4, 4);
--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('affair.read'), ('affair.create'), ('affair.update');
--> statement-breakpoint
INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
SELECT roles.id, permissions.code
FROM roles CROSS JOIN permissions
WHERE roles.name = 'administrator' AND permissions.code IN ('affair.read', 'affair.create', 'affair.update');
