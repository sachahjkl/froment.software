CREATE TABLE `integration_operations` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`receipt` text,
	`created_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	CONSTRAINT `fk_integration_operations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('integration.manage');
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, 'integration.manage' FROM `roles` WHERE `name` = 'administrator';
--> statement-breakpoint
CREATE TRIGGER `integration_operations_update_guard`
BEFORE UPDATE ON `integration_operations`
WHEN NEW.id IS NOT OLD.id
  OR NEW.request_id IS NOT OLD.request_id
  OR NEW.request IS NOT OLD.request
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.created_by_user_id IS NOT OLD.created_by_user_id
  OR OLD.receipt IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Integration requests and completed receipts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_operations_delete_guard`
BEFORE DELETE ON `integration_operations`
BEGIN
  SELECT RAISE(ABORT, 'Integration operations are immutable');
END;
