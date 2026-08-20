CREATE TABLE `quote_links` (
	`id` text PRIMARY KEY,
	`revision_id` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `fk_quote_links_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "quote_links_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_links_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "quote_links_expiry_check" CHECK("expires_at" > "created_at"),
	CONSTRAINT "quote_links_revoked_at_check" CHECK("revoked_at" is null or "revoked_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_links_token_hmac_unique` ON `quote_links` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `quote_links_revision_id_index` ON `quote_links` (`revision_id`);