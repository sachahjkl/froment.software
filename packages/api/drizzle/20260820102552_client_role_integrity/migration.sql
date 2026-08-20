INSERT INTO `roles` (`id`, `name`, `created_at`)
VALUES ('00000000000000000000000001', 'client', 1787216753000)
ON CONFLICT (`name`) DO NOTHING;
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, 'quote.read' FROM `roles` WHERE `name` = 'client';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, 'order.read' FROM `roles` WHERE `name` = 'client';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, 'invoice.read' FROM `roles` WHERE `name` = 'client';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `id`, 'document.download' FROM `roles` WHERE `name` = 'client';
--> statement-breakpoint
INSERT OR IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT `users`.`id`, `roles`.`id`
FROM `users`
CROSS JOIN `roles`
WHERE `users`.`kind` = 'client' AND `roles`.`name` = 'client';
