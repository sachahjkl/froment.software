CREATE TABLE `integration_retries` (
	`operation_id` text PRIMARY KEY,
	`attempts` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`error` text,
	CONSTRAINT `fk_integration_retries_operation_id_integration_operations_id_fk` FOREIGN KEY (`operation_id`) REFERENCES `integration_operations`(`id`),
	CONSTRAINT "integration_retries_attempts_check" CHECK("attempts" between 0 and 5),
	CONSTRAINT "integration_retries_status_check" CHECK("status" in ('waiting', 'processing', 'completed', 'exhausted', 'blocked'))
);
--> statement-breakpoint
CREATE INDEX `integration_retries_due_index` ON `integration_retries` (`status`,`next_attempt_at`);